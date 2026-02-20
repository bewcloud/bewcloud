import { generateFieldHtml, getFormDataField } from '/public/ts/utils/form.ts';
import { convertObjectToFormData, currencyMap, escapeHtml, html } from '/public/ts/utils/misc.ts';
import { getEnabledMultiFactorAuthMethodsFromUser } from '/public/ts/utils/multi-factor-auth.ts';
import { getTimeZones } from '/public/ts/utils/calendar.ts';
import Loading from '/components/Loading.ts';
export const actionWords = new Map([['change-email', 'change email'], ['verify-change-email', 'change email'], ['change-password', 'change password'], ['change-dav-password', 'change WebDav password'], ['delete-account', 'delete account'], ['change-currency', 'change currency'], ['change-timezone', 'change timezone']]);
function formFields(action, formData, currency, timezoneId) {
  const fields = [{
    name: 'action',
    label: '',
    type: 'hidden',
    value: action,
    overrideValue: action,
    required: true,
    readOnly: true
  }];
  if (action === 'change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true
    });
  } else if (action === 'verify-change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true
    }, {
      name: 'verification-code',
      label: 'Verification Code',
      description: `The verification code to validate your new email.`,
      type: 'text',
      placeholder: '000000',
      required: true
    });
  } else if (action === 'change-password') {
    fields.push({
      name: 'current-password',
      label: 'Current Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true
    }, {
      name: 'new-password',
      label: 'New Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true
    });
  } else if (action === 'change-dav-password') {
    fields.push({
      name: 'new-dav-password',
      label: 'New WebDav Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
      description: 'Alternative password used for WebDav access and/or HTTP Basic Auth.'
    });
  } else if (action === 'delete-account') {
    fields.push({
      name: 'current-password',
      label: 'Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      description: 'You need to input your password in order to delete your account.',
      required: true
    });
  } else if (action === 'change-currency') {
    fields.push({
      name: 'currency',
      label: 'Currency',
      type: 'select',
      options: Array.from(currencyMap.keys()).map(currencySymbol => ({
        value: currencySymbol,
        label: `${currencySymbol} (${currencyMap.get(currencySymbol)})`
      })),
      value: getFormDataField(formData, 'currency') || currency,
      required: true
    });
  } else if (action === 'change-timezone') {
    const timezones = getTimeZones();
    fields.push({
      name: 'timezone',
      label: 'Timezone',
      type: 'select',
      options: timezones.map(timezone => ({
        value: timezone.id,
        label: timezone.label
      })),
      value: getFormDataField(formData, 'timezone') || timezoneId,
      required: true
    });
  }
  return fields;
}
export default function Settings({
  formData: formDataObject,
  error,
  notice,
  currency,
  timezoneId,
  isExpensesAppEnabled,
  isMultiFactorAuthEnabled,
  isCalendarAppEnabled,
  helpEmail,
  user
}) {
  const formData = convertObjectToFormData(formDataObject);
  const multiFactorAuthMethods = getEnabledMultiFactorAuthMethodsFromUser(user);
  return html`
    <section class="mx-auto max-w-7xl my-8">
      ${error ? html`
          <section class="notification-error">
            <h3>${escapeHtml(error.title)}</h3>
            <p>${escapeHtml(error.message)}</p>
          </section>
        ` : ''} ${notice ? html`
          <section class="notification-success">
            <h3>${escapeHtml(notice.title)}</h3>
            <p>${escapeHtml(notice.message)}</p>
          </section>
        ` : ''}

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your email</h2>

      <form method="POST" class="mb-12">
        ${formFields('change-email', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-secondary" type="submit">Change email</button>
        </section>
      </form>

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your password</h2>

      <form method="POST" class="mb-12">
        ${formFields('change-password', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-secondary" type="submit">Change password</button>
        </section>
      </form>

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your WebDav password</h2>

      <form method="POST" class="mb-12">
        ${formFields('change-dav-password', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-secondary" type="submit">Change WebDav password</button>
        </section>
      </form>

      ${isExpensesAppEnabled ? html`
          <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your currency</h2>
          <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
            This is only used in the expenses app, visually. It changes nothing about the stored data or values.
          </p>

          <form method="POST" class="mb-12">
            ${formFields('change-currency', formData, currency, timezoneId).map(field => generateFieldHtml(field, formData)).join('')}
            <section class="flex justify-end mt-8 mb-4">
              <button class="button-secondary" type="submit">Change currency</button>
            </section>
          </form>
        ` : ''} ${isCalendarAppEnabled ? html`
          <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Change your timezone</h2>
          <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
            This is only used in the calendar app.
          </p>

          <form method="POST" class="mb-12">
            ${formFields('change-timezone', formData, currency, timezoneId).map(field => generateFieldHtml(field, formData)).join('')}
            <section class="flex justify-end mt-8 mb-4">
              <button class="button-secondary" type="submit">Change timezone</button>
            </section>
          </form>
        ` : ''} ${isMultiFactorAuthEnabled ? html`
          <section id="multi-factor-auth-settings">
            ${Loading()}
          </section>
        ` : ''}

      <h2 class="text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96">Delete your account</h2>
      <p class="text-left mt-2 mb-6 px-4 max-w-3xl mx-auto lg:min-w-96">
        Deleting your account is instant and deletes all your data. ${helpEmail !== '' ? html`
            If you need help, please <a href="${`mailto:${helpEmail}`}">reach out</a>.
          ` : ''}
      </p>

      <form method="POST" class="mb-12">
        ${formFields('delete-account', formData).map(field => generateFieldHtml(field, formData)).join('')}
        <section class="flex justify-end mt-8 mb-4">
          <button class="button-danger" type="submit">Delete account</button>
        </section>
      </form>
    </section>

    <script type="module">
    import { h, render } from 'preact';

    // Imported files need some preact globals to work
    window.h = h;

    import MultiFactorAuthSettings from '/public/components/auth/MultiFactorAuthSettings.js';

    const multiFactorAuthSettingsElement = document.getElementById('multi-factor-auth-settings');

    if (multiFactorAuthSettingsElement) {
      const multiFactorAuthSettingsApp = h(MultiFactorAuthSettings, {
        methods: ${JSON.stringify(multiFactorAuthMethods.map(method => ({
    type: method.type,
    id: method.id,
    name: method.name,
    enabled: method.enabled,
    backupCodesCount: method.metadata.totp?.hashed_backup_codes?.length
  })))},
      });

      render(multiFactorAuthSettingsApp, multiFactorAuthSettingsElement);

      document.getElementById('loading')?.remove();
    }
    </script>
  `;
}