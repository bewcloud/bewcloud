import { HttpError, PageProps } from 'fresh';
import { Head } from 'fresh/runtime';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export default function ErrorPage({ state, error }: PageProps<Data, FreshContextState>) {
  if (error instanceof HttpError) {
    const status = error.status;

    // Render a 404 not found page
    if (status === 404) {
      return (
        <>
          <Head>
            <title>404 - Page not found</title>
          </Head>
          <main>
            <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
              {!state.user
                ? (
                  <>
                    <img
                      class='my-6'
                      src='/images/logo-white.svg'
                      width='250'
                      height='50'
                      alt='the bewCloud logo: a stylized logo'
                    />
                    <h1>404 - Page not found</h1>
                  </>
                )
                : null}
              <p class='my-4'>
                The page you were looking for doesn't exist.
              </p>
              <a href='/'>Go back home</a>
            </section>
          </main>
        </>
      );
    }
  }

  console.error(error);

  return (
    <>
      <Head>
        <title>500 - Internal server error</title>
      </Head>
      <main>
        <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
          <p class='my-4'>
            An internal server error occurred.
          </p>
          <pre>
            {error?.toString() || JSON.stringify({ error }, null, 2)}
          </pre>
          <a href='/'>Go back home</a>
        </section>
      </main>
    </>
  );
}
