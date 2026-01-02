import { defineConfig } from 'fresh/server.ts';
import tailwind from 'fresh/plugins/tailwind.ts';

import { startCrons } from '/crons/index.ts';

const isBuildMode = Deno.args.includes('build');

async function notifyServiceManagerReady() {
  const socketAddress = Deno.env.get('NOTIFY_SOCKET');
  if (typeof socketAddress !== 'string') {
    return;
  }

  const result = await (new Deno.Command('systemd-notify', {
    args: ['--ready', `MESSAGE=bewCloud is ready`],
  })).output();
  if (!result.success) {
    const output = new TextDecoder().decode(result.stderr);
    throw new Deno.errors.NotCapable(`Failed to execute “systemd-notify”: ${output} (code ${result.code})`);
  }
}

if (!isBuildMode) {
  await startCrons();
  await notifyServiceManagerReady();
}

export default defineConfig({
  plugins: [tailwind()],
});
