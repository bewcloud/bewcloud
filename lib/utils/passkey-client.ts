import { startAuthentication } from '@simplewebauthn/browser';

export async function authenticateWithPasskey(email: string, redirectUrl?: string): Promise<boolean> {
  try {
    const beginResponse = await fetch('/api/two-factor/passkey-auth-begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const beginData = await beginResponse.json();
    if (!beginData.success) {
      throw new Error(beginData.error || 'Failed to begin passkey authentication');
    }

    const authenticationResponse = await startAuthentication(beginData.options);

    const verifyResponse = await fetch('/api/two-factor/passkey-auth-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: beginData.userId,
        challenge: beginData.options.challenge,
        authenticationResponse,
        redirectUrl,
      }),
    });

    if (verifyResponse.ok && verifyResponse.redirected) {
      window.location.href = verifyResponse.url;
      return true;
    }

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      throw new Error(verifyData.error || 'Failed to verify passkey authentication');
    }

    return true;
  } catch (error) {
    console.error('Passkey authentication error:', error);
    throw error;
  }
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.navigator.credentials !== 'undefined';
}
