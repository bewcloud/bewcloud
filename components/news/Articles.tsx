import { useSignal } from '@preact/signals';

import { NewsFeedArticle } from '/lib/types.ts';
import { ResponseBody as RefreshResponseBody } from '/pages/api/news/refresh-articles.ts';
import { RequestBody as ReadRequestBody, ResponseBody as ReadResponseBody } from '/pages/api/news/mark-read.ts';

import FilterDropdown from './FilterDropdown.tsx';

interface ArticlesProps {
  initialArticles: NewsFeedArticle[];
  feeds: { id: string; title: string }[];
}

interface Filter {
  status: 'all' | 'unread';
  feedId: string;
}

let hasFetchedAllArticlesOnce = false;

export default function Articles({ initialArticles, feeds }: ArticlesProps) {
  const isRefreshing = useSignal<boolean>(false);
  const articles = useSignal<NewsFeedArticle[]>(initialArticles);
  const filter = useSignal<Filter>({ status: 'unread', feedId: 'all' });
  const sessionReadArticleIds = useSignal<Set<string>>(new Set());

  const dateFormatOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

  const dateFormat = new Intl.DateTimeFormat('en-GB', dateFormatOptions);

  async function refreshArticles() {
    if (isRefreshing.value) {
      return;
    }

    isRefreshing.value = true;

    try {
      const response = await fetch(`/api/news/refresh-articles`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh articles. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as RefreshResponseBody;

      if (!result.success) {
        throw new Error('Failed to refresh articles!');
      }

      articles.value = [...result.newArticles];
    } catch (error) {
      console.error(error);
    }

    isRefreshing.value = false;
  }

  const filteredArticles = articles.value.filter((article) => {
    if (filter.value.feedId !== 'all' && article.feed_id !== filter.value.feedId) {
      return false;
    }

    if (filter.value.status === 'unread') {
      if (article.is_read && !sessionReadArticleIds.value.has(article.id)) {
        return false;
      }

      return true;
    }

    return true;
  });

  async function onClickView(articleId: string) {
    const newArticles = [...articles.value];

    const matchingArticle = newArticles.find((article) => article.id === articleId);
    if (matchingArticle) {
      if (matchingArticle.is_read) {
        return;
      }

      matchingArticle.is_read = true;
    } else {
      return;
    }

    sessionReadArticleIds.value.add(articleId);

    articles.value = [...newArticles];

    try {
      const requestBody: ReadRequestBody = { articleId };
      const response = await fetch(`/api/news/mark-read`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark article as read. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as ReadResponseBody;

      if (!result.success) {
        throw new Error('Failed to mark article as read!');
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function onClickMarkAllRead() {
    const feedId = filter.value.feedId;

    const newArticles = [...articles.value].map((article) => {
      if (feedId !== 'all' && article.feed_id !== feedId) {
        return article;
      }

      article.is_read = true;

      sessionReadArticleIds.value.add(article.id);

      return article;
    });

    articles.value = [...newArticles];

    try {
      const requestBody: ReadRequestBody = { articleId: 'all', feedId: feedId === 'all' ? undefined : feedId };
      const response = await fetch(`/api/news/mark-read`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all articles as read. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as ReadResponseBody;

      if (!result.success) {
        throw new Error('Failed to mark all articles as read!');
      }
    } catch (error) {
      console.error(error);
    }
  }

  function setNewFilter(newFilter: Partial<Filter>) {
    filter.value = { ...filter.value, ...newFilter };

    if (newFilter.status === 'all' && !hasFetchedAllArticlesOnce) {
      refreshArticles();
      hasFetchedAllArticlesOnce = true;
    }
  }

  return (
    <>
      <section class='flex flex-row flex-wrap items-center justify-between gap-y-2 mb-4'>
        <a href='/news/feeds' class='mr-2'>Manage feeds</a>
        <section class='flex max-w-full items-center gap-2'>
          {feeds.length > 1 && (
            <FilterDropdown
              isFeedPicker
              label={feeds.find((feed) => feed.id === filter.value.feedId)?.title || 'All feeds'}
              selected={filter.value.feedId}
              options={[{ id: 'all', title: 'All feeds' }, ...feeds]}
              onSelect={(feedId) => setNewFilter({ feedId })}
            />
          )}
          <FilterDropdown<Filter['status']>
            label='Filter'
            selected={filter.value.status}
            options={[{ id: 'unread', title: 'Show only unread' }, { id: 'all', title: 'Show all' }]}
            onSelect={(status) => setNewFilter({ status })}
          />

          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 shrink-0'
            type='button'
            title='Mark all read'
            onClick={() => onClickMarkAllRead()}
          >
            <img
              src='/public/images/check-all.svg'
              alt='Mark all read'
              class={`white`}
              width={20}
              height={20}
            />
          </button>

          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 shrink-0'
            type='button'
            title='Fetch new articles'
            onClick={() => refreshArticles()}
          >
            <img
              src='/public/images/refresh.svg'
              alt='Fetch new articles'
              class={`white ${isRefreshing.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        {filteredArticles.length === 0
          ? <p class='my-4 block text-center text-lg text-slate-400'>There are no new articles to show.</p>
          : (
            <section class='divide-y divide-slate-800 shadow-sm rounded-md'>
              {filteredArticles.map((article) => (
                <details
                  key={article.id}
                  class={`group order-first mx-auto max-w-full relative bg-slate-700 duration-150 first:rounded-tl-md first:rounded-tr-md last:rounded-bl-md last:rounded-br-md`}
                >
                  <summary
                    class={`bg-slate-700 hover:bg-slate-600 px-4 py-4 cursor-pointer flex justify-between group-first:rounded-tl-md group-first:rounded-tr-md ${
                      article.is_read ? 'opacity-50' : 'font-semibold'
                    }`}
                    onClick={() => onClickView(article.id)}
                  >
                    <span class='mr-2'>{article.article_title}</span>
                    <span class='text-sm text-slate-300 ml-2 font-normal'>
                      {dateFormat.format(new Date(article.article_date))}
                    </span>
                  </summary>
                  <article class='overflow-auto max-w-full max-h-80 py-2 px-4 font-mono text-sm whitespace-pre-wrap border-t border-b border-slate-600'>
                    {article.article_summary}
                  </article>
                  <a
                    href={article.article_url}
                    class='py-4 px-8 flex justify-between text-right hover:bg-slate-600 group-last:rounded-bl-md group-last:rounded-br-md'
                    target='_blank'
                    rel='noreferrer noopener'
                    onClick={() => onClickView(article.id)}
                  >
                    <span class='text-sm text-slate-400 mr-2 font-normal'>{article.article_url}</span>
                    <span class='ml-2'>View article</span>
                  </a>
                </details>
              ))}
            </section>
          )}
      </section>
    </>
  );
}
