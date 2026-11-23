import { serveFile } from '@std/http/file-server';
import { normalize, resolve } from '@std/path';
import { transpile } from 'deno/emit';

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

function isInlineSafeMimeType(mimeType: string): boolean {
  if (mimeType.includes('html') || mimeType.includes('xml') || mimeType.includes('svg') || mimeType.includes('xsl')) {
    return false;
  }

  if (/^(image|audio|video)\//.test(mimeType)) {
    return true;
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/pdf') {
    return true;
  }

  return false;
}

export function getContentDispositionHeader(type: 'inline' | 'attachment', fileName: string): string {
  const asciiFallbackFileName = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${type}; filename="${asciiFallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}

export function getUserFileResponseHeaders(
  { contentType, byteSize, fileName }: { contentType: string; byteSize: number; fileName: string },
): Record<string, string> {
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  const isInlineSafe = isInlineSafeMimeType(mimeType);

  const headers: Record<string, string> = {
    'cache-control': 'no-cache, no-store, must-revalidate',
    // Kept as-is so `<img src="file.svg">` still works, since images ignore the disposition and don't run scripts
    'content-type': contentType,
    'content-length': byteSize.toString(),
    'content-disposition': getContentDispositionHeader(isInlineSafe ? 'inline' : 'attachment', fileName),
    'x-content-type-options': 'nosniff',
  };

  // Browsers refuse to render PDFs in a sandboxed document
  if (mimeType !== 'application/pdf') {
    headers['content-security-policy'] =
      "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";
  }

  return headers;
}
