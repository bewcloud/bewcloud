import { serveFile } from '@std/http/file-server';
import { normalize, resolve } from '@std/path';
import { transpile } from 'deno/emit';
import sass from 'sass';

interface PublicFilePathResolution {
  absolutePath: string;
  relativePath: string;
}

export function resolveSafePublicFilePath(filePath: string): PublicFilePathResolution | null {
  let decodedFilePath: string;

  try {
    decodedFilePath = decodeURIComponent(filePath);
  } catch {
    return null;
  }

  if (!decodedFilePath || decodedFilePath.includes('\0')) {
    return null;
  }

  const normalizedRelativePath = normalize(decodedFilePath.replaceAll('\\', '/'));

  if (
    normalizedRelativePath.startsWith('/') ||
    normalizedRelativePath.startsWith('../') ||
    normalizedRelativePath === '..'
  ) {
    return null;
  }

  const publicRootPath = resolve('public');
  const resolvedPublicFilePath = resolve(publicRootPath, normalizedRelativePath);

  if (
    resolvedPublicFilePath !== publicRootPath &&
    !resolvedPublicFilePath.startsWith(`${publicRootPath}/`)
  ) {
    return null;
  }

  return {
    absolutePath: resolvedPublicFilePath,
    relativePath: normalizedRelativePath,
  };
}

async function transpileTs(content: string, specifier: URL) {
  const urlStr = specifier.toString();
  const result = await transpile(specifier, {
    load(specifier: string) {
      if (specifier !== urlStr) {
        return Promise.resolve({ kind: 'module', specifier, content: '' });
      }
      return Promise.resolve({ kind: 'module', specifier, content });
    },
  });
  return result.get(urlStr) || '';
}

export async function serveFileWithTs(request: Request, filePath: string, extraHeaders?: ResponseInit['headers']) {
  const response = await serveFile(request, filePath);

  if (response.status !== 200) {
    return response;
  }

  const tsCode = await response.text();
  const jsCode = await transpileTs(tsCode, new URL('file:///src.ts'));
  const { headers } = response;
  headers.set('content-type', 'application/javascript; charset=utf-8');
  headers.delete('content-length');

  return new Response(jsCode, {
    status: response.status,
    statusText: response.statusText,
    headers,
    ...(extraHeaders || {}),
  });
}

function transpileSass(content: string) {
  const compiler = sass(content);

  return compiler.to_string('compressed') as string;
}

export async function serveFileWithSass(request: Request, filePath: string, extraHeaders?: ResponseInit['headers']) {
  const response = await serveFile(request, filePath);

  if (response.status !== 200) {
    return response;
  }

  const sassCode = await response.text();
  const cssCode = transpileSass(sassCode);
  const { headers } = response;
  headers.set('content-type', 'text/css; charset=utf-8');
  headers.delete('content-length');

  return new Response(cssCode, {
    status: response.status,
    statusText: response.statusText,
    headers,
    ...(extraHeaders || {}),
  });
}
