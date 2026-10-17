import { assertEquals } from '@std/assert';

import { NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';
import { concurrentPromises } from '/public/ts/utils/misc.ts';
import { crawlFeed } from '/crons/news.ts';

function makeFeed(feedUrl: string) {
  return { id: crypto.randomUUID(), user_id: crypto.randomUUID(), feed_url: feedUrl, extra: {} } as NewsFeed;
}

Deno.test('that a feed that fails to crawl does not stop the other feeds from being crawled', async () => {
  const originalCrawl = FeedModel.crawl;
  const originalConsoleError = console.error;
  const crawledUrls: string[] = [];

  FeedModel.crawl = (newsFeed: NewsFeed) => {
    crawledUrls.push(newsFeed.feed_url);

    if (newsFeed.feed_url.startsWith('http://10.')) {
      return Promise.reject(new Error(`Refusing to fetch non-public URL: ${newsFeed.feed_url}`));
    }

    return Promise.resolve();
  };
  console.error = () => {};

  try {
    const feeds = [
      makeFeed('http://10.0.0.1/feed.xml'),
      makeFeed('http://10.0.0.2/feed.xml'),
      makeFeed('http://10.0.0.3/feed.xml'),
      makeFeed('https://example.com/feed.xml'),
    ];

    await concurrentPromises(feeds.map((newsFeed) => () => crawlFeed(newsFeed)), 3);

    assertEquals(crawledUrls.sort(), feeds.map((feed) => feed.feed_url).sort());
  } finally {
    FeedModel.crawl = originalCrawl;
    console.error = originalConsoleError;
  }
});
