import { PageProps, RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { OidcModel } from '/lib/models/oidc.ts';

interface Data {
  error?: string;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    const request = context.req;
    const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();

    if (context.state.user || !isSingleSignOnEnabled) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/` } });
    }

    let error = '';

    try {
      const { response } = await OidcModel.validateAndCreateSession(request);

      return response;
    } catch (validationError) {
      console.error(validationError);
      error = (validationError as Error).message;
    }

    return {
      data: {
        error,
      },
    };
  },
};

export default function OidcCallback({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
        <h1 class='text-4xl mb-6'>
          Login with SSO
        </h1>
        {data?.error
          ? (
            <section class='notification-error'>
              <h3>Failed to login!</h3>
              <p>{data?.error}</p>
            </section>
          )
          : null}

        <h2 class='text-2xl mb-4 text-center'>Go back?</h2>
        <p class='text-center mt-2 mb-6'>
          Go back to{' '}
          <strong>
            <a href='/login'>login</a>
          </strong>.
        </p>
      </section>
    </main>
  );
}
