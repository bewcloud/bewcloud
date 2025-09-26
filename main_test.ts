import { join } from '@std/path';
import { assertEquals } from '@std/assert';
import { createBuilder, type InlineConfig } from 'vite';

Deno.test('Basic routes', { sanitizeResources: false, sanitizeOps: false }, async (testContext) => {
  const app = await buildFreshApp();
  const { server, address } = startTestServer(app);

  await testContext.step('#1 GET /', async () => {
    const response = await fetch(`${address}/`, { redirect: 'manual' });
    await response.body?.cancel();
    assertEquals(response.status, 303);
    assertEquals(response.headers.get('Location'), '/login');
  });

  await testContext.step('#2 GET /login', async () => {
    const response = await fetch(`${address}/login`);
    const text = await response.text();
    assertEquals(text.includes('bewCloud'), true);
    assertEquals(response.status, 200);
  });

  await testContext.step('#3 GET /blah', async () => {
    const response = await fetch(`${address}/blah`);
    const text = await response.text();
    assertEquals(text.includes('404 - Page not found'), true);
    assertEquals(response.status, 404);
  });

  await testContext.step('#4 POST /login', async () => {
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    const response = await fetch(`${address}/login`, {
      method: 'POST',
      body: formData,
    });
    const text = await response.text();
    assertEquals(text.includes('Error: Password is too short'), true);
    assertEquals(response.status, 200);
  });

  await testContext.step('#5 shutdown', async () => {
    await server.shutdown();
  });
});

// Default Fresh build configuration
const FRESH_BUILD_CONFIG: InlineConfig = {
  logLevel: 'error',
  root: './',
  build: { emptyOutDir: true },
  environments: {
    ssr: { build: { outDir: join('_fresh', 'server') } },
    client: { build: { outDir: join('_fresh', 'client') } },
  },
};

// Helper function to create and build the Fresh app
async function buildFreshApp(config: InlineConfig = FRESH_BUILD_CONFIG) {
  const builder = await createBuilder(config);
  await builder.buildApp();
  return await import('./_fresh/server.js');
}

// Helper function to start a test server
function startTestServer(app: {
  default: {
    fetch: (req: Request) => Promise<Response>;
  };
}) {
  const server = Deno.serve({
    port: 8000,
    handler: app.default.fetch,
  });

  const { port } = server.addr as Deno.NetAddr;
  const address = `http://localhost:${port}`;

  return { server, address };
}
