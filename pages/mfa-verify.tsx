import { renderToString } from 'preact-render-to-string';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { MultiFactorAuthMethod, MultiFactorAuthMethodType, User } from '/lib/types.ts';
import { UserModel } from '/lib/models/user.ts';
import { createSessionResponse } from '/lib/auth.ts';
import { getSafeRedirectUrl } from '/public/ts/utils/redirect.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import {
  getEnabledMultiFactorAuthMethodsFromUser,
  isMultiFactorAuthEnabledForUser,
  shouldSendEmailCodeOnLogin,
} from '/public/ts/utils/multi-factor-auth.ts';
import { TOTPModel } from '/lib/models/multi-factor-auth/totp.ts';
import { EmailModel } from '/lib/models/multi-factor-auth/email.ts';
import { html } from '/public/ts/utils/misc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import MultiFactorAuthVerifyForm from '/components/auth/MultiFactorAuthVerifyForm.tsx';

const titlePrefix = 'Multi-Factor Authentication Verification';

async function isEmailCodePending(user: User, enabledMethods: MultiFactorAuthMethod[]) {
  if (shouldSendEmailCodeOnLogin(user)) {
    return true;
  }

  const emailMethod = enabledMethods.find((method) => method.type === 'email');

  if (!emailMethod) {
    return false;
  }

  return await EmailModel.hasPendingCode(emailMethod.id, user);
}

async function get({ request, match, session, isRunningLocally }: RequestHandlerParams) {
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

  if (!isMultiFactorAuthEnabled) {
    return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
  }

  const searchParams = new URL(request.url).searchParams;
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));

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
    isEmailCodeSent: await isEmailCodePending(user, enabledMethods),
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
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));

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

  let isEmailCodeSent = false;

  const renderPage = (error?: { title: string; message: string }) => {
    const htmlContent = defaultHtmlContent({
      error,
      email: user.email,
      redirectUrl,
      availableMethods,
      isEmailCodeSent,
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix,
      match,
      request,
      session,
      isRunningLocally,
    });
  };

  try {
    isEmailCodeSent = await isEmailCodePending(user, enabledMethods);

    const formData = await request.formData();
    const code = getFormDataField(formData, 'code');
    const token = getFormDataField(formData, 'token');
    const shouldSendEmailCode = getFormDataField(formData, 'send_email_code') === 'true';

    if (shouldSendEmailCode) {
      const emailMethod = enabledMethods.find((method) => method.type === 'email');

      if (!emailMethod) {
        throw new Error('Email verification is not enabled');
      }

      await EmailModel.createAndSendCode(emailMethod.id, user);

      isEmailCodeSent = true;

      return renderPage();
    }

    if (code) {
      isEmailCodeSent = true;
    }

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

    return renderPage({
      title: 'Verification Failed',
      message: (error as Error).message,
    });
  }
}

function defaultHtmlContent({ email, redirectUrl, availableMethods, isEmailCodeSent, error }: {
  error?: {
    title: string;
    message: string;
  };
  email?: string;
  redirectUrl?: string;
  availableMethods?: MultiFactorAuthMethodType[];
  isEmailCodeSent?: boolean;
}) {
  const multiFactorAuthVerifyFormReactNode = (
    <MultiFactorAuthVerifyForm
      email={email || ''}
      redirectUrl={redirectUrl || '/'}
      availableMethods={availableMethods || []}
      isEmailCodeSent={isEmailCodeSent || false}
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
