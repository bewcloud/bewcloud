import { convertObjectToFormData, helpEmail } from '/lib/utils/misc.ts';
import { FormField, generateFieldHtml, getFormDataField } from '/lib/form-utils.tsx';

interface SettingsProps {
  formData: Record<string, any>;
  error?: {
    title: string;
    message: string;
  };
  notice?: {
    title: string;
    message: string;
  };
}

export type Action =
  | 'change-email'
  | 'verify-change-email'
  | 'change-password'
  | 'change-dav-password'
  | 'delete-account';

export const actionWords = new Map<Action, string>([
  ['change-email', 'change email'],
  ['verify-change-email', 'change email'],
  ['change-password', 'change password'],
  ['change-dav-password', 'change DAV password'],
  ['delete-account', 'delete account'],
]);

function formFields(action: Action, formData: FormData) {
  const fields: FormField[] = [
    {
      name: 'action',
      label: '',
      type: 'hidden',
      value: action,
      overrideValue: action,
      required: true,
      readOnly: true,
    },
  ];

  if (action === 'change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true,
    });
  } else if (action === 'verify-change-email') {
    fields.push({
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jane.doe@example.com',
      value: getFormDataField(formData, 'email'),
      required: true,
    }, {
      name: 'verification-code',
      label: 'Verification Code',
      description: `The verification code to validate your new email.`,
      type: 'text',
      placeholder: '000000',
      required: true,
    });
  } else if (action === 'change-password') {
    fields.push({
      name: 'current-password',
      label: 'Current Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
    }, {
      name: 'new-password',
      label: 'New Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
    });
  } else if (action === 'change-dav-password') {
    fields.push({
      name: 'new-dav-password',
      label: 'New DAV Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      required: true,
      description: 'Alternative password used for DAV access and/or HTTP Basic Auth.',
    });
  } else if (action === 'delete-account') {
    fields.push({
      name: 'current-password',
      label: 'Password',
      type: 'password',
      placeholder: 'super-SECRET-passphrase',
      description: 'You need to input your password in order to delete your account.',
      required: true,
    });
  }
  return fields;
}

export default function Settings({ formData: formDataObject, error, notice }: SettingsProps) {
  const formData = convertObjectToFormData(formDataObject);

  const action = getFormDataField(formData, 'action') as Action;

  return (
    <>
      <section class='mx-auto max-w-7xl my-8'>
        {error
          ? (
            <section class='notification-error'>
              <h3>{error.title}</h3>
              <p>{error.message}</p>
            </section>
          )
          : null}
        {notice
          ? (
            <section class='notification-success'>
              <h3>{notice.title}</h3>
              <p>{notice.message}</p>
            </section>
          )
          : null}

        <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>Change your email</h2>

        <form method='POST' class='mb-12'>
          {formFields(
            action === 'change-email' && notice?.message.includes('verify') ? 'verify-change-email' : 'change-email',
            formData,
          ).map((field) => generateFieldHtml(field, formData))}
          <section class='flex justify-end mt-8 mb-4'>
            <button class='button-secondary' type='submit'>Change email</button>
          </section>
        </form>

        <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>Change your password</h2>

        <form method='POST' class='mb-12'>
          {formFields('change-password', formData).map((field) => generateFieldHtml(field, formData))}
          <section class='flex justify-end mt-8 mb-4'>
            <button class='button-secondary' type='submit'>Change password</button>
          </section>
        </form>

        <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>Change your DAV password</h2>

        <form method='POST' class='mb-12'>
          {formFields('change-dav-password', formData).map((field) => generateFieldHtml(field, formData))}
          <section class='flex justify-end mt-8 mb-4'>
            <button class='button-secondary' type='submit'>Change DAV password</button>
          </section>
        </form>

        <h2 class='text-2xl mb-4 text-left px-4 max-w-screen-md mx-auto lg:min-w-96'>Delete your account</h2>
        <p class='text-left mt-2 mb-6 px-4 max-w-screen-md mx-auto lg:min-w-96'>
          Deleting your account is instant and deletes all your data. If you need help, please{' '}
          <a href={`mailto:${helpEmail}`}>reach out</a>.
        </p>

        <form method='POST' class='mb-12'>
          {formFields('delete-account', formData).map((field) => generateFieldHtml(field, formData))}
          <section class='flex justify-end mt-8 mb-4'>
            <button class='button-danger' type='submit'>Delete account</button>
          </section>
        </form>
      </section>
    </>
  );
}
