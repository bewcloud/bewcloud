import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import {
  getPasskeyCredentialsFromUser,
  updatePasskeyCounter,
  verifyPasskeyAuthentication,
} from '/lib/utils/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { createSessionResponse } from '/lib/auth.ts';

interface PasskeyAuthVerifyRequest {
  userId: string;
  challenge: string;
  authenticationResponse: any;
  redirectUrl?: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!(await AppConfig.isTwoFactorEnabled())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Two-factor authentication is not enabled on this server',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    try {
      const body = await request.json() as PasskeyAuthVerifyRequest;
      const { userId, challenge, authenticationResponse, redirectUrl } = body;

      if (!userId || !challenge || !authenticationResponse) {
        return new Response(
          JSON.stringify({ success: false, error: 'User ID, challenge, and authentication response are required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const user = await UserModel.getById(userId);
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'User not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const config = await AppConfig.getConfig();
      const expectedOrigin = config.auth.baseUrl;
      const expectedRPID = new URL(config.auth.baseUrl).hostname;

      const userCredentials = getPasskeyCredentialsFromUser(user);
      const credentialID = authenticationResponse.id;

      const credential = userCredentials.find((cred) => cred.credentialID === credentialID);
      if (!credential) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credential not found for this user' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const verification = await verifyPasskeyAuthentication(
        authenticationResponse,
        challenge,
        expectedOrigin,
        expectedRPID,
        credential,
      );

      if (!verification.verified) {
        return new Response(
          JSON.stringify({ success: false, error: 'Passkey authentication verification failed' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      updatePasskeyCounter(user, credentialID, verification.authenticationInfo.newCounter);
      await UserModel.update(user);

      return await createSessionResponse(request, user, {
        urlToRedirectTo: redirectUrl || '/',
      });
    } catch (error) {
      console.error('Passkey authentication verify error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify passkey authentication',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
