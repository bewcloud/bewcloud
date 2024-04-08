import { join } from 'std/path/join.ts';
import { lookup } from 'mrmime';

export function getProperDestinationPath(url: string) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export function addDavPrefixToKeys(object: Record<string, any>, prefix = 'D:'): Record<string, any> {
  if (Array.isArray(object)) {
    return object.map((item) => addDavPrefixToKeys(item));
  }

  if (typeof object === 'object' && object !== null) {
    return Object.entries(object).reduce((reducedObject, [key, value]) => {
      const prefixedKey = key === 'xml' || key.startsWith('#') || key.startsWith('@') ? key : `${prefix}${key}`;
      reducedObject[prefixedKey] = addDavPrefixToKeys(value);
      return reducedObject;
    }, {} as Record<string, any>);
  }

  return object;
}

export function getPropertyNames(xml: Record<string, any>): string[] {
  const propFindElement = xml['D:propfind'] || xml.propfind;
  if (!propFindElement) {
    return ['allprop'];
  }

  const propElement = propFindElement['D:prop'] || propFindElement.prop;
  if (!propElement) {
    return [];
  }

  const propertyNames: string[] = [];
  for (const key in propElement) {
    if (Object.hasOwn(propElement, key)) {
      propertyNames.push(key.replace('D:', ''));
    }
  }

  return propertyNames;
}

function encodeFilePath(filePath: string) {
  const encoded = encodeURIComponent(filePath)
    .replace(/%2F/g, '/')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return encoded;
}

async function getFilePaths(
  path: string,
  depth?: number | null,
): Promise<string[]> {
  const filePaths: string[] = [];

  try {
    const stat = await Deno.stat(path);

    if (stat.isFile) {
      filePaths.push(path);
    } else if (stat.isDirectory || stat.isSymlink) {
      if (depth === 0) {
        filePaths.push(`${path}/`);
      } else {
        filePaths.push(`${path}/`);

        const directoryEntries = Deno.readDir(path);

        for await (const entry of directoryEntries) {
          const entryPath = [path, entry.name]
            .filter(Boolean)
            .join('/')
            .replaceAll('//', '/');

          filePaths.push(entry.isDirectory || entry.isSymlink ? `${entryPath}/` : entryPath);

          if (entry.isDirectory && (depth === 1 || depth === null)) {
            const nestedResources = await getFilePaths(
              entryPath,
              depth ? depth - 1 : depth,
            );

            filePaths.push(...nestedResources);
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }

  return [...new Set(filePaths)];
}

export async function buildPropFindResponse(
  properties: string[],
  rootPath: string,
  queryPath: string,
  depth: number | null = null,
): Promise<Record<string, any>> {
  const filePaths = await getFilePaths(join(rootPath, queryPath), depth);

  const response: Record<string, any> = {
    xml: {
      '@version': '1.0',
      '@encoding': 'UTF-8',
    },
    multistatus: {
      '@xmlns:D': 'DAV:',
      response: [],
    },
  };

  for (const filePath of filePaths) {
    try {
      const stat = await Deno.stat(filePath);

      const isDirectory = stat.isDirectory || stat.isSymlink;
      const prop: Record<string, any> = {};
      const notFound: Record<string, any> = {};

      for (const propKey of properties) {
        switch (propKey) {
          case 'displayname':
            prop.displayname = isDirectory ? filePath.split('/').filter(Boolean).pop() : filePath.split('/').pop();
            break;
          case 'getcontentlength':
            if (!isDirectory) {
              prop.getcontentlength = stat.size?.toString() || '0';
            }
            break;
          case 'getcontenttype':
            if (!isDirectory) {
              prop.getcontenttype = lookup(filePath);
            }
            break;
          case 'resourcetype':
            prop.resourcetype = isDirectory ? { collection: { '@xmlns:D': 'DAV:' } } : {};
            break;
          case 'getlastmodified':
            prop.getlastmodified = stat.mtime?.toUTCString() || '';
            break;
          case 'creationdate':
            prop.creationdate = stat.birthtime?.toUTCString() || '';
            break;
          case 'getetag':
            prop.etag = stat.mtime?.toUTCString();
            break;
          case 'getctag':
            prop.ctag = stat.mtime?.toUTCString();
            break;
          case 'allprop':
            prop.displayname = isDirectory ? filePath.split('/').filter(Boolean).pop() : filePath.split('/').pop();
            if (!isDirectory) {
              prop.getcontentlength = stat.size?.toString() || '0';
              prop.getcontenttype = lookup(filePath);
            }
            prop.resourcetype = isDirectory ? { collection: { '@xmlns:D': 'DAV:' } } : {};
            prop.getlastmodified = stat.mtime?.toUTCString() || '';
            prop.creationdate = stat.birthtime?.toUTCString() || '';
            prop.etag = stat.mtime?.toUTCString();
            prop.ctag = stat.mtime?.toUTCString();
            break;
        }

        if (typeof prop[propKey] === 'undefined' && propKey !== 'allprop') {
          if (propKey.startsWith('s:')) {
            notFound[propKey.slice(2)] = { '@xmlns:s': 'SAR:' };
          } else {
            notFound[propKey] = '';
          }
        }
      }

      const davFileName = filePath.replace(join(rootPath, queryPath), queryPath);

      const davFilePath = `/dav${(davFileName.startsWith('/') ? '' : '/')}${davFileName}`.replaceAll('//', '/');

      response.multistatus.response.push({
        href: encodeFilePath(davFilePath),
        propstat: [
          { prop, status: 'HTTP/1.1 200 OK' },
          { prop: notFound, status: 'HTTP/1.1 404 Not Found' },
        ],
      });
    } catch (error) {
      console.error(error);
    }
  }

  return addDavPrefixToKeys(response);
}
