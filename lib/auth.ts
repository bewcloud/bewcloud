import { decodeBase64, decodeBase64Url, encodeBase64Url } from '@std/encoding';
import { Cookie, getCookies, setCookie } from '@std/http';
import '@std/dotenv/load';

import { generateHash, isRunningLocally } from './utils/misc.ts';
import { User, UserSession } from './types.ts';
import { UserModel, UserSessionModel, validateUserAndSession } from './models/user.ts';
import { AppConfig } from './config.ts';

export const JWT_SECRET = Deno.env.get('JWT_SECRET') || '';
export const PASSWORD_SALT = Deno.env.get('PASSWORD_SALT') || '';
export const MFA_KEY = Deno.env.get('MFA_KEY') || '';
export const MFA_SALT = Deno.env.get('MFA_SALT') || '';
export const COOKIE_NAME = 'bewcloud-app-v1';

export interface JwtData {
  data: {
    user_id: string;
    session_id: string;
  };
}

const isUrlAnIp = (baseUrl: string) => /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(baseUrl);

const textToData = (text: string) => new TextEncoder().encode(text);

export const dataToText = (data: Uint8Array) => new TextDecoder().decode(data);

export const generateKey = async (key: string): Promise<CryptoKey> =>
  await crypto.subtle.importKey('raw', textToData(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

async function signAuthJwt<T = JwtData>(key: CryptoKey, data: T): Promise<string> {
  const payload = encodeBase64Url(textToData(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))) + '.' +
    encodeBase64Url(textToData(JSON.stringify(data) || ''));
  const signature = encodeBase64Url(
    new Uint8Array(await crypto.subtle.sign({ name: 'HMAC' }, key, textToData(payload))),
  );
  return `${payload}.${signature}`;
}

export async function verifyAuthJwt<T = JwtData>(key: CryptoKey, jwt: string): Promise<T> {
  const jwtParts = jwt.split('.');
  if (jwtParts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const data = textToData(jwtParts[0] + '.' + jwtParts[1]);
  if (
    await crypto.subtle.verify({ name: 'HMAC' }, key, decodeBase64Url(jwtParts[2]) as unknown as ArrayBuffer, data) ===
      true
  ) {
    return JSON.parse(dataToText(decodeBase64Url(jwtParts[1]))) as T;
  }

  throw new Error('Invalid JWT');
}

export async function resolveCookieDomain(request: Request) {
  const config = await AppConfig.getConfig();
  const baseUrl = config.auth.baseUrl;

  if (!isUrlAnIp(baseUrl) || isRunningLocally(request)) {
    const domain = new URL(request.url).hostname;
    if (await AppConfig.isCookieDomainAllowed(domain)) {
      return domain;
    }
    return baseUrl.replace('https://', '').replace('http://', '').split(':')[0];
  }
  return '';
}

export async function getDataFromRequest(
  request: Request,
): Promise<{ user: User; session: UserSession | undefined; tokenData?: JwtData['data'] } | null> {
  const cookies = getCookies(request.headers);
  const authorizationHeader = request.headers.get('authorization');

  if (cookies[COOKIE_NAME]) {
    const result = await getDataFromCookie(cookies[COOKIE_NAME]);

    if (result) {
      return result;
    }
  }

  if (authorizationHeader) {
    const result = await getDataFromAuthorizationHeader(authorizationHeader);

    if (result) {
      return result;
    }
  }

  return null;
}

async function getDataFromAuthorizationHeader(authorizationHeader: string) {
  if (!authorizationHeader) {
    return null;
  }

  // Only basic auth is supported for now
  if (!authorizationHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    const basicAuthHash = authorizationHeader.split('Basic ')[1] || '';

    const [basicAuthUsername, basicAuthPassword] = dataToText(decodeBase64(basicAuthHash)).split(':');

    const hashedPassword = await generateHash(`${basicAuthPassword}:${PASSWORD_SALT}`, 'SHA-256');

    const user = await UserModel.getByEmail(basicAuthUsername);

    if (!user || (user.hashed_password !== hashedPassword && user.extra.dav_hashed_password !== hashedPassword)) {
      throw new Error('Email not found or invalid password.');
    }

    return { user, session: undefined };
  } catch (error) {
    console.error(error);
  }

  return null;
}

async function getDataFromCookie(
  cookieValue: string,
): Promise<{ user: User; session: UserSession | undefined; tokenData?: JwtData['data'] } | null> {
  if (!cookieValue) {
    return null;
  }

  const key = await generateKey(JWT_SECRET);

  try {
    const token = await verifyAuthJwt(key, cookieValue) as JwtData;

    const { user, session } = await validateUserAndSession(token.data.user_id, token.data.session_id);

    return { user, session, tokenData: token.data };
  } catch (error) {
    console.error(error);
  }

  return null;
}

export async function generateToken<T = JwtData>(tokenData: T): Promise<string> {
  const key = await generateKey(JWT_SECRET);

  const token = await signAuthJwt<{ data: T }>(key, { data: tokenData });

  return token;
}

export async function logoutUser(request: Request) {
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1));

  const cookies = getCookies(request.headers);

  const result = await getDataFromCookie(cookies[COOKIE_NAME]);

  if (!result || !result.tokenData?.session_id || !result.user) {
    throw new Error('Invalid session');
  }

  const { tokenData } = result;
  const { session_id } = tokenData;

  // Delete user session
  await UserSessionModel.delete(session_id);

  // Generate response with empty and expiring cookie
  const cookie: Cookie = {
    name: COOKIE_NAME,
    value: '',
    expires: tomorrow,
    path: '/',
    secure: isRunningLocally(request) ? false : true,
    httpOnly: true,
    sameSite: 'Lax',
    domain: await resolveCookieDomain(request),
  };

  if (await AppConfig.isCookieDomainSecurityDisabled()) {
    delete cookie.domain;
  }

  const response = new Response('Logged Out', {
    status: 303,
    headers: { 'Location': '/', 'Content-Type': 'text/html; charset=utf-8' },
  });

  setCookie(response.headers, cookie);

  return response;
}

export async function createSessionResponse(
  request: Request,
  user: User,
  { urlToRedirectTo = '/' }: {
    urlToRedirectTo?: string;
  } = {},
) {
  const response = new Response('Logged In', {
    status: 303,
    headers: { 'Location': urlToRedirectTo, 'Content-Type': 'text/html; charset=utf-8' },
  });

  const responseWithCookie = await createSessionCookie(request, user, response);

  return responseWithCookie;
}

export async function createSessionCookie(
  request: Request,
  user: User,
  response: Response,
  isShortLived = false,
) {
  const newSession = await UserSessionModel.create(user, isShortLived);

  // Generate response with session cookie
  const token = await generateToken({ user_id: user.id, session_id: newSession.id });

  const cookie: Cookie = {
    name: COOKIE_NAME,
    value: token,
    expires: newSession.expires_at,
    path: '/',
    secure: isRunningLocally(request) ? false : true,
    httpOnly: true,
    sameSite: 'Lax',
    domain: await resolveCookieDomain(request),
  };

  if (await AppConfig.isCookieDomainSecurityDisabled()) {
    delete cookie.domain;
  }

  setCookie(response.headers, cookie);

  return response;
}
