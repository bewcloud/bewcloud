import PasswordlessPasskeyLogin from "/public/components/auth/PasswordlessPasskeyLogin.js";
export default function MultiFactorAuthVerifyForm({
  email,
  redirectUrl,
  availableMethods,
  error
}) {
  const hasPasskey = availableMethods.includes('passkey');
  const hasTotp = availableMethods.includes('totp');
  const hasEmail = availableMethods.includes('email');
  return h("section", {
    class: "max-w-md w-full mb-12 mx-auto"
  }, h("section", {
    class: "mb-6"
  }, h("h2", {
    class: "mt-6 text-center text-3xl font-extrabold text-white"
  }, "Multi-Factor Authentication"), h("p", {
    class: "mt-2 text-center text-sm text-gray-300"
  }, "You are required to authenticate with an additional method")), error ? h("section", {
    class: "notification-error"
  }, h("h3", null, error.title), h("p", null, error.message)) : null, hasEmail ? h("form", {
    class: "mb-6",
    method: "POST",
    action: `/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`
  }, h("fieldset", {
    class: "block mb-4"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "token"
  }, "Email Verification Code"), h("input", {
    type: "text",
    id: "code",
    name: "code",
    placeholder: "123456",
    class: "mt-1 input-field",
    autocomplete: "off",
    required: true
  })), h("section", {
    class: "flex justify-center mt-8 mb-4"
  }, h("button", {
    type: "submit",
    class: "button"
  }, "Verify Code"))) : null, hasEmail && hasTotp ? h("section", {
    class: "text-center -mt-10 mb-6 block"
  }, h("p", {
    class: "text-gray-400 text-sm"
  }, "or")) : null, hasTotp ? h("form", {
    class: "mb-6",
    method: "POST",
    action: `/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`
  }, h("fieldset", {
    class: "block mb-4"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "token"
  }, "Authentication Token or Backup Code"), h("input", {
    type: "text",
    id: "token",
    name: "token",
    placeholder: "123456 or backup code",
    class: "mt-1 input-field",
    autocomplete: "one-time-code",
    required: true
  })), h("section", {
    class: "flex justify-center mt-8 mb-4"
  }, h("button", {
    type: "submit",
    class: "button"
  }, "Verify Code"))) : null, (hasEmail || hasTotp) && hasPasskey ? h("section", {
    class: "text-center -mt-10 mb-6 block"
  }, h("p", {
    class: "text-gray-400 text-sm"
  }, "or")) : null, hasPasskey && email ? h("section", {
    class: "mb-8"
  }, h(PasswordlessPasskeyLogin, {
    email: email,
    redirectUrl: redirectUrl
  })) : null, h("section", {
    class: "text-center mt-6"
  }, h("a", {
    href: "/login",
    class: "text-blue-400 hover:text-blue-300 text-sm"
  }, "Back to Login")));
}