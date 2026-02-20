import page, { RequestHandlerParams } from '/lib/page.ts';

import { AppConfig } from '/lib/config.ts';
import { OidcModel } from '/lib/models/oidc.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { escapeHtml, html } from '/public/ts/utils/misc.ts';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams) {
  const isSingleSignOnEnabled = await AppConfig.isSingleSignOnEnabled();

  if (user || !isSingleSignOnEnabled) {
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

  const htmlContent = defaultHtmlContent({ error });

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix: 'Login with SSO',
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent({ error }: { error: string }) {
  return html`
    <main id="main">
      <section class="max-w-3xl mx-auto flex flex-col items-center justify-center">
        <h1 class="text-4xl mb-6">
          Login with SSO
        </h1>
        ${error
          ? html`
            <section class="notification-error">
              <h3>Failed to login!</h3>
              <p>${escapeHtml(error)}</p>
            </section>
          `
          : ''}

        <h2 class="text-2xl mb-4 text-center">Go back?</h2>
        <p class="text-center mt-2 mb-6">
          Go back to <strong><a href="/login">login</a></strong>.
        </p>
      </section>
    </main>
  `;
}

export default page({
  get,
  accessMode: 'public',
});
