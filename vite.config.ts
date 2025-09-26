import { defineConfig, PluginOption } from 'vite';
import { fresh } from '@fresh/plugin-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
    changeLocalUrlPlugin(), // Comment this line if this doesn't annoy you
  ],
});

// This changes the annoying 127.0.0.1:8000 URL to localhost:8000 in the terminal, so it can be easily clicked, if you want it.
function changeLocalUrlPlugin(): PluginOption {
  return {
    name: 'change-local-url',
    configureServer(server) {
      const { printUrls: originalPrintUrls } = server;

      server.printUrls = () => {
        const { resolvedUrls } = server;

        for (let index = 0; index < (resolvedUrls?.local.length || 0); index++) {
          const url = resolvedUrls?.local[index];
          if (url) {
            resolvedUrls.local[index] = url.replace('http://127.0.0.1:8000', 'http://localhost:8000');
          }
        }

        server.resolvedUrls = resolvedUrls;

        originalPrintUrls();
      };
    },
  };
}
