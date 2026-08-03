import { assertEquals } from '@std/assert';
import { walk } from '@std/fs';
import { dirname, fromFileUrl, join, resolve } from '@std/path';

const rootPath = dirname(fromFileUrl(import.meta.url));
const compiledComponentsPath = join(rootPath, 'public', 'components');

// The browser only gets what's under /public/, so a compiled component importing a .ts/.tsx path (or anything else that isn't there) 404s and leaves the page stuck on its loading state
Deno.test('that compiled components only import files that are actually served', async () => {
  const brokenImports: string[] = [];

  for await (const entry of walk(compiledComponentsPath, { exts: ['.js'] })) {
    const fileContents = await Deno.readTextFile(entry.path);

    for (const match of fileContents.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
      const importedPath = match[1];

      const absolutePath = importedPath.startsWith('/public/')
        ? join(rootPath, importedPath)
        : importedPath.startsWith('.')
        ? resolve(dirname(entry.path), importedPath)
        // Bare specifiers come from the import map, and /public/ts/ files are transpiled on the fly when requested
        : '';

      if (!absolutePath) {
        continue;
      }

      try {
        await Deno.stat(absolutePath);
      } catch {
        brokenImports.push(`${entry.path} imports ${importedPath}`);
      }
    }
  }

  assertEquals(brokenImports, []);
});
