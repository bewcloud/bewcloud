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
function renderHook(path: Signal<string>, uploadError: Signal<string>, enqueued: EnqueuedItem[]) {
  let hook: ReturnType<typeof useDragAndDropUpload> | undefined;

  function TestComponent() {
    hook = useDragAndDropUpload({
      path,
      uploadError,
      enqueueUpload: (items) => {
        enqueued.push(...items);
        return Promise.resolve();
      },
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
