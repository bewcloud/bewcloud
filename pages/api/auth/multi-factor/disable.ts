import { FreshContextState } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { UserModel } from '/lib/models/user.ts';
import { getMultiFactorAuthMethodByIdFromUser } from '/lib/utils/multi-factor-auth.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';

export interface RequestBody {
  methodId?: string;
  password: string;
  disableAll?: boolean;
}

export interface ResponseBody {
  success: boolean;
  error?: string;
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
    const { methodId, password, disableAll } = body;

    if (!password) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Password is required',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

    if (user.hashed_password !== hashedPassword) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Invalid password',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    if (disableAll) {
      user.extra.multi_factor_auth_methods = [];

      await UserModel.update(user);

      const responseBody: ResponseBody = {
        success: true,
      };

      return new Response(JSON.stringify(responseBody));
    }

    if (!methodId) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Method ID is required when not disabling all methods',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const method = getMultiFactorAuthMethodByIdFromUser(user, methodId);

    if (!method) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Multi-factor authentication method not found',
      };

      return new Response(JSON.stringify(responseBody), { status: 404 });
    }

    if (!method.enabled) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Multi-factor authentication method is not enabled',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    MultiFactorAuthModel.disableMethodFromUser(user, methodId);

    await UserModel.update(user);

    const responseBody: ResponseBody = {
      success: true,
    };

    return new Response(JSON.stringify(responseBody));
  },
};
