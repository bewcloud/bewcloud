import { useSignal } from '@preact/signals';
import { startRegistration } from '@simplewebauthn/browser';
const methodTypeLabels = {
  totp: 'Authenticator App',
  passkey: 'Passkey',
  email: 'Email'
};
const methodTypeDescriptions = {
  totp: 'Use an authenticator app like Aegis Authenticator or Google Authenticator to generate codes.',
  passkey: 'Use biometric authentication or security keys.',
  email: 'Receive codes in your email.'
};
const availableMethodTypes = ['totp', 'passkey', 'email'];
export default function MultiFactorAuthSettings({
  methods
}) {
  const setupData = useSignal(null);
  const isLoading = useSignal(false);
  const error = useSignal(null);
  const success = useSignal(null);
  const showDisableForm = useSignal(null);
  const verificationToken = useSignal('');
  const disablePassword = useSignal('');
  const enabledMethods = methods.filter(method => method.enabled);
  const hasMultiFactorAuthEnabled = enabledMethods.length > 0;
  const setupPasskey = async () => {
    const beginResponse = await fetch('/api/auth/multi-factor/passkey/setup-begin', {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!beginResponse.ok) {
      throw new Error(`Failed to begin passkey registration! ${beginResponse.statusText} ${await beginResponse.text()}`);
    }
    const beginData = await beginResponse.json();
    if (!beginData.success) {
      throw new Error(beginData.error || 'Failed to begin passkey registration.');
    }
    const registrationResponse = await startRegistration({
      optionsJSON: beginData.options
    });
    const completeRequestBody = {
      methodId: beginData.sessionData.methodId,
      challenge: beginData.sessionData.challenge,
      registrationResponse
    };
    const completeResponse = await fetch('/api/auth/multi-factor/passkey/setup-complete', {
      method: 'POST',
      body: JSON.stringify(completeRequestBody)
    });
    if (!completeResponse.ok) {
      throw new Error(`Failed to complete passkey registration! ${completeResponse.statusText} ${await completeResponse.text()}`);
    }
    const completeData = await completeResponse.json();
    if (!completeData.success) {
      throw new Error(completeData.error || 'Failed to complete passkey registration.');
    }
    setupData.value = {
      methodId: beginData.sessionData.methodId,
      type: 'passkey'
    };
  };
  const setupTOTP = async () => {
    const response = await fetch('/api/auth/multi-factor/totp/setup', {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw new Error(`Failed to setup TOTP multi-factor authentication. ${response.statusText} ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to setup TOTP multi-factor authentication.');
    }
    setupData.value = {
      type: 'totp',
      secret: data.data.secret,
      qrCodeUrl: data.data.qrCodeUrl,
      backupCodes: data.data.backupCodes,
      methodId: data.data.methodId
    };
  };
  const setupEmail = async () => {
    const response = await fetch('/api/auth/multi-factor/email/setup', {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw new Error(`Failed to setup email multi-factor authentication. Please check your SMTP settings are valid and try again. ${response.statusText} ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to setup email multi-factor authentication.');
    }
    setupData.value = {
      type: 'email',
      methodId: data.data.methodId
    };
  };
  const setupMultiFactorAuth = async type => {
    isLoading.value = true;
    error.value = null;
    try {
      if (type === 'totp') {
        await setupTOTP();
      } else if (type === 'passkey') {
        await setupPasskey();
      } else if (type === 'email') {
        await setupEmail();
      }
    } catch (setupError) {
      error.value = setupError.message;
    } finally {
      isLoading.value = false;
    }
  };
  const enableMultiFactorAuth = async () => {
    if (!setupData.value) {
      error.value = 'No setup data available';
      return;
    }
    if (setupData.value.type !== 'passkey' && !verificationToken.value) {
      error.value = 'Please enter a verification code/token';
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const requestBody = {
        methodId: setupData.value.methodId,
        code: setupData.value.type === 'passkey' ? 'passkey-verified' : verificationToken.value
      };
      const response = await fetch('/api/auth/multi-factor/enable', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to enable multi-factor authentication method. ${response.statusText} ${await response.text()}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to enable multi-factor authentication method.');
      }
      success.value = 'Multi-factor authentication method has been enabled successfully! Reloading...';
      setupData.value = null;
      verificationToken.value = '';
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (enableError) {
      error.value = enableError.message;
    } finally {
      isLoading.value = false;
    }
  };
  const disableMultiFactorAuth = async (methodId, disableAll = false) => {
    if (!disablePassword.value) {
      error.value = 'Please enter your password';
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const requestBody = {
        methodId,
        password: disablePassword.value,
        disableAll
      };
      const response = await fetch('/api/auth/multi-factor/disable', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        throw new Error(`Failed to disable multi-factor authentication method. ${response.statusText} ${await response.text()}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to disable multi-factor authentication method.');
      }
      success.value = 'Multi-factor authentication method has been disabled successfully! Reloading...';
      showDisableForm.value = null;
      disablePassword.value = '';
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (disableError) {
      error.value = disableError.message;
    } finally {
      isLoading.value = false;
    }
  };
  const cancelSetup = () => {
    setupData.value = null;
    verificationToken.value = '';
    error.value = null;
  };
  const cancelDisable = () => {
    showDisableForm.value = null;
    disablePassword.value = '';
    error.value = null;
  };
  return h("section", {
    class: "mb-16"
  }, h("h2", {
    class: "text-2xl mb-4 text-left px-4 max-w-3xl mx-auto lg:min-w-96"
  }, "Multi-Factor Authentication (MFA)"), h("section", {
    class: "px-4 max-w-3xl mx-auto lg:min-w-96"
  }, error.value ? h("section", {
    class: "notification-error mb-4"
  }, h("p", null, error.value)) : null, success.value ? h("section", {
    class: "notification-success mb-4"
  }, h("p", null, success.value)) : null, h("p", {
    class: "mb-6"
  }, "Multi-factor authentication adds an extra layer of security to your account by requiring additional verification beyond your password."), availableMethodTypes.filter(type => !enabledMethods.some(method => method.type === type)).length > 0 ? h("section", {
    class: "mb-6 mt-4"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, "Available Authentication Methods"), h("section", {
    class: "space-y-4"
  }, availableMethodTypes.filter(type => !enabledMethods.some(method => method.type === type) && setupData.value?.type !== type).map(type => h("section", {
    key: type,
    class: "border rounded-lg p-4"
  }, h("section", {
    class: "flex items-center justify-between"
  }, h("section", null, h("h4", {
    class: "font-medium"
  }, methodTypeLabels[type]), h("p", {
    class: "text-sm text-gray-400"
  }, methodTypeDescriptions[type])), h("button", {
    type: "button",
    onClick: () => setupMultiFactorAuth(type),
    disabled: isLoading.value,
    class: "button-secondary"
  }, isLoading.value ? '...' : 'Add')))))) : null, setupData.value && setupData.value.type === 'totp' ? h("section", {
    class: "mb-6"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, "Setup Authenticator App"), h("section", {
    class: "mb-6"
  }, h("p", {
    class: "mb-4"
  }, "1. Scan this QR code with your authenticator app (Aegis Authenticator, Google Authenticator, etc.):"), h("section", {
    class: "flex justify-center mb-4 max-w-sm mx-auto"
  }, h("img", {
    src: setupData.value.qrCodeUrl,
    alt: "TOTP QR Code",
    class: "border-8 border-white"
  })), h("p", {
    class: "text-sm text-gray-400 mb-4"
  }, "Or manually enter this secret:", ' ', h("code", {
    class: "bg-gray-200 px-2 py-1 rounded text-gray-900"
  }, setupData.value.secret))), h("section", {
    class: "mb-6"
  }, h("p", {
    class: "mb-4"
  }, "2. Save these backup codes ", h("strong", {
    class: "font-bold text-sky-500"
  }, "NOW"), " in a safe place:"), h("section", {
    class: "bg-gray-200 border rounded p-4 font-mono text-sm text-gray-900"
  }, setupData.value.backupCodes.map((code, index) => h("section", {
    key: index,
    class: "mb-1"
  }, code))), h("p", {
    class: "text-sm text-gray-400 mt-2"
  }, "These codes can be used to access your account if you lose your authenticator device.", ' ', h("strong", {
    class: "font-bold text-sky-500"
  }, "They won't be visible again"), ".")), h("fieldset", {
    class: "block mb-6"
  }, h("label", {
    class: "text-slate-300 block pb-1"
  }, "3. Enter the 6-digit code from your authenticator app:"), h("input", {
    type: "text",
    value: verificationToken.value,
    onInput: event => verificationToken.value = event.target.value,
    placeholder: "123456",
    class: "mt-1 input-field",
    maxLength: 6
  })), h("section", {
    class: "flex justify-end gap-2 mt-8 mb-4"
  }, h("button", {
    type: "button",
    onClick: cancelSetup,
    disabled: isLoading.value,
    class: "button-secondary"
  }, "Cancel"), h("button", {
    type: "button",
    onClick: enableMultiFactorAuth,
    disabled: isLoading.value || !verificationToken.value,
    class: "button"
  }, isLoading.value ? 'Enabling...' : 'Enable TOTP MFA'))) : null, setupData.value && setupData.value.type === 'passkey' ? h("section", {
    class: "mb-6"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, "Passkey Setup Complete"), h("p", {
    class: "mb-4"
  }, "Your passkey has been successfully registered! You can now enable it for multi-factor authentication."), h("section", {
    class: "flex justify-end gap-2 mt-8 mb-4"
  }, h("button", {
    type: "button",
    onClick: cancelSetup,
    disabled: isLoading.value,
    class: "button-secondary"
  }, "Cancel"), h("button", {
    type: "button",
    onClick: enableMultiFactorAuth,
    disabled: isLoading.value,
    class: "button"
  }, isLoading.value ? 'Enabling...' : 'Enable Passkey MFA'))) : null, setupData.value && setupData.value.type === 'email' ? h("section", {
    class: "mb-6"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, "Setup Email"), h("fieldset", {
    class: "block mb-6"
  }, h("label", {
    class: "text-slate-300 block pb-1"
  }, "Enter the 6-digit code you received in your email:"), h("input", {
    type: "text",
    value: verificationToken.value,
    onInput: event => verificationToken.value = event.target.value,
    placeholder: "123456",
    class: "mt-1 input-field",
    maxLength: 6
  })), h("section", {
    class: "flex justify-end gap-2 mt-8 mb-4"
  }, h("button", {
    type: "button",
    onClick: cancelSetup,
    disabled: isLoading.value,
    class: "button-secondary"
  }, "Cancel"), h("button", {
    type: "button",
    onClick: enableMultiFactorAuth,
    disabled: isLoading.value || !verificationToken.value,
    class: "button"
  }, isLoading.value ? 'Enabling...' : 'Enable Email MFA'))) : null, hasMultiFactorAuthEnabled && !showDisableForm.value ? h("section", null, h("section", {
    class: "mb-6"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, "Active Authentication Methods"), enabledMethods.map(method => h("section", {
    key: method.id,
    class: "border rounded-lg p-4 mb-4"
  }, h("section", {
    class: "flex items-center justify-between"
  }, h("section", null, h("section", {
    class: `flex items-center ${method.type === 'totp' && typeof method.backupCodesCount !== 'undefined' ? 'mb-2' : ''}`
  }, h("span", {
    class: "inline-block w-3 h-3 bg-green-500 rounded-full mr-2"
  }), h("span", {
    class: "font-medium"
  }, method.name)), method.type === 'totp' && typeof method.backupCodesCount !== 'undefined' ? h("p", {
    class: "text-sm text-gray-600"
  }, method.backupCodesCount > 0 ? `${method.backupCodesCount} backup codes remaining` : 'No backup codes remaining') : null), h("button", {
    type: "button",
    onClick: () => showDisableForm.value = method.id,
    class: "button-secondary"
  }, "Disable"))))), h("section", {
    class: "flex justify-end mt-8 mb-4"
  }, h("button", {
    type: "button",
    onClick: () => showDisableForm.value = 'all',
    class: "button-danger"
  }, "Disable All MFA"))) : null, showDisableForm.value ? h("section", {
    class: "mb-6"
  }, h("h3", {
    class: "text-lg font-semibold mb-4"
  }, showDisableForm.value === 'all' ? 'Disable All Multi-Factor Authentication' : 'Disable Authentication Method'), h("p", {
    class: "mb-4"
  }, showDisableForm.value === 'all' ? 'This will disable all multi-factor authentication methods and make your account less secure.' : 'This will disable this authentication method.', " Please enter your password to confirm."), h("fieldset", {
    class: "block mb-4"
  }, h("label", {
    class: "text-slate-300 block pb-1"
  }, "Password"), h("input", {
    type: "password",
    value: disablePassword.value,
    onInput: event => disablePassword.value = event.target.value,
    placeholder: "Enter your password",
    class: "mt-1 input-field"
  })), h("section", {
    class: "flex justify-end gap-2 mt-8 mb-4"
  }, h("button", {
    type: "button",
    onClick: cancelDisable,
    disabled: isLoading.value,
    class: "button-secondary"
  }, "Cancel"), h("button", {
    type: "button",
    onClick: () => disableMultiFactorAuth(showDisableForm.value === 'all' ? undefined : showDisableForm.value || undefined, showDisableForm.value === 'all'),
    disabled: isLoading.value || !disablePassword.value,
    class: "button-danger"
  }, isLoading.value ? 'Disabling...' : 'Disable'))) : null));
}