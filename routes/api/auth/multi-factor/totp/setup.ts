import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';

export interface RequestBody {}

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

export const handler: RouteHandler<unknown, FreshContextState> = {
  async POST(context) {
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

    const config = await AppConfig.getConfig();
    const issuer = new URL(config.auth.baseUrl).hostname;
    const methodId = MultiFactorAuthModel.generateMethodId();
    const setup = await TOTPModel.createMethod(methodId, 'Authenticator App', issuer, user.email);

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
