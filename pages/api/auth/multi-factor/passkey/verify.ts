import { AuthenticationResponseJSON } from '@simplewebauthn/server';

import { FreshContextState } from '/lib/types.ts';
import { PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { createSessionResponse } from '/lib/auth.ts';

export interface RequestBody {
  email: string;
  challenge: string;
  authenticationResponse: AuthenticationResponseJSON;
  redirectUrl?: string;
}

export interface ResponseBody {
  success: boolean;
  error?: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request) {
    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Multi-factor authentication is not enabled on this server',
      };

      return new Response(JSON.stringify(responseBody), { status: 403 });
    }

    const body = await request.clone().json() as RequestBody;
    const { email, challenge, authenticationResponse, redirectUrl } = body;

    if (!email || !challenge || !authenticationResponse) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Email, challenge, and authentication response are required',
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
    const expectedOrigin = config.auth.baseUrl;
    const expectedRPID = new URL(config.auth.baseUrl).hostname;

    const userCredentials = PasskeyModel.getCredentialsFromUser(user);
    const credentialID = authenticationResponse.id;

    const credential = userCredentials.find((credential) => credential.credentialID === credentialID);
    if (!credential) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Credential not found for this user',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    const verification = await PasskeyModel.verifyAuthentication(
      authenticationResponse,
      challenge,
      expectedOrigin,
      expectedRPID,
      credential,
    );

    if (!verification.verified) {
      const responseBody: ResponseBody = {
        success: false,
        error: 'Passkey authentication verification failed',
      };

      return new Response(JSON.stringify(responseBody), { status: 400 });
    }

    // Update the counter to protect against replay attacks
    PasskeyModel.updateCounterForUser(user, credentialID, verification.authenticationInfo.newCounter);
    await UserModel.update(user);

    return await createSessionResponse(request, user, {
      urlToRedirectTo: redirectUrl || '/',
    });
  },
};
