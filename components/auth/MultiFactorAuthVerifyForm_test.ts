import { assertEquals, assertStringIncludes } from '@std/assert';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';

import { MultiFactorAuthMethodType } from '/lib/types.ts';
import MultiFactorAuthVerifyForm from './MultiFactorAuthVerifyForm.tsx';

function render(availableMethods: MultiFactorAuthMethodType[], isEmailCodeSent: boolean) {
  return renderToString(h(MultiFactorAuthVerifyForm, {
    email: 'user@example.com',
    redirectUrl: '/',
    availableMethods,
    isEmailCodeSent,
  }));
}

Deno.test('MultiFactorAuthVerifyForm asks for the email code when it was already sent', () => {
  const html = render(['email'], true);

  assertStringIncludes(html, 'name="code"');
  assertEquals(html.includes('send_email_code'), false);
});

Deno.test('MultiFactorAuthVerifyForm offers to send the email code when another method is enabled', () => {
  const html = render(['totp', 'email'], false);

  assertStringIncludes(html, 'name="token"');
  assertStringIncludes(html, 'name="send_email_code"');
  assertEquals(html.includes('name="code"'), false);
});

Deno.test('MultiFactorAuthVerifyForm shows the authenticator code before the email section', () => {
  const html = render(['email', 'totp'], false);

  assertEquals(html.indexOf('name="token"') < html.indexOf('name="send_email_code"'), true);
});

Deno.test('MultiFactorAuthVerifyForm shows the email code form after sending it alongside other methods', () => {
  const html = render(['totp', 'email'], true);

  assertStringIncludes(html, 'name="token"');
  assertStringIncludes(html, 'name="code"');
  assertEquals(html.includes('send_email_code'), false);
});

Deno.test('MultiFactorAuthVerifyForm does not show email options when email is not enabled', () => {
  const html = render(['totp'], false);

  assertStringIncludes(html, 'name="token"');
  assertEquals(html.includes('name="code"'), false);
  assertEquals(html.includes('send_email_code'), false);
});
