import { Handlers } from 'fresh/server.ts';
import { FreshContextState, TwoFactorActionResponse } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { UserModel } from '/lib/models/user.ts';
import { getTwoFactorMethodById, getTwoFactorMethods } from '/lib/utils/two-factor.ts';
import { AppConfig } from '/lib/config.ts';

interface DisableRequestBody {
  methodId?: string;
  password: string;
  disableAll?: boolean;
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
      const body = await request.json() as DisableRequestBody;
      const { methodId, password, disableAll } = body;

      if (!password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Password is required' } as TwoFactorActionResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

      if (user.hashed_password !== hashedPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid password' } as TwoFactorActionResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (disableAll) {
        delete user.extra.two_factor_methods;

        await UserModel.update(user);

        return new Response(
          JSON.stringify(
            {
              success: true,
              message: 'All two-factor authentication methods have been disabled',
            } as TwoFactorActionResponse,
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (!methodId) {
        return new Response(
          JSON.stringify(
            {
              success: false,
              error: 'Method ID is required when not disabling all methods',
            } as TwoFactorActionResponse,
          ),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const methods = getTwoFactorMethods(user);
      const method = getTwoFactorMethodById(user, methodId);

      if (!method) {
        return new Response(
          JSON.stringify({ success: false, error: 'Two-factor method not found' } as TwoFactorActionResponse),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (!method.enabled) {
        return new Response(
          JSON.stringify({ success: false, error: 'Two-factor method is not enabled' } as TwoFactorActionResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const updatedMethods = methods.filter((m) => m.id !== methodId);
      user.extra.two_factor_methods = updatedMethods;

      await UserModel.update(user);

      return new Response(
        JSON.stringify(
          {
            success: true,
            message: 'Two-factor authentication method disabled successfully',
          } as TwoFactorActionResponse,
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Two-factor disable error:', error);
      return new Response(
        JSON.stringify(
          { success: false, error: 'Failed to disable two-factor authentication' } as TwoFactorActionResponse,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
