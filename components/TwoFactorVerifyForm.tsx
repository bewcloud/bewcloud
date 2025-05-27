import PasskeyAuth from '/islands/PasskeyAuth.tsx';

interface TwoFactorVerifyFormProps {
  userId: string;
  redirectUrl: string;
  availableMethods: string[];
  error?: { title: string; message: string };
}

export default function TwoFactorVerifyForm(
  { userId, redirectUrl, availableMethods, error }: TwoFactorVerifyFormProps,
) {
  const hasPasskey = availableMethods.includes('passkey');
  const hasTotp = availableMethods.includes('totp');

  return (
    <div class='max-w-md w-full space-y-8'>
      <div>
        <h2 class='mt-6 text-center text-3xl font-extrabold text-white'>
          Two-Factor Authentication
        </h2>
        <p class='mt-2 text-center text-sm text-gray-300'>
          Choose your preferred authentication method
        </p>
      </div>

      {error && (
        <div class='bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative mb-4'>
          <strong class='font-bold'>{error.title}:</strong>
          <span class='block sm:inline'>{error.message}</span>
        </div>
      )}

      {hasPasskey && (
        <div class='space-y-4'>
          <PasskeyAuth userId={userId} redirectUrl={redirectUrl} />

          {hasTotp && (
            <div class='text-center'>
              <p class='text-gray-400 text-sm'>or</p>
            </div>
          )}
        </div>
      )}

      {hasTotp && (
        <form
          class='space-y-6'
          method='POST'
          action={`/two-factor-verify?user=${userId}&redirect=${encodeURIComponent(redirectUrl)}`}
        >
          <div>
            <label for='token' class='block text-sm font-medium mb-2 text-white'>
              Authentication Token or Backup Code
            </label>
            <input
              type='text'
              id='token'
              name='token'
              placeholder='123456 or backup code'
              class='w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400'
              autocomplete='one-time-code'
              required
            />
          </div>

          <button
            type='submit'
            class='w-full button flex items-center justify-center'
          >
            Verify Code
          </button>
        </form>
      )}

      <div class='text-center'>
        <a href='/login' class='text-blue-400 hover:text-blue-300 text-sm'>
          Back to Login
        </a>
      </div>
    </div>
  );
}
