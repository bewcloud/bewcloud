import denoConfig from '/deno.json' with { type: 'json' };
import { dirname } from '@std/path';

const downloadDirectory = `${Deno.cwd()}/public/js`;

function extractFileNameFromUrl(url: string) {
  let fileName = url.replace('https://esm.sh/', '').split('?')[0].trim();
  if (!fileName.endsWith('.mjs') && !fileName.includes('color@^0.3.0')) {
    fileName = `${fileName}.mjs`;
  }
  return fileName;
}

async function ensureDirectoryExistsForFileName(fileName: string) {
  const directory = dirname(fileName);
  try {
    const stat = await Deno.stat(directory);
    if (!stat.isDirectory) {
      throw new Error(`Directory ${directory} is not a directory`);
    }
  } catch (error) {
    if ((error as Error).toString().includes('NotFound')) {
      await Deno.mkdir(directory, { recursive: true });
    }
  }
}

function getUrlsToDownload(): Map<string, { url: string; fileName: string }> {
  const urlMap = new Map<string, { url: string; fileName: string }>();
  const { imports, frontendImports } = denoConfig;

  for (const importName of frontendImports) {
    const url = new URL(imports[importName as keyof typeof imports]);
    // url.searchParams.append('standalone', ''); // This should be easier, but it results in broken bundles (probably because of the missing peerDependencies)

    const finalUrl = url.toString();

    urlMap.set(importName, { url: finalUrl, fileName: extractFileNameFromUrl(finalUrl) });
  }

  return urlMap;
}

async function downloadUrls(urlMap: Map<string, { url: string; fileName: string }>) {
  for (const { url, fileName } of urlMap.values()) {
    console.log(`Fetching source file ${fileName} (${url})...`);
    const response = await fetch(url);
    const sourceContent = await response.text();

    const sourceLines = sourceContent.split('\n');
    for (const sourceLine of sourceLines) {
      const dependencyUrlsMap = new Map<string, { url: string; fileName: string }>();
      const importUrlInSourceContent = sourceLine.split('import "')[1]?.split('"')[0];
      const exportUrlInSourceContent = sourceLine.split('export * from "')[1]?.split('"')[0];
      const defaultExportUrlInSourceContent = sourceLine.split('export { default } from "')[1]?.split('"')[0];

      if (importUrlInSourceContent) {
        const importUrl = new URL(`https://esm.sh${importUrlInSourceContent}`).toString();
        dependencyUrlsMap.set(importUrlInSourceContent, {
          url: importUrl,
          fileName: extractFileNameFromUrl(importUrl),
        });
      }

      if (exportUrlInSourceContent) {
        const exportUrl = new URL(`https://esm.sh${exportUrlInSourceContent}`).toString();
        dependencyUrlsMap.set(exportUrlInSourceContent, {
          url: exportUrl,
          fileName: extractFileNameFromUrl(exportUrl),
        });
      }

      if (defaultExportUrlInSourceContent) {
        const defaultExportUrl = new URL(`https://esm.sh${defaultExportUrlInSourceContent}`).toString();
        dependencyUrlsMap.set(defaultExportUrlInSourceContent, {
          url: defaultExportUrl,
          fileName: extractFileNameFromUrl(defaultExportUrl),
        });
      }

      await downloadUrls(dependencyUrlsMap);

      continue;
    }

    console.log(`Downloading bundle file ${fileName} (${url})...`);

    const bundleResponse = await fetch(url);
    let bundleFileContent = await bundleResponse.text();

    // Update absolute import paths
    bundleFileContent = bundleFileContent.replaceAll('import "/', 'import "/public/js/');
    bundleFileContent = bundleFileContent.replaceAll('import"/', 'import"/public/js/');
    // Update absolute export paths
    bundleFileContent = bundleFileContent.replaceAll('export * from "/', 'export * from "/public/js/');
    bundleFileContent = bundleFileContent.replaceAll('from"/', 'from"/public/js/'); // minified files
    // Update absolute default export paths
    bundleFileContent = bundleFileContent.replaceAll(
      'export { default } from "/',
      'export { default } from "/public/js/',
    );
    // Remove sourcemap URLs (they're not downloaded)
    bundleFileContent = bundleFileContent.replaceAll('//# sourceMappingURL=', '//');

    const fullFilePath = `${downloadDirectory}/${fileName}`;

    console.log(`Writing bundle file ${fileName} (${fullFilePath})...`);

    await ensureDirectoryExistsForFileName(fullFilePath);

    await Deno.writeTextFile(fullFilePath, bundleFileContent);
  }
}

async function main() {
  const urlMap = getUrlsToDownload();

  // These are some extra imports that are harder to match from analyzing the imported files (just related to @std/path)
  urlMap.set('@std/path/internals', {
    url: 'https://esm.sh/@jsr/std__internal@^1.0.12/os',
    fileName: '@jsr/std__internal@^1.0.12/os',
  });

  const osPaths = [
    'basename',
    'constants',
    'dirname',
    'extname',
    'format',
    'from-file-url',
    'glob-to-regexp',
    'is-absolute',
    'join-globs',
    'join',
    'normalize-glob',
    'normalize',
    'parse',
    'relative',
    'resolve',
    'to-file-url',
    'to-namespaced-path',
    '_util',
  ];
  for (const path of osPaths) {
    urlMap.set(`@std/path/posix/${path}`, {
      url: `https://esm.sh/@jsr/std__path@1.1.4/denonext/posix/${path}.mjs`,
      fileName: `@jsr/std__path@1.1.4/denonext/posix/${path}.mjs`,
    });
    urlMap.set(`@std/path/windows/${path}`, {
      url: `https://esm.sh/@jsr/std__path@1.1.4/denonext/windows/${path}.mjs`,
      fileName: `@jsr/std__path@1.1.4/denonext/windows/${path}.mjs`,
    });
  }

  const commonPaths = [
    'common',
    'basename',
    'assert_path',
    'strip_trailing_separators',
    'dirname',
    'constants',
    'format',
    'from_file_url',
    'glob_to_reg_exp',
    'normalize',
    'normalize_string',
    'relative',
    'to_file_url',
  ];
  for (const path of commonPaths) {
    urlMap.set(`@std/path/common/${path}`, {
      url: `https://esm.sh/@jsr/std__path@1.1.4/denonext/_common/${path}.mjs`,
      fileName: `@jsr/std__path@1.1.4/denonext/_common/${path}.mjs`,
    });
  }

  await downloadUrls(urlMap);

  console.log('Done');
  Deno.exit(0);
}

main();
