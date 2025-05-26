import { useSignal } from '@preact/signals';

interface TOTPSettingsProps {
  isEnabled: boolean;
  hasBackupCodes: boolean;
  backupCodesCount: number;
}

interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export default function TOTPSettings({ isEnabled, hasBackupCodes, backupCodesCount }: TOTPSettingsProps) {
  const setupData = useSignal<TOTPSetupData | null>(null);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const success = useSignal<string | null>(null);
  const showDisableForm = useSignal(false);
  const verificationToken = useSignal('');
  const disablePassword = useSignal('');

  const setupTOTP = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup TOTP');
      }

      setupData.value = data;
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      isLoading.value = false;
    }
  };

  const enableTOTP = async () => {
    if (!setupData.value || !verificationToken.value) {
      error.value = 'Please enter a verification token';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: setupData.value.secret,
          token: verificationToken.value,
          backupCodes: setupData.value.backupCodes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable TOTP');
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

  const disableTOTP = async () => {
    if (!disablePassword.value) {
      error.value = 'Please enter your password';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: disablePassword.value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable TOTP');
      }

      success.value = 'Two-factor authentication has been disabled successfully!';
      showDisableForm.value = false;
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
    showDisableForm.value = false;
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

        {!isEnabled && !setupData.value && (
          <div>
            <p class='mb-4 text-gray-600'>
              Two-factor authentication adds an extra layer of security to your account by requiring a code from your
              phone in addition to your password.
            </p>
            <section class='flex justify-end mt-8 mb-4 px-4 max-w-screen-md mx-auto lg:min-w-96'>
              <button
                type='button'
                onClick={setupTOTP}
                disabled={isLoading.value}
                class='button-secondary'
              >
                {isLoading.value ? 'Setting up...' : 'Enable 2FA'}
              </button>
            </section>
          </div>
        )}

        {setupData.value && (
          <div class='mb-6'>
            <h3 class='text-lg font-semibold mb-4'>Setup Two-Factor Authentication</h3>

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

            <section class='flex justify-end gap-2 mt-8 mb-4 px-4 max-w-screen-md mx-auto lg:min-w-96'>
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
                onClick={enableTOTP}
                disabled={isLoading.value || !verificationToken.value}
                class='button-secondary'
              >
                {isLoading.value ? 'Enabling...' : 'Enable 2FA'}
              </button>
            </section>
          </div>
        )}

        {isEnabled && !showDisableForm.value && (
          <div>
            <div class='flex items-center mb-4'>
              <span class='inline-block w-3 h-3 bg-green-500 rounded-full mr-2'></span>
              <span class='text-green-700 font-medium'>Two-factor authentication is enabled</span>
            </div>

            {hasBackupCodes && (
              <p class='mb-4 text-sm text-gray-600'>
                You have {backupCodesCount} backup codes remaining.
              </p>
            )}

            <section class='flex justify-end mt-8 mb-4 px-4 max-w-screen-md mx-auto lg:min-w-96'>
              <button
                type='button'
                onClick={() => showDisableForm.value = true}
                class='button-secondary'
              >
                Disable 2FA
              </button>
            </section>
          </div>
        )}

        {showDisableForm.value && (
          <div class='mb-6'>
            <h3 class='text-lg font-semibold mb-4'>Disable Two-Factor Authentication</h3>
            <p class='mb-4'>
              Disabling 2FA will make your account less secure. Please enter your password to confirm.
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

            <section class='flex justify-end gap-2 mt-8 mb-4 px-4 max-w-screen-md mx-auto lg:min-w-96'>
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
                onClick={disableTOTP}
                disabled={isLoading.value || !disablePassword.value}
                class='button-danger'
              >
                {isLoading.value ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
