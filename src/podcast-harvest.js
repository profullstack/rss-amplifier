/**
 * Podcast discovery, via the iTunes Search API.
 *
 * The same source `media-streamer` uses, and for the same reasons: it is free,
 * needs no key, works server-to-server, and — the part that matters here — it
 * returns the actual `feedUrl` for every result, which is the one thing a
 * poller needs and most podcast directories will not give you.
 *
 * There is no bulk export, so a large catalogue is assembled from many small
 * searches: a spread of genres and terms, deduplicated by feed URL. That has
 * two consequences the code has to respect:
 *
 *   - **It must be paced.** Apple rate-limits this endpoint at roughly twenty
 *     requests a minute and answers 403 when pushed. The default delay sits
 *     just under that, and a 403 backs off rather than hammering through.
 *   - **It must be resumable.** A harvest is hundreds of requests over tens of
 *     minutes. Each query's results are written as they arrive, so stopping
 *     halfway keeps everything found so far, and re-running skips what is
 *     already stored.
 */

const SEARCH_URL = 'https://itunes.apple.com/search';

/**
 * Genres worth sweeping, as Apple names them.
 *
 * Genre names double as good search terms here — the API has no "list every
 * podcast in this genre" mode, so a genre search is simply a term search that
 * happens to match a broad, well-populated slice of the catalogue.
 */
export const GENRES = [
  'arts', 'books', 'design', 'fashion', 'food', 'performing arts', 'visual arts',
  'business', 'careers', 'entrepreneurship', 'investing', 'management', 'marketing',
  'comedy', 'improv', 'stand-up',
  'education', 'courses', 'language learning', 'self-improvement',
  'fiction', 'drama', 'science fiction',
  'government', 'politics', 'policy',
  'health', 'fitness', 'medicine', 'mental health', 'nutrition',
  'history',
  'kids', 'family', 'parenting', 'stories for kids',
  'leisure', 'games', 'hobbies', 'home and garden', 'video games',
  'music', 'music commentary', 'music history', 'music interviews',
  'news', 'business news', 'daily news', 'entertainment news', 'tech news',
  'religion', 'spirituality', 'buddhism', 'christianity', 'islam', 'judaism',
  'science', 'astronomy', 'chemistry', 'earth sciences', 'life sciences',
  'nature', 'physics', 'social sciences',
  'society', 'culture', 'documentary', 'personal journals', 'philosophy',
  'places and travel', 'relationships',
  'sports', 'baseball', 'basketball', 'cricket', 'football', 'golf', 'hockey',
  'running', 'soccer', 'tennis', 'wrestling',
  'technology', 'programming', 'software', 'startups', 'artificial intelligence',
  'cybersecurity', 'crypto', 'linux', 'open source', 'web development',
  'true crime',
  'tv and film', 'after shows', 'film history', 'film reviews',
];

/** Extra terms that reach corners the genre names miss. */
export const EXTRA_TERMS = [
  'interview', 'podcast', 'radio', 'show', 'talk', 'weekly', 'daily', 'live',
  'review', 'stories', 'report', 'hour', 'club', 'cast', 'network', 'sessions',
  'conversations', 'chat', 'insights', 'academy', 'lab', 'studio', 'files',
];

/** Markets to sweep. The same search returns different catalogues per store. */
export const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'BR', 'IN', 'JP'];

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
 * One search. Returns feeds, or an empty list with a reason.
 *
 * Never throws: a harvest is hundreds of these and one bad response must not
 * end the run.
 */
export async function searchPodcasts(term, { country = 'US', limit = 200, timeoutMs = 15_000, signal } = {}) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('media', 'podcast');
  url.searchParams.set('entity', 'podcast');
  url.searchParams.set('term', term);
  url.searchParams.set('country', country);
  url.searchParams.set('limit', String(limit));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'RSS-Amplifier/1.0 (podcast catalogue)' },
    });

    if (response.status === 403 || response.status === 429) {
      return { ok: false, rateLimited: true, feeds: [], error: `HTTP ${response.status}` };
    }
    if (!response.ok) {
      return { ok: false, feeds: [], error: `HTTP ${response.status}` };
    }

    const body = await response.json();
    const feeds = [];

    for (const result of body?.results ?? []) {
      if (!result?.feedUrl) continue;
      feeds.push({
        feedUrl: result.feedUrl,
        title: result.collectionName ?? result.trackName,
        siteUrl: result.trackViewUrl ?? result.collectionViewUrl,
        sourceOrigin: 'itunes',
        genre: result.primaryGenreName,
      });
    }

    return { ok: true, feeds };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'timed out' : (error?.message ?? String(error));
    return { ok: false, feeds: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds the query list.
 *
 * Genres first, because they return the densest results, then extra terms.
 * Countries beyond the first are only swept for genres — sweeping every term
 * in every market multiplies the request count for rapidly diminishing returns.
 */
export function buildQueries({ countries = ['US'], includeExtras = true } = {}) {
  const queries = [];

  for (const country of countries) {
    for (const genre of GENRES) queries.push({ term: genre, country });
  }

  if (includeExtras) {
    const primary = countries[0] ?? 'US';
    for (const term of EXTRA_TERMS) queries.push({ term, country: primary });
  }

  return queries;
}

/**
 * Runs a paced harvest, storing feeds as they are found.
 *
 * `onBatch` is awaited per query, so results are persisted incrementally and
 * an interrupted harvest keeps everything up to that point.
 */
export async function harvestPodcasts(onBatch, options = {}) {
  const {
    countries = ['US'],
    includeExtras = true,
    delayMs = 3_500,
    signal,
    onProgress,
  } = options;

  const queries = buildQueries({ countries, includeExtras });
  const seen = new Set();

  let stored = 0;
  let failures = 0;
  let backoffMs = delayMs;

  for (const [index, query] of queries.entries()) {
    if (signal?.aborted) break;

    const result = await searchPodcasts(query.term, { country: query.country, signal });

    if (result.rateLimited) {
      // Give the endpoint room rather than burning the rest of the run
      // against a wall of 403s.
      backoffMs = Math.min(backoffMs * 2, 60_000);
      failures += 1;
      onProgress?.({ index, total: queries.length, query, rateLimited: true, backoffMs });
      await sleep(backoffMs, signal);
      continue;
    }

    backoffMs = delayMs;
    if (!result.ok) failures += 1;

    const fresh = result.feeds.filter((feed) => {
      if (seen.has(feed.feedUrl)) return false;
      seen.add(feed.feedUrl);
      return true;
    });

    if (fresh.length > 0) {
      await onBatch(fresh);
      stored += fresh.length;
    }

    onProgress?.({
      index: index + 1,
      total: queries.length,
      query,
      found: result.feeds.length,
      fresh: fresh.length,
      stored,
    });

    if (index < queries.length - 1) await sleep(delayMs, signal);
  }

  return { queries: queries.length, unique: seen.size, stored, failures };
}
