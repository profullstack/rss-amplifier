/**
 * CLI handlers for the feed catalogue and its daemon.
 *
 * Kept out of `bin/rss-amplifier.js` because that file is already long and
 * these commands are the only ones that touch the SQLite store.
 */

import colors from 'ansi-colors';
import { FeedStore } from './feed-store.js';
import { importOpmlFile } from './opml-import.js';
import { FeedDaemon, DEFAULTS } from './feed-daemon.js';
import { harvestPodcasts, COUNTRIES } from './podcast-harvest.js';

function withStore(argv, run) {
  const store = new FeedStore({ dbPath: argv.db });
  try {
    return run(store);
  } finally {
    store.close();
  }
}

/** `feeds import-opml <file>` — stream an OPML catalogue into the store. */
export async function importOpmlCommand(argv) {
  const store = new FeedStore({ dbPath: argv.db });

  try {
    console.log(colors.cyan(`Importing ${argv.file}…`));

    let added = 0;
    let batches = 0;

    const summary = await importOpmlFile(argv.file, async (batch) => {
      const result = store.addFeeds(batch, { sourceOrigin: argv.origin ?? 'opml' });
      added += result.added;
      batches += 1;
      if (batches % 10 === 0) {
        process.stdout.write(colors.gray(`\r  ${added} new feeds stored…`));
      }
    });

    process.stdout.write('\r');
    console.log(colors.green(`✅ ${added} new feeds stored`));
    console.log(
      colors.gray(
        `   ${summary.unique} unique in file, ${summary.total - added} already known` +
          (summary.malformed ? `, ${summary.malformed} unusable` : ''),
      ),
    );

    const stats = store.stats();
    console.log(colors.gray(`   catalogue is now ${stats.feeds} feeds`));
    console.log(
      colors.yellow('\nNothing has been fetched yet — start the daemon to poll them:'),
    );
    console.log(colors.gray('   rss-amplifier daemon start'));
  } finally {
    store.close();
  }
}

/** `feeds harvest-podcasts` — build a podcast catalogue from iTunes. */
export async function harvestPodcastsCommand(argv) {
  const store = new FeedStore({ dbPath: argv.db });
  const controller = new AbortController();

  const onSignal = () => {
    console.log(colors.yellow('\nStopping — everything found so far is saved.'));
    controller.abort();
  };
  process.once('SIGINT', onSignal);

  try {
    const countries = argv.all ? COUNTRIES : ['US'];
    console.log(colors.cyan(`Harvesting podcasts from iTunes (${countries.length} market(s))…`));
    console.log(colors.gray('  Paced to stay under Apple\'s rate limit; Ctrl-C is safe.\n'));

    const summary = await harvestPodcasts(
      async (batch) => {
        store.addFeeds(batch, { sourceOrigin: 'itunes' });
      },
      {
        countries,
        signal: controller.signal,
        delayMs: argv.delay ?? 3_500,
        onProgress: (progress) => {
          if (progress.rateLimited) {
            process.stdout.write(
              colors.yellow(`\r  rate limited, backing off ${Math.round(progress.backoffMs / 1000)}s…   `),
            );
            return;
          }
          process.stdout.write(
            colors.gray(
              `\r  ${progress.index}/${progress.total} "${progress.query.term}" ` +
                `(+${progress.fresh}) — ${progress.stored} unique so far   `,
            ),
          );
        },
      },
    );

    process.stdout.write('\r');
    console.log(colors.green(`\n✅ ${summary.stored} podcast feeds stored from ${summary.queries} searches`));
    if (summary.failures) console.log(colors.gray(`   ${summary.failures} searches failed`));
  } finally {
    process.off('SIGINT', onSignal);
    store.close();
  }
}

/** `feeds stats` — what the catalogue looks like. */
export async function feedStatsCommand(argv) {
  withStore(argv, (store) => {
    const stats = store.stats();

    console.log(colors.green('📊 Feed catalogue'));
    console.log('');
    console.log(colors.cyan(`  Feeds:          ${stats.feeds}`));
    console.log(colors.cyan(`  Active:         ${stats.active}`));
    console.log(colors.cyan(`  Due now:        ${stats.due}`));
    console.log(colors.cyan(`  Never fetched:  ${stats.neverFetched}`));
    console.log(colors.cyan(`  Failing:        ${stats.failing}`));
    console.log(colors.cyan(`  Articles:       ${stats.articles}`));

    if (stats.byKind?.length) {
      console.log('');
      for (const row of stats.byKind) {
        console.log(colors.gray(`  ${row.kind.padEnd(10)} ${row.n}`));
      }
    }
  });
}

/** `feeds recent` — the newest articles the daemon has collected. */
export async function recentArticlesCommand(argv) {
  withStore(argv, (store) => {
    const articles = store.recentArticles({
      limit: argv.limit ?? 20,
      ...(argv.kind ? { kind: argv.kind } : {}),
    });

    if (articles.length === 0) {
      console.log(colors.yellow('No articles yet. Is the daemon running?'));
      return;
    }

    for (const article of articles) {
      const when = article.published_at?.slice(0, 10) ?? '          ';
      console.log(`${colors.gray(when)}  ${colors.cyan(article.feed_title ?? '')}`);
      console.log(`            ${article.title ?? '(untitled)'}`);
    }
  });
}

/** `daemon start` — poll the catalogue until stopped. */
export async function daemonCommand(argv) {
  const daemon = new FeedDaemon({
    ...(argv.db ? { dbPath: argv.db } : {}),
    batchSize: argv.batch ?? DEFAULTS.batchSize,
    batchDelayMs: (argv.pause ?? 2) * 1000,
  });

  const stop = () => {
    console.log(colors.yellow('\nStopping after this batch…'));
    daemon.stop();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log(colors.green('🔁 Feed daemon started'));
  console.log(
    colors.gray(
      `   ${daemon.config.batchSize} feeds at a time, ` +
        `${daemon.config.batchDelayMs / 1000}s between batches. Ctrl-C to stop.\n`,
    ),
  );

  const started = Date.now();

  const totals = await daemon.start({
    onTick: (result, running) => {
      if (result.claimed === 0) return;
      const mins = Math.max((Date.now() - started) / 60_000, 0.01);
      process.stdout.write(
        colors.gray(
          `\r  ${running.batches} batches · ${running.updated} updated · ` +
            `${running.unchanged} unchanged · ${running.failed} failed · ` +
            `${running.newArticles} new articles · ` +
            `${Math.round((running.updated + running.unchanged + running.failed) / mins)}/min   `,
        ),
      );
    },
  });

  console.log(colors.green(`\n\n✅ Stopped after ${totals.batches} batches`));
  console.log(
    colors.gray(
      `   ${totals.updated} updated, ${totals.unchanged} unchanged, ` +
        `${totals.failed} failed, ${totals.newArticles} new articles`,
    ),
  );
}
