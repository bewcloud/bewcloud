import { assertEquals, assertStringIncludes } from '@std/assert';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';

import { NewsFeedArticle } from '/lib/types.ts';
import Articles from './Articles.tsx';

function buildArticle(id: string, feedId: string, title: string): NewsFeedArticle {
  return {
    id,
    user_id: 'user-1',
    feed_id: feedId,
    article_url: `https://example.com/${id}`,
    article_title: title,
    article_summary: `Summary of ${title}`,
    article_date: new Date('2026-01-01T00:00:00Z'),
    is_read: false,
    extra: {},
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
}

const initialArticles = [
  buildArticle('article-1', 'feed-1', 'First feed article'),
  buildArticle('article-2', 'feed-2', 'Second feed article'),
];

Deno.test('Articles lets users pick a feed when there are multiple feeds', () => {
  const html = renderToString(h(Articles, {
    initialArticles,
    feeds: [{ id: 'feed-1', title: 'First feed' }, { id: 'feed-2', title: 'Second feed' }],
  }));

  assertStringIncludes(html, 'Filter by feed:');
  assertStringIncludes(html, 'All feeds</button>');
  assertStringIncludes(html, 'First feed</button>');
  assertStringIncludes(html, 'Second feed</button>');
});

Deno.test('Articles shows articles from every feed by default', () => {
  const html = renderToString(h(Articles, {
    initialArticles,
    feeds: [{ id: 'feed-1', title: 'First feed' }, { id: 'feed-2', title: 'Second feed' }],
  }));

  assertStringIncludes(html, 'First feed article');
  assertStringIncludes(html, 'Second feed article');
});

Deno.test('Articles does not show the feed picker when there is at most one feed', () => {
  const html = renderToString(h(Articles, {
    initialArticles: [initialArticles[0]],
    feeds: [{ id: 'feed-1', title: 'First feed' }],
  }));

  assertEquals(html.includes('Filter by feed:'), false);
});
