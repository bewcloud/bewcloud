import { DOMParser, initParser } from 'https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm-noinit.ts';
import { Feed, parseFeed } from 'https://deno.land/x/rss@1.0.0/mod.ts';
import { fetchUrl, fetchUrlAsGooglebot, fetchUrlWithProxy, fetchUrlWithRetries } from './utils/misc.ts';
import { NewsFeed, NewsFeedCrawlType, NewsFeedType } from './types.ts';

export interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  content_text?: string;
  content_html?: string;
  summary?: string;
  date_modified?: string;
  date_published: string;
}

export interface JsonFeed {
  version: string;
  title: string;
  home_page_url?: string;
  description?: string;
  authors?: { name: string; url?: string }[];
  language?: string;
  items: JsonFeedItem[];
}

async function getFeedFromUrlContents(urlContents: string) {
  try {
    const jsonFeed = JSON.parse(urlContents) as JsonFeed;
    return jsonFeed;
  } catch (_error) {
    const feed = await parseFeed(urlContents);
    return feed;
  }
}

export async function parseUrl(feedUrl: string) {
  const urlContents = await fetchUrl(feedUrl);
  const feed = await getFeedFromUrlContents(urlContents);
  return feed;
}

export async function parseUrlAsGooglebot(feedUrl: string) {
  const urlContents = await fetchUrlAsGooglebot(feedUrl);
  const feed = await getFeedFromUrlContents(urlContents);
  return feed;
}

export async function parseUrlWithProxy(feedUrl: string) {
  const urlContents = await fetchUrlWithProxy(feedUrl);
  const feed = await getFeedFromUrlContents(urlContents);
  return feed;
}

async function parseUrlWithRetries(feedUrl: string): Promise<{ feed: JsonFeed | Feed; crawlType: NewsFeedCrawlType }> {
  try {
    const feed = await parseUrl(feedUrl);
    return { feed, crawlType: 'direct' };
  } catch (_error) {
    try {
      const feed = await parseUrlAsGooglebot(feedUrl);
      return { feed, crawlType: 'googlebot' };
    } catch (_error) {
      const feed = await parseUrlWithProxy(feedUrl);
      return { feed, crawlType: 'proxy' };
    }
  }
}

export async function isValid(feedUrl: string, fastFail = false) {
  try {
    console.log('Checking if URL is a valid feed URL', feedUrl);
    const { feed } = fastFail ? { feed: await parseUrl(feedUrl) } : await parseUrlWithRetries(feedUrl);
    return Boolean(
      (feed as Feed).title?.value || (feed as JsonFeed).title || (feed as JsonFeed).items?.length ||
        (feed as Feed).links?.length > 0 || feed.description,
    );
  } catch (error) {
    console.log('Failed parsing feed to check validity', feedUrl);
    console.log(error);
  }

  return false;
}

export async function getFeedInfo(feedUrl: string, fastFail = false): Promise<NewsFeed['extra']> {
  try {
    console.log('Getting Feed URL info', feedUrl);

    const { feed, crawlType } = fastFail
      ? { feed: await parseUrl(feedUrl), crawlType: 'direct' as const }
      : await parseUrlWithRetries(feedUrl);
    let feedType: NewsFeedType = 'rss';

    if ((feed as JsonFeed).version) {
      feedType = 'json';
    } else if ((feed as Feed).type === 'ATOM') {
      feedType = 'atom';
    }

    return {
      title: (feed as Feed).title?.value || (feed as JsonFeed).title || '',
      feed_type: feedType,
      crawl_type: crawlType,
    };
  } catch (error) {
    console.log('Failed parsing feed to check validity', feedUrl);
    console.log(error);
  }

  return {};
}

export async function findFeedInUrl(url: string) {
  let urlContents = '';
  try {
    urlContents = await fetchUrl(url);
  } catch (error) {
    console.log('Failed to fetch URL to find feed', url);
    console.log(error);
    return null;
  }

  await initParser();

  try {
    const document = new DOMParser().parseFromString(urlContents, 'text/html');

    const urlOptions = [
      url,
      document!.querySelector('link[type="application/rss+xml"]')?.getAttribute('href'),
      document!.querySelector('link[type="application/atom+xml"]')?.getAttribute('href'),
      document!.querySelector('link[rel="alternate"]')?.getAttribute('href'),
      // Try some common URL paths
      'feed',
      'rss',
      'rss.xml',
      'feed.xml',
      'atom.xml',
      'atom',
      'feeds/posts/default',
    ].filter(Boolean);

    for (const urlOption of urlOptions) {
      const optionalSlash = urlOption!.startsWith('/') || url.endsWith('/') ? '' : '/';
      const potentialFeedUrl = urlOption!.startsWith('http') ? urlOption : `${url}${optionalSlash}${urlOption}`;

      try {
        const isValidFeed = await isValid(potentialFeedUrl!, true);

        if (isValidFeed) {
          return potentialFeedUrl;
        }
      } catch (_error) {
        // Do nothing.
      }
    }
  } catch (error) {
    // This error can happen for huge responses, but that usually means the URL works
    if (error.toString().includes('RangeError: Maximum call stack size exceeded')) {
      return url;
    } else {
      console.error(error);
    }
  }

  return null;
}

export function getArticleUrl(links: Feed['entries'][0]['links']) {
  try {
    for (const link of links) {
      if (link.rel === 'alternate' && link.type?.startsWith('text/html')) {
        return link.href || '';
      }
    }

    return links[0]?.href || '';
  } catch (_error) {
    return '';
  }
}

export async function getUrlInfo(url: string): Promise<{ title: string; htmlBody: string; textBody: string } | null> {
  let urlContents = '';
  try {
    urlContents = await fetchUrlWithRetries(url);
  } catch (error) {
    console.log('Failed to fetch URL to get info', url);
    console.log(error);
    return null;
  }

  await initParser();

  const document = new DOMParser().parseFromString(urlContents, 'text/html');

  const title = document!.querySelector('title')?.textContent;
  let htmlBody = document!.querySelector('body')?.innerHTML;
  let textBody = document!.querySelector('body')?.textContent;

  const mainHtml = document!.querySelector('main')?.innerHTML;
  const mainText = document!.querySelector('main')?.textContent;

  const articleHtml = document!.querySelector('article')?.innerHTML;
  const articleText = document!.querySelector('article')?.textContent;

  if (mainHtml && mainText) {
    htmlBody = mainHtml;
    textBody = mainText;
  } else if (articleHtml && articleText) {
    htmlBody = articleHtml;
    textBody = articleText;
  }

  if (!title || !htmlBody || !textBody) {
    return null;
  }

  return { title, htmlBody, textBody };
}

export async function parseTextFromHtml(html: string): Promise<string> {
  let text = '';

  await initParser();

  const document = new DOMParser().parseFromString(html, 'text/html');

  text = document!.textContent;

  return text;
}
