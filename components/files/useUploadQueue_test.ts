import { assertEquals } from '@std/assert';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { signal } from '@preact/signals';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { useUploadQueue } from './useUploadQueue.ts';

Deno.test('that the in-page fallback keeps counting each drop across its one-file enqueues, even when another drop enqueues in between', async () => {
  let hook: ReturnType<typeof useUploadQueue> | undefined;

  function TestComponent() {
    hook = useUploadQueue({
      isEnabled: false,
      path: signal('/'),
      files: signal<DirectoryFile[]>([]),
      directories: signal<Directory[]>([]),
      checkExistingFiles: false,
    });
    return null;
  }

  renderToString(h(TestComponent, {}));

  const labels: string[] = [];
  hook!.uploadProgress.subscribe((label) => label && labels.push(label));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(Response.json({ success: true, newFiles: [], newDirectories: [] }));

  try {
    await hook!.enqueueUpload([{ file: new File(['d'], 'd.txt'), parentPath: '/', batchId: 'first-drop' }]);
    await hook!.enqueueUpload([{ file: new File(['f'], 'f.txt'), parentPath: '/', batchId: 'second-drop' }]);
    await hook!.enqueueUpload([{ file: new File(['e'], 'e.txt'), parentPath: '/', batchId: 'first-drop' }]);
    await hook!.enqueueUpload([{ file: new File(['g'], 'g.txt'), parentPath: '/', batchId: 'second-drop' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assertEquals(labels, ['Uploading d.txt…', 'Uploading f.txt…', 'Uploading e.txt (2/2)…', 'Uploading g.txt (2/2)…']);
});
