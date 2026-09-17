import { assertEquals } from '@std/assert';

import { readAllDirectoryEntries } from './useDragAndDropUpload.ts';

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
