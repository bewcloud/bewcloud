import { useSignal } from '@preact/signals';
import { TwoFactorActionResponse, TwoFactorMethodType, TwoFactorSetupResponse } from '/lib/types.ts';

interface TwoFactorMethod {
  type: TwoFactorMethodType;
  id: string;
  name: string;
  enabled: boolean;
  backupCodesCount?: number;
}

interface TwoFactorSettingsProps {
  methods: TwoFactorMethod[];
}

interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  methodId: string;
}

const methodTypeLabels: Record<TwoFactorMethodType, string> = {
  totp: 'Authenticator App',
  email: 'Email',
  passkey: 'Passkey',
};

const methodTypeDescriptions: Record<TwoFactorMethodType, string> = {
  totp: 'Use an authenticator app like Google Authenticator or Authy to generate codes',
  email: 'Receive verification codes via email',
  passkey: 'Use biometric authentication or security keys',
};

export default function TwoFactorSettings({ methods }: TwoFactorSettingsProps) {
  const setupData = useSignal<TOTPSetupData | null>(null);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const success = useSignal<string | null>(null);
  const showDisableForm = useSignal<string | null>(null);
  const verificationToken = useSignal('');
  const disablePassword = useSignal('');
  const selectedMethodType = useSignal<TwoFactorMethodType>('totp');

  const enabledMethods = methods.filter((m) => m.enabled);
  const hasTwoFactorEnabled = enabledMethods.length > 0;

  const setupTwoFactor = async (type: TwoFactorMethodType) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/two-factor/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: methodTypeLabels[type],
        }),
      });

      const data = await response.json() as TwoFactorSetupResponse;

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to setup two-factor authentication');
      }

      if (type === 'totp') {
        setupData.value = {
          secret: data.data.secret!,
          qrCodeUrl: data.data.qrCodeUrl!,
          backupCodes: data.data.backupCodes!,
          methodId: data.data.methodId!,
        };
      }
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const enableTwoFactor = async () => {
    if (!setupData.value || !verificationToken.value) {
      error.value = 'Please enter a verification token';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId: setupData.value.methodId,
          code: verificationToken.value,
        }),
      });

      const data = await response.json() as TwoFactorActionResponse;

      if (!data.success) {
        throw new Error(data.error || 'Failed to enable two-factor authentication');
      }

      success.value = 'Two-factor authentication has been enabled successfully!';
      setupData.value = null;
      verificationToken.value = '';

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const disableTwoFactor = async (methodId?: string, disableAll = false) => {
    if (!disablePassword.value) {
      error.value = 'Please enter your password';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/two-factor/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methodId,
          password: disablePassword.value,
          disableAll,
        }),
      });

      const data = await response.json() as TwoFactorActionResponse;

      if (!data.success) {
        throw new Error(data.error || 'Failed to disable two-factor authentication');
      }

      success.value = data.message || 'Two-factor authentication has been disabled successfully!';
      showDisableForm.value = null;
      disablePassword.value = '';

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      error.value = (err as Error).message;
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
        Two-Factor Authentication (2FA)
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
          Two-factor authentication adds an extra layer of security to your account by requiring additional verification
          beyond your password.
        </p>

        {!hasTwoFactorEnabled && !setupData.value && (
          <div>
            <div class='mb-6'>
              <h3 class='text-lg font-semibold mb-4'>Available Authentication Methods</h3>
              <div class='space-y-4'>
                {(['totp'] as TwoFactorMethodType[]).map((type) => (
                  <div key={type} class='border rounded-lg p-4'>
                    <div class='flex items-center justify-between'>
                      <div>
                        <h4 class='font-medium'>{methodTypeLabels[type]}</h4>
                        <p class='text-sm text-gray-600'>{methodTypeDescriptions[type]}</p>
                      </div>
                      <button
                        type='button'
                        onClick={() => setupTwoFactor(type)}
                        disabled={isLoading.value}
                        class='button-secondary'
                      >
                        {isLoading.value ? 'Setting up...' : 'Setup'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {setupData.value && (
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
                onInput={(e) => verificationToken.value = (e.target as HTMLInputElement).value}
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
                class='button-outline'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={enableTwoFactor}
                disabled={isLoading.value || !verificationToken.value}
                class='button-secondary'
              >
                {isLoading.value ? 'Enabling...' : 'Enable 2FA'}
              </button>
            </section>
          </div>
        )}

        {hasTwoFactorEnabled && !showDisableForm.value && (
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
                Disable All 2FA
              </button>
            </section>
          </div>
        )}

        {showDisableForm.value && (
          <div class='mb-6'>
            <h3 class='text-lg font-semibold mb-4'>
              {showDisableForm.value === 'all'
                ? 'Disable All Two-Factor Authentication'
                : 'Disable Authentication Method'}
            </h3>
            <p class='mb-4'>
              {showDisableForm.value === 'all'
                ? 'This will disable all two-factor authentication methods and make your account less secure.'
                : 'This will disable this authentication method.'} Please enter your password to confirm.
            </p>

            <div class='mb-4'>
              <label class='block text-sm font-medium mb-2'>Password:</label>
              <input
                type='password'
                value={disablePassword.value}
                onInput={(e) => disablePassword.value = (e.target as HTMLInputElement).value}
                placeholder='Enter your password'
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <section class='flex justify-end gap-2 mt-8 mb-4'>
              <button
                type='button'
                onClick={cancelDisable}
                disabled={isLoading.value}
                class='button-outline'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() =>
                  disableTwoFactor(
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
