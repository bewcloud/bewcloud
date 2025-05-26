import { Handlers, PageProps } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { getEnabledTwoFactorMethods, hasTwoFactorEnabled, verifyTwoFactorToken } from '/lib/utils/two-factor.ts';
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
    if (!(await AppConfig.isTwoFactorEnabled())) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user');
    const redirectUrl = url.searchParams.get('redirect') || '/';

    if (!userId) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const user = await UserModel.getById(userId);

    if (!user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const has2FA = hasTwoFactorEnabled(user);

    if (!has2FA) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    return await context.render({
      userId,
      redirectUrl,
    });
  },
  async POST(request, context) {
    if (!(await AppConfig.isTwoFactorEnabled())) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('user');
    const redirectUrl = url.searchParams.get('redirect') || '/';

    if (!userId) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const user = await UserModel.getById(userId);

    if (!user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const has2FA = hasTwoFactorEnabled(user);

    if (!has2FA) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    try {
      const formData = await request.formData();
      const token = getFormDataField(formData, 'token');

      if (!token) {
        throw new Error('Authentication token is required');
      }

      let isValid = false;
      let updateUser = false;

      const enabledMethods = getEnabledTwoFactorMethods(user);

      for (const method of enabledMethods) {
        const verification = verifyTwoFactorToken(method, token);
        if (verification.isValid) {
          isValid = true;

          if (verification.remainingCodes && method.metadata.totp) {
            method.metadata.totp.backup_codes = verification.remainingCodes;
            updateUser = true;
          }
          break;
        }
      }

      if (!isValid) {
        throw new Error('Invalid authentication token or backup code');
      }

      if (updateUser) {
        await UserModel.update(user);
      }

      return await createSessionResponse(request, user, { urlToRedirectTo: redirectUrl });
    } catch (error) {
      console.error('Two-factor verification error:', error);

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

export default function TwoFactorVerifyPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main class='flex flex-col items-center justify-center min-h-screen'>
      <div class='max-w-md w-full space-y-8'>
        <div>
          <h2 class='mt-6 text-center text-3xl font-extrabold text-white'>
            Two-Factor Authentication
          </h2>
          <p class='mt-2 text-center text-sm text-gray-300'>
            Enter your authentication code to continue
          </p>
        </div>
        <form
          class='mt-8 space-y-6'
          method='POST'
          action={`/two-factor-verify?user=${data.userId}&redirect=${encodeURIComponent(data.redirectUrl || '/')}`}
        >
          <div class='mb-4'>
            <label for='token' class='block text-sm font-medium mb-2 text-white'>
              Authentication Token or Backup Code
            </label>
            <input
              type='text'
              id='token'
              name='token'
              placeholder='123456 or backup code'
              class='w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400'
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
          <a href='/login' class='text-blue-400 hover:text-blue-300'>
            Back to Login
          </a>
        </div>
      </div>
    </main>
  );
}
