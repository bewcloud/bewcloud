import { App, staticFiles } from 'fresh';

import { startCrons } from '/crons/index.ts';

const shouldStartCrons = Deno.env.get('START_BEWCLOUD_CRONS') === 'true';

if (shouldStartCrons) {
  await startCrons();
}

export const app = new App()
  // Add static file serving middleware
  .use(staticFiles())
  // Enable file-system based routing
  .fsRoutes();
