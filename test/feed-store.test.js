/**
 * Feed Store Tests
 * The SQLite catalogue that replaces feeds.json for large imports.
 */

import { expect } from 'chai';
import { FeedStore } from '../src/feed-store.js';

describe('Feed Store', () => {
  let store;

  beforeEach(() => {
    store = new FeedStore({ dbPath: ':memory:' });
  });

  afterEach(() => {
    store.close();
  });

  describe('addFeeds', () => {
    it('stores feeds and reports how many were new', () => {
      const result = store.addFeeds([
        { feedUrl: 'https://a.example/feed', title: 'A' },
        { feedUrl: 'https://b.example/feed', title: 'B' },
      ]);

      expect(result.added).to.equal(2);
      expect(store.stats().feeds).to.equal(2);
    });

    it('ignores a feed it already has', () => {
      store.addFeeds([{ feedUrl: 'https://a.example/feed' }]);
      const again = store.addFeeds([
        { feedUrl: 'https://a.example/feed' },
        { feedUrl: 'https://c.example/feed' },
      ]);

      expect(again.added).to.equal(1);
      expect(store.stats().feeds).to.equal(2);
    });

    it('skips entries with no url rather than throwing', () => {
      const result = store.addFeeds([{ title: 'no url' }, { feedUrl: 'https://d.example/feed' }]);
      expect(result.added).to.equal(1);
    });

    it('staggers first fetches instead of making everything due at once', () => {
      // 47,000 feeds all due simultaneously is the thing that would make the
      // first tick after an import a stampede.
      store.addFeeds(
        Array.from({ length: 50 }, (_, i) => ({ feedUrl: `https://s${i}.example/feed` })),
      );

      const due = store.claimDue(50);
      expect(due.length).to.be.below(50);
    });
  });

  describe('claimDue', () => {
    it('returns at most the batch size', () => {
      store.addFeeds(Array.from({ length: 30 }, (_, i) => ({ feedUrl: `https://b${i}.example/f` })));
      // Everything overdue, so batching is the only thing limiting the result.
      store.db.exec("UPDATE feeds SET next_fetch_at = '2020-01-01T00:00:00.000Z'");

      expect(store.claimDue(8)).to.have.lengthOf(8);
    });

    it('does not return inactive feeds', () => {
      store.addFeeds([{ feedUrl: 'https://dead.example/feed' }]);
      store.db.exec("UPDATE feeds SET next_fetch_at = '2020-01-01T00:00:00.000Z', is_active = 0");

      expect(store.claimDue(8)).to.have.lengthOf(0);
    });

    it('serves the most overdue feed first', () => {
      store.addFeeds([{ feedUrl: 'https://old.example/f' }, { feedUrl: 'https://new.example/f' }]);
      store.db.exec(
        "UPDATE feeds SET next_fetch_at = '2020-01-01T00:00:00.000Z' WHERE feed_url LIKE '%old%'",
      );
      store.db.exec(
        "UPDATE feeds SET next_fetch_at = '2021-01-01T00:00:00.000Z' WHERE feed_url LIKE '%new%'",
      );

      expect(store.claimDue(1)[0].feed_url).to.contain('old');
    });
  });

  describe('recordSuccess and recordFailure', () => {
    it('clears the failure count on a success', () => {
      store.addFeeds([{ feedUrl: 'https://a.example/feed' }]);
      const id = store.claimDue(1, new Date(Date.now() + 86_400_000))[0].id;

      store.recordFailure(id, { error: 'boom', intervalMin: 60 });
      store.recordSuccess(id, { intervalMin: 360, etag: 'W/"x"' });

      const row = store.db.prepare('SELECT * FROM feeds WHERE id = ?').get(id);
      expect(row.consecutive_failures).to.equal(0);
      expect(row.last_error).to.equal(null);
      expect(row.etag).to.equal('W/"x"');
    });

    it('deactivates a feed when told to', () => {
      store.addFeeds([{ feedUrl: 'https://gone.example/feed' }]);
      const id = store.db.prepare('SELECT id FROM feeds').get().id;

      store.recordFailure(id, { error: 'gone', intervalMin: 1440, deactivate: true });

      expect(store.db.prepare('SELECT is_active FROM feeds WHERE id = ?').get(id).is_active).to.equal(0);
    });
  });

  describe('addArticles', () => {
    let feedId;

    beforeEach(() => {
      store.addFeeds([{ feedUrl: 'https://a.example/feed' }]);
      feedId = store.db.prepare('SELECT id FROM feeds').get().id;
    });

    it('stores articles and counts them', () => {
      const added = store.addArticles(feedId, [
        { guid: '1', title: 'One' },
        { guid: '2', title: 'Two' },
      ]);

      expect(added).to.equal(2);
      expect(store.stats().articles).to.equal(2);
    });

    it('does not store the same article twice', () => {
      store.addArticles(feedId, [{ guid: '1', title: 'One' }]);
      const again = store.addArticles(feedId, [
        { guid: '1', title: 'One' },
        { guid: '2', title: 'Two' },
      ]);

      // Re-polling a feed returns items already seen; only genuinely new ones
      // should count, or every poll would look like a burst of activity.
      expect(again).to.equal(1);
    });

    it('ignores articles with no identity', () => {
      expect(store.addArticles(feedId, [{ title: 'no guid or link' }])).to.equal(0);
    });
  });

  describe('pruneArticles', () => {
    it('removes articles past the retention window', () => {
      store.addFeeds([{ feedUrl: 'https://a.example/feed' }]);
      const feedId = store.db.prepare('SELECT id FROM feeds').get().id;

      store.addArticles(feedId, [
        { guid: 'old', publishedAt: '2020-01-01T00:00:00.000Z' },
        { guid: 'new', publishedAt: new Date().toISOString() },
      ]);

      expect(store.pruneArticles(30)).to.equal(1);
      expect(store.stats().articles).to.equal(1);
    });
  });
});
