export default function PasswordlessPasskeyLogin({
  email,
  redirectUrl
}) {
  return h(Fragment, null, h("section", {
    class: "space-y-4"
  }, h("section", {
    class: "flex justify-center mt-2 mb-4"
  }, h("button", {
    id: "passwordless-passkey-login-button",
    type: "button",
    class: "button-secondary",
    "data-email": email,
    "data-redirect-url": redirectUrl
  }, "Login with Passkey")), h("section", {
    class: "notification-error hidden",
    id: "passwordless-passkey-login-error"
  })), h("script", {
    src: "/public/js/simplewebauthn.js"
  }), h("script", {
    type: "module",
    src: "/public/ts/passwordless-passkey-login.ts"
  }));
}