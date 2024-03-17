import { Head } from 'fresh/runtime.ts';
import { PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';

interface Data {}

export default function Error404({ state }: PageProps<Data, FreshContextState>) {
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
