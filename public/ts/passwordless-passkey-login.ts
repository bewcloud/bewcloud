declare global {
  interface Window {
    SimpleWebAuthnBrowser: typeof import('@simplewebauthn/browser');
  }
}

import {
  RequestBody as PasskeyBeginRequestBody,
  ResponseBody as PasskeyBeginResponseBody,
} from '/pages/api/auth/multi-factor/passkey/begin.ts';

import {
  RequestBody as PasskeyVerifyRequestBody,
  ResponseBody as PasskeyVerifyResponseBody,
} from '/pages/api/auth/multi-factor/passkey/verify.ts';

let isLoading = false;
const passkeyButton = document.getElementById('passwordless-passkey-login-button') as HTMLButtonElement;
const errorElement = document.getElementById('passwordless-passkey-login-error') as HTMLDivElement;

function updateErrorMessage(message: string) {
  if (errorElement) {
    errorElement.innerHTML = `<p>${message}</p>`;
    if (message) {
      errorElement.classList.remove('hidden');
    } else {
      errorElement.classList.add('hidden');
    }
  }
}

async function handlePasswordlessLogin(email: string, redirectUrl: string) {
  if (isLoading) {
    return;
  }

  if (!email) {
    const promptEmail = prompt('Please enter your email');
    if (!promptEmail) {
      throw new Error('Email is required to login with Passkey');
    }
    email = promptEmail;
  }

  const originalButtonText = passkeyButton.textContent;
  passkeyButton.textContent = 'Authenticating...';
  isLoading = true;
  updateErrorMessage('');

  try {
    const beginRequestBody: PasskeyBeginRequestBody = {
      email,
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

    const authenticationResponse = await window.SimpleWebAuthnBrowser.startAuthentication({
      optionsJSON: beginData.options!,
    });

    const verifyRequestBody: PasskeyVerifyRequestBody = {
      email,
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
    updateErrorMessage((handleError as Error).message);
  } finally {
    isLoading = false;
    passkeyButton.textContent = originalButtonText;
  }
}

passkeyButton?.addEventListener('click', () => {
  const email = passkeyButton.dataset.email;
  const redirectUrl = passkeyButton.dataset.redirectUrl;
  handlePasswordlessLogin(email ?? '', redirectUrl ?? '/');
});
