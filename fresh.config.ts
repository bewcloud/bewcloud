import { tmpdir } from 'node:os';
import { defineConfig } from 'fresh/server.ts';
import tailwind from 'fresh/plugins/tailwind.ts';

import { startCrons } from '/crons/index.ts';

const isBuildMode = Deno.args.includes('build');

if (!isBuildMode) {
  await startCrons();
}

async function notifyServiceManagerReady(message) {
  const socketAddr = Deno.env.get("NOTIFY_SOCKET");
  if(typeof(socketAddr) !== "string") {
    return;  // Service manager doesn’t expect any messages
  }

  // Alternative using systemd CLI (systemd specific, requires CLI utils in $PATH)
  /*await (new Deno.Command("systemd-notify", {
    args: ["--ready", `MESSAGE=${message.replace("\n", " ")}`]
  })).spawn();*/

  // Map socket path syntax
  if(socketAddr[0] === "@") {
    socketAddr = `\0${socketAddr.slice(1)}`;
  } else if(socketAddr[0] !== "/") {
    return;  // Invalid path
  }

  // Send message to service manager (requires Deno `--unstable-net`)
  //
  // Passing a valid `path` here is required, even though it is not used (Deno bug/limitation).
  let senderAddr = `${tmpdir()}/bewcloud-notify-${crypto.randomUUID()}.sock`;
  let connection = Deno.listenDatagram({ transport: "unixpacket", path: senderAddr });
  await Deno.remove(senderAddr);
  await connection.send(
    new TextEncoder().encode(`READY=1\nSTATUS=${message.replace("\n", " ")}`),
    { transport: "unixpacket", path: socketAddr }
  );
  await connection.close();
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
