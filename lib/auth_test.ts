import { assertEquals, assertNotEquals, assertRejects } from '@std/assert';
import { encodeBase64 } from '@std/encoding';

import type { User, UserSession } from '/lib/types.ts';
import { generateHash } from '/public/ts/utils/misc.ts';

// The auth cookies are signed with a secret that's read from the environment when the auth module is loaded
Deno.env.set('JWT_SECRET', 'auth-test-secret');

const { AppConfig } = await import('./config.ts');
const { UserModel, UserSessionModel } = await import('./models/user.ts');
const {
  COOKIE_NAME,
  generateToken,
  generateUploadSessionTag,
  getDataFromRequest,
  isUploadSessionTagValid,
  logoutUser,
  PASSWORD_SALT,
} = await import('./auth.ts');

Deno.test('that generateUploadSessionTag works', async () => {
  const tag = await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  assertEquals(tag, await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11'));

  // A queue tagged by another session must not match, otherwise leftover uploads would be accepted under the session that's logged in now
  assertNotEquals(tag, await generateUploadSessionTag('0b2d4f6a-1c3e-4b5d-8e7f-2a9c0b1d3e42'));

  // The raw session id never leaves the server
  assertNotEquals(tag, 'cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  assertEquals(await generateUploadSessionTag(), '');
  assertEquals(await generateUploadSessionTag(''), '');
});

Deno.test('that isUploadSessionTagValid requires a matching tag for cookie sessions', async () => {
  const sessionId = 'cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11';
  const tag = await generateUploadSessionTag(sessionId);

  assertEquals(await isUploadSessionTagValid(tag, sessionId), true);
  assertEquals(await isUploadSessionTagValid('', sessionId), false);
  assertEquals(await isUploadSessionTagValid(undefined, sessionId), false);
  assertEquals(
    await isUploadSessionTagValid(await generateUploadSessionTag('0b2d4f6a-1c3e-4b5d-8e7f-2a9c0b1d3e42'), sessionId),
    false,
  );

  // Basic auth / no cookie session: untagged requests are allowed
  assertEquals(await isUploadSessionTagValid('', undefined), true);
  assertEquals(await isUploadSessionTagValid(undefined), true);
  assertEquals(await isUploadSessionTagValid(tag), true);
});

function createUser(email: string, overrides: Partial<User> = {}): User {
  return {
    id: `${email}-id`,
    email,
    hashed_password: '',
    subscription: { external: {}, expires_at: '', updated_at: '' },
    status: 'active',
    extra: { is_email_verified: true },
    created_at: new Date(),
    ...overrides,
  };
}

interface ReverseProxyAuthStubs {
  users: User[];
  createdEmails: string[];
}

async function withReverseProxyAuthStubs(
  {
    users = [],
    enableReverseProxyAuth = true,
    reverseProxyAuthEmailHeader = 'Remote-Email',
    reverseProxyAuthLogoutUrl = '',
    allowSignupsViaSingleSignOn = false,
    isThereAnAdmin = true,
  }: {
    users?: User[];
    enableReverseProxyAuth?: boolean;
    reverseProxyAuthEmailHeader?: string;
    reverseProxyAuthLogoutUrl?: string;
    allowSignupsViaSingleSignOn?: boolean;
    isThereAnAdmin?: boolean;
  },
  fn: (stubs: ReverseProxyAuthStubs) => Promise<void>,
) {
  const config = await AppConfig.getConfig();
  const previousAuthConfig = { ...config.auth };
  const originalGetByEmail = UserModel.getByEmail;
  const originalGetById = UserModel.getById;
  const originalCreate = UserModel.create;
  const originalIsThereAnAdmin = UserModel.isThereAnAdmin;
  const originalGetSessionById = UserSessionModel.getById;
  const originalUpdateSession = UserSessionModel.update;
  const originalDeleteSession = UserSessionModel.delete;

  const stubs: ReverseProxyAuthStubs = { users: [...users], createdEmails: [] };

  config.auth.enableReverseProxyAuth = enableReverseProxyAuth;
  config.auth.reverseProxyAuthEmailHeader = reverseProxyAuthEmailHeader;
  config.auth.reverseProxyAuthLogoutUrl = reverseProxyAuthLogoutUrl;
  config.auth.allowSignups = false;
  config.auth.allowSignupsViaSingleSignOn = allowSignupsViaSingleSignOn;

  UserModel.getByEmail = (email) =>
    Promise.resolve(stubs.users.find((user) => user.email === email.toLowerCase().trim()) as User);
  UserModel.getById = (id) => Promise.resolve(stubs.users.find((user) => user.id === id) as User);
  UserModel.isThereAnAdmin = () => Promise.resolve(isThereAnAdmin);
  UserModel.create = async (email) => {
    // Give concurrent requests a chance to interleave, like a real database round trip would
    await new Promise((resolve) => setTimeout(resolve, 10));

    const user = createUser(email);

    stubs.users.push(user);
    stubs.createdEmails.push(email);

    return user;
  };
  // Every cookie session belongs to the first user
  UserSessionModel.getById = (id) =>
    Promise.resolve(
      {
        id,
        user_id: users[0]?.id,
        expires_at: new Date(),
        last_seen_at: new Date(),
        created_at: new Date(),
      } as UserSession,
    );
  UserSessionModel.update = () => Promise.resolve();
  UserSessionModel.delete = () => Promise.resolve();

  try {
    await fn(stubs);
  } finally {
    config.auth = previousAuthConfig;
    UserModel.getByEmail = originalGetByEmail;
    UserModel.getById = originalGetById;
    UserModel.create = originalCreate;
    UserModel.isThereAnAdmin = originalIsThereAnAdmin;
    UserSessionModel.getById = originalGetSessionById;
    UserSessionModel.update = originalUpdateSession;
    UserSessionModel.delete = originalDeleteSession;
  }
}

function createRequest(headers: Record<string, string> = {}, path = '/files') {
  return new Request(`http://localhost:8000${path}`, { headers });
}

Deno.test('that the reverse proxy auth header is ignored when it is disabled', async () => {
  const user = createUser('jane@example.com');

  await withReverseProxyAuthStubs({ users: [user], enableReverseProxyAuth: false }, async () => {
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': user.email })), null);
  });
});

Deno.test('that the reverse proxy auth header authenticates an existing user', async () => {
  const user = createUser('jane@example.com');

  await withReverseProxyAuthStubs({ users: [user] }, async ({ createdEmails }) => {
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': user.email })), {
      user,
      session: undefined,
    });

    // Emails are case-insensitive and proxies might pad them
    assertEquals(
      (await getDataFromRequest(createRequest({ 'remote-email': '  Jane@Example.com ' })))?.user,
      user,
    );

    assertEquals(createdEmails, []);
  });
});

Deno.test('that the reverse proxy auth header name is configurable', async () => {
  const user = createUser('jane@example.com');

  await withReverseProxyAuthStubs({ users: [user], reverseProxyAuthEmailHeader: 'X-authentik-email' }, async () => {
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': user.email })), null);
    assertEquals((await getDataFromRequest(createRequest({ 'X-Authentik-Email': user.email })))?.user, user);
  });
});

Deno.test('that the reverse proxy auth ignores empty or invalid emails', async () => {
  await withReverseProxyAuthStubs({ allowSignupsViaSingleSignOn: true }, async ({ createdEmails }) => {
    assertEquals(await getDataFromRequest(createRequest()), null);
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': '   ' })), null);
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': 'jane' })), null);

    assertEquals(createdEmails, []);
  });

  // A misconfigured header name must not take down every request
  await withReverseProxyAuthStubs({ reverseProxyAuthEmailHeader: '' }, async () => {
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': 'jane@example.com' })), null);
  });
});

Deno.test('that the reverse proxy auth only signs up new users when allowed', async () => {
  await withReverseProxyAuthStubs({}, async ({ createdEmails }) => {
    assertEquals(await getDataFromRequest(createRequest({ 'Remote-Email': 'new@example.com' })), null);
    assertEquals(createdEmails, []);
  });

  await withReverseProxyAuthStubs({ allowSignupsViaSingleSignOn: true }, async ({ createdEmails }) => {
    const result = await getDataFromRequest(createRequest({ 'Remote-Email': 'New@Example.com' }));

    assertEquals(result?.user.email, 'new@example.com');
    assertEquals(result?.session, undefined);
    assertEquals(createdEmails, ['new@example.com']);
  });

  // The first user can always sign up (and becomes an admin), like with every other signup method
  await withReverseProxyAuthStubs({ isThereAnAdmin: false }, async ({ createdEmails }) => {
    assertEquals(
      (await getDataFromRequest(createRequest({ 'Remote-Email': 'admin@example.com' })))?.user.email,
      'admin@example.com',
    );
    assertEquals(createdEmails, ['admin@example.com']);
  });
});

Deno.test('that concurrent reverse proxy auth requests sign up a new user only once', async () => {
  await withReverseProxyAuthStubs({ allowSignupsViaSingleSignOn: true }, async ({ createdEmails }) => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => getDataFromRequest(createRequest({ 'Remote-Email': 'new@example.com' }))),
    );

    assertEquals(createdEmails, ['new@example.com']);

    for (const result of results) {
      assertEquals(result?.user.id, 'new@example.com-id');
    }
  });
});

Deno.test('that the reverse proxy auth falls back to the cookie and basic auth', async () => {
  const user = createUser('jane@example.com');
  const otherUser = createUser('john@example.com', {
    extra: {
      is_email_verified: true,
      dav_hashed_password: await generateHash(`dav-password:${PASSWORD_SALT}`, 'SHA-256'),
    },
  });

  await withReverseProxyAuthStubs({ users: [user, otherUser] }, async () => {
    const token = await generateToken({ user_id: user.id, session_id: 'session-id' });

    assertEquals((await getDataFromRequest(createRequest({ cookie: `${COOKIE_NAME}=${token}` })))?.user, user);

    // The reverse proxy is what authenticates the request, when it says who it is
    assertEquals(
      (await getDataFromRequest(createRequest({ cookie: `${COOKIE_NAME}=${token}`, 'Remote-Email': otherUser.email })))
        ?.user,
      otherUser,
    );

    // Users that can't be signed up don't lose their existing session
    assertEquals(
      (await getDataFromRequest(
        createRequest({ cookie: `${COOKIE_NAME}=${token}`, 'Remote-Email': 'new@example.com' }),
      ))?.user,
      user,
    );

    // DAV clients usually skip the reverse proxy's authentication and use basic auth instead
    const basicAuth = `Basic ${encodeBase64(`${otherUser.email}:dav-password`)}`;

    assertEquals((await getDataFromRequest(createRequest({ authorization: basicAuth }, '/dav')))?.user, otherUser);
  });
});

Deno.test('that logging out redirects to the reverse proxy logout URL', async () => {
  const user = createUser('jane@example.com');
  const reverseProxyAuthLogoutUrl = 'https://auth.example.com/logout';

  await withReverseProxyAuthStubs({ users: [user], reverseProxyAuthLogoutUrl }, async () => {
    // Without a cookie session, there's nothing to clear here
    const response = await logoutUser(createRequest({ 'Remote-Email': user.email }, '/logout'));

    assertEquals(response.status, 303);
    assertEquals(response.headers.get('location'), reverseProxyAuthLogoutUrl);
    assertEquals(response.headers.get('set-cookie'), null);

    const token = await generateToken({ user_id: user.id, session_id: 'session-id' });
    const cookieResponse = await logoutUser(createRequest({ cookie: `${COOKIE_NAME}=${token}` }, '/logout'));

    assertEquals(cookieResponse.status, 303);
    assertEquals(cookieResponse.headers.get('location'), reverseProxyAuthLogoutUrl);
    assertEquals(cookieResponse.headers.get('set-cookie')?.startsWith(`${COOKIE_NAME}=;`), true);
  });

  await withReverseProxyAuthStubs({ users: [user] }, async () => {
    const response = await logoutUser(createRequest({ 'Remote-Email': user.email }, '/logout'));

    assertEquals(response.status, 303);
    assertEquals(response.headers.get('location'), '/');
  });

  // The logout URL only applies to reverse proxy authentication
  await withReverseProxyAuthStubs(
    { users: [user], enableReverseProxyAuth: false, reverseProxyAuthLogoutUrl },
    async () => {
      const token = await generateToken({ user_id: user.id, session_id: 'session-id' });
      const response = await logoutUser(createRequest({ cookie: `${COOKIE_NAME}=${token}` }, '/logout'));

      assertEquals(response.headers.get('location'), '/');

      await assertRejects(() => logoutUser(createRequest({}, '/logout')), Error, 'Invalid session');
    },
  );
});
