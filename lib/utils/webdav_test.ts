import { assertEquals } from '@std/assert';
import { parse, stringify } from '@libs/xml';

import { addDavPrefixToKeys, getProperDestinationPath, getPropertyNames } from './webdav.ts';

Deno.test('that getProperDestinationPath works', () => {
  const tests: { input: string; expected?: string }[] = [
    {
      input: `http://127.0.0.1/dav/12345-abcde-67890`,
      expected: 'dav/12345-abcde-67890',
    },
    {
      input: `http://127.0.0.1/dav/spaced-%20uid`,
      expected: 'dav/spaced- uid',
    },
    {
      input: `http://127.0.0.1/dav/something-deeper/spaced-%C3%A7uid`,
      expected: 'dav/something-deeper/spaced-çuid',
    },
  ];

  for (const test of tests) {
    const output = getProperDestinationPath(test.input);
    if (test.expected) {
      assertEquals(output, test.expected);
    }
  }
});

Deno.test('that addDavPrefixToKeys works', () => {
  const tests: {
    input: { object: Record<string, any> | Record<string, any>[]; prefix?: string };
    expected: Record<string, any>;
  }[] = [
    {
      input: {
        object: {
          displayname: 'test',
        },
      },
      expected: {
        'D:displayname': 'test',
      },
    },
    {
      input: {
        object: [
          { displayname: 'test' },
          { color: 'black' },
        ],
      },
      expected: [
        { 'D:displayname': 'test' },
        { 'D:color': 'black' },
      ],
    },
    {
      input: {
        object: { '@version': '1.0', '@encoding': 'UTF-8', displayname: 'test', color: 'black' },
      },
      expected: {
        '@version': '1.0',
        '@encoding': 'UTF-8',
        'D:displayname': 'test',
        'D:color': 'black',
      },
    },
    {
      input: {
        object: { displayname: 'test', color: 'black' },
        prefix: 'S:',
      },
      expected: {
        'S:displayname': 'test',
        'S:color': 'black',
      },
    },
  ];

  for (const test of tests) {
    const output = addDavPrefixToKeys(test.input.object, test.input.prefix);
    if (test.expected) {
      assertEquals(output, test.expected);
    }
  }
});

Deno.test('that getPropertyNames works', () => {
  const tests: {
    input: Record<string, any>;
    expected: string[];
  }[] = [
    {
      input: {
        'D:propfind': {
          'D:prop': {
            'D:displayname': 'test',
          },
        },
      },
      expected: ['displayname'],
    },
    {
      input: {
        'D:propfind': {
          'D:prop': {
            'D:displayname': 'test',
            'D:color': 'black',
          },
        },
      },
      expected: ['displayname', 'color'],
    },
    {
      input: {},
      expected: ['allprop'],
    },
  ];

  for (const test of tests) {
    const output = getPropertyNames(test.input);
    if (test.expected) {
      assertEquals(output, test.expected);
    }
  }
});

Deno.test('that @libs/xml.parse works', () => {
  const tests: { input: string; expected: Record<string, any> }[] = [
    {
      input: `<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:">
  <prop>
    <displayname>test</displayname>
  </prop>
</propfind>`,
      expected: {
        xml: {
          '@version': 1,
          '@encoding': 'UTF-8',
        },
        propfind: {
          '@xmlns': 'DAV:',
          prop: {
            displayname: 'test',
          },
        },
      },
    },
    {
      input: `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname>test</D:displayname>
  </D:prop>
</D:propfind>`,
      expected: {
        xml: {
          '@version': 1,
          '@encoding': 'UTF-8',
        },
        'D:propfind': {
          '@xmlns:D': 'DAV:',
          'D:prop': {
            'D:displayname': 'test',
          },
        },
      },
    },
  ];

  for (const test of tests) {
    const output = parse(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that @libs/xml.stringify works', () => {
  const tests: { input: Record<string, any>; expected: string }[] = [
    {
      input: {
        xml: {
          '@version': '1.0',
          '@encoding': 'UTF-8',
        },
        'D:propfind': {
          'D:prop': {
            'D:displayname': 'test',
          },
        },
      },
      expected: `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind>
  <D:prop>
    <D:displayname>test</D:displayname>
  </D:prop>
</D:propfind>`,
    },
    {
      input: {
        xml: {
          '@version': '1.0',
          '@encoding': 'UTF-8',
        },
        'D:propfind': {
          '@xmlns:D': 'DAV:',
          'D:prop': {
            'D:displayname': 'test',
          },
        },
      },
      expected: `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname>test</D:displayname>
  </D:prop>
</D:propfind>`,
    },
  ];

  for (const test of tests) {
    const output = stringify(test.input);
    assertEquals(output, test.expected);
  }
});
