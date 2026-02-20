import page, { RequestHandlerParams } from '/lib/page.ts';
import { SupportedCurrencySymbol, User } from '/lib/types.ts';
import { PASSWORD_SALT } from '/lib/auth.ts';
import { UserModel, VerificationCodeModel } from '/lib/models/user.ts';
import { convertFormDataToObject, currencyMap, generateHash, html, validateEmail } from '/public/ts/utils/misc.ts';
import { getFormDataField } from '/public/ts/utils/form.ts';
import { EmailModel } from '/lib/models/email.ts';
import { AppConfig } from '/lib/config.ts';
import { getTimeZones } from '/public/ts/utils/calendar.ts';
import { basicLayoutResponse } from '/lib/utils/layout.tsx';
import Settings, { Action, actionWords } from '/components/Settings.ts';

const titlePrefix = 'Settings';

async function get({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const isExpensesAppEnabled = await AppConfig.isAppEnabled('expenses');
  const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();
  const isCalendarAppEnabled = await AppConfig.isAppEnabled('calendar');

  const htmlContent = defaultHtmlContent({
    formData: {},
    currency: user!.extra.expenses_currency,
    timezoneId: user!.extra.timezone?.id || 'UTC',
    isExpensesAppEnabled,
    helpEmail,
    isMultiFactorAuthEnabled,
    isCalendarAppEnabled,
    user: user!,
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

async function post({ request, user, match, session, isRunningLocally }: RequestHandlerParams): Promise<Response> {
  const isExpensesAppEnabled = await AppConfig.isAppEnabled('expenses');
  const helpEmail = (await AppConfig.getConfig()).visuals.helpEmail;
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();
  const isCalendarAppEnabled = await AppConfig.isAppEnabled('calendar');

  let action: Action = 'change-email';
  let errorTitle = '';
  let errorMessage = '';
  let successTitle = '';
  let successMessage = '';

  const formData = await request.clone().formData();

  try {
    action = getFormDataField(formData, 'action') as Action;

    if (action !== 'change-email' && action !== 'verify-change-email') {
      formData.set('email', user!.email);
    }

    if ((action === 'change-email' || action === 'verify-change-email')) {
      const email = getFormDataField(formData, 'email');

      if (!validateEmail(email)) {
        throw new Error(`Invalid email.`);
      }

      if (email === user!.email) {
        throw new Error(`New email is the same as the current email.`);
      }

      const matchingUser = await UserModel.getByEmail(email);

      if (matchingUser) {
        throw new Error('Email is already in use.');
      }

      if (action === 'change-email' && (await AppConfig.isEmailVerificationEnabled())) {
        const verificationCode = await VerificationCodeModel.create(user!, email, 'email');

        await EmailModel.sendVerificationEmail(email, verificationCode);

        successTitle = 'Verify your email!';
        successMessage = 'You have received a code in your new email. Use it to verify it here.';
      } else {
        if (await AppConfig.isEmailVerificationEnabled()) {
          const code = getFormDataField(formData, 'verification-code');

          await VerificationCodeModel.validate(user!, email, code, 'email');
        }

        user!.email = email;

        await UserModel.update(user!);

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

      if (user!.hashed_password !== hashedCurrentPassword) {
        throw new Error('Invalid current password.');
      }

      if (hashedCurrentPassword === hashedNewPassword) {
        throw new Error(`New password is the same as the current password.`);
      }

      user!.hashed_password = hashedNewPassword;

      await UserModel.update(user!);

      successTitle = 'Password changed!';
      successMessage = 'Password changed successfully.';
    } else if (action === 'change-dav-password') {
      const newDavPassword = getFormDataField(formData, 'new-dav-password');

      if (newDavPassword.length < 6) {
        throw new Error(`New DAV password is too short`);
      }

      const hashedNewDavPassword = await generateHash(`${newDavPassword}:${PASSWORD_SALT}`, 'SHA-256');

      if (user!.extra.dav_hashed_password === hashedNewDavPassword) {
        throw new Error(`New DAV password is the same as the current password.`);
      }

      user!.extra.dav_hashed_password = hashedNewDavPassword;

      await UserModel.update(user!);

      successTitle = 'DAV Password changed!';
      successMessage = 'DAV Password changed successfully.';
    } else if (action === 'delete-account') {
      const currentPassword = getFormDataField(formData, 'current-password');

      const hashedCurrentPassword = await generateHash(`${currentPassword}:${PASSWORD_SALT}`, 'SHA-256');

      if (user!.hashed_password !== hashedCurrentPassword) {
        throw new Error('Invalid current password.');
      }

      await UserModel.delete(user!.id);

      return new Response('Account deleted successfully', {
        status: 303,
        headers: { 'location': `/signup?success=delete` },
      });
    } else if (action === 'change-currency') {
      const newCurrencySymbol = getFormDataField(formData, 'currency') as SupportedCurrencySymbol;

      if (!currencyMap.has(newCurrencySymbol)) {
        throw new Error(`Invalid currency.`);
      }

      user!.extra.expenses_currency = newCurrencySymbol;

      await UserModel.update(user!);

      successTitle = 'Currency changed!';
      successMessage = 'Currency changed successfully.';
    } else if (action === 'change-timezone') {
      const timezones = getTimeZones();
      const newTimezoneId = getFormDataField(formData, 'timezone');
      const matchingTimezone = timezones.find((timezone) => timezone.id === newTimezoneId);

      if (!matchingTimezone) {
        throw new Error(`Invalid timezone.`);
      }

      user!.extra.timezone = {
        id: newTimezoneId,
        utcOffset: matchingTimezone.utcOffset,
      };

      await UserModel.update(user!);

      successTitle = 'Timezone changed!';
      successMessage = 'Timezone changed successfully.';
    }

    const notice = successTitle
      ? {
        title: successTitle,
        message: successMessage,
      }
      : undefined;

    const htmlContent = defaultHtmlContent({
      notice,
      formData: convertFormDataToObject(formData),
      currency: user!.extra.expenses_currency,
      timezoneId: user!.extra.timezone?.id || 'UTC',
      isExpensesAppEnabled,
      helpEmail,
      isMultiFactorAuthEnabled,
      isCalendarAppEnabled,
      user: user!,
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
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).toString();
    errorTitle = `Failed to ${actionWords.get(action) || action}!`;

    const htmlContent = defaultHtmlContent({
      error: { title: errorTitle, message: errorMessage },
      formData: convertFormDataToObject(formData),
      currency: user!.extra.expenses_currency,
      timezoneId: user!.extra.timezone?.id || 'UTC',
      isExpensesAppEnabled,
      helpEmail,
      isMultiFactorAuthEnabled,
      isCalendarAppEnabled,
      user: user!,
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

function defaultHtmlContent({
  formData,
  error,
  notice,
  currency,
  timezoneId,
  isExpensesAppEnabled,
  isMultiFactorAuthEnabled,
  isCalendarAppEnabled,
  helpEmail,
  user,
}: {
  formData: Record<string, any>;
  error?: { title: string; message: string };
  notice?: { title: string; message: string };
  currency?: SupportedCurrencySymbol;
  timezoneId?: string;
  isExpensesAppEnabled: boolean;
  isMultiFactorAuthEnabled: boolean;
  isCalendarAppEnabled: boolean;
  helpEmail: string;
  user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> };
}) {
  const settingsHtml = Settings({
    formData,
    error,
    notice,
    currency,
    timezoneId,
    isExpensesAppEnabled,
    isMultiFactorAuthEnabled,
    isCalendarAppEnabled,
    helpEmail,
    user,
  });

  const htmlContent = html`
    <main id="main">
      ${settingsHtml}
    </main>
  `;

  return htmlContent;
}

export default page({
  get,
  post,
  accessMode: 'user',
});
