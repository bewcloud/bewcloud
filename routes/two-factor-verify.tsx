import { Handlers, PageProps } from 'fresh/server.ts';
import { FreshContextState } from '/lib/types.ts';
import { getEnabledTwoFactorMethods, hasTwoFactorEnabled, verifyTwoFactorToken } from '/lib/utils/two-factor.ts';
import { UserModel } from '/lib/models/user.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { AppConfig } from '/lib/config.ts';
import TwoFactorVerifyForm from '/components/TwoFactorVerifyForm.tsx';

interface Data {
  error?: {
    title: string;
    message: string;
  };
  userId?: string;
  redirectUrl?: string;
  availableMethods?: string[];
  hasPasskey?: boolean;
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

    const enabledMethods = getEnabledTwoFactorMethods(user);
    const availableMethods = enabledMethods.map((m) => m.type);
    const hasPasskey = availableMethods.includes('passkey');

    return await context.render({
      userId,
      redirectUrl,
      availableMethods,
      hasPasskey,
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
        const verification = await verifyTwoFactorToken(method, token);
        if (verification.isValid) {
          isValid = true;

          if (verification.remainingCodes && method.metadata.totp) {
            method.metadata.totp.hashed_backup_codes = verification.remainingCodes;
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

      const enabledMethods = getEnabledTwoFactorMethods(user);
      const availableMethods = enabledMethods.map((m) => m.type);

      return await context.render({
        error: {
          title: 'Verification Failed',
          message: (error as Error).message,
        },
        userId,
        redirectUrl,
        availableMethods,
      });
    }
  },
};

export default function TwoFactorVerifyPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main class='flex flex-col items-center justify-center min-h-screen'>
      <TwoFactorVerifyForm
        userId={data.userId || ''}
        redirectUrl={data.redirectUrl || '/'}
        availableMethods={data.availableMethods || []}
        error={data.error}
      />
    </main>
  );
}
