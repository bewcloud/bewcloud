import { useSignal } from '@preact/signals';
import { startRegistration } from '@simplewebauthn/browser';

import { MultiFactorAuthMethodType } from '/lib/types.ts';
import {
  RequestBody as PasskeyRegisterBeginRequestBody,
  ResponseBody as PasskeyRegisterBeginResponseBody,
} from '/routes/api/auth/multi-factor/passkey/register-begin.ts';
import {
  RequestBody as PasskeyRegisterCompleteRequestBody,
  ResponseBody as PasskeyRegisterCompleteResponseBody,
} from '/routes/api/auth/multi-factor/passkey/register-complete.ts';
import {
  RequestBody as MultiFactorAuthSetupRequestBody,
  ResponseBody as MultiFactorAuthSetupResponseBody,
} from '/routes/api/auth/multi-factor/setup.ts';
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

const methodTypeLabels: Record<MultiFactorAuthMethodType, string> = {
  totp: 'Authenticator App',
  passkey: 'Passkey',
};

const methodTypeDescriptions: Record<MultiFactorAuthMethodType, string> = {
  totp: 'Use an authenticator app like Aegis Authenticator or Google Authenticator to generate codes',
  passkey: 'Use biometric authentication or security keys',
};

const availableMethodTypes = ['totp', 'passkey'] as MultiFactorAuthMethodType[];

export default function MultiFactorAuthSettings({ methods }: MultiFactorAuthSettingsProps) {
  const setupData = useSignal<TOTPSetupData | PasskeySetupData | null>(null);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const success = useSignal<string | null>(null);
  const showDisableForm = useSignal<string | null>(null);
  const verificationToken = useSignal('');
  const disablePassword = useSignal('');

  const enabledMethods = methods.filter((method) => method.enabled);
  const hasMultiFactorAuthEnabled = enabledMethods.length > 0;

  const setupPasskey = async (methodId: string) => {
    const beginRequestBody: PasskeyRegisterBeginRequestBody = {
      methodId,
    };

    const beginResponse = await fetch('/api/auth/multi-factor/passkey/register-begin', {
      method: 'POST',
      body: JSON.stringify(beginRequestBody),
    });

    if (!beginResponse.ok) {
      throw new Error(
        `Failed to begin passkey registration! ${beginResponse.statusText} ${await beginResponse.text()}`,
      );
    }

    const beginData = await beginResponse.json() as PasskeyRegisterBeginResponseBody;

    if (!beginData.success) {
      throw new Error(beginData.error || 'Failed to begin passkey registration');
    }

    const registrationResponse = await startRegistration({ optionsJSON: beginData.options! });

    const completeRequestBody: PasskeyRegisterCompleteRequestBody = {
      methodId,
      challenge: beginData.sessionData!.challenge,
      registrationResponse,
    };

    const completeResponse = await fetch('/api/auth/multi-factor/passkey/register-complete', {
      method: 'POST',
      body: JSON.stringify(completeRequestBody),
    });

    if (!completeResponse.ok) {
      throw new Error(
        `Failed to complete passkey registration! ${completeResponse.statusText} ${await completeResponse.text()}`,
      );
    }

    const completeData = await completeResponse.json() as PasskeyRegisterCompleteResponseBody;

    if (!completeData.success) {
      throw new Error(completeData.error || 'Failed to complete passkey registration');
    }

    setupData.value = {
      methodId,
      type: 'passkey',
    };
  };

  const setupMultiFactorAuth = async (type: MultiFactorAuthMethodType) => {
    isLoading.value = true;
    error.value = null;

    try {
      const requestBody: MultiFactorAuthSetupRequestBody = {
        type,
        name: methodTypeLabels[type],
      };

      const response = await fetch('/api/auth/multi-factor/setup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json() as MultiFactorAuthSetupResponseBody;

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to setup multi-factor authentication');
      }

      if (type === 'totp') {
        setupData.value = {
          type: 'totp',
          secret: data.data.secret!,
          qrCodeUrl: data.data.qrCodeUrl!,
          backupCodes: data.data.backupCodes!,
          methodId: data.data.methodId!,
        };
      } else if (type === 'passkey') {
        await setupPasskey(data.data.methodId!);
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
      error.value = 'Please enter a verification token';
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

      const data = await response.json() as MultiFactorAuthEnableResponseBody;

      if (!data.success) {
        throw new Error(data.error || 'Failed to enable multi-factor authentication');
      }

      success.value = 'Multi-factor authentication has been enabled successfully!';
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

      const data = await response.json() as MultiFactorAuthDisableResponseBody;

      if (!data.success) {
        throw new Error(data.error || 'Failed to disable multi-factor authentication');
      }

      success.value = 'Multi-factor authentication has been disabled successfully!';
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
    <div class='mb-16'>
      <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>
        Multi-Factor Authentication (MFA)
      </h2>

      <div class='px-4 max-w-screen-md mx-auto lg:min-w-96'>
        {error.value && (
          <div class='notification-error mb-4'>
            <p>{error.value}</p>
          </div>
        )}

        {success.value && (
          <div class='notification-success mb-4'>
            <p>{success.value}</p>
          </div>
        )}

        <p class='mb-6 text-gray-600'>
          Multi-factor authentication adds an extra layer of security to your account by requiring additional
          verification beyond your password.
        </p>

        {!setupData.value && (
          <div>
            <div class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>
                {hasMultiFactorAuthEnabled
                  ? 'Add Additional Authentication Method'
                  : 'Available Authentication Methods'}
              </h3>
              <div class='space-y-4'>
                {availableMethodTypes
                  .filter((type) => !enabledMethods.some((method) => method.type === type))
                  .map((type) => (
                    <div key={type} class='border rounded-lg p-4'>
                      <div class='flex items-center justify-between'>
                        <div>
                          <h4 class='font-medium'>{methodTypeLabels[type]}</h4>
                          <p class='text-sm text-gray-600'>{methodTypeDescriptions[type]}</p>
                        </div>
                        <button
                          type='button'
                          onClick={() => setupMultiFactorAuth(type)}
                          disabled={isLoading.value}
                          class='button-secondary'
                        >
                          {isLoading.value ? 'Setting up...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {availableMethodTypes
                    .filter((type) => !enabledMethods.some((method) => method.type === type)).length === 0 && (
                <p class='text-gray-600 text-center py-4'>
                  All available authentication methods are already enabled.
                </p>
              )}
            </div>
          </div>
        )}

        {setupData.value && setupData.value.type !== 'passkey' && (
          <div class='mb-6'>
            <h3 class='text-lg font-semibold mb-4'>Setup Authenticator App</h3>

            <div class='mb-6'>
              <p class='mb-4'>
                1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div class='flex justify-center mb-4'>
                <img src={setupData.value.qrCodeUrl} alt='TOTP QR Code' class='border' />
              </div>
              <p class='text-sm text-gray-600 mb-4'>
                Or manually enter this secret:{' '}
                <code class='bg-gray-200 px-2 py-1 rounded'>{setupData.value.secret}</code>
              </p>
            </div>

            <div class='mb-6'>
              <p class='mb-4'>2. Save these backup codes in a safe place:</p>
              <div class='bg-white border rounded p-4 font-mono text-sm text-gray-900'>
                {setupData.value.backupCodes.map((code, index) => <div key={index} class='mb-1'>{code}</div>)}
              </div>
              <p class='text-sm text-gray-600 mt-2'>
                These codes can be used to access your account if you lose your authenticator device.
              </p>
            </div>

            <div class='mb-6'>
              <label class='block text-sm font-medium mb-2'>
                3. Enter the 6-digit code from your authenticator app:
              </label>
              <input
                type='text'
                value={verificationToken.value}
                onInput={(event) => verificationToken.value = (event.target as HTMLInputElement).value}
                placeholder='123456'
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                maxLength={6}
              />
            </div>

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
                {isLoading.value ? 'Enabling...' : 'Enable MFA'}
              </button>
            </section>
          </div>
        )}

        {setupData.value && setupData.value.type === 'passkey' && (
          <div class='mb-6'>
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
          </div>
        )}

        {hasMultiFactorAuthEnabled && !showDisableForm.value && (
          <div>
            <div class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>Active Authentication Methods</h3>

              {enabledMethods.map((method) => (
                <div key={method.id} class='border rounded-lg p-4 mb-4'>
                  <div class='flex items-center justify-between'>
                    <div>
                      <div class='flex items-center mb-2'>
                        <span class='inline-block w-3 h-3 bg-green-500 rounded-full mr-2'></span>
                        <span class='font-medium'>{method.name}</span>
                      </div>
                      {method.type === 'totp' && method.backupCodesCount !== undefined && (
                        <p class='text-sm text-gray-600'>
                          {method.backupCodesCount > 0
                            ? `${method.backupCodesCount} backup codes remaining`
                            : 'No backup codes remaining'}
                        </p>
                      )}
                    </div>
                    <button
                      type='button'
                      onClick={() => showDisableForm.value = method.id}
                      class='button-secondary'
                    >
                      Disable
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <section class='flex justify-end mt-8 mb-4'>
              <button
                type='button'
                onClick={() => showDisableForm.value = 'all'}
                class='button-danger'
              >
                Disable All MFA
              </button>
            </section>
          </div>
        )}

        {showDisableForm.value && (
          <div class='mb-6'>
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

            <div class='mb-4'>
              <label class='block text-sm font-medium mb-2'>Password:</label>
              <input
                type='password'
                value={disablePassword.value}
                onInput={(event) => disablePassword.value = (event.target as HTMLInputElement).value}
                placeholder='Enter your password'
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
