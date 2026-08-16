/**
 * OPML Import Tests
 * Streaming import of large feed catalogues.
 */

import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importOpmlFile, normaliseFeedUrl, parseOutline, decodeEntities } from '../src/opml-import.js';

describe('OPML Import', () => {
  let tempFile;

  afterEach(() => {
    if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    tempFile = undefined;
  });

  function writeOpml(body) {
    tempFile = path.join(os.tmpdir(), `opml-test-${process.pid}-${Math.random()}.opml`);
    fs.writeFileSync(tempFile, `<?xml version="1.0"?><opml version="2.0"><body>${body}</body></opml>`);
    return tempFile;
  }

  describe('normaliseFeedUrl', () => {
    it('keeps a usable url', () => {
      expect(normaliseFeedUrl('https://example.com/feed.xml')).to.equal('https://example.com/feed.xml');
    });

    it('drops a trailing slash so one feed is not stored twice', () => {
      expect(normaliseFeedUrl('https://example.com/feed/')).to.equal('https://example.com/feed');
    });

    it('does not force http up to https', () => {
      // Plenty of small sites serve http only; rewriting the scheme produces a
      // feed URL that never loads.
      expect(normaliseFeedUrl('http://example.com/feed')).to.equal('http://example.com/feed');
    });

    it('rejects anything that is not a fetchable feed', () => {
      expect(normaliseFeedUrl('not a url')).to.equal(undefined);
      expect(normaliseFeedUrl('mailto:me@example.com')).to.equal(undefined);
      expect(normaliseFeedUrl('')).to.equal(undefined);
      expect(normaliseFeedUrl(null)).to.equal(undefined);
    });
  });

  describe('decodeEntities', () => {
    it('decodes what OPML attributes actually contain', () => {
      expect(decodeEntities('Tom &amp; Jerry')).to.equal('Tom & Jerry');
      expect(decodeEntities('a &lt;b&gt; c')).to.equal('a <b> c');
      expect(decodeEntities('it&#39;s')).to.equal("it's");
    });
  });

  describe('parseOutline', () => {
    it('reads a feed outline', () => {
      const feed = parseOutline(
        '<outline type="rss" text="Blog" title="Blog" xmlUrl="https://ex.com/rss" htmlUrl="https://ex.com/"/>',
      );

      expect(feed.feedUrl).to.equal('https://ex.com/rss');
      expect(feed.title).to.equal('Blog');
      expect(feed.siteUrl).to.equal('https://ex.com/');
    });

    it('skips a folder outline, which has no feed', () => {
      expect(parseOutline('<outline text="Group" title="Group">')).to.equal(undefined);
    });

    it('handles single-quoted attributes', () => {
      expect(parseOutline("<outline xmlUrl='https://ex.com/rss'/>").feedUrl).to.equal('https://ex.com/rss');
    });
  });

  describe('importOpmlFile', () => {
    it('streams feeds in batches', async () => {
      const outlines = Array.from(
        { length: 25 },
        (_, i) => `<outline type="rss" title="F${i}" xmlUrl="https://ex${i}.com/rss"/>`,
      ).join('');

      const batches = [];
      const summary = await importOpmlFile(writeOpml(outlines), async (batch) => {
        batches.push(batch.length);
      }, { batchSize: 10 });

      expect(summary.total).to.equal(25);
      expect(batches).to.deep.equal([10, 10, 5]);
    });

    it('deduplicates within the file', async () => {
      const outlines = [
        '<outline xmlUrl="https://ex.com/rss"/>',
        '<outline xmlUrl="https://ex.com/rss/"/>',
        '<outline xmlUrl="https://other.com/rss"/>',
      ].join('');

      const seen = [];
      const summary = await importOpmlFile(writeOpml(outlines), async (batch) => {
        seen.push(...batch);
      });

      expect(summary.unique).to.equal(2);
      expect(seen).to.have.lengthOf(2);
    });

    it('counts unusable outlines rather than failing the import', async () => {
      const outlines =
        '<outline xmlUrl="not-a-url"/><outline xmlUrl="https://good.com/rss"/>';

      const seen = [];
      const summary = await importOpmlFile(writeOpml(outlines), async (batch) => {
        seen.push(...batch);
      });

      expect(seen).to.have.lengthOf(1);
      expect(summary.malformed).to.equal(1);
    });

    it('reads several outlines packed onto one line', async () => {
      const outlines =
        '<outline xmlUrl="https://a.com/rss"/><outline xmlUrl="https://b.com/rss"/>';

      const seen = [];
      await importOpmlFile(writeOpml(outlines), async (batch) => seen.push(...batch));

      expect(seen).to.have.lengthOf(2);
    });
  });
});
