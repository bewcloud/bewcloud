import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { UserModel } from '/lib/models/user.ts';

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { user } = context.state;

    if (!user.extra.totp_enabled) {
      return new Response(JSON.stringify({ error: 'TOTP is not enabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      const body = await request.json();
      const { password } = body;

      if (!password) {
        return new Response(JSON.stringify({ error: 'Password is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

      if (user.hashed_password !== hashedPassword) {
        return new Response(JSON.stringify({ error: 'Invalid password' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      delete user.extra.totp_secret;
      delete user.extra.totp_enabled;
      delete user.extra.totp_backup_codes;

      await UserModel.update(user);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('TOTP disable error:', error);
      return new Response(JSON.stringify({ error: 'Failed to disable TOTP' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
}; 