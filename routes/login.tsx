import { Handlers, PageProps } from 'fresh/server.ts';

import { generateHash, validateEmail } from '/lib/utils/misc.ts';
import { createSessionResponse, PASSWORD_SALT } from '/lib/auth.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/lib/form-utils.tsx';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { sendVerifyEmailEmail } from '/lib/providers/brevo.ts';
import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {
  error?: string;
  notice?: string;
  email?: string;
  formData?: FormData;
  isEmailVerificationEnabled: boolean;
  helpEmail: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

    const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
    const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;

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

    return await context.render({ notice, email, formData, isEmailVerificationEnabled, helpEmail });
  },
  async POST(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

    const isEmailVerificationEnabled = await AppConfig.isEmailVerificationEnabled();
    const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;

    const formData = await request.clone().formData();
    const email = getFormDataField(formData, 'email');

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

      if (!(await AppConfig.isEmailVerificationEnabled()) && !user.extra.is_email_verified) {
        user.extra.is_email_verified = true;

        await UserModel.update(user);
      }

      if (!user.extra.is_email_verified) {
        const code = getFormDataField(formData, 'verification-code');

        if (!code) {
          const verificationCode = await VerificationCodeModel.create(user, user.email, 'email');

          await sendVerifyEmailEmail(user.email, verificationCode);

          throw new Error('Email not verified. New code sent to verify your email.');
        } else {
          await VerificationCodeModel.validate(user, user.email, code, 'email');

          user.extra.is_email_verified = true;

          await UserModel.update(user);
        }
      }

      if (user.extra.totp_enabled && (await AppConfig.isTOTPEnabled())) {
        const redirectUrl = new URL(request.url).searchParams.get('redirect') || '/';
        return new Response('Redirect', {
          status: 303,
          headers: { 'Location': `/totp-verify?user=${user.id}&redirect=${encodeURIComponent(redirectUrl)}` },
        });
      }

      return createSessionResponse(request, user, { urlToRedirectTo: `/` });
    } catch (error) {
      console.error(error);
      return await context.render({
        error: (error as Error).toString(),
        email,
        formData,
        isEmailVerificationEnabled,
        helpEmail,
      });
    }
  },
};

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

export default function Login({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
        <h1 class='text-4xl mb-6'>
          Login
        </h1>
        {data?.error
          ? (
            <section class='notification-error'>
              <h3>Failed to login!</h3>
              <p>{data?.error}</p>
            </section>
          )
          : null}
        {data?.notice
          ? (
            <section class='notification-success'>
              <h3>{data?.isEmailVerificationEnabled ? 'Verify your email!' : 'Account created!'}</h3>
              <p>{data?.notice}</p>
            </section>
          )
          : null}

        <form method='POST' class='mb-12'>
          {formFields(
            data?.email,
            data?.notice?.includes('verify your email') && data?.isEmailVerificationEnabled,
          ).map((field) => generateFieldHtml(field, data?.formData || new FormData()))}
          <section class='flex justify-center mt-8 mb-4'>
            <button class='button' type='submit'>Login</button>
          </section>
        </form>

        <h2 class='text-2xl mb-4 text-center'>Need an account?</h2>
        <p class='text-center mt-2 mb-6'>
          If you still don't have an account,{' '}
          <strong>
            <a href='/signup'>signup</a>
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
