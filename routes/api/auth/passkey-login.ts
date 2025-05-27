import { Handlers } from 'fresh/server.ts';
import { FreshContextState, User } from '/lib/types.ts';
import { generatePasskeyAuthenticationOptions, verifyPasskeyAuthentication } from '/lib/utils/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getEnabledTwoFactorMethods } from '/lib/utils/two-factor.ts';

interface PasskeyLoginRequest {
  stage: 'begin' | 'verify';
  challenge?: string;
  authenticationResponse?: any;
  redirectUrl?: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!(await AppConfig.isTwoFactorEnabled())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Passwordless passkey login requires two-factor authentication to be enabled',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    try {
      const body = await request.json() as PasskeyLoginRequest;
      const { stage } = body;

      if (stage === 'begin') {
        const config = await AppConfig.getConfig();

        const options = await generatePasskeyAuthenticationOptions(
          config.auth.baseUrl,
          [], // Empty array for passwordless - allow any registered passkey
        );

        return new Response(
          JSON.stringify({
            success: true,
            options,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } else if (stage === 'verify') {
        const { challenge, authenticationResponse, redirectUrl } = body;

        if (!challenge || !authenticationResponse) {
          return new Response(
            JSON.stringify({ success: false, error: 'Challenge and authentication response are required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        const credentialId = authenticationResponse.id;
        if (!credentialId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid credential ID' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        let matchedUser: User | null = null;
        let matchedCredential = null;

        try {
          const { default: Database, sql } = await import('/lib/interfaces/database.ts');
          const db = new Database();
          const potentialUsers = await db.query<User>(
            sql`
            SELECT * FROM "bewcloud_users" 
            WHERE "extra"::text LIKE $1
          `,
            [`%${credentialId}%`],
          );

          for (const user of potentialUsers) {
            const methods = getEnabledTwoFactorMethods(user);
            const passkeyMethods = methods.filter((m) => m.type === 'passkey');

            for (const method of passkeyMethods) {
              const passkeyData = method.metadata.passkey;
              if (passkeyData && passkeyData.credential_id === credentialId) {
                matchedUser = user;
                matchedCredential = {
                  credentialID: passkeyData.credential_id,
                  credentialPublicKey: passkeyData.public_key,
                  counter: passkeyData.counter || 0,
                  credentialDeviceType: passkeyData.device_type || 'unknown',
                  credentialBackedUp: passkeyData.backed_up || false,
                  transports: passkeyData.transports || [],
                };
                break;
              }
            }
            if (matchedUser) break;
          }
        } catch (dbError) {
          console.error('Database search error:', dbError);
          throw new Error('Failed to search for passkey user');
        }

        if (!matchedUser || !matchedCredential) {
          return new Response(
            JSON.stringify({ success: false, error: 'Passkey not found or not registered' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        const config = await AppConfig.getConfig();
        const verification = await verifyPasskeyAuthentication(
          authenticationResponse,
          challenge,
          config.auth.baseUrl,
          new URL(config.auth.baseUrl).hostname,
          matchedCredential,
        );

        if (!verification.verified) {
          return new Response(
            JSON.stringify({ success: false, error: 'Passkey verification failed' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        // Update the counter for replay attack protection
        const methods = getEnabledTwoFactorMethods(matchedUser);
        const passkeyMethod = methods.find((m) =>
          m.type === 'passkey' &&
          m.metadata.passkey?.credential_id === credentialId
        );

        if (passkeyMethod?.metadata.passkey) {
          passkeyMethod.metadata.passkey.counter = verification.authenticationInfo.newCounter;
          await UserModel.update(matchedUser);
        }

        return await createSessionResponse(request, matchedUser, {
          urlToRedirectTo: redirectUrl || '/',
        });
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid stage parameter' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    } catch (error) {
      console.error('Passwordless passkey login error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to process passkey login',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
