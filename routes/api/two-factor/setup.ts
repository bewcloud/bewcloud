import { Handlers } from 'fresh/server.ts';
import { FreshContextState, TwoFactorSetupResponse } from '/lib/types.ts';
import { createTwoFactorMethod } from '/lib/utils/two-factor.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

interface SetupRequestBody {
  type: 'totp' | 'email' | 'passkey';
  name: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' } as TwoFactorSetupResponse), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!(await AppConfig.isTwoFactorEnabled())) {
      return new Response(
        JSON.stringify(
          {
            success: false,
            error: 'Two-factor authentication is not enabled on this server',
          } as TwoFactorSetupResponse,
        ),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { user } = context.state;

    try {
      const body = await request.json() as SetupRequestBody;
      const { type, name } = body;

      if (!type || !name) {
        return new Response(
          JSON.stringify({ success: false, error: 'Type and name are required' } as TwoFactorSetupResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (type !== 'totp') {
        return new Response(
          JSON.stringify(
            { success: false, error: `${type} authentication is not yet supported` } as TwoFactorSetupResponse,
          ),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const config = await AppConfig.getConfig();
      const issuer = new URL(config.auth.baseUrl).hostname;
      const setup = await createTwoFactorMethod(type, name, issuer, user.email);

      if (!user.extra.two_factor_methods) {
        user.extra.two_factor_methods = [];
      }

      user.extra.two_factor_methods.push(setup.method);
      await UserModel.update(user);

      const responseData: TwoFactorSetupResponse = {
        success: true,
        data: {
          methodId: setup.method.id,
          secret: setup.method.metadata.totp?.secret,
          qrCodeUrl: setup.qrCodeUrl,
          backupCodes: setup.method.metadata.totp?.backup_codes,
        },
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Two-factor setup error:', error);
      return new Response(
        JSON.stringify(
          { success: false, error: 'Failed to setup two-factor authentication' } as TwoFactorSetupResponse,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
