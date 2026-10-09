import { assertEquals } from '@std/assert';

import { fetchExistingNames, fetchExistingNamesByPath } from './existingFileNames.ts';

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

Deno.test('that fetchExistingNamesByPath lists every path once, a few at a time', async () => {
  const requestedPaths: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  stubFetch(
    ((_url: string, options: RequestInit) => {
      requestedPaths.push(JSON.parse(options.body as string).parentPath);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);

      return new Promise<Response>((resolve) =>
        setTimeout(() => {
          inFlight--;
          resolve(new Response(JSON.stringify({ success: true, files: [], directories: [] })));
        }, 1)
      );
    }) as unknown as () => Promise<Response>,
  );

  try {
    const paths = Array.from({ length: 20 }, (_, index) => `/directory-${index}/`);
    const existingNamesByPath = await fetchExistingNamesByPath([...paths, ...paths]);

    assertEquals(existingNamesByPath.size, 20);
    assertEquals(requestedPaths.sort(), [...paths].sort());
    assertEquals(maxInFlight, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
