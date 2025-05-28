// This file contains some passkey authentication utilities that are isomorphic.

import { startAuthentication } from '@simplewebauthn/browser';

import {
  RequestBody as PasskeyAuthBeginRequestBody,
  ResponseBody as PasskeyAuthBeginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/begin.ts';
import {
  RequestBody as PasskeyAuthVerifyRequestBody,
  ResponseBody as PasskeyAuthVerifyResponseBody,
} from '/routes/api/auth/multi-factor/passkey/verify.ts';

export async function authenticateWithPasskey(email: string, redirectUrl?: string): Promise<boolean> {
  try {
    const beginRequestBody: PasskeyAuthBeginRequestBody = {
      email,
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
      userId: beginData.sessionData!.userId,
      challenge: beginData.options!.challenge,
      authenticationResponse,
      redirectUrl,
    };

    const verifyResponse = await fetch('/api/auth/multi-factor/passkey/verify', {
      method: 'POST',
      body: JSON.stringify(verifyRequestBody),
    });

    if (verifyResponse.ok && verifyResponse.redirected) {
      window.location.href = verifyResponse.url;
      return true;
    }

    const verifyData = await verifyResponse.json() as PasskeyAuthVerifyResponseBody;

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
    typeof window.navigator?.credentials !== 'undefined';
}
