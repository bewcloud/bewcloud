import { RouteHandler } from 'fresh';
import { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';

import { FreshContextState } from '/lib/types.ts';
import { PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  email: string;
}

export interface ResponseBody {
  success: boolean;
  error?: string;
  options?: PublicKeyCredentialCreationOptionsJSON;
  sessionData?: {
    challenge: string;
    methodId: string;
  };
}

export const handler: RouteHandler<unknown, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passwordless passkey login requires multi-factor authentication to be enabled.',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const body = await request.clone().json() as RequestBody;
    const { email } = body;

    if (!email) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Email is required',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const user = await UserModel.getByEmail(email);

    if (!user) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'User not found',
      };

      return new Response(JSON.stringify(responseBody), { status: 404 });
    }

    const config = await AppConfig.getConfig();
    const allowedCredentials = PasskeyModel.getCredentialsFromUser(user);

    if (allowedCredentials.length === 0) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'No passkeys registered for this user',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const options = await PasskeyModel.generateAuthenticationOptions(
      config.auth.baseUrl,
      allowedCredentials,
    );

    const responseBody: ResponseBody = {
      success: true,
      options,
      sessionData: {
        challenge: options.challenge,
        methodId: options.challenge,
      },
    };

    return new Response(JSON.stringify(responseBody));
  },
};
