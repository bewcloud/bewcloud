import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState, MultiFactorAuthMethodType } from '/lib/types.ts';
import { UserModel } from '/lib/models/user.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import {
  getEnabledMultiFactorAuthMethodsFromUser,
  isMultiFactorAuthEnabledForUser,
} from '/lib/utils/multi-factor-auth.ts';
import MultiFactorAuthVerifyForm from '/components/auth/MultiFactorAuthVerifyForm.tsx';

interface Data {
  error?: {
    title: string;
    message: string;
  };
  // TODO: Remove this since we can get the user from the cookie
  userId?: string;
  redirectUrl?: string;
  availableMethods?: MultiFactorAuthMethodType[];
  hasPasskey?: boolean;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const searchParams = new URL(request.url).searchParams;
    const redirectUrl = searchParams.get('redirect') || '/';

    const { user } = (await MultiFactorAuthModel.getDataFromRequest(request)) || {};

    if (!user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const hasMultiFactorAuthEnabled = isMultiFactorAuthEnabledForUser(user);

    if (!hasMultiFactorAuthEnabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const enabledMethods = getEnabledMultiFactorAuthMethodsFromUser(user);
    const availableMethods = enabledMethods.map((method) => method.type);
    const hasPasskey = availableMethods.includes('passkey');

    return await context.render({
      userId: user.id,
      redirectUrl,
      availableMethods,
      hasPasskey,
    });
  },
  async POST(request, context) {
    const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

    if (!isMultiFactorAuthEnabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const searchParams = new URL(request.url).searchParams;
    const redirectUrl = searchParams.get('redirect') || '/';

    const { user } = (await MultiFactorAuthModel.getDataFromRequest(request)) || {};

    if (!user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const hasMultiFactorAuthEnabled = isMultiFactorAuthEnabledForUser(user);

    if (!hasMultiFactorAuthEnabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
    }

    const enabledMethods = getEnabledMultiFactorAuthMethodsFromUser(user);
    const availableMethods = enabledMethods.map((method) => method.type);
    const hasPasskey = availableMethods.includes('passkey');

    try {
      const formData = await request.formData();
      const token = getFormDataField(formData, 'token');

      if (!token) {
        throw new Error('Authentication token is required');
      }

      let isValid = false;
      let updateUser = false;

      for (const method of enabledMethods) {
        const verification = await MultiFactorAuthModel.verifyMultiFactorAuthToken(method, token);
        if (verification.isValid) {
          isValid = true;

          if (verification.remainingCodes && method.type === 'totp' && method.metadata.totp) {
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
      console.error('Multi-factor authentication verification error:', error);

      return await context.render({
        error: {
          title: 'Verification Failed',
          message: (error as Error).message,
        },
        userId: user.id,
        redirectUrl,
        availableMethods,
        hasPasskey,
      });
    }
  },
};

export default function MultiFactorAuthVerifyPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main class='flex flex-col items-center justify-center min-h-screen'>
      <MultiFactorAuthVerifyForm
        userId={data.userId || ''}
        redirectUrl={data.redirectUrl || '/'}
        availableMethods={data.availableMethods || []}
        error={data.error}
      />
    </main>
  );
}
