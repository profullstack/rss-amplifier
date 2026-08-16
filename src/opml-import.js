/**
 * OPML import.
 *
 * Reads an OPML file line by line rather than parsing it into a DOM. The
 * catalogue this was built for is a 7.4 MB file holding 47,000 outlines, and
 * handing that to an XML parser builds a tree several times the size of the
 * file before a single feed has been stored — for a document whose useful
 * content is two attributes per line.
 *
 * Streaming keeps memory flat no matter how large the file gets, and feeds are
 * handed to the caller in batches so they can be committed as they arrive
 * instead of accumulating a 47,000-element array first.
 */

import fs from 'node:fs';
import readline from 'node:readline';

/** Pulls one attribute out of an outline element. Handles both quote styles. */
function attribute(line, name) {
  const match =
    line.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) ??
    line.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'));
  return match?.[1];
}

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

/** OPML attributes are XML-escaped; a title with an ampersand is common. */
export function decodeEntities(value) {
  if (!value) return value;
  return value
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/**
 * Normalises a feed URL enough to dedupe on it.
 *
 * The same feed reached as `http://` and `https://`, or with and without a
 * trailing slash, is one feed — and storing it twice means fetching it twice
 * forever. The scheme is deliberately *not* forced to https: plenty of small
 * sites only serve http, and rewriting them produces a feed that never loads.
 */
export function normaliseFeedUrl(raw) {
  if (typeof raw !== 'string') return undefined;
  const trimmed = decodeEntities(raw.trim());
  if (!trimmed) return undefined;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (!url.hostname.includes('.')) return undefined;

  url.hash = '';
  // A trailing slash on a path is meaningless here, but the root itself keeps
  // one so `https://example.com/` does not become an invalid bare origin.
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/**
 * Parses one OPML outline line into a feed, or returns nothing.
 *
 * Container outlines — the folders an OPML uses for grouping — carry no
 * `xmlUrl` and are skipped rather than treated as feeds.
 */
export function parseOutline(line) {
  const xmlUrl = attribute(line, 'xmlUrl');
  if (!xmlUrl) return undefined;

  const feedUrl = normaliseFeedUrl(xmlUrl);
  if (!feedUrl) return undefined;

  const title = decodeEntities(attribute(line, 'title') ?? attribute(line, 'text') ?? '');
  const htmlUrl = attribute(line, 'htmlUrl');

  return {
    feedUrl,
    title: title || undefined,
    siteUrl: htmlUrl ? decodeEntities(htmlUrl) : undefined,
  };
}

/**
 * Streams an OPML file, yielding batches of feeds.
 *
 * `onBatch` is awaited, so a caller that writes to a database applies
 * backpressure simply by taking its time — the file is not read faster than
 * the feeds can be stored.
 */
export async function importOpmlFile(filePath, onBatch, { batchSize = 1000 } = {}) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let batch = [];
  let total = 0;
  let malformed = 0;
  // Dedupe within the file itself. The database also refuses duplicates, but
  // catching them here avoids the round trip for a catalogue that genuinely
  // does list some feeds twice.
  const seen = new Set();

  for await (const line of lines) {
    if (!line.includes('xmlUrl')) continue;

    // One line can hold several outlines when the file is not pretty-printed.
    for (const fragment of line.split('<outline')) {
      if (!fragment.includes('xmlUrl')) continue;

      const feed = parseOutline(fragment);
      if (!feed) {
        malformed += 1;
        continue;
      }

      if (seen.has(feed.feedUrl)) continue;
      seen.add(feed.feedUrl);

      batch.push(feed);
      total += 1;

      if (batch.length >= batchSize) {
        await onBatch(batch);
        batch = [];
      }
    }
  }

  if (batch.length > 0) await onBatch(batch);

  return { total, malformed, unique: seen.size };
}
