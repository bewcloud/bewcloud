import page, { RequestHandlerParams } from '/lib/page.ts';
import { copy as copyRecursively } from '@std/fs';
import { dirname, join } from '@std/path';
import { parse, stringify } from '@libs/xml';

import { AppConfig } from '/lib/config.ts';
import { acquireLock, findBlockingLock, refreshLock, releaseLock } from '/lib/interfaces/webdav-locks.ts';
import {
  addDavPrefixToKeys,
  buildPropFindResponse,
  getLockTokensFromIfHeader,
  getProperDestinationPath,
  getPropertyNames,
  handleWebDavError,
} from '/lib/utils/webdav.ts';
import { ensureUserPathIsValidAndSecurelyAccessible, FileModel } from '/lib/models/files.ts';

async function handler({ request, user, match }: RequestHandlerParams): Promise<Response> {
  if (!user) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="bewCloud", charset="UTF-8"' },
    });
  }

  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  let { filePath } = match.pathname.groups;

  if (!filePath) {
    filePath = '/';
  }

  filePath = decodeURIComponent(filePath);

  const userId = user!.id;

  const rootPath = join(await AppConfig.getFilesRootPath(), userId);

  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      DAV: '1, 2',
      'Ms-Author-Via': 'DAV',
      Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, COPY, MOVE, MKCOL, PROPFIND, LOCK, UNLOCK',
      'Content-Length': '0',
      Date: new Date().toUTCString(),
    });

    return new Response(null, { status: 200, headers });
  }

  if (request.method === 'GET') {
    try {
      const fileResult = await FileModel.get(userId, filePath);

      if (!fileResult.success) {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(fileResult.contents! as BodyInit, {
        status: 200,
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          'content-type': fileResult.contentType!,
          'content-length': fileResult.byteSize!.toString(),
        },
      });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'DELETE') {
    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

      const presentedTokens = getLockTokensFromIfHeader(request.headers.get('if'));

      if (findBlockingLock(userId, filePath, presentedTokens)) {
        return new Response('Locked', { status: 423 });
      }

      await Deno.remove(join(rootPath, filePath), { recursive: true });

      return new Response(null, { status: 204 });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'PUT') {
    const contentLengthString = request.headers.get('content-length');
    const contentLength = contentLengthString ? parseInt(contentLengthString, 10) : null;
    const body = contentLength === 0 ? new Blob([new Uint8Array([0])]).stream() : request.clone().body;

    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

      const presentedTokens = getLockTokensFromIfHeader(request.headers.get('if'));

      if (findBlockingLock(userId, filePath, presentedTokens)) {
        return new Response('Locked', { status: 423 });
      }

      const newFile = await Deno.open(join(rootPath, filePath), {
        create: true,
        write: true,
        truncate: true,
      });

      await body?.pipeTo(newFile.writable);

      return new Response('Created', { status: 201 });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'COPY' || request.method === 'MOVE') {
    const newFilePath = request.headers.get('destination');

    if (!newFilePath) {
      return new Response('Bad Request', { status: 400 });
    }

    const destinationPath = getProperDestinationPath(newFilePath);

    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);
      await ensureUserPathIsValidAndSecurelyAccessible(userId, destinationPath);

      const presentedTokens = getLockTokensFromIfHeader(request.headers.get('if'));

      if (request.method === 'MOVE' && findBlockingLock(userId, filePath, presentedTokens)) {
        return new Response('Locked', { status: 423 });
      }

      if (findBlockingLock(userId, destinationPath, presentedTokens)) {
        return new Response('Locked', { status: 423 });
      }

      const sourceAbsolutePath = join(rootPath, filePath);
      const destinationAbsolutePath = join(rootPath, destinationPath);

      let sourceStat: Deno.FileInfo;
      try {
        sourceStat = await Deno.stat(sourceAbsolutePath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return handleWebDavError(error, 404);
        }
        throw error;
      }

      try {
        await Deno.stat(dirname(destinationAbsolutePath));
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return handleWebDavError(error, 409);
        }
        throw error;
      }

      const isOverwriteDisallowed = request.headers.get('overwrite') === 'F';

      let destinationExists = true;
      try {
        await Deno.stat(destinationAbsolutePath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          destinationExists = false;
        } else {
          throw error;
        }
      }

      if (destinationExists && isOverwriteDisallowed) {
        return new Response('Precondition Failed', { status: 412 });
      }

      if (destinationExists) {
        await Deno.remove(destinationAbsolutePath, { recursive: true });
      }

      if (request.method === 'COPY') {
        if (sourceStat.isDirectory) {
          const isShallowCopy = request.headers.get('depth') === '0';

          if (isShallowCopy) {
            await Deno.mkdir(destinationAbsolutePath);
          } else {
            await copyRecursively(sourceAbsolutePath, destinationAbsolutePath);
          }
        } else {
          await Deno.copyFile(sourceAbsolutePath, destinationAbsolutePath);
        }
      } else {
        await Deno.rename(sourceAbsolutePath, destinationAbsolutePath);
      }

      return new Response(destinationExists ? null : 'Created', {
        status: destinationExists ? 204 : 201,
      });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'MKCOL') {
    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

      const body = await request.clone().text();

      if (body) {
        return new Response('Unsupported Media Type', { status: 415 });
      }

      const presentedTokens = getLockTokensFromIfHeader(request.headers.get('if'));

      if (findBlockingLock(userId, filePath, presentedTokens)) {
        return new Response('Locked', { status: 423 });
      }

      await Deno.mkdir(join(rootPath, filePath));
      return new Response('Created', { status: 201 });
    } catch (error) {
      const statusOverride = error instanceof Deno.errors.NotFound
        ? 409
        : error instanceof Deno.errors.AlreadyExists
        ? 405
        : undefined;
      return handleWebDavError(error, statusOverride);
    }
  }

  if (request.method === 'LOCK') {
    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

      const depthHeader = request.headers.get('depth');

      if (depthHeader && depthHeader !== '0' && depthHeader !== 'infinity') {
        return new Response('Bad Request', { status: 400 });
      }

      const depth: 'infinity' | '0' = depthHeader === '0' ? '0' : 'infinity';
      const presentedTokens = getLockTokensFromIfHeader(request.headers.get('if'));
      const body = await request.clone().text();

      let token: string;
      let lockRootPath = filePath;
      let ownerHref: string | undefined;

      if (!body && presentedTokens.length > 0) {
        const refreshed = refreshLock(userId, filePath, presentedTokens);

        if (!refreshed) {
          return new Response('Conflict', { status: 409 });
        }

        token = refreshed.token;
        lockRootPath = refreshed.path;
      } else {
        await Deno.stat(join(rootPath, filePath));

        const parsedXml = parse(body) as Record<string, any>;
        ownerHref = parsedXml['D:lockinfo']?.['D:owner']?.['D:href'];

        const acquired = acquireLock(userId, filePath, depth);

        if (!acquired) {
          return new Response('Locked', { status: 423 });
        }

        token = acquired.token;
      }

      const lockRootHref = lockRootPath === '/' ? '/dav/' : `/dav/${lockRootPath}`;

      const responseXml: Record<string, any> = {
        xml: {
          '@version': '1.0',
          '@encoding': 'UTF-8',
        },
        prop: {
          '@xmlns:D': 'DAV:',
          lockdiscovery: {
            activelock: {
              locktype: { write: null },
              lockscope: { exclusive: null },
              depth,
              owner: { href: ownerHref },
              timeout: 'Second-600',
              locktoken: { href: token },
              lockroot: { href: lockRootHref },
            },
          },
        },
      };

      const responseString = stringify(addDavPrefixToKeys(responseXml));

      return new Response(responseString, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Lock-Token': `<${token}>`,
          'Content-Length': responseString.length.toString(),
          Date: new Date().toUTCString(),
        },
      });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'UNLOCK') {
    try {
      await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

      const lockTokenHeader = request.headers.get('lock-token') || '';
      const [, presentedToken] = lockTokenHeader.match(/<([^>]+)>/) || [];

      if (!presentedToken || !releaseLock(userId, filePath, presentedToken)) {
        return new Response('Conflict', { status: 409 });
      }

      return new Response(null, { status: 204 });
    } catch (error) {
      return handleWebDavError(error);
    }
  }

  if (request.method === 'PROPFIND') {
    const depthString = request.headers.get('depth');
    const depth = depthString ? parseInt(depthString, 10) : null;
    const xml = await request.clone().text();
    let properties: string[] = ['allprop'];

    if (xml) {
      if (/xmlns:[\w-]+\s*=\s*("|')\1/.test(xml)) {
        return new Response('Bad Request', { status: 400 });
      }

      try {
        const parsedXml = parse(xml) as Record<string, any>;

        properties = getPropertyNames(parsedXml);
      } catch (error) {
        return handleWebDavError(error, 400);
      }
    }

    await ensureUserPathIsValidAndSecurelyAccessible(userId, filePath);

    const responseXml = await buildPropFindResponse(properties, rootPath, filePath, depth);

    return responseXml['D:multistatus']['D:response'].length === 0
      ? new Response('Not Found', {
        status: 404,
        headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      })
      : new Response(stringify(responseXml), {
        status: 207,
        headers: new Headers({
          'Content-Type': 'text/xml; charset=utf-8',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        }),
      });
  }

  return new Response(null, { status: 405 });
}

export default page({
  get: handler,
  delete: handler,
  put: handler,
  options: handler,
  catchAll: handler,
  accessMode: 'public',
});
