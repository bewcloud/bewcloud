import { assertEquals } from '@std/assert';
import { createHandler, ServeHandlerInfo } from 'fresh/server.ts';

import manifest from './fresh.gen.ts';
import config from './fresh.config.ts';

// @ts-ignore Deno's newer types seem to have messed this up
const CONN_INFO: ServeHandlerInfo = {
  remoteAddr: { hostname: '127.0.0.1', port: 53496, transport: 'tcp' },
};

Deno.test('Basic routes', async (testContext) => {
  const handler = await createHandler(manifest, config);

  await testContext.step('#1 GET /', async () => {
    const response = await handler(new Request('http://127.0.0.1/'), CONN_INFO);
    assertEquals(response.status, 303);
  });

  await testContext.step('#2 GET /login', async () => {
    const response = await handler(new Request('http://127.0.0.1/login'), CONN_INFO);
    const text = await response.text();
    assertEquals(text.includes('bewCloud'), true);
    assertEquals(response.status, 200);
  });

  await testContext.step('#3 GET /blah', async () => {
    const response = await handler(new Request('http://127.0.0.1/blah'), CONN_INFO);
    const text = await response.text();
    assertEquals(text.includes('404 - Page not found'), true);
    assertEquals(response.status, 404);
  });

  await testContext.step('#4 POST /login', async () => {
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    const request = new Request('http://127.0.0.1/login', {
      method: 'POST',
      body: formData,
    });
    const response = await handler(request, CONN_INFO);
    const text = await response.text();
    assertEquals(text.includes('Error: Password is too short'), true);
    assertEquals(response.status, 200);
  });
});
