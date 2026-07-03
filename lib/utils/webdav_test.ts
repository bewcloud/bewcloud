import { assertEquals } from '@std/assert';
import { parse, stringify } from '@libs/xml';

import {
  addDavPrefixToKeys,
  getProperDestinationPath,
  getPropertyNames,
  mapFileSystemErrorToStatus,
} from './webdav.ts';

Deno.test('that getProperDestinationPath works', () => {
  const tests: { input: string; expected?: string }[] = [
    {
      input: `http://127.0.0.1/dav/12345-abcde-67890`,
      expected: '12345-abcde-67890',
    },
    {
      input: `http://127.0.0.1/dav/spaced-%20uid`,
      expected: 'spaced- uid',
    },
    {
      input: `http://127.0.0.1/dav/something-deeper/spaced-%C3%A7uid`,
      expected: 'something-deeper/spaced-çuid',
    },
    {
      // Regression test for #155: the Destination header's /dav/ prefix must also be stripped.
      input: `https://storage.yukis.eu/dav/Choraufnahmen/Noten2`,
      expected: 'Choraufnahmen/Noten2',
    },
  ];

  for (const test of tests) {
    const output = getProperDestinationPath(test.input);
    if (test.expected) {
      assertEquals(output, test.expected);
    }
  }
});

Deno.test('that mapFileSystemErrorToStatus works', () => {
  const tests: { input: unknown; expected: number }[] = [
    { input: new Deno.errors.PermissionDenied('denied'), expected: 403 },
    { input: new Deno.errors.NotFound('missing'), expected: 404 },
    { input: new Deno.errors.AlreadyExists('exists'), expected: 409 },
    { input: new Deno.errors.NotADirectory('not a dir'), expected: 409 },
    { input: new Deno.errors.FilesystemLoop('loop'), expected: 508 },
    { input: Object.assign(new Error('no space'), { code: 'ENOSPC' }), expected: 507 },
    { input: new Error('unexpected'), expected: 500 },
  ];

  for (const test of tests) {
    const output = mapFileSystemErrorToStatus(test.input);
    assertEquals(output, test.expected);
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
