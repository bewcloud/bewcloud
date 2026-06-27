import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import { html } from '/public/ts/utils/misc.ts';
import page, { RequestHandlerParams } from '/lib/page.ts';
import { User } from '/lib/types.ts';

const titlePrefix = '404 - Page not found';

function get({ request, match, user, session, isRunningLocally }: RequestHandlerParams) {
  const htmlContent = defaultHtmlContent(user);

  return basicLayoutResponse(htmlContent, {
    currentPath: match?.pathname.input || '/',
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

function defaultHtmlContent(user?: User | null) {
  const htmlContent = html`
    <main>
      <section class="max-w-3xl mx-auto flex flex-col items-center justify-center">
        ${!user
          ? (
            html`
              <h1>404 - Page not found</h1>
            `
          )
          : ''}
        <p class="my-4">
          The page you were looking for doesn't exist.
        </p>
        <a href="/">Go back home</a>
      </section>
    </main>
  `;

  return htmlContent;
}

export default page({
  get,
  accessMode: 'public',
});
