import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { generatePasskeyAuthenticationOptions, getPasskeyCredentialsFromUser } from '/lib/utils/passkey.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

interface PasskeyAuthBeginRequest {
  userId?: string;
  email?: string;
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
      const body = await request.json() as PasskeyAuthBeginRequest;
      const { userId, email } = body;

      let user;
      if (userId) {
        user = await UserModel.getById(userId);
      } else if (email) {
        user = await UserModel.getByEmail(email);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'User ID or email is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

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
      const allowCredentials = getPasskeyCredentialsFromUser(user);

      if (allowCredentials.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No passkeys registered for this user' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const options = await generatePasskeyAuthenticationOptions(
        config.auth.baseUrl,
        allowCredentials,
      );

      return new Response(
        JSON.stringify({
          success: true,
          options,
          userId: user.id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Passkey authentication begin error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to begin passkey authentication',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
