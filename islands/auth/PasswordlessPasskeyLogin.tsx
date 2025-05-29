import { useSignal } from '@preact/signals';
import { startAuthentication } from '@simplewebauthn/browser';

import {
  RequestBody as PasskeyBeginRequestBody,
  ResponseBody as PasskeyBeginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/begin.ts';

import {
  RequestBody as PasskeyVerifyRequestBody,
  ResponseBody as PasskeyVerifyResponseBody,
} from '/routes/api/auth/multi-factor/passkey/verify.ts';

interface PasswordlessPasskeyLoginProps {
  email?: string;
  redirectUrl?: string;
}

export default function PasswordlessPasskeyLogin({ email: providedEmail, redirectUrl }: PasswordlessPasskeyLoginProps) {
  const isLoading = useSignal(false);
  const email = useSignal<string | null>(providedEmail || null);
  const error = useSignal<string | null>(null);

  const handlePasswordlessLogin = async () => {
    if (isLoading.value) {
      return;
    }

    if (!email.value) {
      const promptEmail = prompt('Please enter your email');
      if (!promptEmail) {
        throw new Error('Email is required to login with Passkey');
      }
      email.value = promptEmail;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const beginRequestBody: PasskeyBeginRequestBody = {
        email: email.value,
      };

      const beginResponse = await fetch('/api/auth/multi-factor/passkey/begin', {
        method: 'POST',
        body: JSON.stringify(beginRequestBody),
      });

      if (!beginResponse.ok) {
        throw new Error(
          `Failed to begin passwordless login! ${beginResponse.statusText} ${await beginResponse.text()}`,
        );
      }

      const beginData = await beginResponse.json() as PasskeyBeginResponseBody;

      if (!beginData.success) {
        throw new Error(beginData.error || 'Failed to begin passwordless login');
      }

      const authenticationResponse = await startAuthentication({
        optionsJSON: beginData.options!,
      });

      const verifyRequestBody: PasskeyVerifyRequestBody = {
        email: email.value,
        challenge: beginData.sessionData!.challenge,
        authenticationResponse,
        redirectUrl: redirectUrl || '/',
      };

      const verifyResponse = await fetch('/api/auth/multi-factor/passkey/verify', {
        method: 'POST',
        body: JSON.stringify(verifyRequestBody),
      });

      if (verifyResponse.ok) {
        window.location.href = redirectUrl || '/';
        return;
      }

      const verifyData = await verifyResponse.json() as PasskeyVerifyResponseBody;
      throw new Error(
        verifyData.error || `Authentication failed! ${verifyResponse.statusText} ${await verifyResponse.text()}`,
      );
    } catch (handleError) {
      console.error('Passwordless passkey login failed:', handleError);
      error.value = (handleError as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  return (
    <section class='space-y-4'>
      <section class='flex justify-center mt-2 mb-4'>
        <button
          type='button'
          onClick={handlePasswordlessLogin}
          class='button-secondary'
        >
          {isLoading.value ? 'Authenticating...' : 'Login with Passkey'}
        </button>
      </section>

      {error.value
        ? (
          <section class='notification-error'>
            <p>{error.value}</p>
          </section>
        )
        : null}
    </section>
  );
}
