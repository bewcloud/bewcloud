import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { verifyTOTPToken } from '/lib/utils/totp.ts';
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
    
    try {
      const body = await request.json();
      const { secret, token, backupCodes } = body;

      if (!secret || !token || !backupCodes) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!verifyTOTPToken(secret, token)) {
        return new Response(JSON.stringify({ error: 'Invalid TOTP token' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      user.extra.totp_secret = secret;
      user.extra.totp_enabled = true;
      user.extra.totp_backup_codes = backupCodes;

      await UserModel.update(user);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('TOTP enable error:', error);
      return new Response(JSON.stringify({ error: 'Failed to enable TOTP' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
}; 