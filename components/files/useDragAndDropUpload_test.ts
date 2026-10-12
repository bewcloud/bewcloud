import { assertEquals } from '@std/assert';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Signal, signal } from '@preact/signals';

import { readAllDirectoryEntries, useDragAndDropUpload } from './useDragAndDropUpload.ts';

Deno.test('that readAllDirectoryEntries accumulates every batch until an empty one is returned', async () => {
  const firstBatch = Array.from({ length: 100 }, (_, index) => ({ name: `file-${index}` }) as FileSystemEntry);
  const secondBatch = Array.from(
    { length: 100 },
    (_, index) => ({ name: `file-${100 + index}` }) as FileSystemEntry,
  );

  let callCount = 0;

  const mockReader = {
    readEntries(success: (entries: FileSystemEntry[]) => void, _error: (error: unknown) => void) {
      callCount += 1;

      if (callCount === 1) {
        success(firstBatch);
      } else if (callCount === 2) {
        success(secondBatch);
      } else {
        success([]);
      }
    },
  } as FileSystemDirectoryReader;

  const entries = await readAllDirectoryEntries(mockReader);

  assertEquals(entries, [...firstBatch, ...secondBatch]);
});

type EnqueuedItem = { file: File; parentPath: string; overwrite: boolean; batchId: string };

// Renders the hook once (server-side, so no DOM is needed) and hands back what it returned. Its functions keep working after the render, since all they touch are signals.
function renderHook(
  path: Signal<string>,
  uploadError: Signal<string>,
  enqueued: EnqueuedItem[],
  fileFilter?: (file: File) => boolean,
) {
  let hook: ReturnType<typeof useDragAndDropUpload> | undefined;

  function TestComponent() {
    hook = useDragAndDropUpload({
      path,
      uploadError,
      enqueueUpload: (items) => {
        enqueued.push(...items);
        return Promise.resolve();
      },
      fileFilter,
    });
    return null;
  }

  renderToString(h(TestComponent, {}));

  return hook!;
}

function listingResponse(fileNames: string[], directoryNames: string[] = []) {
  return new Response(JSON.stringify({
    success: true,
    files: fileNames.map((file_name) => ({ file_name })),
    directories: directoryNames.map((directory_name) => ({ directory_name })),
  }));
}

const originalFetch = globalThis.fetch;

Deno.test('that a file pick while another upload is still being prepared is turned away', async () => {
  const path = signal('/');
  const uploadError = signal('');
  const enqueued: EnqueuedItem[] = [];

  let releaseListing = () => {};
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      releaseListing = () => resolve(listingResponse([]));
    })) as typeof globalThis.fetch;

  try {
    const hook = renderHook(path, uploadError, enqueued);

    const firstUpload = hook.uploadFiles([new File(['a'], 'a.txt')]);
    await hook.uploadFiles([new File(['b'], 'b.txt')]);

    assertEquals(
      uploadError.value,
      'Another upload is still being prepared. Wait for it to finish before adding more.',
    );

    releaseListing();
    await firstUpload;

    assertEquals(enqueued.map((item) => item.file.name), ['a.txt']);
    assertEquals(hook.isResolvingConflicts.value, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that files upload to the directory that was in view when the upload started, even after navigating away', async () => {
  const path = signal('/Documents/');
  const uploadError = signal('');
  const enqueued: EnqueuedItem[] = [];

  let releaseListing = () => {};
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      releaseListing = () => resolve(listingResponse([]));
    })) as typeof globalThis.fetch;

  try {
    const hook = renderHook(path, uploadError, enqueued);

    const upload = hook.uploadFiles([new File(['a'], 'a.txt')]);
    path.value = '/Pictures/';
    releaseListing();
    await upload;

    assertEquals(enqueued.map((item) => item.parentPath), ['/Documents/']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that files the view does not accept are reported when the rest of the drop is uploaded', async () => {
  const path = signal('/Photos/');
  const uploadError = signal('');
  const enqueued: EnqueuedItem[] = [];

  globalThis.fetch = (() => Promise.resolve(listingResponse([]))) as typeof globalThis.fetch;

  try {
    const hook = renderHook(path, uploadError, enqueued, (file) => file.name.endsWith('.jpg'));

    await hook.uploadFiles([new File(['a'], 'a.jpg'), new File(['b'], 'b.txt'), new File(['c'], 'c.pdf')]);

    assertEquals(enqueued.map((item) => item.file.name), ['a.jpg']);
    assertEquals(hook.skippedFilesNotice.value, 'Skipped 2 unsupported files.');
    assertEquals(uploadError.value, '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that a dropped directory whose name a file already has is skipped and reported', async () => {
  const path = signal('/');
  const uploadError = signal('');
  const enqueued: EnqueuedItem[] = [];

  globalThis.fetch = ((_url: string, options: RequestInit) => {
    const { parentPath } = JSON.parse(options.body as string);
    return Promise.resolve(parentPath === '/' ? listingResponse(['photos']) : listingResponse([]));
  }) as typeof globalThis.fetch;

  try {
    const hook = renderHook(path, uploadError, enqueued);

    const nestedFile = new File(['a'], 'a.jpg');
    Object.defineProperty(nestedFile, 'webkitRelativePath', { value: 'photos/a.jpg' });

    await hook.uploadFiles([nestedFile, new File(['b'], 'b.txt')]);

    assertEquals(enqueued.map((item) => item.file.name), ['b.txt']);
    assertEquals(uploadError.value, '(/photos): A file with this name already exists.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('that only a file the user chose to replace is uploaded with overwrite', async () => {
  const path = signal('/');
  const uploadError = signal('');
  const enqueued: EnqueuedItem[] = [];

  globalThis.fetch = (() => Promise.resolve(listingResponse(['a.txt']))) as typeof globalThis.fetch;

  try {
    const hook = renderHook(path, uploadError, enqueued);

    const upload = hook.uploadFiles([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]);

    while (!hook.fileConflictModal.value) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    assertEquals(hook.fileConflictModal.value.filePath, '/a.txt');
    hook.fileConflictModal.value.onReplace();
    await upload;

    assertEquals(enqueued.map((item) => [item.file.name, item.overwrite]), [['a.txt', true], ['b.txt', false]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
