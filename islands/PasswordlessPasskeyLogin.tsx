import { useSignal } from '@preact/signals';
import { startAuthentication } from '@simplewebauthn/browser';

interface PasswordlessPasskeyLoginProps {
  redirectUrl?: string;
}

export default function PasswordlessPasskeyLogin({ redirectUrl }: PasswordlessPasskeyLoginProps) {
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handlePasswordlessLogin = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const beginResponse = await fetch('/api/auth/passkey-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'begin' }),
      });

      const beginData = await beginResponse.json();
      if (!beginData.success) {
        throw new Error(beginData.error || 'Failed to begin passwordless login');
      }

      const authenticationResponse = await startAuthentication({
        optionsJSON: beginData.options,
      });

      const verifyResponse = await fetch('/api/auth/passkey-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'verify',
          challenge: beginData.options.challenge,
          authenticationResponse,
          redirectUrl: redirectUrl || '/',
        }),
      });

      if (verifyResponse.ok) {
        window.location.href = redirectUrl || '/';
      } else {
        const verifyData = await verifyResponse.json();
        throw new Error(verifyData.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Passwordless passkey login failed:', err);
      error.value = (err as Error).message;
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
          Passwordless login is available when 2FA is enabled
        </p>
      </div>
    </div>
  );
}
