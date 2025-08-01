import { MultiFactorAuthMethodType } from '/lib/types.ts';
import PasswordlessPasskeyLogin from '/islands/auth/PasswordlessPasskeyLogin.tsx';

interface MultiFactorAuthVerifyFormProps {
  email: string;
  redirectUrl: string;
  availableMethods: MultiFactorAuthMethodType[];
  error?: { title: string; message: string };
}

export default function MultiFactorAuthVerifyForm(
  { email, redirectUrl, availableMethods, error }: MultiFactorAuthVerifyFormProps,
) {
  const hasPasskey = availableMethods.includes('passkey');
  const hasTotp = availableMethods.includes('totp');
  const hasEmail = availableMethods.includes('email');

  return (
    <section class='max-w-md w-full mb-12'>
      <section class='mb-6'>
        <h2 class='mt-6 text-center text-3xl font-extrabold text-white'>
          Multi-Factor Authentication
        </h2>
        <p class='mt-2 text-center text-sm text-gray-300'>
          You are required to authenticate with an additional method
        </p>
      </section>

      {error
        ? (
          <section class='notification-error'>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
          </section>
        )
        : null}

      {hasEmail
        ? (
          <form
            class='mb-6'
            method='POST'
            action={`/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`}
          >
            <fieldset class='block mb-4'>
              <label class='text-slate-300 block pb-1' for='token'>
                Email Verification Code
              </label>
              <input
                type='text'
                id='code'
                name='code'
                placeholder='123456'
                class='mt-1 input-field'
                autocomplete='off'
                required
              />
            </fieldset>

            <section class='flex justify-center mt-8 mb-4'>
              <button
                type='submit'
                class='button'
              >
                Verify Code
              </button>
            </section>
          </form>
        )
        : null}

      {hasEmail && hasTotp
        ? (
          <section class='text-center -mt-10 mb-6 block'>
            <p class='text-gray-400 text-sm'>or</p>
          </section>
        )
        : null}

      {hasTotp
        ? (
          <form
            class='mb-6'
            method='POST'
            action={`/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`}
          >
            <fieldset class='block mb-4'>
              <label class='text-slate-300 block pb-1' for='token'>
                Authentication Token or Backup Code
              </label>
              <input
                type='text'
                id='token'
                name='token'
                placeholder='123456 or backup code'
                class='mt-1 input-field'
                autocomplete='one-time-code'
                required
              />
            </fieldset>

            <section class='flex justify-center mt-8 mb-4'>
              <button
                type='submit'
                class='button'
              >
                Verify Code
              </button>
            </section>
          </form>
        )
        : null}

      {(hasEmail || hasTotp) && hasPasskey
        ? (
          <section class='text-center -mt-10 mb-6 block'>
            <p class='text-gray-400 text-sm'>or</p>
          </section>
        )
        : null}

      {hasPasskey && email
        ? (
          <section class='mb-8'>
            <PasswordlessPasskeyLogin email={email} redirectUrl={redirectUrl} />
          </section>
        )
        : null}

      <section class='text-center mt-6'>
        <a href='/login' class='text-blue-400 hover:text-blue-300 text-sm'>
          Back to Login
        </a>
      </section>
    </section>
  );
}
