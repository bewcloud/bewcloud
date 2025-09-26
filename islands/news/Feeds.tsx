import { useSignal } from '@preact/signals';

import { NewsFeed } from '/lib/types.ts';
import { escapeHtml, validateUrl } from '/lib/utils/misc.ts';
import { RequestBody as AddRequestBody, ResponseBody as AddResponseBody } from '/pages/api/news/add-feed.tsx';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/pages/api/news/delete-feed.tsx';
import { RequestBody as ImportRequestBody, ResponseBody as ImportResponseBody } from '/pages/api/news/import-feeds.tsx';

interface FeedsProps {
  initialFeeds: NewsFeed[];
}

function formatNewsFeedsToOpml(feeds: NewsFeed[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Subscriptions</title>
  </head>
  <body>
    ${
    feeds.map((feed) =>
      `<outline title="${escapeHtml(feed.extra.title || '')}" text="${escapeHtml(feed.extra.title || '')}" type="${
        feed.extra.feed_type || 'rss'
      }" xmlUrl="${escapeHtml(feed.feed_url)}" htmlUrl="${escapeHtml(feed.feed_url)}"/>`
    ).join('\n    ')
  }
  </body>
</opml>`;
}

function parseOpmlFromTextContents(html: string): string[] {
  const feedUrls: string[] = [];

  const document = new DOMParser().parseFromString(html, 'text/html');

  const feeds = Array.from(document.getElementsByTagName('outline'));

  for (const feed of feeds) {
    const url = (feed.getAttribute('xmlUrl') || feed.getAttribute('htmlUrl') || '').trim();

    if (validateUrl(url)) {
      feedUrls.push(url);
    }
  }

  return feedUrls;
}

export default function Feeds({ initialFeeds }: FeedsProps) {
  const isAdding = useSignal<boolean>(false);
  const isDeleting = useSignal<boolean>(false);
  const isExporting = useSignal<boolean>(false);
  const isImporting = useSignal<boolean>(false);
  const feeds = useSignal<NewsFeed[]>(initialFeeds);
  const isOptionsDropdownOpen = useSignal<boolean>(false);

  const dateFormatOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

  const dateFormat = new Intl.DateTimeFormat('en-GB', dateFormatOptions);

  async function onClickAddFeed() {
    if (isAdding.value) {
      return;
    }

    const url = (prompt(`What's the **URL** for the new feed?`) || '').trim();

    if (!url) {
      alert('A URL is required for a new feed!');
      return;
    }

    if (!validateUrl(url)) {
      alert('Invalid URL!');
      return;
    }

    isAdding.value = true;

    try {
      const requestBody: AddRequestBody = { feedUrl: url };
      const response = await fetch(`/api/news/add-feed`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to add feed. ${response.statusText} ${await response.text()}`);
      }

      const result = await response.json() as AddResponseBody;

      if (!result.success) {
        throw new Error('Failed to add feed!');
      }

      feeds.value = [...result.newFeeds];
    } catch (error) {
      console.error(error);
    }

    isAdding.value = false;
  }

  function toggleOptionsDropdown() {
    isOptionsDropdownOpen.value = !isOptionsDropdownOpen.value;
  }

  async function onClickDeleteFeed(feedId: string) {
    if (confirm('Are you sure you want to delete this feed and all its articles?')) {
      if (isDeleting.value) {
        return;
      }

      isDeleting.value = true;

      try {
        const requestBody: DeleteRequestBody = { feedId };
        const response = await fetch(`/api/news/delete-feed`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete feed. ${response.statusText} ${await response.text()}`);
        }

        const result = await response.json() as DeleteResponseBody;

        if (!result.success) {
          throw new Error('Failed to delete feed!');
        }

        feeds.value = [...result.newFeeds];
      } catch (error) {
        console.error(error);
      }

      isDeleting.value = false;
    }
  }

  function onClickImportOpml() {
    isOptionsDropdownOpen.value = false;

    if (isImporting.value) {
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.click();

    fileInput.onchange = (event) => {
      const files = (event.target as HTMLInputElement)?.files!;
      const file = files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async (fileRead) => {
        const importFileContents = fileRead.target?.result;

        if (!importFileContents || isImporting.value) {
          return;
        }

        isImporting.value = true;

        try {
          const feedUrls = parseOpmlFromTextContents(importFileContents!.toString());

          const requestBody: ImportRequestBody = { feedUrls };
          const response = await fetch(`/api/news/import-feeds`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            throw new Error(`Failed to import feeds. ${response.statusText} ${await response.text()}`);
          }

          const result = await response.json() as ImportResponseBody;

          if (!result.success) {
            throw new Error('Failed to import feeds!');
          }

          feeds.value = [...result.newFeeds];
        } catch (error) {
          console.error(error);
        }

        isImporting.value = false;
      };

      reader.readAsText(file, 'UTF-8');
    };
  }

  function onClickExportOpml() {
    isOptionsDropdownOpen.value = false;

    if (isExporting.value) {
      return;
    }

    isExporting.value = true;

    const fileName = `feeds-${new Date().toISOString().substring(0, 19).replace(/:/g, '-')}.opml`;

    const exportContents = formatNewsFeedsToOpml([...feeds.peek()]);

    // Add content-type
    const xmlContent = `data:application/xml; charset=utf-8,${exportContents}`;

    // Download the file
    const data = encodeURI(xmlContent);
    const link = document.createElement('a');
    link.setAttribute('href', data);
    link.setAttribute('download', fileName);
    link.click();
    link.remove();

    isExporting.value = false;
  }

  return (
    <>
      <section class='flex flex-row items-center justify-between mb-4'>
        <a href='/news' class='mr-2'>View articles</a>
        <section class='flex items-center'>
          <section class='relative inline-block text-left ml-2'>
            <div>
              <button
                type='button'
                class='inline-flex w-full justify-center gap-x-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600'
                id='filter-button'
                aria-expanded='true'
                aria-haspopup='true'
                onClick={() => toggleOptionsDropdown()}
              >
                OPML
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
                !isOptionsDropdownOpen.value ? 'hidden' : ''
              }`}
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='filter-button'
              tabindex={-1}
            >
              <div class='py-1'>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickImportOpml()}
                  type='button'
                >
                  Import OPML
                </button>
                <button
                  class={`text-white block px-4 py-2 text-sm w-full text-left hover:bg-slate-600`}
                  onClick={() => onClickExportOpml()}
                  type='button'
                >
                  Export OPML
                </button>
              </div>
            </div>
          </section>
          <button
            class='inline-block justify-center gap-x-1.5 rounded-md bg-[#51A4FB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 ml-2'
            type='button'
            title='Add new feed'
            onClick={() => onClickAddFeed()}
          >
            <img
              src='/public/images/add.svg'
              alt='Add new feed'
              class={`white ${isAdding.value ? 'animate-spin' : ''}`}
              width={20}
              height={20}
            />
          </button>
        </section>
      </section>

      <section class='mx-auto max-w-7xl my-8'>
        <table class='w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md'>
          <thead>
            <tr>
              <th scope='col' class='px-6 py-4 font-medium text-white'>Title & URL</th>
              <th scope='col' class='px-6 py-4 font-medium text-white'>Last Crawl</th>
              <th scope='col' class='px-6 py-4 font-medium text-white'>Type</th>
              <th scope='col' class='px-6 py-4 font-medium text-white  w-20'></th>
            </tr>
          </thead>
          <tbody class='divide-y divide-slate-600 border-t border-slate-600'>
            {feeds.value.map((newsFeed) => (
              <tr class='bg-slate-700 hover:bg-slate-600 group'>
                <td class='flex gap-3 px-6 py-4 font-normal text-white'>
                  <div class='text-sm'>
                    <div class='font-medium text-white'>{newsFeed.extra.title || 'N/A'}</div>
                    <div class='text-slate-400'>{newsFeed.feed_url}</div>
                  </div>
                </td>
                <td class='px-6 py-4 text-slate-200'>
                  {newsFeed.last_crawled_at ? dateFormat.format(new Date(newsFeed.last_crawled_at)) : 'N/A'}
                </td>
                <td class='px-6 py-4'>
                  <div class='text-xs font-semibold text-slate-200'>
                    {newsFeed.extra.feed_type?.split('').map((character) => character.toUpperCase()).join('') || 'N/A'}
                  </div>
                </td>
                <td class='px-6 py-4'>
                  <span
                    class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100'
                    onClick={() => onClickDeleteFeed(newsFeed.id)}
                  >
                    <img
                      src='/public/images/delete.svg'
                      class='red drop-shadow-md'
                      width={24}
                      height={24}
                      alt='Delete feed'
                      title='Delete feed'
                    />
                  </span>
                </td>
              </tr>
            ))}
            {feeds.value.length === 0
              ? (
                <tr class='hover:bg-slate-600'>
                  <td class='flex gap-3 px-6 py-4 font-normal' colspan={4}>
                    <div class='text-md'>
                      <div class='font-medium text-slate-400'>No feeds to show</div>
                    </div>
                  </td>
                </tr>
              )
              : null}
          </tbody>
        </table>

        <span
          class={`flex justify-end items-center text-sm mt-1 mx-2 text-slate-100`}
        >
          {isDeleting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Deleting...
              </>
            )
            : null}
          {isExporting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Exporting...
              </>
            )
            : null}
          {isImporting.value
            ? (
              <>
                <img src='/public/images/loading.svg' class='white mr-2' width={18} height={18} />Importing...
              </>
            )
            : null}
          {!isDeleting.value && !isExporting.value && !isImporting.value ? <>&nbsp;</> : null}
        </span>
      </section>
    </>
  );
}
