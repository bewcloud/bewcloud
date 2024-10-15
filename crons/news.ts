import Database, { sql } from '/lib/interfaces/database.ts';
import { NewsFeed } from '/lib/types.ts';
import { concurrentPromises } from '/lib/utils/misc.ts';
import { crawlNewsFeed } from '/lib/data/news.ts';

const db = new Database();

export async function fetchNewArticles(forceFetch = false) {
  const fourHoursAgo = forceFetch ? new Date() : new Date(new Date().setUTCHours(new Date().getUTCHours() - 4));

  try {
    const feedsToCrawl = await db.query<NewsFeed>(
      sql`SELECT * FROM "bewcloud_news_feeds" WHERE "last_crawled_at" IS NULL OR "last_crawled_at" <= $1 ORDER BY "last_crawled_at" ASC`,
      [
        fourHoursAgo.toISOString(),
      ],
    );

    console.info('Will crawl', feedsToCrawl.length, 'news feeds');

    await concurrentPromises(feedsToCrawl.map((newsFeed) => () => crawlNewsFeed(newsFeed)), 3);

    console.info('Crawled', feedsToCrawl.length, 'news feeds');
  } catch (error) {
    console.error(error);
  }
}

export async function cleanupOldArticles() {
  const oneMonthAgo = new Date(new Date().setUTCMonth(new Date().getUTCMonth() - 1));

  try {
    console.info('Will cleanup old articles');

    const feedIdsToSkip = new Set<string>();

    const feeds = await db.query<Pick<NewsFeed, 'id' | 'feed_url'>>(
      sql`SELECT "id", "feed_url" FROM "bewcloud_news_feeds" ORDER BY "last_crawled_at" ASC`,
    );

    for (const feed of feeds) {
      const recentArticlesCount = (await db.query<{ count: number }>(
        sql`SELECT COUNT("id") AS "count" FROM "bewcloud_news_feed_articles" WHERE "feed_id" = $1 AND "article_date" >= $2`,
        [feed.id, oneMonthAgo.toISOString().substring(0, 10)],
      ))[0].count;

      // Don't delete old articles if the feed doesn't have many recent articles (low frequency feeds)
      if (recentArticlesCount <= 5) {
        feedIdsToSkip.add(feed.id);
      }
    }

    const result = await db.query<{ count: number }>(
      sql`WITH "deleted" AS (
        DELETE FROM "bewcloud_news_feed_articles" WHERE "is_read" = TRUE AND "article_date" <= $1 AND "feed_id" != ANY($2) RETURNING *
      )
        SELECT COUNT(*) FROM "deleted"`,
      [
        oneMonthAgo.toISOString().substring(0, 10),
        [...feedIdsToSkip],
      ],
    );

    console.info('Deleted', result[0].count, 'old articles');
  } catch (error) {
    console.error(error);
  }
}
