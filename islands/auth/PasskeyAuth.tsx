import { useSignal } from '@preact/signals';
import { startAuthentication } from '@simplewebauthn/browser';

import {
  RequestBody as PasskeyAuthBeginRequestBody,
  ResponseBody as PasskeyAuthBeginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/begin.ts';
import {
  RequestBody as PasskeyAuthVerifyRequestBody,
  ResponseBody as PasskeyAuthVerifyResponseBody,
} from '/routes/api/auth/multi-factor/passkey/verify.ts';

interface PasskeyAuthProps {
  userId: string;
  redirectUrl: string;
}

export default function PasskeyAuth({ userId, redirectUrl }: PasskeyAuthProps) {
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handlePasskeyAuth = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const beginRequestBody: PasskeyAuthBeginRequestBody = {
        userId,
      };

      const beginResponse = await fetch('/api/auth/multi-factor/passkey/begin', {
        method: 'POST',
        body: JSON.stringify(beginRequestBody),
      });

      const beginData = await beginResponse.json() as PasskeyAuthBeginResponseBody;

      if (!beginData.success) {
        throw new Error(beginData.error || 'Failed to begin passkey authentication');
      }

      const authenticationResponse = await startAuthentication({ optionsJSON: beginData.options! });

      const verifyRequestBody: PasskeyAuthVerifyRequestBody = {
        userId,
        challenge: beginData.options!.challenge,
        authenticationResponse,
        redirectUrl,
      };

      const verifyResponse = await fetch('/api/auth/multi-factor/passkey/verify', {
        method: 'POST',
        body: JSON.stringify(verifyRequestBody),
      });

      if (verifyResponse.ok) {
        window.location.href = redirectUrl;
        return;
      }

      const verifyData = await verifyResponse.json() as PasskeyAuthVerifyResponseBody;

      throw new Error(verifyData.error || 'Authentication failed');
    } catch (verificationError) {
      console.error('Passkey authentication failed:', verificationError);
      error.value = (verificationError as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  return (
    <div class='space-y-4'>
      <button
        type='button'
        onClick={handlePasskeyAuth}
        disabled={isLoading.value}
        class='w-full button disabled:bg-sky-300 disabled:hover:bg-sky-300 flex items-center justify-center'
      >
        {isLoading.value ? 'Authenticating...' : 'Use Passkey'}
      </button>

      {error.value && (
        <div class='bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative'>
          <strong class='font-bold'>Passkey Error:</strong>
          <span class='block sm:inline'>{error.value}</span>
        </div>
      )}
    </div>
  );
}
