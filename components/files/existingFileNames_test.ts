import { assertEquals } from '@std/assert';

import { fetchExistingNames } from './existingFileNames.ts';

const originalFetch = globalThis.fetch;

function stubFetch(response: () => Promise<Response>) {
  globalThis.fetch = response as typeof globalThis.fetch;
}

Deno.test('that fetchExistingNames returns both the file and the directory names of a listing', async () => {
  stubFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify({
        success: true,
        files: [{ file_name: 'photo.jpg' }, { file_name: 'notes.txt' }],
        directories: [{ directory_name: 'archive' }],
      })),
    )
  );

  try {
    const existingNames = await fetchExistingNames('/');

    assertEquals([...existingNames.fileNames].sort(), ['notes.txt', 'photo.jpg']);
    assertEquals([...existingNames.directoryNames], ['archive']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that fetchExistingNames fails open when the listing request fails', async () => {
  stubFetch(() => Promise.reject(new Error('network is down')));

  try {
    const existingNames = await fetchExistingNames('/');

    assertEquals(existingNames.fileNames.size, 0);
    assertEquals(existingNames.directoryNames.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that fetchExistingNames fails open on a non-ok response', async () => {
  stubFetch(() => Promise.resolve(new Response('Bad Request', { status: 400 })));

  try {
    const existingNames = await fetchExistingNames('/');

    assertEquals(existingNames.fileNames.size, 0);
    assertEquals(existingNames.directoryNames.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
