import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { generatePasskeyRegistrationOptions, getPasskeyCredentialsFromUser } from '/lib/utils/passkey.ts';
import { AppConfig } from '/lib/config.ts';

interface PasskeyRegisterBeginRequest {
  methodId: string;
}

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const { user } = context.state;

    try {
      const body = await request.json() as PasskeyRegisterBeginRequest;
      const { methodId } = body;

      if (!methodId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Method ID is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const config = await AppConfig.getConfig();
      const existingCredentials = getPasskeyCredentialsFromUser(user);

      const options = await generatePasskeyRegistrationOptions(
        user.id,
        user.email,
        config.auth.baseUrl,
        existingCredentials,
      );

      if (!context.state.session) {
        throw new Error('No session found');
      }

      const sessionData = {
        challenge: options.challenge,
        methodId,
        userId: user.id,
      };

      return new Response(
        JSON.stringify({
          success: true,
          options,
          sessionData,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Passkey registration begin error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to begin passkey registration',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
