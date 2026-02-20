export interface PasswordlessPasskeyLoginProps {
  email?: string;
  redirectUrl?: string;
}

export default function PasswordlessPasskeyLogin({ email, redirectUrl }: PasswordlessPasskeyLoginProps) {
  return (
    <>
      <section class='space-y-4'>
        <section class='flex justify-center mt-2 mb-4'>
          <button
            id='passwordless-passkey-login-button'
            type='button'
            class='button-secondary'
            data-email={email}
            data-redirect-url={redirectUrl}
          >
            Login with Passkey
          </button>
        </section>

        <section class='notification-error hidden' id='passwordless-passkey-login-error'></section>
      </section>

      <script src='/public/js/simplewebauthn.js'></script>
      <script type='module' src='/public/ts/passwordless-passkey-login.ts'></script>
    </>
  );
}
