import { useSignal } from '@preact/signals';
import { startAuthentication } from '@simplewebauthn/browser';

import {
  RequestBody as PasskeyLoginRequestBody,
  ResponseBody as PasskeyLoginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/login.ts';

interface PasswordlessPasskeyLoginProps {
  redirectUrl?: string;
}

export default function PasswordlessPasskeyLogin({ redirectUrl }: PasswordlessPasskeyLoginProps) {
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handlePasswordlessLogin = async () => {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const beginRequestBody: PasskeyLoginRequestBody = {
        stage: 'begin',
      };

      const beginResponse = await fetch('/api/auth/multi-factor/passkey/login', {
        method: 'POST',
        body: JSON.stringify(beginRequestBody),
      });

      if (!beginResponse.ok) {
        throw new Error(
          `Failed to begin passwordless login! ${beginResponse.statusText} ${await beginResponse.text()}`,
        );
      }

      const beginData = await beginResponse.json() as PasskeyLoginResponseBody;

      if (!beginData.success) {
        throw new Error(beginData.error || 'Failed to begin passwordless login');
      }

      const authenticationResponse = await startAuthentication({
        optionsJSON: beginData.options!,
      });

      const verifyRequestBody: PasskeyLoginRequestBody = {
        stage: 'verify',
        challenge: beginData.options!.challenge,
        authenticationResponse,
        redirectUrl: redirectUrl || '/',
      };

      const verifyResponse = await fetch('/api/auth/multi-factor/passkey/login', {
        method: 'POST',
        body: JSON.stringify(verifyRequestBody),
      });

      if (verifyResponse.ok) {
        window.location.href = redirectUrl || '/';
        return;
      }

      const verifyData = await verifyResponse.json() as PasskeyLoginResponseBody;
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
    <div class='space-y-4'>
      <div class='text-center'>
        <p class='text-gray-400 text-sm mb-3'>or</p>
      </div>

      <button
        type='button'
        onClick={handlePasswordlessLogin}
        disabled={isLoading.value}
        class='w-full button disabled:bg-sky-300 disabled:hover:bg-sky-300 flex items-center justify-center'
      >
        {isLoading.value ? 'Authenticating...' : 'Login with Passkey'}
      </button>

      {error.value && (
        <div class='bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative'>
          <strong class='font-bold'>Passkey Login Error:</strong>
          <span class='block sm:inline'>{error.value}</span>
        </div>
      )}

      <div class='text-center'>
        <p class='text-gray-500 text-xs'>
          Passwordless login is available when MFA is enabled
        </p>
      </div>
    </div>
  );
}
