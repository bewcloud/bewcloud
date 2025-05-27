import { Handlers } from 'fresh/server.ts';
import { FreshContextState, TwoFactorActionResponse } from '/lib/types.ts';
import { createPasskeyTwoFactorMethod, verifyPasskeyRegistration } from '/lib/utils/passkey.ts';
import { getTwoFactorMethodById } from '/lib/utils/two-factor.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

interface PasskeyRegisterCompleteRequest {
  methodId: string;
  challenge: string;
  registrationResponse: any;
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
        JSON.stringify({
          success: false,
          error: 'Two-factor authentication is not enabled on this server',
        } as TwoFactorActionResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { user } = context.state;

    try {
      const body = await request.json() as PasskeyRegisterCompleteRequest;
      const { methodId, challenge, registrationResponse } = body;

      if (!methodId || !challenge || !registrationResponse) {
        return new Response(
          JSON.stringify(
            {
              success: false,
              error: 'Method ID, challenge, and registration response are required',
            } as TwoFactorActionResponse,
          ),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const method = getTwoFactorMethodById(user, methodId);
      if (!method || method.type !== 'passkey') {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid passkey method' } as TwoFactorActionResponse),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const config = await AppConfig.getConfig();
      const expectedOrigin = config.auth.baseUrl;
      const expectedRPID = new URL(config.auth.baseUrl).hostname;

      const verification = await verifyPasskeyRegistration(
        registrationResponse,
        challenge,
        expectedOrigin,
        expectedRPID,
      );

      if (!verification.verified || !verification.registrationInfo) {
        return new Response(
          JSON.stringify(
            { success: false, error: 'Passkey registration verification failed' } as TwoFactorActionResponse,
          ),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const { registrationInfo } = verification;
      const credentialID = registrationInfo.credential.id;
      const credentialPublicKey = isoBase64URL.fromBuffer(registrationInfo.credential.publicKey);

      if (method.metadata.passkey) {
        method.metadata.passkey.credential_id = credentialID;
        method.metadata.passkey.public_key = credentialPublicKey;
        method.metadata.passkey.counter = registrationInfo.credential.counter;
        method.metadata.passkey.device_type = registrationInfo.credentialDeviceType;
        method.metadata.passkey.backed_up = registrationInfo.credentialBackedUp;
        method.metadata.passkey.transports = registrationResponse.response?.transports || [];
      }

      await UserModel.update(user);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Passkey registered successfully',
        } as TwoFactorActionResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Passkey registration complete error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to complete passkey registration',
        } as TwoFactorActionResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
