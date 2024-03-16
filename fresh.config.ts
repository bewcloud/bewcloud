import { defineConfig } from 'fresh/server.ts';
import tailwind from 'fresh/plugins/tailwind.ts';

import { startCrons } from '/crons/index.ts';

const isBuildMode = Deno.args.includes('build');

if (!isBuildMode) {
  startCrons();
}

export default defineConfig({
  plugins: [tailwind()],
});
