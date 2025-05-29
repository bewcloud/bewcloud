import { Handlers } from 'fresh/server.ts';
import { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';

export interface RequestBody {}

export interface ResponseBody {
  success: boolean;
  error?: string;
  options?: PublicKeyCredentialCreationOptionsJSON;
  sessionData?: {
    challenge: string;
    methodId: string;
    userId: string;
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
        error: 'Passwordless passkey login requires multi-factor authentication to be enabled.',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const { user } = context.state;

    const methodId = MultiFactorAuthModel.generateMethodId();

    const config = await AppConfig.getConfig();
    const existingCredentials = PasskeyModel.getCredentialsFromUser(user);

    const options = await PasskeyModel.generateRegistrationOptions(
      user.id,
      user.email,
      config.auth.baseUrl,
      existingCredentials,
    );

    const sessionData: ResponseBody['sessionData'] = {
      challenge: options.challenge,
      methodId,
      userId: user.id,
    };

    const responseBody: ResponseBody = {
      success: true,
      options,
      sessionData,
    };

    return new Response(JSON.stringify(responseBody));
  },
};
