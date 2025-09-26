import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { RegistrationResponseJSON } from '@simplewebauthn/server';

import { FreshContextState } from '/lib/types.ts';
import { PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  methodId: string;
  challenge: string;
  registrationResponse: RegistrationResponseJSON;
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
        error: 'Passwordless passkey login requires multi-factor authentication to be enabled.',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const { user } = context.state;

    const body = await request.clone().json() as RequestBody;
    const { methodId, challenge, registrationResponse } = body;

    if (!methodId || !challenge || !registrationResponse) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Method ID, challenge, and registration response are required',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const config = await AppConfig.getConfig();
    const expectedOrigin = config.auth.baseUrl;
    const expectedRPID = new URL(config.auth.baseUrl).hostname;

    const verification = await PasskeyModel.verifyRegistration(
      registrationResponse,
      challenge,
      expectedOrigin,
      expectedRPID,
    );

    if (!verification.verified || !verification.registrationInfo) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey registration verification failed',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const { registrationInfo } = verification;
    const credentialID = registrationInfo.credential.id;
    const credentialPublicKey = isoBase64URL.fromBuffer(registrationInfo.credential.publicKey);

    const method = PasskeyModel.createMethod(
      methodId,
      'Passkey',
      credentialID,
      credentialPublicKey,
      registrationInfo.credential.counter,
      registrationInfo.credentialDeviceType,
      registrationInfo.credentialBackedUp,
      // @ts-expect-error SimpleWebAuthn supports a few more transports, and that's OK
      registrationResponse.response?.transports || [],
    );

    if (!user.extra.multi_factor_auth_methods) {
      user.extra.multi_factor_auth_methods = [];
    }

    user.extra.multi_factor_auth_methods.push(method);

    await UserModel.update(user);

    const responseBody: ResponseBody = {
      success: true,
    };

    return new Response(JSON.stringify(responseBody));
  },
};
