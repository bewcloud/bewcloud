import PasswordlessPasskeyLogin from "/public/components/auth/PasswordlessPasskeyLogin.js";
export default function MultiFactorAuthVerifyForm({
  email,
  redirectUrl,
  availableMethods,
  isEmailCodeSent,
  error
}) {
  const hasPasskey = availableMethods.includes('passkey') && Boolean(email);
  const hasTotp = availableMethods.includes('totp');
  const hasEmail = availableMethods.includes('email');
  const action = `/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`;
  return h("section", {
    class: "max-w-md w-full mb-12 mx-auto px-4"
  }, h("section", {
    class: "mb-6"
  }, h("h1", {
    class: "mt-6 text-center text-3xl font-extrabold text-white"
  }, "Multi-Factor Authentication"), h("p", {
    class: "mt-2 text-center text-sm text-gray-300"
  }, "Verify your identity to finish logging in.")), error ? h("section", {
    class: "notification-error",
    role: "alert"
  }, h("h3", null, error.title), h("p", null, error.message)) : null, h("section", {
    class: "grid gap-4"
  }, hasTotp && h("form", {
    class: "w-full min-w-0 p-0 text-center",
    method: "POST",
    action: action
  }, h("fieldset", {
    class: "mb-4 text-left"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "token"
  }, "Authenticator or backup code"), h("input", {
    type: "text",
    id: "token",
    name: "token",
    placeholder: "123456 or backup code",
    class: "mt-1 input-field",
    autocomplete: "one-time-code",
    required: true
  })), h("button", {
    type: "submit",
    class: "button"
  }, "Verify code")), hasTotp && hasEmail && h("p", {
    class: "text-center text-gray-400 text-sm"
  }, "or"), hasEmail && h("form", {
    class: "w-full min-w-0 p-0 text-center",
    method: "POST",
    action: action
  }, isEmailCodeSent ? h(Fragment, null, h("fieldset", {
    class: "mb-4 text-left"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "code"
  }, "Email verification code"), h("input", {
    type: "text",
    id: "code",
    name: "code",
    placeholder: "123456",
    class: "mt-1 input-field",
    inputmode: "numeric",
    autocomplete: "one-time-code",
    required: true
  })), h("button", {
    type: "submit",
    class: "button"
  }, "Verify email code")) : h("button", {
    type: "submit",
    class: "button-secondary",
    name: "send_email_code",
    value: "true"
  }, "Send 2FA code by email")), (hasEmail || hasTotp) && hasPasskey && h("p", {
    class: "text-center text-gray-400 text-sm"
  }, "or"), hasPasskey && h(PasswordlessPasskeyLogin, {
    email: email,
    redirectUrl: redirectUrl
  })), h("section", {
    class: "text-center mt-6"
  }, h("a", {
    href: "/login",
    class: "text-blue-400 hover:text-blue-300 text-sm"
  }, "Back to Login")));
}