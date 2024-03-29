import { Handlers, PageProps } from 'fresh/server.ts';

import { Dashboard, FreshContextState } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import {
  createVerificationCode,
  deleteUser,
  getUserByEmail,
  updateUser,
  validateVerificationCode,
} from '/lib/data/user.ts';
import { convertFormDataToObject, generateHash, validateEmail } from '/lib/utils/misc.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { sendVerifyEmailEmail } from '/lib/providers/brevo.ts';
import Settings, { Action, actionWords } from '/islands/Settings.tsx';

interface Data {
  error?: {
    title: string;
    message: string;
  };
  notice?: {
    title: string;
    message: string;
  };
  formData: Record<string, any>;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    return await context.render();
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    let action: Action = 'change-email';
    let errorTitle = '';
    let errorMessage = '';
    let successTitle = '';
    let successMessage = '';

    const formData = await request.clone().formData();

    try {
      const { user } = context.state;

      action = getFormDataField(formData, 'action') as Action;

      if (action !== 'change-email' && action !== 'verify-change-email') {
        formData.set('email', user.email);
      }

      if ((action === 'change-email' || action === 'verify-change-email')) {
        const email = getFormDataField(formData, 'email');

        if (!validateEmail(email)) {
          throw new Error(`Invalid email.`);
        }

        if (email === user.email) {
          throw new Error(`New email is the same as the current email.`);
        }

        const matchingUser = await getUserByEmail(email);

        if (matchingUser) {
          throw new Error('Email is already in use.');
        }

        if (action === 'change-email') {
          const verificationCode = await createVerificationCode(user, email, 'email');

          await sendVerifyEmailEmail(email, verificationCode);

          successTitle = 'Verify your email!';
          successMessage = 'You have received a code in your new email. Use it to verify it here.';
        } else {
          const code = getFormDataField(formData, 'verification-code');

          await validateVerificationCode(user, email, code, 'email');

          user.email = email;

          await updateUser(user);

          successTitle = 'Email updated!';
          successMessage = 'Email updated successfully.';
        }
      } else if (action === 'change-password') {
        const currentPassword = getFormDataField(formData, 'current-password');
        const newPassword = getFormDataField(formData, 'new-password');

        if (newPassword.length < 6) {
          throw new Error(`New password is too short`);
        }

        const hashedCurrentPassword = await generateHash(`${currentPassword}:${PASSWORD_SALT}`, 'SHA-256');
        const hashedNewPassword = await generateHash(`${newPassword}:${PASSWORD_SALT}`, 'SHA-256');

        if (user.hashed_password !== hashedCurrentPassword) {
          throw new Error('Invalid current password.');
        }

        if (hashedCurrentPassword === hashedNewPassword) {
          throw new Error(`New password is the same as the current password.`);
        }

        user.hashed_password = hashedNewPassword;

        await updateUser(user);

        successTitle = 'Password changed!';
        successMessage = 'Password changed successfully.';
      } else if (action === 'change-dav-password') {
        const newDavPassword = getFormDataField(formData, 'new-dav-password');

        if (newDavPassword.length < 6) {
          throw new Error(`New DAV password is too short`);
        }

        const hashedNewDavPassword = await generateHash(`${newDavPassword}:${PASSWORD_SALT}`, 'SHA-256');

        if (user.extra.dav_hashed_password === hashedNewDavPassword) {
          throw new Error(`New DAV password is the same as the current password.`);
        }

        user.extra.dav_hashed_password = hashedNewDavPassword;

        await updateUser(user);

        successTitle = 'DAV Password changed!';
        successMessage = 'DAV Password changed successfully.';
      } else if (action === 'delete-account') {
        const currentPassword = getFormDataField(formData, 'current-password');

        const hashedCurrentPassword = await generateHash(`${currentPassword}:${PASSWORD_SALT}`, 'SHA-256');

        if (user.hashed_password !== hashedCurrentPassword) {
          throw new Error('Invalid current password.');
        }

        await deleteUser(user.id);

        return new Response('Account deleted successfully', {
          status: 303,
          headers: { 'location': `/signup?success=delete` },
        });
      }

      const notice = successTitle
        ? {
          title: successTitle,
          message: successMessage,
        }
        : undefined;

      return await context.render({
        notice,
        formData: convertFormDataToObject(formData),
      });
    } catch (error) {
      console.error(error);
      errorMessage = error.toString();
      errorTitle = `Failed to ${actionWords.get(action) || action}!`;

      return await context.render({
        error: { title: errorTitle, message: errorMessage },
        formData: convertFormDataToObject(formData),
      });
    }
  },
};

export default function Dashboard({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Settings formData={data?.formData} error={data?.error} notice={data?.notice} />
    </main>
  );
}
