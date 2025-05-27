import { useSignal } from '@preact/signals';
import { startAuthentication } from '@simplewebauthn/browser';

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
      const beginResponse = await fetch('/api/two-factor/passkey-auth-begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const beginData = await beginResponse.json();
      if (!beginData.success) {
        throw new Error(beginData.error || 'Failed to begin passkey authentication');
      }

      const authenticationResponse = await startAuthentication({ optionsJSON: beginData.options });

      const verifyResponse = await fetch('/api/two-factor/passkey-auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          challenge: beginData.options.challenge,
          authenticationResponse,
          redirectUrl,
        }),
      });

      if (verifyResponse.ok) {
        window.location.href = redirectUrl;
      } else {
        const verifyData = await verifyResponse.json();
        throw new Error(verifyData.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Passkey authentication failed:', err);
      error.value = (err as Error).message;
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
