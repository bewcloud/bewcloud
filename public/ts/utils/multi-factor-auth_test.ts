import { assertEquals } from '@std/assert';

import { MultiFactorAuthMethod, MultiFactorAuthMethodType } from '/lib/types.ts';
import { shouldSendEmailCodeOnLogin } from './multi-factor-auth.ts';

function buildUser(methods: { type: MultiFactorAuthMethodType; enabled?: boolean }[]) {
  return {
    extra: {
      multi_factor_auth_methods: methods.map((method, index): MultiFactorAuthMethod => ({
        type: method.type,
        id: `method-${index}`,
        name: `Method ${index}`,
        enabled: method.enabled ?? true,
        created_at: new Date('2026-01-01T00:00:00Z'),
        metadata: {},
      })),
    },
  };
}

Deno.test('that shouldSendEmailCodeOnLogin sends the email code only when email is the sole enabled method', () => {
  const tests: { input: Parameters<typeof buildUser>[0]; expected: boolean }[] = [
    { input: [{ type: 'email' }], expected: true },
    { input: [{ type: 'email' }, { type: 'email' }], expected: true },
    { input: [{ type: 'email' }, { type: 'totp' }], expected: false },
    { input: [{ type: 'totp' }, { type: 'email' }], expected: false },
    { input: [{ type: 'email' }, { type: 'passkey' }], expected: false },
    { input: [{ type: 'email' }, { type: 'totp', enabled: false }], expected: true },
    { input: [{ type: 'email', enabled: false }, { type: 'totp' }], expected: false },
    { input: [{ type: 'totp' }], expected: false },
    { input: [{ type: 'passkey' }], expected: false },
    { input: [], expected: false },
  ];

  for (const test of tests) {
    const output = shouldSendEmailCodeOnLogin(buildUser(test.input));
    assertEquals(output, test.expected, `Input: ${JSON.stringify(test.input)}`);
  }
});

Deno.test('that shouldSendEmailCodeOnLogin handles users without any multi-factor auth methods', () => {
  assertEquals(shouldSendEmailCodeOnLogin({ extra: {} }), false);
});
