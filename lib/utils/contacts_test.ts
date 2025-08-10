import { assertEquals } from 'std/assert/assert_equals.ts';
import { assertMatch } from 'std/assert/assert_match.ts';

import { generateVCard, getIdFromVCard, parseVCard, splitTextIntoVCards, updateVCard } from './contacts.ts';

Deno.test('that getIdFromVCard works', () => {
  const tests: { input: string; expected?: string; shouldBeUUID?: boolean }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:12345-abcde-67890
FN:John Doe
END:VCARD`,
      expected: '12345-abcde-67890',
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
UID:jane-smith-uuid
EMAIL:jane@example.com
END:VCARD`,
      expected: 'jane-smith-uuid',
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
FN:No UID Contact
EMAIL:nouid@example.com
END:VCARD`,
      shouldBeUUID: true,
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:   spaced-uid   
FN:Spaced UID
END:VCARD`,
      expected: 'spaced-uid',
    },
  ];

  for (const test of tests) {
    const output = getIdFromVCard(test.input);
    if (test.expected) {
      assertEquals(output, test.expected);
    } else if (test.shouldBeUUID) {
      // Check that it's a valid UUID format
      assertMatch(output, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  }
});

Deno.test('that splitTextIntoVCards works', () => {
  const tests: { input: string; expected: string[] }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:1
FN:John Doe
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:2
FN:Jane Smith
END:VCARD`,
      expected: [
        `BEGIN:VCARD
VERSION:4.0
UID:1
FN:John Doe
END:VCARD`,
        `BEGIN:VCARD
VERSION:4.0
UID:2
FN:Jane Smith
END:VCARD`,
      ],
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
END:VCARD`,
      expected: [
        `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
END:VCARD`,
      ],
    },
    {
      input: '',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
FN:Incomplete Contact`,
      expected: [],
    },
  ];

  for (const test of tests) {
    const output = splitTextIntoVCards(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that generateVCard works', () => {
  const tests: { input: { contactId: string; firstName: string; lastName?: string }; expected: string }[] = [
    {
      input: { contactId: 'test-123', firstName: 'John', lastName: 'Doe' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:Doe;John;
FN:John Doe
UID:test-123
END:VCARD`,
    },
    {
      input: { contactId: 'single-name', firstName: 'Madonna' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:;Madonna;
FN:Madonna 
UID:single-name
END:VCARD`,
    },
    {
      input: { contactId: 'special-chars', firstName: 'John,Test', lastName: 'Doe\nSmith' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:Doe\\nSmith;John\\,Test;
FN:John\\,Test Doe\\nSmith
UID:special-chars
END:VCARD`,
    },
  ];

  for (const test of tests) {
    const output = generateVCard(test.input.contactId, test.input.firstName, test.input.lastName);
    assertEquals(output, test.expected);
  }
});

Deno.test('that updateVCard works', () => {
  const tests: {
    input: {
      vCard: string;
      updates: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        notes?: string;
      };
    };
    expected: string;
  }[] = [
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { firstName: 'Jane', lastName: 'Smith' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Smith;Jane;
FN:Jane Smith
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-456
N:Doe;John;
FN:John Doe
EMAIL:old@example.com
TEL:+1234567890
END:VCARD`,
        updates: { email: 'new@example.com', phone: '+9876543210' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-456
N:Doe;John;
FN:John Doe
EMAIL:new@example.com
TEL:+9876543210
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-789
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { email: 'added@example.com', phone: '+1111111111', notes: 'Test notes' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-789
N:Doe;John;
FN:John Doe
EMAIL;TYPE=HOME:added@example.com
TEL;TYPE=HOME:+1111111111
NOTE:Test notes
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-special
N:Doe;John;
FN:John Doe
NOTE:Old notes
END:VCARD`,
        updates: { notes: 'New notes\nwith newlines, and commas' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-special
N:Doe;John;
FN:John Doe
NOTE:New notes\\nwith newlines\\, and commas
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-carriage
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { notes: 'Notes with\r\ncarriage returns' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-carriage
N:Doe;John;
FN:John Doe
NOTE:Notes with\\ncarriage returns
END:VCARD`,
    },
  ];

  for (const test of tests) {
    const output = updateVCard(test.input.vCard, test.input.updates);
    assertEquals(output, test.expected);
  }
});

Deno.test('that parseVCard works', () => {
  const tests: {
    input: string;
    expected: Array<{
      uid?: string;
      firstName?: string;
      lastName?: string;
      middleNames?: string[];
      title?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }>;
  }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Doe;John;Middle;Jr
FN:John Middle Doe Jr
EMAIL;TYPE=HOME:john@example.com
TEL;TYPE=HOME:+1234567890
NOTE:Test contact notes
END:VCARD`,
      expected: [{
        uid: 'test-123',
        firstName: 'John',
        lastName: 'Doe',
        middleNames: ['Middle'],
        title: 'Jr',
        email: 'john@example.com',
        phone: '+1234567890',
        notes: 'Test contact notes',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
UID:test-456
N:Smith;Jane;;
FN:Jane Smith
EMAIL:jane@example.com
TEL:+9876543210
END:VCARD`,
      expected: [{
        uid: 'test-456',
        firstName: 'Jane',
        lastName: 'Smith',
        middleNames: [],
        title: '',
        email: 'jane@example.com',
        phone: '+9876543210',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:multi-1
N:Doe;John;
FN:John Doe
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:multi-2
N:Smith;Jane;
FN:Jane Smith
EMAIL;PREF=1:jane@example.com
END:VCARD`,
      expected: [
        {
          uid: 'multi-1',
          firstName: 'John',
          lastName: 'Doe',
          middleNames: [],
          title: '',
        },
        {
          uid: 'multi-2',
          firstName: 'Jane',
          lastName: 'Smith',
          middleNames: [],
          title: '',
          email: 'jane@example.com',
        },
      ],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:escaped-contact
N:Test;Contact;
FN:Contact Test
NOTE:Notes with\\nescaped newlines\\, and commas
END:VCARD`,
      expected: [{
        uid: 'escaped-contact',
        firstName: 'Contact',
        lastName: 'Test',
        middleNames: [],
        title: '',
        notes: 'Notes with\nescaped newlines, and commas',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:2.1
UID:version-21
N:Old;Format;
FN:Format Old
EMAIL:old@example.com
TEL:+1111111111
END:VCARD`,
      expected: [{
        uid: 'version-21',
        firstName: 'Format',
        lastName: 'Old',
        middleNames: [],
        title: '',
        email: 'old@example.com',
        phone: '+1111111111',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:email-variations
N:Test;Email;
FN:Email Test
EMAIL:direct@example.com
EMAIL;TYPE=WORK:work@example.com
TEL:+1234567890
TEL;TYPE=WORK:+9876543210
END:VCARD`,
      expected: [{
        uid: 'email-variations',
        firstName: 'Email',
        lastName: 'Test',
        middleNames: [],
        title: '',
        email: 'direct@example.com', // Only first email is captured
        phone: '+1234567890', // Only first phone is captured
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:5.0
UID:invalid-version
N:Invalid;Version;
FN:Version Invalid
END:VCARD`,
      expected: [{
        uid: 'invalid-version',
        firstName: 'Version',
        lastName: 'Invalid',
        middleNames: [],
        title: '',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:no-first-name
N:LastOnly;;
FN:LastOnly
END:VCARD`,
      expected: [{ uid: 'no-first-name' }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:empty-uid
N:Test;Empty;
FN:Empty Test
END:VCARD`,
      expected: [{
        firstName: 'Empty',
        lastName: 'Test',
        middleNames: [],
        title: '',
        uid: 'empty-uid',
      }],
    },
  ];

  for (const test of tests) {
    const output = parseVCard(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that parseVCard handles edge cases', () => {
  const edgeCases: { input: string; description: string; expected: any[] }[] = [
    {
      input: '',
      description: 'empty string',
      expected: [],
    },
    {
      input: 'Not a vCard at all',
      description: 'invalid format',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:incomplete`,
      description: 'incomplete vCard without END',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:missing-required
FN:Missing Required Fields
END:VCARD`,
      description: 'vCard without N field',
      expected: [{ uid: 'missing-required' }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:empty-fields
N:;;;
FN:Empty Fields
EMAIL:
TEL:
NOTE:
END:VCARD`,
      description: 'vCard with empty field values',
      expected: [{ uid: 'empty-fields', notes: '' }],
    },
  ];

  for (const test of edgeCases) {
    const output = parseVCard(test.input);
    assertEquals(output, test.expected, `Failed for: ${test.description}`);
  }
});
