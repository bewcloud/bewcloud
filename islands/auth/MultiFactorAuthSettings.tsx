import { useSignal } from '@preact/signals';
import { startRegistration } from '@simplewebauthn/browser';

import { MultiFactorAuthMethodType } from '/lib/types.ts';
import {
  RequestBody as PasskeySetupBeginRequestBody,
  ResponseBody as PasskeySetupBeginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/setup-begin.ts';
import {
  RequestBody as PasskeySetupCompleteRequestBody,
  ResponseBody as PasskeySetupCompleteResponseBody,
} from '/routes/api/auth/multi-factor/passkey/setup-complete.ts';
import {
  RequestBody as TOTPSetupRequestBody,
  ResponseBody as TOTPSetupResponseBody,
} from '/routes/api/auth/multi-factor/totp/setup.ts';
import {
  RequestBody as EmailSetupRequestBody,
  ResponseBody as EmailSetupResponseBody,
} from '/routes/api/auth/multi-factor/email/setup.ts';
import {
  RequestBody as MultiFactorAuthEnableRequestBody,
  ResponseBody as MultiFactorAuthEnableResponseBody,
} from '/routes/api/auth/multi-factor/enable.ts';
import {
  RequestBody as MultiFactorAuthDisableRequestBody,
  ResponseBody as MultiFactorAuthDisableResponseBody,
} from '/routes/api/auth/multi-factor/disable.ts';

interface MultiFactorAuthMethod {
  type: MultiFactorAuthMethodType;
  id: string;
  name: string;
  enabled: boolean;
  backupCodesCount?: number;
}

interface MultiFactorAuthSettingsProps {
  methods: MultiFactorAuthMethod[];
}

interface TOTPSetupData {
  type: 'totp';
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  methodId: string;
}

interface PasskeySetupData {
  methodId: string;
  type: 'passkey';
}

interface EmailSetupData {
  methodId: string;
  type: 'email';
}

const methodTypeLabels: Record<MultiFactorAuthMethodType, string> = {
  totp: 'Authenticator App',
  passkey: 'Passkey',
  email: 'Email',
};

const methodTypeDescriptions: Record<MultiFactorAuthMethodType, string> = {
  totp: 'Use an authenticator app like Aegis Authenticator or Google Authenticator to generate codes.',
  passkey: 'Use biometric authentication or security keys.',
  email: 'Receive codes in your email.',
};

const availableMethodTypes = ['totp', 'passkey', 'email'] as MultiFactorAuthMethodType[];

export default function MultiFactorAuthSettings({ methods }: MultiFactorAuthSettingsProps) {
  const setupData = useSignal<TOTPSetupData | PasskeySetupData | EmailSetupData | null>(null);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const success = useSignal<string | null>(null);
  const showDisableForm = useSignal<'all' | string | null>(null);
  const verificationToken = useSignal('');
  const disablePassword = useSignal('');

  const enabledMethods = methods.filter((method) => method.enabled);
  const hasMultiFactorAuthEnabled = enabledMethods.length > 0;

  const setupPasskey = async () => {
    const beginRequestBody: PasskeySetupBeginRequestBody = {};

    const beginResponse = await fetch('/api/auth/multi-factor/passkey/setup-begin', {
      method: 'POST',
      body: JSON.stringify(beginRequestBody),
    });

    if (!beginResponse.ok) {
      throw new Error(
        `Failed to begin passkey registration! ${beginResponse.statusText} ${await beginResponse.text()}`,
      );
    }

    const beginData = await beginResponse.json() as PasskeySetupBeginResponseBody;

    if (!beginData.success) {
      throw new Error(beginData.error || 'Failed to begin passkey registration.');
    }

    const registrationResponse = await startRegistration({ optionsJSON: beginData.options! });

    const completeRequestBody: PasskeySetupCompleteRequestBody = {
      methodId: beginData.sessionData!.methodId,
      challenge: beginData.sessionData!.challenge,
      registrationResponse,
    };

    const completeResponse = await fetch('/api/auth/multi-factor/passkey/setup-complete', {
      method: 'POST',
      body: JSON.stringify(completeRequestBody),
    });

    if (!completeResponse.ok) {
      throw new Error(
        `Failed to complete passkey registration! ${completeResponse.statusText} ${await completeResponse.text()}`,
      );
    }

    const completeData = await completeResponse.json() as PasskeySetupCompleteResponseBody;

    if (!completeData.success) {
      throw new Error(completeData.error || 'Failed to complete passkey registration.');
    }

    setupData.value = {
      methodId: beginData.sessionData!.methodId,
      type: 'passkey',
    };
  };

  const setupTOTP = async () => {
    const requestBody: TOTPSetupRequestBody = {};

    const response = await fetch('/api/auth/multi-factor/totp/setup', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to setup TOTP multi-factor authentication. ${response.statusText} ${await response.text()}`,
      );
    }

    const data = await response.json() as TOTPSetupResponseBody;

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to setup TOTP multi-factor authentication.');
    }

    setupData.value = {
      type: 'totp',
      secret: data.data.secret!,
      qrCodeUrl: data.data.qrCodeUrl!,
      backupCodes: data.data.backupCodes!,
      methodId: data.data.methodId!,
    };
  };

  const setupEmail = async () => {
    const requestBody: EmailSetupRequestBody = {};

    const response = await fetch('/api/auth/multi-factor/email/setup', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to setup email multi-factor authentication. Please check your SMTP settings are valid and try again. ${response.statusText} ${await response
          .text()}`,
      );
    }

    const data = await response.json() as EmailSetupResponseBody;

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to setup email multi-factor authentication.');
    }

    setupData.value = {
      type: 'email',
      methodId: data.data.methodId!,
    };
  };

  const setupMultiFactorAuth = async (type: MultiFactorAuthMethodType) => {
    isLoading.value = true;
    error.value = null;

    try {
      if (type === 'totp') {
        await setupTOTP();
      } else if (type === 'passkey') {
        await setupPasskey();
      } else if (type === 'email') {
        await setupEmail();
      }
    } catch (setupError) {
      error.value = (setupError as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const enableMultiFactorAuth = async () => {
    if (!setupData.value) {
      error.value = 'No setup data available';
      return;
    }

    if (setupData.value.type !== 'passkey' && !verificationToken.value) {
      error.value = 'Please enter a verification code/token';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const requestBody: MultiFactorAuthEnableRequestBody = {
        methodId: setupData.value.methodId,
        code: setupData.value.type === 'passkey' ? 'passkey-verified' : verificationToken.value,
      };

      const response = await fetch('/api/auth/multi-factor/enable', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to enable multi-factor authentication method. ${response.statusText} ${await response.text()}`,
        );
      }

      const data = await response.json() as MultiFactorAuthEnableResponseBody;

      if (!data.success) {
        throw new Error(data.error || 'Failed to enable multi-factor authentication method.');
      }

      success.value = 'Multi-factor authentication method has been enabled successfully! Reloading...';
      setupData.value = null;
      verificationToken.value = '';

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (enableError) {
      error.value = (enableError as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const disableMultiFactorAuth = async (methodId?: string, disableAll = false) => {
    if (!disablePassword.value) {
      error.value = 'Please enter your password';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const requestBody: MultiFactorAuthDisableRequestBody = {
        methodId,
        password: disablePassword.value,
        disableAll,
      };

      const response = await fetch('/api/auth/multi-factor/disable', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to disable multi-factor authentication method. ${response.statusText} ${await response.text()}`,
        );
      }

      const data = await response.json() as MultiFactorAuthDisableResponseBody;

      if (!data.success) {
        throw new Error(data.error || 'Failed to disable multi-factor authentication method.');
      }

      success.value = 'Multi-factor authentication method has been disabled successfully! Reloading...';
      showDisableForm.value = null;
      disablePassword.value = '';

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (disableError) {
      error.value = (disableError as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const cancelSetup = () => {
    setupData.value = null;
    verificationToken.value = '';
    error.value = null;
  };

  const cancelDisable = () => {
    showDisableForm.value = null;
    disablePassword.value = '';
    error.value = null;
  };

  return (
    <section class='mb-16'>
      <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>
        Multi-Factor Authentication (MFA)
      </h2>

      <section class='px-4 max-w-screen-md mx-auto lg:min-w-96'>
        {error.value
          ? (
            <section class='notification-error mb-4'>
              <p>{error.value}</p>
            </section>
          )
          : null}

        {success.value
          ? (
            <section class='notification-success mb-4'>
              <p>{success.value}</p>
            </section>
          )
          : null}

        <p class='mb-6'>
          Multi-factor authentication adds an extra layer of security to your account by requiring additional
          verification beyond your password.
        </p>

        {availableMethodTypes
            .filter((type) => !enabledMethods.some((method) => method.type === type)).length > 0
          ? (
            <section class='mb-6 mt-4'>
              <h3 class='text-lg font-semibold mb-4'>
                Available Authentication Methods
              </h3>
              <section class='space-y-4'>
                {availableMethodTypes
                  .filter((type) =>
                    !enabledMethods.some((method) => method.type === type) && setupData.value?.type !== type
                  )
                  .map((type) => (
                    <section key={type} class='border rounded-lg p-4'>
                      <section class='flex items-center justify-between'>
                        <section>
                          <h4 class='font-medium'>{methodTypeLabels[type]}</h4>
                          <p class='text-sm text-gray-400'>{methodTypeDescriptions[type]}</p>
                        </section>
                        <button
                          type='button'
                          onClick={() => setupMultiFactorAuth(type)}
                          disabled={isLoading.value}
                          class='button-secondary'
                        >
                          {isLoading.value ? '...' : 'Add'}
                        </button>
                      </section>
                    </section>
                  ))}
              </section>
            </section>
          )
          : null}

        {setupData.value && setupData.value.type === 'totp'
          ? (
            <section class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>Setup Authenticator App</h3>

              <section class='mb-6'>
                <p class='mb-4'>
                  1. Scan this QR code with your authenticator app (Aegis Authenticator, Google Authenticator, etc.):
                </p>
                <section class='flex justify-center mb-4 max-w-sm mx-auto'>
                  <img src={setupData.value.qrCodeUrl} alt='TOTP QR Code' class='border-8 border-white' />
                </section>
                <p class='text-sm text-gray-400 mb-4'>
                  Or manually enter this secret:{' '}
                  <code class='bg-gray-200 px-2 py-1 rounded text-gray-900'>{setupData.value.secret}</code>
                </p>
              </section>

              <section class='mb-6'>
                <p class='mb-4'>
                  2. Save these backup codes <strong class='font-bold text-sky-500'>NOW</strong> in a safe place:
                </p>
                <section class='bg-gray-200 border rounded p-4 font-mono text-sm text-gray-900'>
                  {setupData.value.backupCodes.map((code, index) => <section key={index} class='mb-1'>{code}</section>)}
                </section>
                <p class='text-sm text-gray-400 mt-2'>
                  These codes can be used to access your account if you lose your authenticator device.{' '}
                  <strong class='font-bold text-sky-500'>They won't be visible again</strong>.
                </p>
              </section>

              <fieldset class='block mb-6'>
                <label class='text-slate-300 block pb-1'>
                  3. Enter the 6-digit code from your authenticator app:
                </label>
                <input
                  type='text'
                  value={verificationToken.value}
                  onInput={(event) => verificationToken.value = (event.target as HTMLInputElement).value}
                  placeholder='123456'
                  class='mt-1 input-field'
                  maxLength={6}
                />
              </fieldset>

              <section class='flex justify-end gap-2 mt-8 mb-4'>
                <button
                  type='button'
                  onClick={cancelSetup}
                  disabled={isLoading.value}
                  class='button-secondary'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={enableMultiFactorAuth}
                  disabled={isLoading.value || !verificationToken.value}
                  class='button'
                >
                  {isLoading.value ? 'Enabling...' : 'Enable TOTP MFA'}
                </button>
              </section>
            </section>
          )
          : null}

        {setupData.value && setupData.value.type === 'passkey'
          ? (
            <section class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>Passkey Setup Complete</h3>
              <p class='mb-4'>
                Your passkey has been successfully registered! You can now enable it for multi-factor authentication.
              </p>

              <section class='flex justify-end gap-2 mt-8 mb-4'>
                <button
                  type='button'
                  onClick={cancelSetup}
                  disabled={isLoading.value}
                  class='button-secondary'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={enableMultiFactorAuth}
                  disabled={isLoading.value}
                  class='button'
                >
                  {isLoading.value ? 'Enabling...' : 'Enable Passkey MFA'}
                </button>
              </section>
            </section>
          )
          : null}

        {setupData.value && setupData.value.type === 'email'
          ? (
            <section class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>Setup Email</h3>

              <fieldset class='block mb-6'>
                <label class='text-slate-300 block pb-1'>
                  Enter the 6-digit code you received in your email:
                </label>
                <input
                  type='text'
                  value={verificationToken.value}
                  onInput={(event) => verificationToken.value = (event.target as HTMLInputElement).value}
                  placeholder='123456'
                  class='mt-1 input-field'
                  maxLength={6}
                />
              </fieldset>

              <section class='flex justify-end gap-2 mt-8 mb-4'>
                <button
                  type='button'
                  onClick={cancelSetup}
                  disabled={isLoading.value}
                  class='button-secondary'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={enableMultiFactorAuth}
                  disabled={isLoading.value || !verificationToken.value}
                  class='button'
                >
                  {isLoading.value ? 'Enabling...' : 'Enable Email MFA'}
                </button>
              </section>
            </section>
          )
          : null}

        {hasMultiFactorAuthEnabled && !showDisableForm.value
          ? (
            <section>
              <section class='mb-6'>
                <h3 class='text-lg font-semibold mb-4'>Active Authentication Methods</h3>

                {enabledMethods.map((method) => (
                  <section key={method.id} class='border rounded-lg p-4 mb-4'>
                    <section class='flex items-center justify-between'>
                      <section>
                        <section
                          class={`flex items-center ${
                            method.type === 'totp' && typeof method.backupCodesCount !== 'undefined' ? 'mb-2' : ''
                          }`}
                        >
                          <span class='inline-block w-3 h-3 bg-emerald-500 rounded-full mr-2'></span>
                          <span class='font-medium'>{method.name}</span>
                        </section>
                        {method.type === 'totp' && typeof method.backupCodesCount !== 'undefined'
                          ? (
                            <p class='text-sm text-gray-600'>
                              {method.backupCodesCount > 0
                                ? `${method.backupCodesCount} backup codes remaining`
                                : 'No backup codes remaining'}
                            </p>
                          )
                          : null}
                      </section>
                      <button
                        type='button'
                        onClick={() => showDisableForm.value = method.id}
                        class='button-secondary'
                      >
                        Disable
                      </button>
                    </section>
                  </section>
                ))}
              </section>

              <section class='flex justify-end mt-8 mb-4'>
                <button
                  type='button'
                  onClick={() => showDisableForm.value = 'all'}
                  class='button-danger'
                >
                  Disable All MFA
                </button>
              </section>
            </section>
          )
          : null}

        {showDisableForm.value
          ? (
            <section class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>
                {showDisableForm.value === 'all'
                  ? 'Disable All Multi-Factor Authentication'
                  : 'Disable Authentication Method'}
              </h3>
              <p class='mb-4'>
                {showDisableForm.value === 'all'
                  ? 'This will disable all multi-factor authentication methods and make your account less secure.'
                  : 'This will disable this authentication method.'} Please enter your password to confirm.
              </p>

              <fieldset class='block mb-4'>
                <label class='text-slate-300 block pb-1'>Password</label>
                <input
                  type='password'
                  value={disablePassword.value}
                  onInput={(event) => disablePassword.value = (event.target as HTMLInputElement).value}
                  placeholder='Enter your password'
                  class='mt-1 input-field'
                />
              </fieldset>

              <section class='flex justify-end gap-2 mt-8 mb-4'>
                <button
                  type='button'
                  onClick={cancelDisable}
                  disabled={isLoading.value}
                  class='button-secondary'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={() =>
                    disableMultiFactorAuth(
                      showDisableForm.value === 'all' ? undefined : showDisableForm.value || undefined,
                      showDisableForm.value === 'all',
                    )}
                  disabled={isLoading.value || !disablePassword.value}
                  class='button-danger'
                >
                  {isLoading.value ? 'Disabling...' : 'Disable'}
                </button>
              </section>
            </section>
          )
          : null}
      </section>
    </section>
  );
}
