import { assertEquals, assertStringIncludes } from '@std/assert';

import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import { EmailModel } from '/lib/models/multi-factor-auth/email.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';
import { MultiFactorAuthMethod, User } from '/lib/types.ts';

import mfaVerifyPage from './mfa-verify.tsx';

function createMethod(type: MultiFactorAuthMethod['type']): MultiFactorAuthMethod {
  return { type, id: `${type}-id`, name: type, enabled: true, created_at: new Date(), metadata: {} };
}

function createUser(types: MultiFactorAuthMethod['type'][]): User {
  return {
    id: 'user',
    email: 'mfa@example.com',
    hashed_password: '',
    subscription: { external: {}, expires_at: '', updated_at: '' },
    status: 'active',
    extra: { is_email_verified: true, multi_factor_auth_methods: types.map(createMethod) },
    created_at: new Date(),
  };
}

type Handler = 'get' | 'post';

async function withStubs(
  { user, isCodePending }: { user: User; isCodePending: boolean },
  fn: (
    context: { sentCodes: string[]; request: (handler: Handler, fields?: Record<string, string>) => Promise<string> },
  ) => Promise<void>,
) {
  const config = await AppConfig.getConfig();
  const previousEnableMultiFactor = config.auth.enableMultiFactor;
  const originalGetDataFromRequest = MultiFactorAuthModel.getDataFromRequest;
  const originalCreateAndSendCode = EmailModel.createAndSendCode;
  const originalHasPendingCode = EmailModel.hasPendingCode;
  const originalVerifyMethodToken = TOTPModel.verifyMethodToken;
  const sentCodes: string[] = [];

  config.auth.enableMultiFactor = true;
  MultiFactorAuthModel.getDataFromRequest = () => Promise.resolve({ user });
  EmailModel.createAndSendCode = (id) => {
    sentCodes.push(id);
    isCodePending = true;
    return Promise.resolve();
  };
  EmailModel.hasPendingCode = () => Promise.resolve(isCodePending);
  TOTPModel.verifyMethodToken = () => Promise.resolve({ isValid: false });

  const request = async (handler: Handler, fields?: Record<string, string>) => {
    const request = new Request('http://localhost:8000/mfa-verify', {
      method: handler.toUpperCase(),
      body: fields ? new URLSearchParams(fields) : undefined,
    });
    const match = new URLPattern({ pathname: '/mfa-verify' }).exec(request.url)!;
    const response = await mfaVerifyPage[handler]!({ request, match, isRunningLocally: true });

    assertEquals(response.status, 200);

    return await response.text();
  };

  try {
    await fn({ sentCodes, request });
  } finally {
    config.auth.enableMultiFactor = previousEnableMultiFactor;
    MultiFactorAuthModel.getDataFromRequest = originalGetDataFromRequest;
    EmailModel.createAndSendCode = originalCreateAndSendCode;
    EmailModel.hasPendingCode = originalHasPendingCode;
    TOTPModel.verifyMethodToken = originalVerifyMethodToken;
  }
}

function hasSendButton(html: string) {
  return html.includes('name="send_email_code"');
}

function hasEmailCodeField(html: string) {
  return html.includes('name="code"');
}

Deno.test('that the email code is offered on request when other methods are enabled', async () => {
  await withStubs({ user: createUser(['totp', 'email']), isCodePending: false }, async ({ sentCodes, request }) => {
    const html = await request('get');

    assertEquals(hasSendButton(html), true);
    assertEquals(hasEmailCodeField(html), false);
    assertEquals(sentCodes.length, 0);
  });
});

Deno.test('that requesting the email code sends it once and shows the code field', async () => {
  await withStubs({ user: createUser(['totp', 'email']), isCodePending: false }, async ({ sentCodes, request }) => {
    const html = await request('post', { send_email_code: 'true' });

    assertEquals(sentCodes, ['email-id']);
    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
  });
});

Deno.test('that the email code field stays visible after a wrong authenticator token', async () => {
  await withStubs({ user: createUser(['totp', 'email']), isCodePending: false }, async ({ sentCodes, request }) => {
    await request('post', { send_email_code: 'true' });

    const html = await request('post', { token: '000000' });

    assertStringIncludes(html, 'Verification Failed');
    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 1);
  });
});

Deno.test('that the email code field stays visible when reopening the verification page', async () => {
  await withStubs({ user: createUser(['totp', 'email']), isCodePending: true }, async ({ sentCodes, request }) => {
    const html = await request('get');

    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 0);
  });
});

Deno.test('that the email code field is shown without a request when email is the only method', async () => {
  await withStubs({ user: createUser(['email']), isCodePending: false }, async ({ request }) => {
    const html = await request('get');

    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
  });
});

Deno.test('that sending the email code fails when email is not enabled', async () => {
  await withStubs({ user: createUser(['totp']), isCodePending: false }, async ({ sentCodes, request }) => {
    const html = await request('post', { send_email_code: 'true' });

    assertStringIncludes(html, 'Email verification is not enabled');
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 0);
  });
});
