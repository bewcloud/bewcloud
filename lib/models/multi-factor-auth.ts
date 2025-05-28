import { Cookie, getCookies, setCookie } from 'std/http/cookie.ts';

import { MultiFactorAuthMethod, MultiFactorAuthMethodType, User } from '/lib/types.ts';
import { getMultiFactorAuthMethodByIdFromUser } from '/lib/utils/multi-factor-auth.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';
import {
  COOKIE_NAME as AUTH_COOKIE_NAME,
  generateKey,
  generateToken,
  JWT_SECRET,
  JwtData,
  resolveCookieDomain,
  verifyAuthJwt,
} from '/lib/auth.ts';
import { isRunningLocally } from '/lib/utils/misc.ts';
import { AppConfig } from '/lib/config.ts';
import { UserModel } from './user.ts';

const COOKIE_NAME = `${AUTH_COOKIE_NAME}-mfa`;
const MFA_SESSION_ID = 'mfa';

export interface MultiFactorAuthSetup {
  method: MultiFactorAuthMethod;
  qrCodeUrl?: string;
  plainTextSecret?: string;
  plainTextBackupCodes?: string[];
}

export class MultiFactorAuthModel {
  static generateMethodId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  static async createMethod(
    type: MultiFactorAuthMethodType,
    name: string,
    issuer: string,
    accountName: string,
  ): Promise<MultiFactorAuthSetup> {
    const methodId = this.generateMethodId();

    switch (type) {
      case 'totp': {
        return await TOTPModel.createMethod(methodId, name, issuer, accountName);
      }

      case 'passkey': {
        // TODO: Is this correct? Or should we use the PasskeyModel.createMethod?
        const method: MultiFactorAuthMethod = {
          type: 'passkey',
          id: methodId,
          name,
          enabled: false,
          created_at: new Date(),
          metadata: {
            passkey: {
              credential_id: '',
              public_key: '',
              counter: 0,
              device_type: 'unknown',
              backed_up: false,
              transports: [],
            },
          },
        };

        return { method };
      }

      default:
        throw new Error(`Unsupported MFA method: ${type}`);
    }
  }

  static async verifyMultiFactorAuthToken(
    method: MultiFactorAuthMethod,
    token: string,
  ): Promise<{ isValid: boolean; remainingCodes?: string[] }> {
    switch (method.type) {
      case 'totp': {
        return await TOTPModel.verifyMethodToken(method.metadata, token);
      }

      case 'passkey': {
        // TODO: Is this correct? Or should we use the PasskeyModel.verifyMethodToken from here instead of directly?
        return { isValid: true };
      }

      default:
        return { isValid: false };
    }
  }

  static enableMethodForUser(
    user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
    methodId: string,
  ): void {
    const method = getMultiFactorAuthMethodByIdFromUser(user, methodId);
    if (method) {
      method.enabled = true;
    }
  }

  static disableMethodFromUser(
    user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
    methodId: string,
  ): void {
    const method = getMultiFactorAuthMethodByIdFromUser(user, methodId);
    if (method) {
      method.enabled = false;
    }
  }

  static removeMethodFromUser(
    user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
    methodId: string,
  ): void {
    if (!user.extra.multi_factor_auth_methods) {
      return;
    }

    const index = user.extra.multi_factor_auth_methods.findIndex((method) => method.id === methodId);
    if (index !== -1) {
      user.extra.multi_factor_auth_methods.splice(index, 1);
    }
  }

  static async createSessionResponse(
    request: Request,
    user: User,
    { urlToRedirectTo = '/' }: {
      urlToRedirectTo?: string;
    } = {},
  ) {
    const response = new Response('MFA Required', {
      status: 303,
      headers: {
        'Location': `/mfa-verify?user=${user.id}&redirect=${encodeURIComponent(urlToRedirectTo)}`,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

    const responseWithCookie = await this.createSessionCookie(request, user, response);

    return responseWithCookie;
  }

  private static async createSessionCookie(
    request: Request,
    user: User,
    response: Response,
  ) {
    const token = await generateToken({ user_id: user.id, session_id: MFA_SESSION_ID });

    const cookie: Cookie = {
      name: COOKIE_NAME,
      value: token,
      expires: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
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

  static async getDataFromRequest(request: Request): Promise<{ user: User } | null> {
    const cookies = getCookies(request.headers);

    if (cookies[COOKIE_NAME]) {
      const result = await this.getDataFromCookie(cookies[COOKIE_NAME]);

      if (result) {
        return result;
      }
    }

    return null;
  }

  private static async getDataFromCookie(cookieValue: string): Promise<{ user: User } | null> {
    if (!cookieValue) {
      return null;
    }

    const key = await generateKey(JWT_SECRET);

    try {
      const token = await verifyAuthJwt(key, cookieValue) as JwtData;

      const user = await UserModel.getById(token.data.user_id);

      if (!user || token.data.session_id !== MFA_SESSION_ID) {
        throw new Error('Not Found');
      }

      return { user };
    } catch (error) {
      console.error(error);
    }

    return null;
  }
}
