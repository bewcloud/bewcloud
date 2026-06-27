import { renderToString } from 'preact-render-to-string';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { MultiFactorAuthMethodType } from '/lib/types.ts';
import { UserModel } from '/lib/models/user.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import {
  getEnabledMultiFactorAuthMethodsFromUser,
  isMultiFactorAuthEnabledForUser,
} from '/public/ts/utils/multi-factor-auth.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';
import { EmailModel } from '/lib/models/multi-factor-auth/email.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import MultiFactorAuthVerifyForm from '/components/auth/MultiFactorAuthVerifyForm.tsx';

const titlePrefix = 'Multi-Factor Authentication Verification';

async function get({ request, match, session, isRunningLocally }: RequestHandlerParams) {
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

  const htmlContent = defaultHtmlContent({
    email: user.email,
    redirectUrl,
    availableMethods,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    session,
    isRunningLocally,
  });
}

async function post({ request, match, session, isRunningLocally }: RequestHandlerParams) {
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

  try {
    const formData = await request.formData();
    const code = getFormDataField(formData, 'code');
    const token = getFormDataField(formData, 'token');

    if (!code && !token) {
      throw new Error('Authentication code/token is required');
    }

    let isValid = false;
    let updateUser = false;

    for (const method of enabledMethods) {
      // Passkey verification is handled in a separate process
      if (method.type === 'passkey') {
        continue;
      }

      if (method.type === 'totp') {
        const verification = await TOTPModel.verifyMethodToken(method.metadata, token);
        if (verification.isValid) {
          isValid = true;

          if (verification.remainingCodes && method.type === 'totp' && method.metadata.totp) {
            method.metadata.totp.hashed_backup_codes = verification.remainingCodes;
            updateUser = true;
          }
          break;
        }
      }

      if (method.type === 'email') {
        const verification = await EmailModel.verifyCode(method.id, code, user);
        if (verification) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      throw new Error('Invalid authentication code/token or backup code');
    }

    if (updateUser) {
      await UserModel.update(user);
    }

    return await createSessionResponse(request, user, { urlToRedirectTo: redirectUrl });
  } catch (error) {
    console.error('Multi-factor authentication verification error:', error);

    const htmlContent = defaultHtmlContent({
      error: {
        title: 'Verification Failed',
        message: (error as Error).message,
      },
      email: user.email,
      redirectUrl,
      availableMethods,
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix,
      match,
      request,
      session,
      isRunningLocally,
    });
  }
}

function defaultHtmlContent({ email, redirectUrl, availableMethods, error }: {
  error?: {
    title: string;
    message: string;
  };
  email?: string;
  redirectUrl?: string;
  availableMethods?: MultiFactorAuthMethodType[];
}) {
  const multiFactorAuthVerifyFormReactNode = (
    <MultiFactorAuthVerifyForm
      email={email || ''}
      redirectUrl={redirectUrl || '/'}
      availableMethods={availableMethods || []}
      error={error}
    />
  );
  const multiFactorAuthVerifyFormHtml = renderToString(multiFactorAuthVerifyFormReactNode);

  return html`
    <main id="main">
      <section class="max-w-3xl mx-auto flex flex-col items-center justify-center">
        ${multiFactorAuthVerifyFormHtml}
      </section>
    </main>
  `;
}

export default page({
  get,
  post,
  accessMode: 'public',
});
