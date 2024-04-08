import { Handler, RouteConfig } from 'fresh/server.ts';
import { join } from 'std/path/join.ts';
import { parse, stringify } from 'xml';

import { FreshContextState } from '/lib/types.ts';
import { getFilesRootPath } from '/lib/config.ts';
import {
  addDavPrefixToKeys,
  buildPropFindResponse,
  getProperDestinationPath,
  getPropertyNames,
} from '/lib/utils/webdav.ts';
import { getFile } from '/lib/data/files.ts';

interface Data {}

export const config: RouteConfig = {
  routeOverride: '/dav/:filePath*',
};

export const handler: Handler<Data, FreshContextState> = async (request, context) => {
  if (!context.state.user) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="bewCloud", charset="UTF-8"' },
    });
  }

  let { filePath } = context.params;

  if (!filePath) {
    filePath = '/';
  }

  filePath = decodeURIComponent(filePath);

  const rootPath = join(getFilesRootPath(), context.state.user.id);

  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      DAV: '1, 2',
      'Ms-Author-Via': 'DAV',
      Allow: 'OPTIONS, DELETE, PROPFIND',
      'Content-Length': '0',
      Date: new Date().toUTCString(),
    });

    return new Response(null, { status: 200, headers });
  }

  if (request.method === 'GET') {
    try {
      const fileResult = await getFile(context.state.user.id, filePath);

      if (!fileResult.success) {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(fileResult.contents!, {
        status: 200,
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          'content-type': fileResult.contentType!,
          'content-length': fileResult.byteSize!.toString(),
        },
      });
    } catch (error) {
      console.error(error);
    }

    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'DELETE') {
    try {
      await Deno.remove(join(rootPath, filePath));

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error(error);
    }

    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'PUT') {
    const contentLengthString = request.headers.get('content-length');
    const contentLength = contentLengthString ? parseInt(contentLengthString, 10) : null;
    const body = contentLength === 0 ? new Blob([new Uint8Array([0])]).stream() : request.clone().body;

    try {
      const newFile = await Deno.open(join(rootPath, filePath), {
        create: true,
        write: true,
        truncate: true,
      });

      await body?.pipeTo(newFile.writable);

      return new Response('Created', { status: 201 });
    } catch (error) {
      console.error(error);
    }

    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'COPY') {
    const newFilePath = request.headers.get('destination');
    if (newFilePath) {
      try {
        await Deno.copyFile(join(rootPath, filePath), join(rootPath, getProperDestinationPath(newFilePath)));
        return new Response('Created', { status: 201 });
      } catch (error) {
        console.error(error);
      }
    }

    return new Response('Bad Request', { status: 400 });
  }

  if (request.method === 'MOVE') {
    const newFilePath = request.headers.get('destination');
    if (newFilePath) {
      try {
        await Deno.rename(join(rootPath, filePath), join(rootPath, getProperDestinationPath(newFilePath)));
        return new Response('Created', { status: 201 });
      } catch (error) {
        console.error(error);
      }
    }
  }

  if (request.method === 'MKCOL') {
    try {
      await Deno.mkdir(join(rootPath, filePath), { recursive: true });
      return new Response('Created', { status: 201 });
    } catch (error) {
      console.error(error);
    }

    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'LOCK') {
    const depthString = request.headers.get('depth');
    const depth = depthString ? parseInt(depthString, 10) : null;
    const xml = await request.clone().text();
    const parsedXml = parse(xml) as Record<string, any>;

    // TODO: This should create an actual lock, not just "pretend", and have it checked when fetching a directory/file
    const lockToken = crypto.randomUUID();

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
            owner: {
              href: parsedXml['D:lockinfo']?.['D:owner']?.['D:href'],
            },
            timeout: 'Second-600',
            locktoken: { href: lockToken },
            lockroot: { href: filePath },
          },
        },
      },
    };

    const responseString = stringify(addDavPrefixToKeys(responseXml));

    return new Response(responseString, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Lock-Token': `<${lockToken}>`,
        'Content-Length': responseString.length.toString(),
        Date: new Date().toUTCString(),
      },
    });
  }

  if (request.method === 'UNLOCK') {
    // TODO: This should release an actual lock, not just "pretend"
    // const lockToken = request.headers.get('Lock-Token');

    return new Response(null, {
      status: 204,
      headers: { Date: new Date().toUTCString() },
    });
  }

  if (request.method === 'PROPFIND') {
    const depthString = request.headers.get('depth');
    const depth = depthString ? parseInt(depthString, 10) : null;
    const xml = await request.clone().text();

    const parsedXml = parse(xml);

    const properties = getPropertyNames(parsedXml);
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
};
