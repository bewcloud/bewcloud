import { assertEquals } from '@std/assert';

import { abortController } from './main.ts';

const baseUrl = 'http://localhost:8000';

Deno.test({
  name: 'HTTP Server',
  fn: async () => {
    let response = await fetch(`${baseUrl}/login`);
    assertEquals(response.status, 200);

    let responseText = await response.text();
    assertEquals(responseText.includes('bewCloud'), true);

    response = await fetch(`${baseUrl}/`, {
      redirect: 'manual',
    });
    assertEquals(response.status, 303);
    assertEquals(response.headers.get('Location'), `/login`);

    response = await fetch(`${baseUrl}/blah`);
    assertEquals(response.status, 404);

    responseText = await response.text();
    assertEquals(responseText.includes('404 - Page not found'), true);

    response = await fetch(`${baseUrl}/public/robots.txt`);
    assertEquals(response.status, 200);

    response = await fetch(`${baseUrl}/public/../main.ts`);
    assertEquals(response.status, 404);

    response = await fetch(`${baseUrl}/public/%2e%2e/main.ts`);
    assertEquals(response.status, 404);

    response = await fetch(`${baseUrl}/public/assets/%2e%2e/%2e%2e/main.ts`);
    assertEquals(response.status, 404);

    const formData = new FormData();
    formData.append('email', 'user@example.com');

    response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      body: formData,
    });
    assertEquals(response.status, 200);

    responseText = await response.text();
    assertEquals(responseText.includes('Error: Password is too short'), true);

    abortController.abort('Test finished');
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
