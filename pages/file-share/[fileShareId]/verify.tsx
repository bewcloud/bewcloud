import { FreshContextState } from '/lib/types.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { AppConfig } from '/lib/config.ts';
import { FileShareModel } from '/lib/models/files.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import ShareVerifyForm from '/components/files/ShareVerifyForm.tsx';

interface Data {
  error?: {
    title: string;
    message: string;
  };
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    const { fileShareId } = context.params;

    if (!fileShareId) {
      return new Response('Not Found', { status: 404 });
    }

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    if (!isPublicFileSharingAllowed) {
      return new Response('Not Found', { status: 404 });
    }

    const fileShare = await FileShareModel.getById(fileShareId);

    if (!fileShare) {
      return new Response('Not Found', { status: 404 });
    }

    if (!fileShare.extra.hashed_password) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}` } });
    }

    return await context.render({});
  },
  async POST(request, context) {
    const { fileShareId } = context.params;

    if (!fileShareId) {
      return new Response('Not Found', { status: 404 });
    }

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    if (!isPublicFileSharingAllowed) {
      return new Response('Not Found', { status: 404 });
    }

    const fileShare = await FileShareModel.getById(fileShareId);

    if (!fileShare) {
      return new Response('Not Found', { status: 404 });
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

      return await context.render({
        error: {
          title: 'Verification Failed',
          message: (error as Error).message,
        },
      });
    }
  },
};

export default function ShareVerifyPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <section class='max-w-screen-md mx-auto flex flex-col items-center justify-center'>
        <ShareVerifyForm
          error={data.error}
        />
      </section>
    </main>
  );
}
