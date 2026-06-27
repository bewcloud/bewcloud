import { renderToString } from 'preact-render-to-string';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { AppConfig } from '/lib/config.ts';
import { FileShareModel } from '/lib/models/files.ts';
import { generateHash, html } from '/public/ts/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import ShareVerifyForm from '/components/files/ShareVerifyForm.tsx';

const titlePrefix = 'File Share Verification';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const { fileShareId } = match.pathname.groups;

  if (!fileShareId) {
    throw new Error('NotFound');
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    throw new Error('NotFound');
  }

  const fileShare = await FileShareModel.getById(fileShareId);

  if (!fileShare) {
    throw new Error('NotFound');
  }

  if (!fileShare.extra.hashed_password) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}` } });
  }

  const htmlContent = defaultHtmlContent({});

  return basicLayoutResponse(htmlContent, {
    currentPath: match.pathname.input,
    titlePrefix,
    match,
    request,
    user,
    session,
    isRunningLocally,
  });
}

async function post({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const { fileShareId } = match.pathname.groups;

  if (!fileShareId) {
    throw new Error('NotFound');
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    throw new Error('NotFound');
  }

  const fileShare = await FileShareModel.getById(fileShareId);

  if (!fileShare) {
    throw new Error('NotFound');
  }

  if (!fileShare.extra.hashed_password) {
    return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}` } });
  }

  try {
    const formData = await request.formData();
    const password = getFormDataField(formData, 'password');

    if (!password) {
      throw new Error('Password is required');
    }

    const hashedPassword = await generateHash(`${password}:${PASSWORD_SALT}`, 'SHA-256');

    if (hashedPassword !== fileShare.extra.hashed_password) {
      throw new Error('Invalid password');
    }

    const response = new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}` } });

    return await FileShareModel.createSessionCookie(request, response, fileShareId, hashedPassword);
  } catch (error) {
    console.error('File share verification error:', error);

    const htmlContent = defaultHtmlContent({
      error: {
        title: 'Verification Failed',
        message: (error as Error).message,
      },
    });

    return basicLayoutResponse(htmlContent, {
      currentPath: match.pathname.input,
      titlePrefix,
      match,
      request,
      user,
      session,
      isRunningLocally,
    });
  }
}

function defaultHtmlContent({ error }: { error?: { title: string; message: string } }) {
  const shareVerifyFormReactNode = <ShareVerifyForm error={error} />;
  const shareVerifyFormHtml = renderToString(shareVerifyFormReactNode);

  const htmlContent = html`
    <main id="main">
      ${shareVerifyFormHtml}
    </main>
  `;
  return htmlContent;
}

export default page({
  get,
  post,
  accessMode: 'public',
});
