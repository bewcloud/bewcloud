import { assertEquals } from '@std/assert';

import { Directory } from '/lib/types.ts';
import {
  bytesFromHumanFileSize,
  formatUploadError,
  getUploadErrorAction,
  humanFileSize,
  sortDirectories,
} from './files.ts';

Deno.test('that humanFileSize works', () => {
  const tests: { input: number; expected: string }[] = [
    {
      input: 1000,
      expected: '1000 B',
    },
    {
      input: 1024,
      expected: '1 KB',
    },
    {
      input: 1100,
      expected: '1.07 KB',
    },
    {
      input: 10000,
      expected: '9.77 KB',
    },
    {
      input: 1,
      expected: '1 B',
    },
    {
      input: 1048576,
      expected: '1 MB',
    },
    {
      input: 1073741824,
      expected: '1 GB',
    },
    {
      input: 1150976,
      expected: '1.10 MB',
    },
    {
      input: 1085276160,
      expected: '1.01 GB',
    },
  ];

  for (const test of tests) {
    const output = humanFileSize(test.input);
    assertEquals(output, test.expected, `Expected ${test.input} to be ${test.expected} but got ${output}`);
  }
});

Deno.test('that bytesFromHumanFileSize works', () => {
  const tests: { input: string; expected: number }[] = [
    {
      input: '1000 B',
      expected: 1000,
    },
    {
      input: '1024 KB',
      expected: 1024 * 1024,
    },
    {
      input: '10000 KB',
      expected: 10000 * 1024,
    },
    {
      input: '1 B',
      expected: 1,
    },
    {
      input: '1048576 MB',
      expected: 1048576 * 1024 * 1024,
    },
    {
      input: '1073741824 GB',
      expected: 1073741824 * 1024 * 1024 * 1024,
    },
    {
      input: '1.01 B',
      expected: 1.01,
    },
    {
      input: '1048576.15 MB',
      expected: 1048576.15 * 1024 * 1024,
    },
    {
      input: '1073741824.37 GB',
      expected: 1073741824.37 * 1024 * 1024 * 1024,
    },
  ];

  for (const test of tests) {
    const output = bytesFromHumanFileSize(test.input);
    assertEquals(output, test.expected, `Expected ${test.input} to be ${test.expected} but got ${output}`);
  }
});

Deno.test('that sortDirectories sorts unknown sizes as the biggest', () => {
  const directories = [
    { directory_name: 'unknown', size_in_bytes: null },
    { directory_name: 'big', size_in_bytes: 2_000 },
    { directory_name: 'small', size_in_bytes: 1_000 },
  ] as Directory[];

  const ascending = sortDirectories(directories, { sortBy: 'size_in_bytes', sortOrder: 'asc' });
  assertEquals(ascending.map((directory) => directory.directory_name), ['small', 'big', 'unknown']);

  const descending = sortDirectories(directories, { sortBy: 'size_in_bytes', sortOrder: 'desc' });
  assertEquals(descending.map((directory) => directory.directory_name), ['unknown', 'big', 'small']);
});

Deno.test('that getUploadErrorAction shows each worker error once and clears it when the worker drops it', () => {
  const error = { error: '(a.txt): Failed', errorId: 'error-1', errorKind: 'file', errorSessionTag: 'session-a' };

  const tests: {
    state: Parameters<typeof getUploadErrorAction>[0];
    lastSeenErrorId: string;
    isShowingWorkerError: boolean;
    expected: ReturnType<typeof getUploadErrorAction>;
  }[] = [
    { state: error, lastSeenErrorId: '', isShowingWorkerError: false, expected: 'show' },
    { state: error, lastSeenErrorId: 'error-0', isShowingWorkerError: true, expected: 'show' },
    // Re-broadcast on every progress tick, or seen before a remount (lastSeenErrorId comes from sessionStorage).
    { state: error, lastSeenErrorId: 'error-1', isShowingWorkerError: true, expected: null },
    { state: error, lastSeenErrorId: 'error-1', isShowingWorkerError: false, expected: null },
    { state: { ...error, errorKind: 'photo' }, lastSeenErrorId: '', isShowingWorkerError: false, expected: null },
    {
      state: { ...error, errorSessionTag: 'session-b' },
      lastSeenErrorId: '',
      isShowingWorkerError: false,
      expected: null,
    },
    // The worker cleared it (new job, logout, or expiry), e.g. after another tab enqueued.
    { state: { error: '', errorId: '' }, lastSeenErrorId: 'error-1', isShowingWorkerError: true, expected: 'clear' },
    // A local error (e.g. "already exists") isn't the worker's to clear.
    { state: { error: '', errorId: '' }, lastSeenErrorId: 'error-1', isShowingWorkerError: false, expected: null },
  ];

  for (const test of tests) {
    const output = getUploadErrorAction(
      test.state,
      'file',
      'session-a',
      test.lastSeenErrorId,
      test.isShowingWorkerError,
    );
    assertEquals(output, test.expected);
  }
});

Deno.test('that formatUploadError names the file when there is one', () => {
  assertEquals(
    formatUploadError('(a.txt): A file with this name already exists.'),
    'Upload failed (a.txt): A file with this name already exists.',
  );
  assertEquals(
    formatUploadError('No supported files were found in the dropped items.'),
    'Upload failed: No supported files were found in the dropped items.',
  );
});
