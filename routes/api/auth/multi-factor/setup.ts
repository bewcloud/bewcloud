import { Handlers } from 'fresh/server.ts';

import { FreshContextState, MultiFactorAuthMethodType } from '/lib/types.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';

export interface RequestBody {
  type: MultiFactorAuthMethodType;
  name: string;
}

export interface ResponseBody {
  success: boolean;
  error?: string;
  data?: {
    methodId: string;
    secret?: string;
    qrCodeUrl?: string;
    backupCodes?: string[];
  };
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Multi-factor authentication is not enabled on this server',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const { user } = context.state;

    const body = await request.clone().json() as RequestBody;
    const { type, name } = body;

    if (!type || !name) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Type and name are required',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    if (type !== 'totp' && type !== 'passkey') {
      const responseBody: ResponseBody = {
        success: false,
        error: `${type} authentication is not supported`,
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const config = await AppConfig.getConfig();
    const issuer = new URL(config.auth.baseUrl).hostname;
    const setup = await MultiFactorAuthModel.createMethod(type, name, issuer, user.email);

    if (!user.extra.multi_factor_auth_methods) {
      user.extra.multi_factor_auth_methods = [];
    }

    user.extra.multi_factor_auth_methods.push(setup.method);

    await UserModel.update(user);

    const responseData: ResponseBody = {
      success: true,
      data: {
        methodId: setup.method.id,
        secret: setup.plainTextSecret,
        qrCodeUrl: setup.qrCodeUrl,
        backupCodes: setup.plainTextBackupCodes,
      },
    };

    return new Response(JSON.stringify(responseData));
  },
};
