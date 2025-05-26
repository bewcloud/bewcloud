import { Handlers, PageProps } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { verifyBackupCode, verifyTOTPToken } from '/lib/utils/totp.ts';
import { UserModel } from '/lib/models/user.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { AppConfig } from '/lib/config.ts';

interface Data {
  error?: {
    title: string;
    message: string;
  };
  userId?: string;
  redirectUrl?: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!(await AppConfig.isTOTPEnabled())) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user');
    const redirectUrl = url.searchParams.get('redirect') || '/';

    if (!userId) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const user = await UserModel.getById(userId);

    if (!user || !user.extra.totp_enabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    return await context.render({
      userId,
      redirectUrl,
    });
  },
  async POST(request, context) {
    if (!(await AppConfig.isTOTPEnabled())) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user');
    const redirectUrl = url.searchParams.get('redirect') || '/';

    if (!userId) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const user = await UserModel.getById(userId);

    if (!user || !user.extra.totp_enabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    try {
      const formData = await request.formData();
      const token = getFormDataField(formData, 'token');

      if (!token) {
        throw new Error('TOTP token is required');
      }

      let isValid = false;

      if (token.length === 6 && /^\d+$/.test(token)) {
        isValid = verifyTOTPToken(user.extra.totp_secret!, token);
      } else if (token.length === 8 && /^[a-fA-F0-9]+$/.test(token)) {
        const { isValid: backupValid, remainingCodes } = verifyBackupCode(
          user.extra.totp_backup_codes || [],
          token.toLowerCase(),
        );

        if (backupValid) {
          isValid = true;
          user.extra.totp_backup_codes = remainingCodes;
          await UserModel.update(user);
        }
      }

      if (!isValid) {
        throw new Error('Invalid TOTP token or backup code');
      }

      return await createSessionResponse(request, user, { urlToRedirectTo: redirectUrl });
    } catch (error) {
      console.error('TOTP verification error:', error);

      return await context.render({
        error: {
          title: 'Verification Failed',
          message: (error as Error).message,
        },
        userId,
        redirectUrl,
      });
    }
  },
};

export default function TOTPVerifyPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main class='mx-auto max-w-7xl my-8'>
      <section class='max-w-screen-sm mx-auto'>
        <h1 class='text-3xl mb-8 text-center'>Two-Factor Authentication</h1>

        {data.error && (
          <section class='notification-error'>
            <h3>{data.error.title}</h3>
            <p>{data.error.message}</p>
          </section>
        )}

        <p class='mb-6 text-center'>
          Enter your 6-digit TOTP code from your authenticator app, or use one of your backup codes.
        </p>

        <form
          method='POST'
          action={`/totp-verify?user=${data.userId}&redirect=${encodeURIComponent(data.redirectUrl || '/')}`}
        >
          <div class='mb-4'>
            <label for='token' class='block text-sm font-medium mb-2'>
              TOTP Code or Backup Code
            </label>
            <input
              type='text'
              id='token'
              name='token'
              placeholder='123456 or backup code'
              class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              autocomplete='one-time-code'
              required
            />
          </div>

          <button
            type='submit'
            class='button'
          >
            Verify
          </button>
        </form>

        <div class='mt-6 text-center'>
          <a href='/login' class='text-blue-600 hover:text-blue-800'>
            Back to Login
          </a>
        </div>
      </section>
    </main>
  );
}
