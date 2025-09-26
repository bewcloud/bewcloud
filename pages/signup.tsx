import { generateHash, validateEmail } from '/lib/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/lib/form-utils.tsx';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { EmailModel } from '/lib/models/email.ts';
import { AppConfig } from '/lib/config.ts';
import { FreshContextState } from '/lib/types.ts';
import { OidcModel } from '/lib/models/oidc.ts';

interface Data {
  error?: string;
  notice?: string;
  email?: string;
  formData?: FormData;
  helpEmail: string;
  isEmailVerificationEnabled: boolean;
  isSingleSignOnEnabled: boolean;
  singleSignOnUrl?: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

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

    return await context.render({
      notice,
      helpEmail,
      isEmailVerificationEnabled,
      isSingleSignOnEnabled,
      singleSignOnUrl,
    });
  },
  async POST(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

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
      return await context.render({
        error: (error as Error).toString(),
        email,
        formData,
        helpEmail,
        isEmailVerificationEnabled,
        isSingleSignOnEnabled,
        singleSignOnUrl,
      });
    }
  },
};

function formFields(data?: Data) {
  const fields: FormField[] = [
    {
      name: 'email',
      label: 'Email',
      description: data?.isEmailVerificationEnabled
        ? `The email that will be used to login. A code will be sent to it.`
        : `The email that will be used to login.`,
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: data?.email || '',
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

export default function Signup({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
        <h1 class='text-4xl mb-6'>
          Signup
        </h1>
        {data?.error
          ? (
            <section class='notification-error'>
              <h3>Failed to signup!</h3>
              <p>{data?.error}</p>
            </section>
          )
          : null}
        {data?.notice
          ? (
            <section class='notification-success'>
              <h3>Success!</h3>
              <p>{data?.notice}</p>
            </section>
          )
          : null}

        <form method='POST' class={data?.isSingleSignOnEnabled && data?.singleSignOnUrl ? 'mb-4 pb-0' : 'mb-12'}>
          {formFields(data).map((field) => generateFieldHtml(field, data?.formData || new FormData()))}
          <section
            class={`flex justify-center mt-8 ${data?.isSingleSignOnEnabled && data?.singleSignOnUrl ? 'mb-0' : 'mb-4'}`}
          >
            <button class='button' type='submit'>Signup</button>
          </section>
        </form>

        {data?.isSingleSignOnEnabled && data?.singleSignOnUrl
          ? (
            <section class='mb-12 max-w-sm mx-auto'>
              <section class='text-center'>
                <p class='text-gray-400 text-sm mb-3'>or</p>
              </section>

              <section class='space-y-4'>
                <section class='flex justify-center mt-2 mb-4'>
                  <a
                    href={data?.singleSignOnUrl}
                    class='button-secondary'
                  >
                    Signup with SSO
                  </a>
                </section>
              </section>
            </section>
          )
          : null}

        <h2 class='text-2xl mb-4 text-center'>Already have an account?</h2>
        <p class='text-center mt-2 mb-6'>
          If you already have an account,{' '}
          <strong>
            <a href='/login'>login</a>
          </strong>.
        </p>

        {data?.helpEmail !== ''
          ? (
            <>
              <h2 class='text-2xl mb-4 text-center'>Need help?</h2>
              <p class='text-center mt-2 mb-6'>
                If you're having any issues or have any questions,{' '}
                <strong>
                  <a href={`mailto:${data?.helpEmail}`}>please reach out</a>
                </strong>.
              </p>
            </>
          )
          : null}
      </section>
    </main>
  );
}
