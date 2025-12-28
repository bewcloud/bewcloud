import { defineConfig } from 'fresh/server.ts';
import tailwind from 'fresh/plugins/tailwind.ts';

import { startCrons } from '/crons/index.ts';

const isBuildMode = Deno.args.includes('build');

if (!isBuildMode) {
  await startCrons();
}

async function notifyServiceManagerReady(message) {
  const socketAddress = Deno.env.get("NOTIFY_SOCKET");
  if (typeof(socketAddress) !== "string") {
    return;  // Service manager doesn’t expect any messages
  }

  // Send message using `systemd-notify` util until the native Deno APIs become stable
  const result = await (new Deno.Command("systemd-notify", {
    args: ["--ready", `MESSAGE=${message.replace("\n", " ")}`]
  })).output();
  if (!result.success) {
    const output = new TextDecoder().decode(result.stderr);
    throw new Deno.errors.NotCapable(`Failed to execute “systemd-notify”: ${output} (code ${result.code})`);
  }

  /*
  // Map socket path syntax
  if (socketAddress[0] === "@") {
    socketAddress = `\0${socketAddress.slice(1)}`;
  } else if (socketAddress[0] !== "/") {
    throw `Invalid NOTIFY_SOCKET address format: ${socketAddress}`;
  }

  // Send message to service manager
  //
  // Blockers:
  //  * https://github.com/denoland/deno/pull/31681
  //  * Deno stabilization of `Deno.listenDatagram` (`--unstable-net`)
  const connection = Deno.listenDatagram({ transport: "unixpacket" });
  await connection.send(
    new TextEncoder().encode(`READY=1\nSTATUS=${message.replace("\n", " ")}`),
    { transport: "unixpacket", path: socketAddress }
  );
  await connection.close();
  */
}

export default defineConfig({
  plugins: [tailwind()],
  server: {
    onListen: (params) => {
      // Format listening address
      const fmtHostPort = (hostname, port) =>
        hostname.includes(":") ? `[${hostname}]:${port}` : `${hostname}:${port}`;

      const addr = (
        params.transport === "unix"  ? `http+unix://${encodeURIComponent(params.path)}` :
        params.transport === "vsock" ? `http+vsock://${params.cid}:${parms.port}` :
        params.transport === "tcp"   ? `http://${fmtHostPort(params.hostname, params.port)}/` : null
      );

      const message = "bewCloud listening for requests" + (addr ? ` on ${addr}` : "");
      console.info(message);
      notifyServiceManagerReady(message);
    },
  },
});
