interface ShareVerifyFormProps {
  error?: { title: string; message: string };
}

export default function ShareVerifyForm(
  { error }: ShareVerifyFormProps,
) {
  return (
    <section class='max-w-md w-full mb-12 mx-auto'>
      <section class='mb-6'>
        <h2 class='mt-6 text-center text-3xl font-extrabold text-white'>
          File Share Authentication
        </h2>
        <p class='mt-2 text-center text-sm text-gray-300'>
          You are required to authenticate with a password
        </p>
      </section>

      {error
        ? (
          <section class='notification-error'>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
          </section>
        )
        : null}

      <form
        class='mb-6'
        method='POST'
      >
        <fieldset class='block mb-4'>
          <label class='text-slate-300 block pb-1' for='verify-password'>
            Password
          </label>
          <input
            type='password'
            id='verify-password'
            name='password'
            placeholder='Password'
            class='mt-1 input-field'
            autocomplete='off'
            required
          />
        </fieldset>

        <section class='flex justify-center mt-8 mb-4'>
          <button
            type='submit'
            class='button'
          >
            Verify Password
          </button>
        </section>
      </form>
    </section>
  );
}
