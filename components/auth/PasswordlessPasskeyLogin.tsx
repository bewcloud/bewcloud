export interface PasswordlessPasskeyLoginProps {
  email?: string;
  redirectUrl?: string;
}

export default function PasswordlessPasskeyLogin({ email, redirectUrl }: PasswordlessPasskeyLoginProps) {
  return (
    <>
      <section class='flex flex-col items-center gap-4'>
        <button
          id='passwordless-passkey-login-button'
          type='button'
          class='button-secondary'
          data-email={email}
          data-redirect-url={redirectUrl}
        >
          Login with Passkey
        </button>

        <section class='notification-error hidden' id='passwordless-passkey-login-error'></section>
      </section>

      <script src='/public/js/simplewebauthn.js'></script>
      <script type='module' src='/public/ts/passwordless-passkey-login.ts'></script>
    </>
  );
}
