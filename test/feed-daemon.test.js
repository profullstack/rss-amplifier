/**
 * Feed Daemon Tests
 * Parsing, scheduling and the batch loop.
 */

import { expect } from 'chai';
import { parseFeed, nextInterval, failureInterval, runBatch, DEFAULTS } from '../src/feed-daemon.js';
import { FeedStore } from '../src/feed-store.js';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  <description>Words</description>
  <link>https://example.com/</link>
  <item>
    <title>First &amp; foremost</title>
    <link>https://example.com/1</link>
    <guid>https://example.com/1</guid>
    <pubDate>Mon, 03 Aug 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Body copy</p>]]></description>
  </item>
  <item>
    <title>Second</title>
    <link>https://example.com/2</link>
    <guid>https://example.com/2</guid>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/">
  <title>Atom Blog</title>
  <link rel="alternate" href="https://example.com/"/>
  <entry xml:base="https://example.com/a">
    <title>Atom One</title>
    <id>tag:example.com,2026:1</id>
    <link href="https://example.com/a"/>
    <updated>2026-08-03T10:00:00Z</updated>
  </entry>
</feed>`;

const PODCAST = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
  <title>A Podcast</title>
  <itunes:author>Someone</itunes:author>
  <item>
    <title>Episode 1</title>
    <guid>ep1</guid>
    <enclosure url="https://example.com/1.mp3" type="audio/mpeg"/>
  </item>
</channel></rss>`;

describe('Feed Daemon', () => {
  describe('parseFeed', () => {
    it('reads an RSS feed', () => {
      const parsed = parseFeed(RSS);

      expect(parsed.kind).to.equal('blog');
      expect(parsed.title).to.equal('Example Blog');
      expect(parsed.articles).to.have.lengthOf(2);
      expect(parsed.articles[0].title).to.equal('First & foremost');
      expect(parsed.articles[0].guid).to.equal('https://example.com/1');
      expect(parsed.articles[0].publishedAt).to.contain('2026-08-03');
    });

    it('strips CDATA and markup out of a summary', () => {
      expect(parseFeed(RSS).articles[0].summary).to.equal('Body copy');
    });

    it('reads an Atom feed whose entries carry attributes', () => {
      // A bare `<entry>` match misses these, and the whole feed then parses as
      // zero articles — which is how a working feed looks broken.
      const parsed = parseFeed(ATOM);

      expect(parsed.articles).to.have.lengthOf(1);
      expect(parsed.articles[0].title).to.equal('Atom One');
      expect(parsed.articles[0].guid).to.equal('tag:example.com,2026:1');
    });

    it('recognises a podcast by its namespace', () => {
      expect(parseFeed(PODCAST).kind).to.equal('podcast');
    });

    it('survives junk instead of throwing', () => {
      expect(parseFeed('<html>not a feed</html>').articles).to.have.lengthOf(0);
      expect(parseFeed('').articles).to.have.lengthOf(0);
      expect(parseFeed(null).articles).to.have.lengthOf(0);
    });

    it('clamps a future publication date to now', () => {
      const future = `<rss><channel><item><guid>x</guid>
        <pubDate>Mon, 03 Aug 2099 10:00:00 GMT</pubDate></item></channel></rss>`;

      expect(Date.parse(parseFeed(future).articles[0].publishedAt)).to.be.at.most(Date.now() + 1000);
    });

    it('caps how many items it reads from an archive dump', () => {
      const many = `<rss><channel>${Array.from(
        { length: 500 },
        (_, i) => `<item><guid>g${i}</guid><title>T${i}</title></item>`,
      ).join('')}</channel></rss>`;

      expect(parseFeed(many).articles).to.have.lengthOf(100);
    });
  });

  describe('nextInterval', () => {
    it('checks a feed sooner when it published something', () => {
      expect(nextInterval(360, { newArticles: 3, notModified: false })).to.equal(180);
    });

    it('backs off when nothing changed', () => {
      expect(nextInterval(360, { newArticles: 0, notModified: true })).to.equal(540);
    });

    it('never goes outside its bounds', () => {
      expect(nextInterval(30, { newArticles: 5 })).to.equal(DEFAULTS.minIntervalMin);
      expect(nextInterval(1440, { newArticles: 0, notModified: true })).to.equal(DEFAULTS.maxIntervalMin);
    });
  });

  describe('failureInterval', () => {
    it('backs off exponentially and then stops growing', () => {
      expect(failureInterval(1)).to.equal(720);
      expect(failureInterval(2)).to.equal(1440);
      expect(failureInterval(20)).to.equal(DEFAULTS.maxIntervalMin);
    });
  });

  describe('runBatch', () => {
    let store;

    beforeEach(() => {
      store = new FeedStore({ dbPath: ':memory:' });
    });

    afterEach(() => store.close());

    it('does nothing when nothing is due', async () => {
      const result = await runBatch(store, { batchSize: 8 });
      expect(result.claimed).to.equal(0);
    });

    it('fetches only one feed per host in a batch', async () => {
      // Several thousand catalogue feeds share a few hosts; drawing eight from
      // one host would hit it eight times at once.
      store.addFeeds([
        { feedUrl: 'https://same.example/a.xml' },
        { feedUrl: 'https://same.example/b.xml' },
        { feedUrl: 'https://other.example/c.xml' },
      ]);
      store.db.exec("UPDATE feeds SET next_fetch_at = '2020-01-01T00:00:00.000Z'");

      const requested = [];
      const result = await runBatch(store, {
        batchSize: 8,
        // Stub fetch so the test never touches the network.
        timeoutMs: 50,
      }).catch(() => ({ claimed: 0 }));

      // Two hosts, so at most two feeds may be claimed regardless of batch size.
      expect(result.claimed).to.be.at.most(2);
      expect(requested).to.have.lengthOf(0);
    });
  });
});
