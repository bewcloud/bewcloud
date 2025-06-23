import { useSignal } from '@preact/signals';

import { NewsFeedArticle } from '/lib/types.ts';
import {
  RequestBody as RefreshRequestBody,
  ResponseBody as RefreshResponseBody,
} from '/routes/api/news/refresh-articles.tsx';
import { RequestBody as ReadRequestBody, ResponseBody as ReadResponseBody } from '/routes/api/news/mark-read.tsx';

interface ArticlesProps {
  initialArticles: NewsFeedArticle[];
}

interface Filter {
  status: 'all' | 'unread';
}

export default function Articles({ initialArticles }: ArticlesProps) {
  const isRefreshing = useSignal<boolean>(false);
  const articles = useSignal<NewsFeedArticle[]>(initialArticles);
  const filter = useSignal<Filter>({ status: 'unread' });
  const sessionReadArticleIds = useSignal<Set<string>>(new Set());
  const isFilterDropdownOpen = useSignal<boolean>(false);

  const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

  async function refreshArticles() {
    if (isRefreshing.value) {
      return;
    }

    isRefreshing.value = true;

    try {
      const requestBody: RefreshRequestBody = {};
      const response = await fetch(`/api/news/refresh-articles`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
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
    const newArticles = [...articles.value].map((article) => {
      article.is_read = true;

      sessionReadArticleIds.value.add(article.id);

      return article;
    });

    articles.value = [...newArticles];

    try {
      const requestBody: ReadRequestBody = { articleId: 'all' };
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

  function toggleFilterDropdown() {
    isFilterDropdownOpen.value = !isFilterDropdownOpen.value;
  }

  function setNewFilter(newFilter: Partial<Filter>) {
    filter.value = { ...filter.value, ...newFilter };

    isFilterDropdownOpen.value = false;
  }

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <a href='/news/feeds' class='mr-2'>Manage feeds</a>
        <section class='flex items-center'>
          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                type='button'
                class='inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600'
                id='filter-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleFilterDropdown()}
              >
                Filter
                <svg class='-mr-1 h-5 w-5 text-slate-400' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                  <path
                    fill-rule='evenodd'
                    d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                    clip-rule='evenodd'
                  />
                </svg>
              </button>
            </div>

            <div
              class={`absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-md bg-slate-700 shadow-lg ring-1 ring-black ring-opacity-15 focus:outline-none ${
                !isFilterDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='filter-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    filter.value.status === 'unread' ? 'font-semibold' : ''
                  }`}
                  onClick={() => setNewFilter({ status: 'unread' })}
                  type='button'
                >
                  Show only unread
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600 ${
                    filter.value.status === 'all' ? 'font-semibold' : ''
                  }`}
                  onClick={() => setNewFilter({ status: 'all' })}
                  type='button'
                >
                  Show all
                </button>
              </div>
            </div>
          </section>

          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 ml-2'
            type='button'
            title='Mark all read'
            onClick={() => onClickMarkAllRead()}
          >
            <img
              src='/images/check-all.svg'
              alt='Mark all read'
              class={`white`}
              width={20}
              height={20}
            />
          </button>

          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
            type='button'
            title='Fetch new articles'
            onClick={() => refreshArticles()}
          >
            <img
              src='/images/refresh.svg'
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
                  class={`group order-first mx-auto max-w-full relative bg-slate-700 duration-150 first:rounded-tl-md first:rounded-tr-md last:rounded-bl-md last:rounded-br-md`}
                >
                  <summary
                    class={`bg-slate-700 hover:bg-slate-600 px-4 py-4 cursor-pointer flex justify-between group-[:first-child]:rounded-tl-md group-[:first-child]:rounded-tr-md ${
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
                    class='py-4 px-8 flex justify-between text-right hover:bg-slate-600 group-[:last-child]:rounded-bl-md group-[:last-child]:rounded-br-md'
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
