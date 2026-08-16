/**
 * The polling daemon.
 *
 * Keeping 47,000 feeds current is only affordable if almost every check costs
 * nothing. Five things make that true, and each one is doing real work:
 *
 *   1. **A small batch, always.** Eight feeds are in flight at a time. Never
 *      eight thousand. The queue is an index on `next_fetch_at`, so "what is
 *      due" is a cheap indexed read rather than a scan of the catalogue.
 *   2. **Conditional GET.** Every feed remembers its `ETag` and
 *      `Last-Modified`. A server that answers `304 Not Modified` costs a few
 *      hundred bytes and no parsing at all, which is what the overwhelming
 *      majority of polls should be.
 *   3. **Adaptive intervals.** A feed that keeps returning nothing new is
 *      checked progressively less often, up to a day. A feed that publishes
 *      every time we look is checked more often. The catalogue converges on
 *      spending its effort where things actually change.
 *   4. **Backoff and eviction.** Dead domains are the single largest source of
 *      waste in a catalogue this size. Failures back off exponentially, and a
 *      feed that fails enough times in a row is deactivated rather than
 *      retried forever.
 *   5. **Idle between batches.** The loop sleeps between batches and sleeps
 *      longer when nothing is due, so a caught-up daemon is close to free.
 *
 * There is deliberately no job queue and no Redis. The database *is* the
 * queue — `next_fetch_at` is the cursor — which means the daemon can be killed
 * at any moment and resumes exactly where it stopped.
 */

import { createHash } from 'node:crypto';
import { FeedStore } from './feed-store.js';

export const DEFAULTS = {
  /** Feeds fetched concurrently. The main politeness and memory knob. */
  batchSize: 8,
  /** Pause between batches, so the loop yields the machine. */
  batchDelayMs: 2_000,
  /** Sleep when nothing is due at all. */
  idleDelayMs: 60_000,
  /** Per-request timeout. A hung server must not stall a batch. */
  timeoutMs: 15_000,
  /** Hard cap on a downloaded feed. Some "feeds" are enormous. */
  maxBytes: 4 * 1024 * 1024,
  /** Interval bounds, in minutes. */
  minIntervalMin: 30,
  maxIntervalMin: 1440,
  baseIntervalMin: 360,
  /** Consecutive failures before a feed is switched off. */
  maxFailures: 8,
  /** Never hit the same host more than once per batch. */
  hostCooldownMs: 5_000,
  retentionDays: 30,
  userAgent: 'RSS-Amplifier/1.0 (+https://rssamplifier.com; feed poller)',
};

/** Sleep that can be cut short when the daemon is stopping. */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Fetches one feed, honouring its stored validators.
 *
 * Returns `{ notModified: true }` for a 304, which is the cheap path the whole
 * design leans on. The body is read as a stream with a byte cap so a
 * misconfigured server cannot hand back a gigabyte and take the daemon with it.
 */
export async function fetchFeed(feed, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const headers = { 'user-agent': config.userAgent, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' };

  if (feed.etag) headers['if-none-match'] = feed.etag;
  if (feed.last_modified) headers['if-modified-since'] = feed.last_modified;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(feed.feed_url, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    if (response.status === 304) {
      return { notModified: true, status: 304 };
    }

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }

    // Read with a cap rather than `response.text()`, which would buffer
    // whatever the server decided to send.
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, status: response.status, error: 'empty body' };

    const chunks = [];
    let size = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > config.maxBytes) {
        await reader.cancel();
        return { ok: false, status: response.status, error: 'feed exceeds size limit' };
      }
      chunks.push(value);
    }

    const body = Buffer.concat(chunks).toString('utf8');

    return {
      ok: true,
      status: response.status,
      body,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined,
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'timed out' : (error?.message ?? String(error));
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

const TAG = (name) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');

function stripCdata(value) {
  return value?.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

function decode(value) {
  if (!value) return value;
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    // Ampersand last, or a double-escaped entity decodes twice.
    .replace(/&amp;/g, '&');
}

function field(block, ...names) {
  for (const name of names) {
    const match = block.match(TAG(name));
    if (match?.[1]) {
      const value = decode(stripCdata(match[1]).replace(/<[^>]+>/g, '').trim());
      if (value) return value;
    }
  }
  return undefined;
}

/**
 * Parses RSS or Atom into articles.
 *
 * Regex rather than a full XML parser, for the same reason the OPML import
 * streams: this runs across tens of thousands of documents and only ever needs
 * a handful of fields from each. It is tolerant of the malformed markup that
 * is completely normal in the wild, where a strict parser would simply reject
 * the feed and lose it.
 */
export function parseFeed(xml) {
  if (!xml || typeof xml !== 'string') return { kind: 'unknown', articles: [] };

  // A podcast is an RSS feed carrying the iTunes namespace and enclosures.
  const isPodcast =
    /xmlns:itunes\s*=/i.test(xml) || /<itunes:(?:author|category|image|duration)/i.test(xml);

  const head = xml.slice(0, 4000);
  const title = field(head, 'title');
  const description = field(head, 'description', 'subtitle');

  const linkMatch =
    head.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
    head.match(/<link>\s*([^<\s][^<]*)<\/link>/i);
  const siteUrl = linkMatch?.[1]?.trim();

  const articles = [];
  // `<entry` matched bare would also match `<entryFoo`; requiring a boundary
  // avoids that, and Atom entries routinely carry attributes such as xml:base.
  const itemPattern = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[2];

    const link =
      field(block, 'link') ??
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];

    const guid = field(block, 'guid', 'id') ?? link;
    if (!guid) continue;

    const published = field(block, 'pubDate', 'published', 'updated', 'dc:date');

    articles.push({
      guid: guid.slice(0, 500),
      title: field(block, 'title')?.slice(0, 500),
      link: link?.slice(0, 1000),
      author: field(block, 'author', 'dc:creator', 'itunes:author')?.slice(0, 200),
      summary: field(block, 'description', 'summary', 'content')?.slice(0, 2000),
      publishedAt: toIso(published),
    });

    // A feed with thousands of items is an archive dump; the recent ones are
    // what matter and reading them all would blow the memory budget.
    if (articles.length >= 100) break;
  }

  return {
    kind: isPodcast ? 'podcast' : 'blog',
    title,
    description,
    siteUrl,
    articles,
  };
}

/** Dates in the wild are unreliable; a future one is clamped to now. */
function toIso(value) {
  if (!value) return undefined;
  const stamp = Date.parse(value);
  if (Number.isNaN(stamp)) return undefined;
  return new Date(Math.min(stamp, Date.now())).toISOString();
}

/**
 * Chooses when to look at a feed again.
 *
 * Something new means look sooner; nothing new means look later. The bounds
 * stop either direction running away, and the result is that effort
 * concentrates on feeds that actually publish.
 */
export function nextInterval(current, { newArticles, notModified }, config = DEFAULTS) {
  const base = current || config.baseIntervalMin;

  if (newArticles > 0) {
    return Math.max(config.minIntervalMin, Math.round(base / 2));
  }

  // A 304 is a definite "nothing changed" and can back off harder than an
  // ambiguous empty parse.
  const factor = notModified ? 1.5 : 1.25;
  return Math.min(config.maxIntervalMin, Math.round(base * factor));
}

/** Exponential backoff on failure, so a dead host is retried rarely. */
export function failureInterval(failures, config = DEFAULTS) {
  const minutes = config.baseIntervalMin * 2 ** Math.min(failures, 5);
  return Math.min(config.maxIntervalMin, minutes);
}

/**
 * Runs one batch: claim what is due, fetch it, store what came back.
 *
 * Returns counts rather than logging, so the caller decides how loud to be.
 */
export async function runBatch(store, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const due = store.claimDue(config.batchSize);

  if (due.length === 0) return { claimed: 0, updated: 0, unchanged: 0, failed: 0, newArticles: 0 };

  // One feed per host per batch. Several thousand of these feeds share a
  // handful of hosting providers, and a batch that happened to draw eight
  // feeds from one host would hit it eight times at once.
  const hosts = new Set();
  const batch = [];
  for (const feed of due) {
    let host;
    try {
      host = new URL(feed.feed_url).hostname;
    } catch {
      host = feed.feed_url;
    }
    if (hosts.has(host)) continue;
    hosts.add(host);
    batch.push(feed);
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let newArticles = 0;

  const results = await Promise.all(
    batch.map(async (feed) => ({ feed, result: await fetchFeed(feed, config) })),
  );

  for (const { feed, result } of results) {
    if (result.notModified) {
      unchanged += 1;
      store.recordSuccess(feed.id, {
        intervalMin: nextInterval(feed.interval_min, { newArticles: 0, notModified: true }, config),
        status: 304,
        etag: feed.etag,
        lastModified: feed.last_modified,
        contentHash: feed.content_hash,
      });
      continue;
    }

    if (!result.ok) {
      failed += 1;
      const failures = (feed.consecutive_failures ?? 0) + 1;
      store.recordFailure(feed.id, {
        error: result.error,
        status: result.status,
        intervalMin: failureInterval(failures, config),
        deactivate: failures >= config.maxFailures,
      });
      continue;
    }

    // Some servers neither send validators nor honour conditional requests.
    // Hashing the body gives them the same cheap "nothing changed" path.
    const hash = createHash('sha1').update(result.body).digest('hex');

    if (hash === feed.content_hash) {
      unchanged += 1;
      store.recordSuccess(feed.id, {
        intervalMin: nextInterval(feed.interval_min, { newArticles: 0, notModified: true }, config),
        status: result.status,
        etag: result.etag ?? feed.etag,
        lastModified: result.lastModified ?? feed.last_modified,
        contentHash: hash,
      });
      continue;
    }

    const parsed = parseFeed(result.body);
    const added = store.addArticles(feed.id, parsed.articles);
    newArticles += added;
    updated += 1;

    store.recordSuccess(feed.id, {
      intervalMin: nextInterval(feed.interval_min, { newArticles: added, notModified: false }, config),
      status: result.status,
      etag: result.etag,
      lastModified: result.lastModified,
      contentHash: hash,
      title: parsed.title,
      siteUrl: parsed.siteUrl,
      description: parsed.description,
      kind: parsed.kind,
    });
  }

  return { claimed: batch.length, updated, unchanged, failed, newArticles };
}

/**
 * The daemon loop.
 *
 * Stops cleanly on SIGINT/SIGTERM, mid-batch if need be: the database holds no
 * claim on a feed beyond its `next_fetch_at`, so nothing is left stuck.
 */
export class FeedDaemon {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.store = options.store ?? new FeedStore({ dbPath: options.dbPath });
    this.ownsStore = !options.store;
    this.controller = new AbortController();
    this.running = false;
    this.totals = { batches: 0, updated: 0, unchanged: 0, failed: 0, newArticles: 0 };
    this.lastPrune = 0;
  }

  stop() {
    this.running = false;
    this.controller.abort();
  }

  async start({ onTick } = {}) {
    this.running = true;

    while (this.running) {
      let result;
      try {
        result = await runBatch(this.store, this.config);
      } catch (error) {
        // A bad batch must never kill the daemon; the next one will retry.
        result = { claimed: 0, error: error?.message ?? String(error) };
      }

      this.totals.batches += 1;
      this.totals.updated += result.updated ?? 0;
      this.totals.unchanged += result.unchanged ?? 0;
      this.totals.failed += result.failed ?? 0;
      this.totals.newArticles += result.newArticles ?? 0;

      onTick?.(result, this.totals);

      // Pruning is a whole-table delete, so it runs once an hour rather than
      // once a batch.
      if (Date.now() - this.lastPrune > 3_600_000) {
        this.lastPrune = Date.now();
        try {
          this.store.pruneArticles(this.config.retentionDays);
        } catch {
          // Retention is housekeeping; failing it must not stop polling.
        }
      }

      if (!this.running) break;

      // Nothing due means the catalogue is current — sleep properly rather
      // than spinning on an empty query.
      const delay = result.claimed === 0 ? this.config.idleDelayMs : this.config.batchDelayMs;
      await sleep(delay, this.controller.signal);
    }

    if (this.ownsStore) this.store.close();
    return this.totals;
  }
}
