export default function ShareVerifyForm({
  error
}) {
  return h("section", {
    class: "max-w-md w-full mb-12 mx-auto"
  }, h("section", {
    class: "mb-6"
  }, h("h2", {
    class: "mt-6 text-center text-3xl font-extrabold text-white"
  }, "File Share Authentication"), h("p", {
    class: "mt-2 text-center text-sm text-gray-300"
  }, "You are required to authenticate with a password")), error ? h("section", {
    class: "notification-error"
  }, h("h3", null, error.title), h("p", null, error.message)) : null, h("form", {
    class: "mb-6",
    method: "POST"
  }, h("fieldset", {
    class: "block mb-4"
  }, h("label", {
    class: "text-slate-300 block pb-1",
    for: "verify-password"
  }, "Password"), h("input", {
    type: "password",
    id: "verify-password",
    name: "password",
    placeholder: "Password",
    class: "mt-1 input-field",
    autocomplete: "off",
    required: true
  })), h("section", {
    class: "flex justify-center mt-8 mb-4"
  }, h("button", {
    type: "submit",
    class: "button"
  }, "Verify Password"))));
}