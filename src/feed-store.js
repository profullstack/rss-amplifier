/**
 * Feed Store
 *
 * The catalogue of feeds and the articles pulled from them, in SQLite.
 *
 * `FeedManager` keeps every feed — and up to a hundred articles per feed —
 * inside one `feeds.json` that it loads whole on construction and rewrites
 * whole on every single change. That is fine for the few dozen feeds one
 * person hand-picks. It is not fine for a catalogue: importing 47,000 feeds
 * through it means 47,000 full-file rewrites of a file that is itself growing
 * past a gigabyte, which is quadratic work and an out-of-memory crash at the
 * end of it. That is the specific failure this module exists to avoid.
 *
 * SQLite via `node:sqlite` — built into Node 24, so there is no native module
 * to compile. (`better-sqlite3` is not an option here: it needs a build
 * toolchain this machine does not have.)
 *
 * The schema is deliberately shaped for what comes next. Feeds are **global**
 * rows, not one person's list, and `subscriptions` keys a feed to an account.
 * A follow/unfollow product on top of this adds rows; it does not need the
 * catalogue re-modelled underneath it.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  '.config',
  'rss-amplifier',
  'feeds.db',
);

/** Feed kinds we distinguish. Podcasts get their own section in the product. */
export const FEED_KINDS = ['blog', 'podcast', 'unknown'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS feeds (
  id              INTEGER PRIMARY KEY,
  feed_url        TEXT NOT NULL UNIQUE,
  site_url        TEXT,
  title           TEXT,
  description     TEXT,
  -- blog | podcast | unknown. Decided when a feed is first parsed, because
  -- an OPML entry rarely says which it is.
  kind            TEXT NOT NULL DEFAULT 'unknown',
  -- Where this row came from: 'opml', 'smallweb', 'manual'.
  source_origin   TEXT NOT NULL DEFAULT 'manual',
  is_active       INTEGER NOT NULL DEFAULT 1,

  -- Conditional-GET state. The whole reason a 47k-feed poller is affordable:
  -- a server that answers 304 costs a few hundred bytes and no parsing.
  etag            TEXT,
  last_modified   TEXT,
  -- Hash of the last body, for servers that ignore conditional requests.
  content_hash    TEXT,

  last_fetched_at TEXT,
  -- When this feed is next due. The poller's queue is an index on this.
  next_fetch_at   TEXT,
  -- Minutes between polls. Adapts: feeds that never change back off.
  interval_min    INTEGER NOT NULL DEFAULT 360,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  last_status     INTEGER,

  article_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feeds_due ON feeds(next_fetch_at) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_feeds_kind ON feeds(kind) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_feeds_origin ON feeds(source_origin);

CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY,
  feed_id      INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid         TEXT NOT NULL,
  title        TEXT,
  link         TEXT,
  author       TEXT,
  summary      TEXT,
  published_at TEXT,
  fetched_at   TEXT NOT NULL,
  UNIQUE (feed_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Accounts and follows.
--
-- Empty for now: this CLI is single-user and nothing writes these yet. They
-- are here so the catalogue above is already the shared, global thing a
-- follow/unfollow product needs, rather than one person's private list that
-- would have to be migrated later.
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  email       TEXT UNIQUE,
  -- 'email' | 'coinpay'. Null until an account actually exists.
  auth_kind   TEXT,
  external_id TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (auth_kind, external_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  feed_id     INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (account_id, feed_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_feed ON subscriptions(feed_id);
`;

/**
 * Opens (and if needed creates) the feed database.
 *
 * WAL plus `synchronous = NORMAL` is the combination that keeps a long-running
 * poller from making the disk the bottleneck: writes batch into the log and
 * readers never block behind them.
 */
export class FeedStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath ?? DEFAULT_DB_PATH;

    if (this.dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    // Cap SQLite's page cache so a long-lived daemon cannot creep. Negative
    // means kibibytes rather than pages: 16 MiB is plenty for this workload.
    this.db.exec('PRAGMA cache_size = -16000');
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  /**
   * Inserts feeds, ignoring any already present.
   *
   * Chunked into transactions rather than one giant one, so a 47k import
   * commits steadily instead of holding a single write lock — and so an
   * interrupted run keeps everything up to the last chunk.
   *
   * The insert itself is cheap: a feed row is a handful of short strings. It
   * is *fetching* them that has to be paced, and that is the daemon's job.
   */
  addFeeds(feeds, { chunkSize = 1000, sourceOrigin = 'manual' } = {}) {
    const insert = this.db.prepare(`
      INSERT INTO feeds (feed_url, site_url, title, source_origin, next_fetch_at,
                         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(feed_url) DO NOTHING
    `);

    const now = new Date().toISOString();
    let added = 0;
    let seen = 0;

    for (let start = 0; start < feeds.length; start += chunkSize) {
      const chunk = feeds.slice(start, start + chunkSize);

      this.db.exec('BEGIN');
      try {
        for (const feed of chunk) {
          if (!feed?.feedUrl) continue;
          seen += 1;
          // Stagger first fetches across the interval instead of making every
          // imported feed due at once — otherwise the first tick after an
          // import faces a 47,000-deep queue.
          const jitterMin = Math.floor(Math.random() * 360);
          const due = new Date(Date.now() + jitterMin * 60_000).toISOString();

          const result = insert.run(
            feed.feedUrl,
            feed.siteUrl ?? null,
            feed.title ?? null,
            feed.sourceOrigin ?? sourceOrigin,
            due,
            now,
            now,
          );
          added += result.changes;
        }
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }

    return { added, seen, skipped: seen - added };
  }

  /**
   * The next feeds due a fetch, oldest deadline first.
   *
   * `limit` is the batch size, and it is the single most important knob for
   * not being a resource hog: the daemon fetches this many at a time and then
   * stops, rather than opening thousands of sockets.
   */
  claimDue(limit = 8, now = new Date()) {
    return this.db
      .prepare(
        `SELECT id, feed_url, site_url, title, kind, etag, last_modified, content_hash,
                interval_min, consecutive_failures
           FROM feeds
          WHERE is_active = 1
            AND (next_fetch_at IS NULL OR next_fetch_at <= ?)
       ORDER BY next_fetch_at IS NULL DESC, next_fetch_at ASC
          LIMIT ?`,
      )
      .all(now.toISOString(), limit);
  }

  /** Rows whose fetch succeeded, whether or not anything changed. */
  recordSuccess(feedId, fields = {}) {
    const now = new Date().toISOString();
    const nextAt = new Date(Date.now() + fields.intervalMin * 60_000).toISOString();

    this.db
      .prepare(
        `UPDATE feeds
            SET etag = ?, last_modified = ?, content_hash = ?,
                title = COALESCE(?, title), site_url = COALESCE(?, site_url),
                description = COALESCE(?, description),
                kind = CASE WHEN ? = 'unknown' THEN kind ELSE ? END,
                last_fetched_at = ?, next_fetch_at = ?, interval_min = ?,
                consecutive_failures = 0, last_error = NULL, last_status = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(
        fields.etag ?? null,
        fields.lastModified ?? null,
        fields.contentHash ?? null,
        fields.title ?? null,
        fields.siteUrl ?? null,
        fields.description ?? null,
        fields.kind ?? 'unknown',
        fields.kind ?? 'unknown',
        now,
        nextAt,
        fields.intervalMin,
        fields.status ?? null,
        now,
        feedId,
      );
  }

  /**
   * Rows whose fetch failed.
   *
   * The failure count drives the backoff and, past a threshold, deactivation.
   * A catalogue this size always contains dead domains, and re-fetching them
   * forever is most of what would make the daemon wasteful.
   */
  recordFailure(feedId, { error, status, intervalMin, deactivate = false }) {
    const now = new Date().toISOString();
    const nextAt = new Date(Date.now() + intervalMin * 60_000).toISOString();

    this.db
      .prepare(
        `UPDATE feeds
            SET consecutive_failures = consecutive_failures + 1,
                last_error = ?, last_status = ?, last_fetched_at = ?,
                next_fetch_at = ?, interval_min = ?,
                is_active = CASE WHEN ? THEN 0 ELSE is_active END,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(
        String(error ?? '').slice(0, 500),
        status ?? null,
        now,
        nextAt,
        intervalMin,
        deactivate ? 1 : 0,
        now,
        feedId,
      );
  }

  /**
   * Stores newly seen articles for one feed.
   *
   * Returns how many were actually new, which is what tells the poller whether
   * this feed is worth checking as often as it currently is.
   */
  addArticles(feedId, articles) {
    if (articles.length === 0) return 0;

    const insert = this.db.prepare(`
      INSERT INTO articles (feed_id, guid, title, link, author, summary, published_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(feed_id, guid) DO NOTHING
    `);

    const now = new Date().toISOString();
    let added = 0;

    this.db.exec('BEGIN');
    try {
      for (const article of articles) {
        if (!article?.guid) continue;
        added += insert.run(
          feedId,
          article.guid,
          article.title ?? null,
          article.link ?? null,
          article.author ?? null,
          article.summary ?? null,
          article.publishedAt ?? null,
          now,
        ).changes;
      }

      if (added > 0) {
        this.db
          .prepare('UPDATE feeds SET article_count = article_count + ? WHERE id = ?')
          .run(added, feedId);
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return added;
  }

  /**
   * Drops articles past the retention window.
   *
   * Without this the database grows without bound: 47,000 feeds publishing a
   * few items a week is millions of rows a year, almost none of which anyone
   * will read.
   */
  pruneArticles(retentionDays = 30) {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    return this.db
      .prepare('DELETE FROM articles WHERE published_at IS NOT NULL AND published_at < ?')
      .run(cutoff).changes;
  }

  stats() {
    const one = (sql, ...args) => this.db.prepare(sql).get(...args) ?? {};

    return {
      feeds: one('SELECT COUNT(*) AS n FROM feeds').n ?? 0,
      active: one('SELECT COUNT(*) AS n FROM feeds WHERE is_active = 1').n ?? 0,
      due: one(
        'SELECT COUNT(*) AS n FROM feeds WHERE is_active = 1 AND (next_fetch_at IS NULL OR next_fetch_at <= ?)',
        new Date().toISOString(),
      ).n ?? 0,
      neverFetched: one('SELECT COUNT(*) AS n FROM feeds WHERE last_fetched_at IS NULL').n ?? 0,
      failing: one('SELECT COUNT(*) AS n FROM feeds WHERE consecutive_failures > 0').n ?? 0,
      articles: one('SELECT COUNT(*) AS n FROM articles').n ?? 0,
      byKind: this.db
        .prepare('SELECT kind, COUNT(*) AS n FROM feeds GROUP BY kind')
        .all(),
    };
  }

  /** Most recent articles across every feed, for the CLI and later the site. */
  recentArticles({ limit = 20, kind } = {}) {
    const where = kind ? 'WHERE f.kind = ?' : '';
    const args = kind ? [kind, limit] : [limit];

    return this.db
      .prepare(
        `SELECT a.title, a.link, a.published_at, f.title AS feed_title, f.kind
           FROM articles a JOIN feeds f ON f.id = a.feed_id
           ${where}
       ORDER BY a.published_at DESC NULLS LAST
          LIMIT ?`,
      )
      .all(...args);
  }
}
