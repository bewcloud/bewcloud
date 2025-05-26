import { Handlers } from 'fresh/server.ts';
import { FreshContextState, TwoFactorActionResponse } from '/lib/types.ts';
import { enableTwoFactorMethod, verifyTOTP } from '/lib/utils/two-factor.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

interface EnableRequestBody {
  methodId: string;
  code: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' } as TwoFactorActionResponse), {
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
          } as TwoFactorActionResponse,
        ),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { user } = context.state;

    try {
      const body = await request.json() as EnableRequestBody;
      const { methodId, code } = body;

      if (!methodId || !code) {
        return new Response(
          JSON.stringify(
            { success: false, error: 'Method ID and verification code are required' } as TwoFactorActionResponse,
          ),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const method = user.extra.two_factor_methods?.find((m) => m.id === methodId);
      if (!method) {
        return new Response(
          JSON.stringify({ success: false, error: 'Two-factor method not found' } as TwoFactorActionResponse),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (method.enabled) {
        return new Response(
          JSON.stringify({ success: false, error: 'Two-factor method is already enabled' } as TwoFactorActionResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (method.type === 'totp') {
        const secret = method.metadata.totp?.secret;
        if (!secret) {
          return new Response(
            JSON.stringify({ success: false, error: 'TOTP secret not found' } as TwoFactorActionResponse),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        const isValid = verifyTOTP(secret, code);
        if (!isValid) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid verification code' } as TwoFactorActionResponse),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      }

      await enableTwoFactorMethod(user, methodId);
      await UserModel.update(user);

      return new Response(JSON.stringify({ success: true } as TwoFactorActionResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Two-factor enable error:', error);
      return new Response(
        JSON.stringify(
          { success: false, error: 'Failed to enable two-factor authentication' } as TwoFactorActionResponse,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
