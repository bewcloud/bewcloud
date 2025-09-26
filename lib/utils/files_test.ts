import { assertEquals } from 'std/assert/assert-equals';
import { humanFileSize } from './files.ts';

Deno.test('that humanFileSize works', () => {
  const tests: { input: number; expected: string }[] = [
    {
      input: 1000,
      expected: '1000 B',
    },
    {
      input: 1024,
      expected: '1.00 KB',
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
      expected: '1.00 MB',
    },
    {
      input: 1073741824,
      expected: '1.00 GB',
    },
  ];

  for (const test of tests) {
    const output = humanFileSize(test.input);
    assertEquals(output, test.expected);
  }
});
