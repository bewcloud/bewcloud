import page, { RequestHandlerParams } from '/lib/page.ts';

import { escapeHtml, generateHash, validateEmail } from '/public/ts/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/public/ts/utils/form.ts';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { EmailModel } from '/lib/models/email.ts';
import { AppConfig } from '/lib/config.ts';
import { OidcModel } from '/lib/models/oidc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';

const titlePrefix = 'Signup';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
  const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();
  const config = await AppConfig.getConfig();
  const helpEmail = config.visuals.helpEmail;

  const singleSignOnUrl = isSingleSignOnEnabled
    ? (await OidcModel.getSignInUrl({ requestPermissions: config.auth.singleSignOnScopes }))
    : undefined;

  const searchParams = new URL(request.url).searchParams;

  let notice = '';

  if (searchParams.get('success') === 'delete') {
    notice = `Your account and all its data has been deleted.`;
  }

  const htmlContent = defaultHtmlContent({
    notice,
    helpEmail,
    isEmailVerificationEnabled,
    isSingleSignOnEnabled,
    singleSignOnUrl,
  });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

async function post({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
  const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();
  const config = await AppConfig.getConfig();
  const helpEmail = config.visuals.helpEmail;

  const singleSignOnUrl = isSingleSignOnEnabled
    ? (await OidcModel.getSignInUrl({ requestPermissions: config.auth.singleSignOnScopes }))
    : undefined;

  const formData = await request.clone().formData();
  const email = getFormDataField(formData, 'email');

  try {
    if (!(await AppConfig.isSignupAllowed())) {
      throw new Error(`Signups are not allowed.`);
    }

    if (!validateEmail(email)) {
      throw new Error(`Invalid email.`);
    }

    const password = getFormDataField(formData, 'password');

    if (password.length < 6) {
      throw new Error(`Password is too short.`);
    }

    const existingUser = await UserModel.getByEmail(email);

    if (existingUser) {
      throw new Error('Email is already in use. Perhaps you want to login instead?');
    }

    const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

    const user = await UserModel.create(email, hashedPassword);

    if (isEmailVerificationEnabled) {
      const verificationCode = await VerificationCodeModel.create(user, user.email, 'email');

      await EmailModel.sendVerificationEmail(user.email, verificationCode);
    }

    return new Response('Signup successful', {
      status: 303,
      headers: { 'location': `/login?success=signup&email=${encodeURIComponent(user.email)}` },
    });
  } catch (error) {
    console.error(error);
    const htmlContent = defaultHtmlContent({
      error: (error as Error).toString(),
      email,
      formData,
      helpEmail,
      isEmailVerificationEnabled,
      isSingleSignOnEnabled,
      singleSignOnUrl,
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix,
      match,
      request,
      user,
      session,
      isRunningLocally,
    });
  }
}

function formFields({ isEmailVerificationEnabled, email }: { isEmailVerificationEnabled: boolean; email?: string }) {
  const fields: FormField[] = [
    {
      name: 'email',
      label: 'Email',
      description: isEmailVerificationEnabled
        ? `The email that will be used to login. A code will be sent to it.`
        : `The email that will be used to login.`,
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: email || '',
      required: true,
    },
    {
      name: 'password',
      label: 'Password',
      description: `The password that will be used to login.`,
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
    },
  ];

  return fields;
}

function defaultHtmlContent(
  { notice, error, email, formData, helpEmail, isEmailVerificationEnabled, isSingleSignOnEnabled, singleSignOnUrl }: {
    error?: string;
    notice?: string;
    email?: string;
    formData?: FormData;
    helpEmail: string;
    isEmailVerificationEnabled: boolean;
    isSingleSignOnEnabled: boolean;
    singleSignOnUrl?: string;
  },
) {
  return html`
    <main id="main">
      <section class="max-w-3xl mx-auto flex flex-col items-center justify-center">
        <h1 class="text-4xl mb-6">
          Signup
        </h1>
        ${error
          ? html`
            <section class="notification-error">
              <h3>Failed to signup!</h3>
              <p>${escapeHtml(error)}</p>
            </section>
          `
          : ''} ${notice
          ? html`
            <section class="notification-success">
              <h3>Success!</h3>
              <p>${escapeHtml(notice)}</p>
            </section>
          `
          : ''}

        <form method="POST" class="${isSingleSignOnEnabled && singleSignOnUrl ? 'mb-4 pb-0' : 'mb-12'}">
          ${formFields({ isEmailVerificationEnabled, email }).map((field) =>
            generateFieldHtml(field, formData || new FormData())
          ).join('')}
          <section
            class="flex justify-center mt-8 ${isSingleSignOnEnabled && singleSignOnUrl ? 'mb-0' : 'mb-4'}"
          >
            <button class="button" type="submit">Signup</button>
          </section>
        </form>

        ${isSingleSignOnEnabled && singleSignOnUrl
          ? html`
            <section class="mb-12 max-w-sm mx-auto">
              <section class="text-center">
                <p class="text-gray-400 text-sm mb-3">or</p>
              </section>

              <section class="space-y-4">
                <section class="flex justify-center mt-2 mb-4">
                  <a
                    href="${singleSignOnUrl}"
                    class="button-secondary"
                  >
                    Signup with SSO
                  </a>
                </section>
              </section>
            </section>
          `
          : ''}

        <h2 class="text-2xl mb-4 text-center">Already have an account?</h2>
        <p class="text-center mt-2 mb-6">
          If you already have an account, <strong><a href="/login">login</a></strong>.
        </p>

        ${helpEmail !== ''
          ? html`
            <h2 class="text-2xl mb-4 text-center">Need help?</h2>
            <p class="text-center mt-2 mb-6">
              If you're having any issues or have any questions, <strong><a href="${`mailto:${
                escapeHtml(helpEmail)
              }`}">please reach out</a></strong>.
            </p>
          `
          : ''}
      </section>
    </main>
  `;
}

export default page({
  get,
  post,
  accessMode: 'public',
});
