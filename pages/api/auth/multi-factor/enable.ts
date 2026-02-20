import page, { RequestHandlerParams } from '/lib/page.ts';

import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';
import { EmailModel } from '/lib/models/multi-factor-auth/email.ts';
import { getMultiFactorAuthMethodByIdFromUser } from '/public/ts/utils/multi-factor-auth.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  methodId: string;
  code: string | 'passkey-verified';
}

export interface ResponseBody {
  success: boolean;
  error?: string;
}

async function post({ request, user }: RequestHandlerParams) {
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

  if (!isMultiFactorAuthEnabled) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Multi-factor authentication is not enabled on this server',
    };

    return new Response(JSON.stringify(responseBody), { status: 403 });
  }

  const body = await request.clone().json() as RequestBody;
  const { methodId, code } = body;

  if (!methodId || !code) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Method ID and verification code are required',
    };

    return new Response(JSON.stringify(responseBody), { status: 400 });
  }

  const method = getMultiFactorAuthMethodByIdFromUser(user!, methodId);
  if (!method) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Multi-factor authentication method not found',
    };

    return new Response(JSON.stringify(responseBody), { status: 404 });
  }

  if (method.enabled) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Multi-factor authentication method is already enabled',
    };

    return new Response(JSON.stringify(responseBody), { status: 400 });
  }

  if (method.type === 'totp') {
    const hashedSecret = method.metadata.totp?.hashed_secret;
    if (!hashedSecret) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'TOTP secret not found',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    try {
      const secret = await TOTPModel.decryptTOTPSecret(hashedSecret);
      const isValid = TOTPModel.verifyTOTP(secret, code);
      if (!isValid) {
        const responseBody: ResponseBody = {
          success: false,
          error: 'Invalid verification code',
        };

        return new Response(JSON.stringify(responseBody), { status: 400 });
      }
    } catch {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Failed to decrypt TOTP secret',
      };

      return new Response(JSON.stringify(responseBody), { status: 500 });
    }
  } else if (method.type === 'passkey') {
    if (code !== 'passkey-verified') {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey not properly verified',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    if (!method.metadata.passkey?.credential_id || !method.metadata.passkey?.public_key) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey credentials not found',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }
  } else if (method.type === 'email') {
    try {
      const isValid = await EmailModel.verifyCode(method.id, code, user!);
      if (!isValid) {
        const responseBody: ResponseBody = {
          success: false,
          error: 'Invalid verification code',
        };

        return new Response(JSON.stringify(responseBody), { status: 400 });
      }
    } catch {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Failed to verify email verification code',
      };

      return new Response(JSON.stringify(responseBody), { status: 500 });
    }
  }

  MultiFactorAuthModel.enableMethodForUser(user!, methodId);

  await UserModel.update(user!);

  const responseBody: ResponseBody = {
    success: true,
  };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
