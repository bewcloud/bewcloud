import { Handlers, PageProps } from 'fresh/server.ts';

import { generateHash, helpEmail, validateEmail } from '/lib/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/lib/form-utils.tsx';
import { createUser, createVerificationCode, getUserByEmail, updateUser } from '/lib/data/user.ts';
import { sendVerifyEmailEmail } from '/lib/providers/brevo.ts';
import { isEmailEnabled, isSignupAllowed } from '/lib/config.ts';
import { FreshContextState } from '/lib/types.ts';

interface Data {
  error?: string;
  notice?: string;
  email?: string;
  formData?: FormData;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

    const searchParams = new URL(request.url).searchParams;

    let notice = '';

    if (searchParams.get('success') === 'delete') {
      notice = `Your account and all its data has been deleted.`;
    }

    return await context.render({ notice });
  },
  async POST(request, context) {
    if (context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

    const formData = await request.clone().formData();
    const email = getFormDataField(formData, 'email');

    try {
      if (!(await isSignupAllowed())) {
        throw new Error(`Signups are not allowed.`);
      }

      if (!validateEmail(email)) {
        throw new Error(`Invalid email.`);
      }

      const password = getFormDataField(formData, 'password');

      if (password.length < 6) {
        throw new Error(`Password is too short.`);
      }

      const existingUser = await getUserByEmail(email);

      if (existingUser) {
        throw new Error('Email is already in use. Perhaps you want to login instead?');
      }

      const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

      const user = await createUser(email, hashedPassword);

      if (isEmailEnabled()) {
        const verificationCode = await createVerificationCode(user, user.email, 'email');

        await sendVerifyEmailEmail(user.email, verificationCode);
      }

      return new Response('Signup successful', {
        status: 303,
        headers: { 'location': `/login?success=signup&email=${encodeURIComponent(user.email)}` },
      });
    } catch (error) {
      console.error(error);
      return await context.render({ error: (error as Error).toString(), email, formData });
    }
  },
};

function formFields(email?: string) {
  const fields: FormField[] = [
    {
      name: 'email',
      label: 'Email',
      description: `The email that will be used to login. A code will be sent to it.`,
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

        <form method='POST' class='mb-12'>
          {formFields(data?.email).map((field) => generateFieldHtml(field, data?.formData || new FormData()))}
          <section class='flex justify-center mt-8 mb-4'>
            <button class='button' type='submit'>Signup</button>
          </section>
        </form>

        <h2 class='text-2xl mb-4 text-center'>Already have an account?</h2>
        <p class='text-center mt-2 mb-6'>
          If you already have an account,{' '}
          <strong>
            <a href='/login'>login</a>
          </strong>.
        </p>

        <h2 class='text-2xl mb-4 text-center'>Need help?</h2>
        <p class='text-center mt-2 mb-6'>
          If you're having any issues or have any questions,{' '}
          <strong>
            <a href={`mailto:${helpEmail}`}>please reach out</a>
          </strong>.
        </p>
      </section>
    </main>
  );
}
