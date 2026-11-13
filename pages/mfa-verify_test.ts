import { assertEquals, assertStringIncludes } from '@std/assert';

import type { MultiFactorAuthMethod, User } from '/lib/types.ts';

// The auth cookies are signed with a secret that's read from the environment when the auth module is loaded
Deno.env.set('JWT_SECRET', 'mfa-verify-test-secret');

const { AppConfig } = await import('/lib/config.ts');
const { MultiFactorAuthModel } = await import('/lib/models/multi-factor-auth.ts');
const { UserModel } = await import('/lib/models/user.ts');
const { EmailModel } = await import('/lib/models/multi-factor-auth/email.ts');
const { TOTPModel } = await import('/lib/models/multi-factor-auth/totp.ts');
const { default: mfaVerifyPage } = await import('./mfa-verify.tsx');

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

interface Context {
  sentCodes: string[];
  failNextSend: () => void;
  // Starts a new password login, which issues a fresh multi-factor auth cookie
  login: () => Promise<string>;
  request: (
    handler: Handler,
    cookie: string,
    fields?: Record<string, string>,
  ) => Promise<{ html: string; cookie: string; setCookie: string }>;
}

async function withStubs({ user }: { user: User }, fn: (context: Context) => Promise<void>) {
  const config = await AppConfig.getConfig();
  const previousEnableMultiFactor = config.auth.enableMultiFactor;
  const originalGetById = UserModel.getById;
  const originalCreateAndSendCode = EmailModel.createAndSendCode;
  const originalVerifyMethodToken = TOTPModel.verifyMethodToken;
  const sentCodes: string[] = [];
  let shouldFailNextSend = false;

  config.auth.enableMultiFactor = true;
  UserModel.getById = () => Promise.resolve(user);
  EmailModel.createAndSendCode = (id) => {
    if (shouldFailNextSend) {
      shouldFailNextSend = false;
      return Promise.reject(new Error('SMTP rejected the message'));
    }

    sentCodes.push(id);
    return Promise.resolve();
  };
  TOTPModel.verifyMethodToken = () => Promise.resolve({ isValid: false });

  const getCookie = (response: Response) => (response.headers.get('set-cookie') || '').split(';')[0];

  const login = async () => {
    const response = await MultiFactorAuthModel.createSessionResponse(
      new Request('http://localhost:8000/login'),
      user,
    );

    return getCookie(response);
  };

  const request = async (handler: Handler, cookie: string, fields?: Record<string, string>) => {
    const request = new Request('http://localhost:8000/mfa-verify', {
      method: handler.toUpperCase(),
      headers: { cookie },
      body: fields ? new URLSearchParams(fields) : undefined,
    });
    const match = new URLPattern({ pathname: '/mfa-verify' }).exec(request.url)!;
    const response = await mfaVerifyPage[handler]!({ request, match, isRunningLocally: true });

    assertEquals(response.status, 200);

    return {
      html: await response.text(),
      cookie: getCookie(response) || cookie,
      setCookie: response.headers.get('set-cookie') || '',
    };
  };

  try {
    await fn({ sentCodes, failNextSend: () => shouldFailNextSend = true, login, request });
  } finally {
    config.auth.enableMultiFactor = previousEnableMultiFactor;
    UserModel.getById = originalGetById;
    EmailModel.createAndSendCode = originalCreateAndSendCode;
    TOTPModel.verifyMethodToken = originalVerifyMethodToken;
  }
}

function getExpiry(setCookie: string) {
  return new Date(/expires=([^;]+)/i.exec(setCookie)![1]).getTime();
}

function hasSendButton(html: string) {
  return html.includes('name="send_email_code"');
}

function hasEmailCodeField(html: string) {
  return html.includes('name="code"');
}

Deno.test('that the email code is offered on request when other methods are enabled', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, login, request }) => {
    const { html } = await request('get', await login());

    assertEquals(hasSendButton(html), true);
    assertEquals(hasEmailCodeField(html), false);
    assertEquals(sentCodes.length, 0);
  });
});

Deno.test('that requesting the email code sends it once and shows the code field', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, login, request }) => {
    const { html } = await request('post', await login(), { send_email_code: 'true' });

    assertEquals(sentCodes, ['email-id']);
    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
  });
});

Deno.test('that the email code field stays visible after a wrong authenticator token', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, login, request }) => {
    const sent = await request('post', await login(), { send_email_code: 'true' });

    const { html } = await request('post', sent.cookie, { token: '000000' });

    assertStringIncludes(html, 'Verification Failed');
    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 1);
  });
});

Deno.test('that the email code field stays visible when reopening the verification page', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, login, request }) => {
    const sent = await request('post', await login(), { send_email_code: 'true' });

    const { html } = await request('get', sent.cookie);

    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 1);
  });
});

Deno.test('that the send button stays available after a failed delivery, including on reload', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, failNextSend, login, request }) => {
    failNextSend();

    const failed = await request('post', await login(), { send_email_code: 'true' });

    assertStringIncludes(failed.html, 'SMTP rejected the message');
    assertEquals(hasSendButton(failed.html), true);
    assertEquals(hasEmailCodeField(failed.html), false);

    const reloaded = await request('get', failed.cookie);

    assertEquals(hasSendButton(reloaded.html), true);
    assertEquals(hasEmailCodeField(reloaded.html), false);

    const retried = await request('post', reloaded.cookie, { send_email_code: 'true' });

    assertEquals(hasEmailCodeField(retried.html), true);
    assertEquals(hasSendButton(retried.html), false);
    assertEquals(sentCodes.length, 1);
  });
});

Deno.test('that a new login starts with the send button even if a previous login requested a code', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ sentCodes, login, request }) => {
    const firstLogin = await request('post', await login(), { send_email_code: 'true' });

    assertEquals(hasEmailCodeField(firstLogin.html), true);

    const secondLogin = await request('get', await login());

    assertEquals(hasSendButton(secondLogin.html), true);
    assertEquals(hasEmailCodeField(secondLogin.html), false);

    const reopenedFirstLogin = await request('get', firstLogin.cookie);

    assertEquals(hasEmailCodeField(reopenedFirstLogin.html), true);
    assertEquals(sentCodes.length, 1);
  });
});

Deno.test('that requesting the email code keeps the pending login expiry', async () => {
  await withStubs({ user: createUser(['totp', 'email']) }, async ({ request }) => {
    const loginResponse = await MultiFactorAuthModel.createSessionResponse(
      new Request('http://localhost:8000/login'),
      createUser(['totp', 'email']),
    );
    const loginSetCookie = loginResponse.headers.get('set-cookie')!;
    const loginCookie = loginSetCookie.split(';')[0];
    const originalDateNow = Date.now;

    // The email code is requested 20 minutes after the password was entered
    Date.now = () => originalDateNow() + 1000 * 60 * 20;

    try {
      const sent = await request('post', loginCookie, { send_email_code: 'true' });

      assertEquals(hasEmailCodeField(sent.html), true);
      assertEquals(getExpiry(sent.setCookie), getExpiry(loginSetCookie));

      // The original window still applies, so the pending login is gone once it passes
      Date.now = () => originalDateNow() + 1000 * 60 * 31;

      assertEquals(
        await MultiFactorAuthModel.getDataFromRequest(
          new Request('http://localhost:8000/mfa-verify', { headers: { cookie: sent.cookie } }),
        ),
        null,
      );
    } finally {
      Date.now = originalDateNow;
    }
  });
});

Deno.test('that the email code field is shown without a request when email is the only method', async () => {
  await withStubs({ user: createUser(['email']) }, async ({ login, request }) => {
    const { html } = await request('get', await login());

    assertEquals(hasEmailCodeField(html), true);
    assertEquals(hasSendButton(html), false);
  });
});

Deno.test('that sending the email code fails when email is not enabled', async () => {
  await withStubs({ user: createUser(['totp']) }, async ({ sentCodes, login, request }) => {
    const { html } = await request('post', await login(), { send_email_code: 'true' });

    assertStringIncludes(html, 'Email verification is not enabled');
    assertEquals(hasSendButton(html), false);
    assertEquals(sentCodes.length, 0);
  });
});
