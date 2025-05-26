import { Handlers } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { generateTOTPSecret, generateQRCodeDataURL, generateBackupCodes } from '/lib/utils/totp.ts';
import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';

export const handler: Handlers<unknown, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { user } = context.state;

    if (user.extra.totp_enabled) {
      return new Response(JSON.stringify({ error: 'TOTP is already enabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const config = await AppConfig.getConfig();
      const issuer = new URL(config.auth.baseUrl).hostname;
      
      const secret = generateTOTPSecret();
      const backupCodes = generateBackupCodes();
      const qrCodeUrl = await generateQRCodeDataURL(secret, issuer, user.email);

      return new Response(JSON.stringify({
        secret,
        qrCodeUrl,
        backupCodes,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('TOTP setup error:', error);
      return new Response(JSON.stringify({ error: 'Failed to setup TOTP' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
}; 