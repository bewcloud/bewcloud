import { MultiFactorAuthMethodType } from '/lib/types.ts';
import PasswordlessPasskeyLogin from '/components/auth/PasswordlessPasskeyLogin.tsx';

interface MultiFactorAuthVerifyFormProps {
  email: string;
  redirectUrl: string;
  availableMethods: MultiFactorAuthMethodType[];
  isEmailCodeSent: boolean;
  error?: { title: string; message: string };
}

export default function MultiFactorAuthVerifyForm(
  { email, redirectUrl, availableMethods, isEmailCodeSent, error }: MultiFactorAuthVerifyFormProps,
) {
  const hasPasskey = availableMethods.includes('passkey') && Boolean(email);
  const hasTotp = availableMethods.includes('totp');
  const hasEmail = availableMethods.includes('email');
  const action = `/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`;

  return (
    <section class='max-w-md w-full mb-12 mx-auto px-4'>
      <section class='mb-6'>
        <h1 class='mt-6 text-center text-3xl font-extrabold text-white'>
          Multi-Factor Authentication
        </h1>
        <p class='mt-2 text-center text-sm text-gray-300'>
          Verify your identity to finish logging in.
        </p>
      </section>

      {error
        ? (
          <section class='notification-error' role='alert'>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
          </section>
        )
        : null}

      <section class='grid gap-4'>
        {hasTotp && (
          <form class='w-full min-w-0 p-0 text-center' method='POST' action={action}>
            <fieldset class='mb-4 text-left'>
              <label class='text-slate-300 block pb-1' for='token'>
                Authenticator or backup code
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
            <button type='submit' class='button'>Verify code</button>
          </form>
        )}

        {hasTotp && hasEmail && <p class='text-center text-gray-400 text-sm'>or</p>}

        {hasEmail && (
          <form class='w-full min-w-0 p-0 text-center' method='POST' action={action}>
            {isEmailCodeSent
              ? (
                <>
                  <fieldset class='mb-4 text-left'>
                    <label class='text-slate-300 block pb-1' for='code'>Email verification code</label>
                    <input
                      type='text'
                      id='code'
                      name='code'
                      placeholder='123456'
                      class='mt-1 input-field'
                      inputmode='numeric'
                      autocomplete='one-time-code'
                      required
                    />
                  </fieldset>
                  <button type='submit' class='button'>Verify email code</button>
                </>
              )
              : (
                <button type='submit' class='button-secondary' name='send_email_code' value='true'>
                  Send 2FA code by email
                </button>
              )}
          </form>
        )}

        {(hasEmail || hasTotp) && hasPasskey && <p class='text-center text-gray-400 text-sm'>or</p>}
        {hasPasskey && <PasswordlessPasskeyLogin email={email} redirectUrl={redirectUrl} />}
      </section>

      <section class='text-center mt-6'>
        <a href='/login' class='text-blue-400 hover:text-blue-300 text-sm'>
          Back to Login
        </a>
      </section>
    </section>
  );
}
