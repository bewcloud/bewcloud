import { Head } from 'fresh/runtime.ts';

export default function Error404() {
  return (
    <>
      <Head>
        <title>404 - Page not found</title>
      </Head>
      <main>
        <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
          <p class='my-4'>
            The page you were looking for doesn't exist.
          </p>
          <a href='/'>Go back home</a>
        </section>
      </main>
    </>
  );
}
