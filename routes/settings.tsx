import { Handlers, PageProps } from 'fresh/server.ts';

import { currencyMap, FreshContextState, SupportedCurrencySymbol } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { convertFormDataToObject, generateHash, validateEmail } from '/lib/utils/misc.ts';
import { getFormDataField } from '/lib/form-utils.tsx';
import { sendVerifyEmailEmail } from '/lib/providers/brevo.ts';
import { AppConfig } from '/lib/config.ts';
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
  currency?: SupportedCurrencySymbol;
  isExpensesAppEnabled: boolean;
  helpEmail: string;
  isTwoFactorEnabled: boolean;
  user: any;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const isExpensesAppEnabled = await AppConfig.isAppEnabled('expenses');
    const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;
    const isTwoFactorEnabled = await AppConfig.isTwoFactorEnabled();

    return await context.render({
      formData: {},
      currency: context.state.user.extra.expenses_currency,
      isExpensesAppEnabled,
      helpEmail,
      isTwoFactorEnabled,
      user: context.state.user,
    });
  },
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const isExpensesAppEnabled = await AppConfig.isAppEnabled('expenses');
    const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;
    const isTwoFactorEnabled = await AppConfig.isTwoFactorEnabled();

    let action: Action = 'change-email';
    let errorTitle = '';
    let errorMessage = '';
    let successTitle = '';
    let successMessage = '';

    const formData = await request.clone().formData();

    const { user } = context.state;

    try {
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

        const matchingUser = await UserModel.getByEmail(email);

        if (matchingUser) {
          throw new Error('Email is already in use.');
        }

        if (action === 'change-email' && (await AppConfig.isEmailVerificationEnabled())) {
          const verificationCode = await VerificationCodeModel.create(user, email, 'email');

          await sendVerifyEmailEmail(email, verificationCode);

          successTitle = 'Verify your email!';
          successMessage = 'You have received a code in your new email. Use it to verify it here.';
        } else {
          if (await AppConfig.isEmailVerificationEnabled()) {
            const code = getFormDataField(formData, 'verification-code');

            await VerificationCodeModel.validate(user, email, code, 'email');
          }

          user.email = email;

          await UserModel.update(user);

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

        await UserModel.update(user);

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

        await UserModel.update(user);

        successTitle = 'DAV Password changed!';
        successMessage = 'DAV Password changed successfully.';
      } else if (action === 'delete-account') {
        const currentPassword = getFormDataField(formData, 'current-password');

        const hashedCurrentPassword = await generateHash(`${currentPassword}:${PASSWORD_SALT}`, 'SHA-256');

        if (user.hashed_password !== hashedCurrentPassword) {
          throw new Error('Invalid current password.');
        }

        await UserModel.delete(user.id);

        return new Response('Account deleted successfully', {
          status: 303,
          headers: { 'location': `/signup?success=delete` },
        });
      } else if (action === 'change-currency') {
        const newCurrencySymbol = getFormDataField(formData, 'currency') as SupportedCurrencySymbol;

        if (!currencyMap.has(newCurrencySymbol)) {
          throw new Error(`Invalid currency.`);
        }

        user.extra.expenses_currency = newCurrencySymbol;

        await UserModel.update(user);

        successTitle = 'Currency changed!';
        successMessage = 'Currency changed successfully.';
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
        currency: user.extra.expenses_currency,
        isExpensesAppEnabled,
        helpEmail,
        isTwoFactorEnabled,
        user: user,
      });
    } catch (error) {
      console.error(error);
      errorMessage = (error as Error).toString();
      errorTitle = `Failed to ${actionWords.get(action) || action}!`;

      return await context.render({
        error: { title: errorTitle, message: errorMessage },
        formData: convertFormDataToObject(formData),
        currency: user.extra.expenses_currency,
        isExpensesAppEnabled,
        helpEmail,
        isTwoFactorEnabled,
        user: user,
      });
    }
  },
};

export default function SettingsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Settings
        formData={data?.formData}
        error={data?.error}
        notice={data?.notice}
        currency={data?.currency}
        isExpensesAppEnabled={data?.isExpensesAppEnabled}
        helpEmail={data?.helpEmail}
        isTwoFactorEnabled={data?.isTwoFactorEnabled}
        user={data?.user}
      />
    </main>
  );
}
