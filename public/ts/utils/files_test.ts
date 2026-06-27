import { assertEquals } from '@std/assert';

import { bytesFromHumanFileSize, humanFileSize } from './files.ts';

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
