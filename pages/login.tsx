import { renderToString } from 'preact-render-to-string';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { escapeHtml, generateHash, html, validateEmail } from '/public/ts/utils/misc.ts';
import { createSessionResponse, PASSWORD_SALT } from '/lib/auth.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/public/ts/utils/form.ts';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { EmailModel } from '/lib/models/email.ts';
import { AppConfig } from '/lib/config.ts';
import { isMultiFactorAuthEnabledForUser } from '/public/ts/utils/multi-factor-auth.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import { OidcModel } from '/lib/models/oidc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import PasswordlessPasskeyLogin from '/components/auth/PasswordlessPasskeyLogin.tsx';

const titlePrefix = 'Login';
const description = 'Login to your account';

async function get({ request, match, user, session, isRunningLocally }: RequestHandlerParams) {
  if (user) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled() && await UserModel.isThereAnAdmin();
  const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();
  const config = await AppConfig.getConfig();
  const helpEmail = config.visuals.helpEmail;

  const singleSignOnUrl = isSingleSignOnEnabled
    ? (await OidcModel.getSignInUrl({ requestPermissions: config.auth.singleSignOnScopes }))
    : undefined;

  const searchParams = new URL(request.url).searchParams;

  const formData = new FormData();
  let notice = '';
  let email = '';

  if (searchParams.get('success') === 'signup') {
    email = searchParams.get('email') || '';
    formData.set('email', email);

    if (await AppConfig.isEmailVerificationEnabled()) {
      notice = `You have received a code in your email. Use it to verify your email and login.`;
    } else {
      notice = `Your account was created successfully. Login below.`;
    }
  }

  const htmlContent = defaultHtmlContent({
    notice,
    email,
    formData,
    isEmailVerificationEnabled,
    isMultiFactorAuthEnabled,
    isSingleSignOnEnabled,
    helpEmail,
    singleSignOnUrl,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    description,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

async function post({ request, match, user, session, isRunningLocally }: RequestHandlerParams) {
  if (user) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
  }

  const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled() && await UserModel.isThereAnAdmin();
  const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();
  const config = await AppConfig.getConfig();
  const helpEmail = config.visuals.helpEmail;

  const singleSignOnUrl = isSingleSignOnEnabled
    ? (await OidcModel.getSignInUrl({ requestPermissions: config.auth.singleSignOnScopes }))
    : undefined;

  const searchParams = new URL(request.url).searchParams;

  const formData = await request.clone().formData();
  const email = getFormDataField(formData, 'email');

  const redirectUrl = searchParams.get('redirect') || '/';

  let errorMessage: string | undefined = undefined;

  try {
    if (!validateEmail(email)) {
      throw new Error(`Invalid email.`);
    }

    const password = getFormDataField(formData, 'password');

    if (password.length < 6) {
      throw new Error(`Password is too short.`);
    }

    const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

    const user = await UserModel.getByEmail(email);

    if (!user || user.hashed_password !== hashedPassword) {
      throw new Error('Email not found or invalid password.');
    }

    const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();

    if (!isEmailVerificationEnabled && !user.extra.is_email_verified) {
      user.extra.is_email_verified = true;

      await UserModel.update(user);
    }

    if (!user.extra.is_email_verified) {
      const code = getFormDataField(formData, 'verification-code');

      if (!code) {
        const verificationCode = await VerificationCodeModel.create(user, user.email, 'email');

        await EmailModel.sendVerificationEmail(user.email, verificationCode);

        throw new Error('Email not verified. New code sent to verify your email.');
      } else {
        await VerificationCodeModel.validate(user, user.email, code, 'email');

        user.extra.is_email_verified = true;

        await UserModel.update(user);
      }
    }

    if (user.extra.is_email_verified && isMultiFactorAuthEnabled && isMultiFactorAuthEnabledForUser(user)) {
      return MultiFactorAuthModel.createSessionResponse(request, user, { urlToRedirectTo: redirectUrl });
    }

    return createSessionResponse(request, user, { urlToRedirectTo: redirectUrl });
  } catch (error) {
    console.error(error);

    errorMessage = (error as Error).toString();
  }

  const htmlContent = defaultHtmlContent({
    error: errorMessage,
    email,
    formData,
    isEmailVerificationEnabled,
    isMultiFactorAuthEnabled,
    isSingleSignOnEnabled,
    helpEmail,
    singleSignOnUrl,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    description,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function formFields(email?: string, showVerificationCode = false) {
  const fields: FormField[] = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: email || '',
      required: true,
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
    },
  ];

  if (showVerificationCode) {
    fields.push({
      name: 'verification-code',
      label: 'Verification Code',
      description: `The verification code to validate your email.`,
      type: 'text',
      placeholder: '000000',
      required: true,
    });
  }

  return fields;
}

function defaultHtmlContent(
  {
    error,
    notice,
    email,
    formData,
    isEmailVerificationEnabled,
    isMultiFactorAuthEnabled,
    isSingleSignOnEnabled,
    singleSignOnUrl,
    helpEmail,
  }: {
    error?: string;
    notice?: string;
    email?: string;
    formData?: FormData;
    isEmailVerificationEnabled: boolean;
    isMultiFactorAuthEnabled: boolean;
    isSingleSignOnEnabled: boolean;
    singleSignOnUrl?: string;
    helpEmail: string;
  },
) {
  const passwordlessPasskeyLoginReactNode = <PasswordlessPasskeyLogin />;

  const passwordlessPasskeyLoginHtml = renderToString(passwordlessPasskeyLoginReactNode);

  const htmlContent = html`
    <main id="main">
      <section class="max-w-3xl mx-auto flex flex-col items-center justify-center">
        <h1 class="text-4xl mb-6">
          Login
        </h1>
        ${error
          ? html`
            <section class="notification-error">
              <h3>Failed to login!</h3>
              <p>${error}</p>
            </section>
          `
          : ''} ${notice
          ? html`
            <section class="notification-success">
              <h3>${isEmailVerificationEnabled ? 'Verify your email!' : 'Account created!'}</h3>
              <p>${notice}</p>
            </section>
          `
          : ''}

        <form method="POST" class="mb-4">
          ${formFields(
            email,
            notice?.includes('verify your email') && isEmailVerificationEnabled,
          ).map((field) => generateFieldHtml(field, formData || new FormData())).join('')}
          <section class="flex justify-center mt-8 mb-4">
            <button class="button" type="submit">Login</button>
          </section>

          ${isMultiFactorAuthEnabled
            ? html`
              <section class="mb-4 max-w-sm mx-auto">
                <section class="text-center">
                  <p class="text-gray-400 text-sm mb-3">or</p>
                </section>

                ${passwordlessPasskeyLoginHtml}
              </section>
            `
            : ''} ${isSingleSignOnEnabled && singleSignOnUrl
            ? html`
              <section class="mb-12 max-w-sm mx-auto">
                <section class="text-center">
                  <p class="text-gray-400 text-sm mb-3">or</p>
                </section>

                <section class="space-y-4">
                  <section class="flex justify-center mt-2 mb-4">
                    <a
                      href="${escapeHtml(singleSignOnUrl)}"
                      class="button-secondary"
                    >
                      Login with SSO
                    </a>
                  </section>
                </section>
              </section>
            `
            : ''}
        </form>

        <h2 class="text-2xl mb-4 text-center">Need an account?</h2>
        <p class="text-center mt-2 mb-6">
          If you still don't have an account, <strong><a href="/signup">signup</a></strong>.
        </p>

        ${helpEmail !== ''
          ? html`
            <h2 class="text-2xl mb-4 text-center">Need help?</h2>
            <p class="text-center mt-2 mb-6">
              If you're having any issues or have any questions,
              <strong>
                <a href="mailto:${escapeHtml(helpEmail)}">please reach out</a>
              </strong>.
            </p>
          `
          : ''}
      </section>
    </main>
  `;

  return htmlContent;
}

export default page({
  get,
  post,
  accessMode: 'public',
});
