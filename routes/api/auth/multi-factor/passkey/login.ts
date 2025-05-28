import { Handlers } from 'fresh/server.ts';
import { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { PasskeyCredential, PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { UserModel } from '/lib/models/user.ts';

export interface RequestBody {
  stage: 'begin' | 'verify';
  challenge?: string;
  authenticationResponse?: AuthenticationResponseJSON;
  redirectUrl?: string;
}

export interface ResponseBody {
  success: boolean;
  error?: string;
  options?: PublicKeyCredentialCreationOptionsJSON;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request) {
    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passwordless passkey login requires multi-factor authentication to be enabled.',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const config = await AppConfig.getConfig();

    const requestBody = await request.clone().json() as RequestBody;
    const { stage, challenge, authenticationResponse, redirectUrl } = requestBody;

    if (stage === 'begin') {
      const options = await PasskeyModel.generateAuthenticationOptions(
        config.auth.baseUrl,
        [], // Empty array for passwordless - allow any registered passkey
      );

      const responseBody: ResponseBody = {
        success: true,
        options,
      };

      return new Response(JSON.stringify(responseBody));
    }

    if (!challenge || !authenticationResponse) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Challenge and authentication response are required for verification stage.',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const credentialId = authenticationResponse.id;
    if (!credentialId) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Invalid credential ID',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const user = await UserModel.getByPasskeyCredentialId(credentialId);

    if (!user) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey not found or not registered',
      };

      return new Response(JSON.stringify(responseBody), { status: 404 });
    }

    const matchingPasskeyMethod = user.extra.multi_factor_auth_methods?.find((method) =>
      method.type === 'passkey' && method.metadata.passkey?.credential_id === credentialId
    );

    if (!matchingPasskeyMethod) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey not found or not registered',
      };

      return new Response(JSON.stringify(responseBody), { status: 404 });
    }

    const passkeyCredential: PasskeyCredential = {
      credentialID: matchingPasskeyMethod.metadata.passkey!.credential_id,
      credentialPublicKey: matchingPasskeyMethod.metadata.passkey!.public_key,
      counter: matchingPasskeyMethod.metadata.passkey!.counter || 0,
      credentialDeviceType: matchingPasskeyMethod.metadata.passkey!.device_type || 'unknown',
      credentialBackedUp: matchingPasskeyMethod.metadata.passkey!.backed_up || false,
      transports: matchingPasskeyMethod.metadata.passkey!.transports || [],
    };

    const verification = await PasskeyModel.verifyAuthentication(
      authenticationResponse,
      challenge,
      config.auth.baseUrl,
      new URL(config.auth.baseUrl).hostname,
      passkeyCredential,
    );

    if (!verification.verified) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey verification failed',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    // Update the counter to protect against replay attacks
    PasskeyModel.updateCounterForUser(
      user,
      matchingPasskeyMethod.metadata.passkey!.credential_id,
      verification.authenticationInfo.newCounter,
    );
    await UserModel.update(user);

    return await createSessionResponse(request, user, {
      urlToRedirectTo: redirectUrl || '/',
    });
  },
};
