import { Feed } from '@mikaelporttila/rss';

import Database, { sql } from '/lib/interfaces/database.ts';
import Locker from '/lib/interfaces/locker.ts';
import { NewsFeed, NewsFeedArticle } from '/lib/types.ts';
import {
  findFeedInUrl,
  getArticleUrl,
  getFeedInfo,
  JsonFeed,
  parseTextFromHtml,
  parseUrl,
  parseUrlAsGooglebot,
  parseUrlWithProxy,
} from '/lib/feed.ts';

const db = new Database();

export class FeedModel {
  static async list(userId: string) {
    const newsFeeds = await db.query<NewsFeed>(sql`SELECT * FROM "bewcloud_news_feeds" WHERE "user_id" = $1`, [
      userId,
    ]);

    return newsFeeds;
  }

  static async get(id: string, userId: string) {
    const newsFeeds = await db.query<NewsFeed>(
      sql`SELECT * FROM "bewcloud_news_feeds" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
      [
        id,
        userId,
      ],
    );

    return newsFeeds[0];
  }

  static async create(userId: string, feedUrl: string) {
    const extra: NewsFeed['extra'] = {};

    const newNewsFeed = (await db.query<NewsFeed>(
      sql`INSERT INTO "bewcloud_news_feeds" (
        "user_id",
        "feed_url",
        "extra"
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [
        userId,
        feedUrl,
        JSON.stringify(extra),
      ],
    ))[0];

    return newNewsFeed;
  }

  static async update(newsFeed: NewsFeed) {
    await db.query(
      sql`UPDATE "bewcloud_news_feeds" SET
          "feed_url" = $2,
          "last_crawled_at" = $3,
          "extra" = $4
        WHERE "id" = $1`,
      [
        newsFeed.id,
        newsFeed.feed_url,
        newsFeed.last_crawled_at,
        JSON.stringify(newsFeed.extra),
      ],
    );
  }

  static async delete(id: string, userId: string) {
    await db.query(
      sql`DELETE FROM "bewcloud_news_feed_articles" WHERE "feed_id" = $1 AND "user_id" = $2`,
      [
        id,
        userId,
      ],
    );

    await db.query(
      sql`DELETE FROM "bewcloud_news_feeds" WHERE "id" = $1 AND "user_id" = $2`,
      [
        id,
        userId,
      ],
    );
  }

  static async crawl(newsFeed: NewsFeed) {
    type FeedArticle = Feed['entries'][number];
    type JsonFeedArticle = JsonFeed['items'][number];

    const MAX_ARTICLES_CRAWLED_PER_RUN = 10;

    const lock = new Locker(`feeds:${newsFeed.id}`);

    await lock.acquire();

    try {
      if (!newsFeed.extra.title || !newsFeed.extra.feed_type || !newsFeed.extra.crawl_type) {
        const feedUrl = await findFeedInUrl(newsFeed.feed_url);

        if (!feedUrl) {
          throw new Error(
            `Invalid URL for feed: "${feedUrl}"`,
          );
        }

        if (feedUrl !== newsFeed.feed_url) {
          newsFeed.feed_url = feedUrl;
        }

        const feedInfo = await getFeedInfo(newsFeed.feed_url);

        newsFeed.extra.title = feedInfo.title;
        newsFeed.extra.feed_type = feedInfo.feed_type;
        newsFeed.extra.crawl_type = feedInfo.crawl_type;
      }

      const feedArticles = await fetchNewsArticles(newsFeed);

      const articles: Omit<NewsFeedArticle, 'id' | 'user_id' | 'feed_id' | 'extra' | 'is_read' | 'created_at'>[] = [];

      for (const feedArticle of feedArticles) {
        // Don't add too many articles per run
        if (articles.length >= MAX_ARTICLES_CRAWLED_PER_RUN) {
          continue;
        }

        let url = (feedArticle as JsonFeedArticle).url || getArticleUrl((feedArticle as FeedArticle).links) ||
          feedArticle.id;

        // Fix relative URLs in the feeds
        if (url!.startsWith('/')) {
          const feedUrl = new URL(newsFeed.feed_url);
          url = `${feedUrl.origin}${url}`;
        }

        const articleIsoDate = (feedArticle as JsonFeedArticle).date_published ||
          (feedArticle as FeedArticle).published?.toISOString() || (feedArticle as JsonFeedArticle).date_modified ||
          (feedArticle as FeedArticle).updated?.toISOString();

        const articleDate = articleIsoDate ? new Date(articleIsoDate) : new Date();

        const summary = await parseTextFromHtml(
          (feedArticle as FeedArticle).description?.value || (feedArticle as FeedArticle).content?.value ||
            (feedArticle as JsonFeedArticle).content_text || (feedArticle as JsonFeedArticle).content_html ||
            (feedArticle as JsonFeedArticle).summary || '',
        );

        if (url) {
          articles.push({
            article_title: (feedArticle as FeedArticle).title?.value || (feedArticle as JsonFeedArticle).title ||
              url.replace('http://', '').replace('https://', ''),
            article_url: url,
            article_summary: summary,
            article_date: articleDate,
          });
        }
      }

      const existingArticles = await ArticleModel.listByFeedId(newsFeed.id);
      const existingArticleUrls = new Set<string>(existingArticles.map((article) => article.article_url));
      const previousLatestArticleUrl = existingArticles[0]?.article_url;
      let seenPreviousLatestArticleUrl = false;
      let addedArticlesCount = 0;

      for (const article of articles) {
        // Stop looking after seeing the previous latest article
        if (article.article_url === previousLatestArticleUrl) {
          seenPreviousLatestArticleUrl = true;
        }

        if (!seenPreviousLatestArticleUrl && !existingArticleUrls.has(article.article_url)) {
          try {
            await ArticleModel.create(newsFeed.user_id, newsFeed.id, article);
            ++addedArticlesCount;
          } catch (error) {
            console.error(error);
            console.error(`Failed to add new article: "${article.article_url}"`);
          }
        }
      }

      console.info('Added', addedArticlesCount, 'new articles');

      newsFeed.last_crawled_at = new Date();

      await this.update(newsFeed);

      lock.release();
    } catch (error) {
      lock.release();

      throw error;
    }
  }
}

export class ArticleModel {
  static async list(userId: string) {
    const articles = await db.query<NewsFeedArticle>(
      sql`SELECT * FROM "bewcloud_news_feed_articles" WHERE "user_id" = $1 ORDER BY "article_date" DESC`,
      [
        userId,
      ],
    );

    return articles;
  }

  static async listByFeedId(feedId: string) {
    const articles = await db.query<NewsFeedArticle>(
      sql`SELECT * FROM "bewcloud_news_feed_articles" WHERE "feed_id" = $1 ORDER BY "article_date" DESC`,
      [
        feedId,
      ],
    );

    return articles;
  }

  static async get(id: string, userId: string) {
    const articles = await db.query<NewsFeedArticle>(
      sql`SELECT * FROM "bewcloud_news_feed_articles" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
      [
        id,
        userId,
      ],
    );

    return articles[0];
  }

  static async create(
    userId: string,
    feedId: string,
    article: Omit<NewsFeedArticle, 'id' | 'user_id' | 'feed_id' | 'extra' | 'is_read' | 'created_at'>,
  ) {
    const extra: NewsFeedArticle['extra'] = {};

    const newNewsArticle = (await db.query<NewsFeedArticle>(
      sql`INSERT INTO "bewcloud_news_feed_articles" (
        "user_id",
        "feed_id",
        "article_url",
        "article_title",
        "article_summary",
        "article_date",
        "extra"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        feedId,
        article.article_url,
        article.article_title,
        article.article_summary,
        article.article_date,
        JSON.stringify(extra),
      ],
    ))[0];

    return newNewsArticle;
  }

  static async update(article: NewsFeedArticle) {
    await db.query(
      sql`UPDATE "bewcloud_news_feed_articles" SET
          "is_read" = $2,
          "extra" = $3
        WHERE "id" = $1`,
      [
        article.id,
        article.is_read,
        JSON.stringify(article.extra),
      ],
    );
  }

  static async markAllRead(userId: string) {
    await db.query(
      sql`UPDATE "bewcloud_news_feed_articles" SET
          "is_read" = TRUE
        WHERE "user_id" = $1`,
      [
        userId,
      ],
    );
  }
}

async function fetchNewsArticles(newsFeed: NewsFeed): Promise<Feed['entries'] | JsonFeed['items']> {
  try {
    if (!newsFeed.extra.title || !newsFeed.extra.feed_type || !newsFeed.extra.crawl_type) {
      throw new Error('Invalid News Feed!');
    }

    let feed: JsonFeed | Feed | null = null;

    if (newsFeed.extra.crawl_type === 'direct') {
      feed = await parseUrl(newsFeed.feed_url);
    } else if (newsFeed.extra.crawl_type === 'googlebot') {
      feed = await parseUrlAsGooglebot(newsFeed.feed_url);
    } else if (newsFeed.extra.crawl_type === 'proxy') {
      feed = await parseUrlWithProxy(newsFeed.feed_url);
    }

    return (feed as Feed)?.entries || (feed as JsonFeed)?.items || [];
  } catch (error) {
    console.error('Failed parsing feed to get articles', newsFeed.feed_url);
    console.error(error);
  }

  return [];
}
