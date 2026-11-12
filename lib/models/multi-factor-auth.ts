import { Cookie, getCookies, setCookie } from '@std/http';

import { MultiFactorAuthMethod, User } from '/lib/types.ts';
import {
  getEnabledMultiFactorAuthMethodsFromUser,
  getMultiFactorAuthMethodByIdFromUser,
  shouldSendEmailCodeOnLogin,
} from '/public/ts/utils/multi-factor-auth.ts';
import {
  COOKIE_NAME as AUTH_COOKIE_NAME,
  generateKey,
  generateToken,
  JWT_SECRET,
  JwtData,
  resolveCookieDomain,
  verifyAuthJwt,
} from '/lib/auth.ts';
import { isRunningLocally } from '/public/ts/utils/misc.ts';
import { getSafeRedirectUrl } from '/public/ts/utils/redirect.ts';
import { AppConfig } from '/lib/config.ts';
import { UserModel } from './user.ts';
import { EmailModel } from './multi-factor-auth/email.ts';

const COOKIE_NAME = `${AUTH_COOKIE_NAME}-mfa`;
const MFA_SESSION_ID = 'mfa';

interface MultiFactorAuthJwtData extends JwtData {
  data: JwtData['data'] & {
    // Scoped to the pending login (this cookie), so a new login starts without it
    is_email_code_sent?: boolean;
  };
}

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

  static async createSessionResponse(
    request: Request,
    user: User,
    { urlToRedirectTo = '/' }: {
      urlToRedirectTo?: string;
    } = {},
  ) {
    const safeRedirectUrl = getSafeRedirectUrl(urlToRedirectTo);

    const response = new Response('MFA Required', {
      status: 303,
      headers: {
        'Location': `/mfa-verify?user=${user.id}&redirect=${encodeURIComponent(safeRedirectUrl)}`,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

    try {
      if (shouldSendEmailCodeOnLogin(user)) {
        const enabledMultiFactorAuthMethods = getEnabledMultiFactorAuthMethodsFromUser(user);

        const emailMethod = enabledMultiFactorAuthMethods.find((method) => method.type === 'email');

        if (emailMethod) {
          await EmailModel.createAndSendCode(emailMethod.id, user);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const responseWithCookie = await this.createSessionCookie(request, user, response);

    return responseWithCookie;
  }

  static async markEmailCodeAsSent(request: Request, user: User, response: Response) {
    return await this.createSessionCookie(request, user, response, { isEmailCodeSent: true });
  }

  private static async createSessionCookie(
    request: Request,
    user: User,
    response: Response,
    { isEmailCodeSent = false }: { isEmailCodeSent?: boolean } = {},
  ) {
    const token = await generateToken<MultiFactorAuthJwtData['data']>({
      user_id: user.id,
      session_id: MFA_SESSION_ID,
      ...(isEmailCodeSent ? { is_email_code_sent: true } : {}),
    });

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

  static async getDataFromRequest(request: Request): Promise<{ user: User; isEmailCodeSent: boolean } | null> {
    const cookies = getCookies(request.headers);

    if (cookies[COOKIE_NAME]) {
      const result = await this.getDataFromCookie(cookies[COOKIE_NAME]);

      if (result) {
        return result;
      }
    }

    return null;
  }

  private static async getDataFromCookie(
    cookieValue: string,
  ): Promise<{ user: User; isEmailCodeSent: boolean } | null> {
    if (!cookieValue) {
      return null;
    }

    const key = await generateKey(JWT_SECRET);

    try {
      const token = await verifyAuthJwt<MultiFactorAuthJwtData>(key, cookieValue);

      const user = await UserModel.getById(token.data.user_id);

      if (!user || token.data.session_id !== MFA_SESSION_ID) {
        throw new Error('Not Found');
      }

      return { user, isEmailCodeSent: token.data.is_email_code_sent === true };
    } catch (error) {
      console.error(error);
    }

    return null;
  }
}
