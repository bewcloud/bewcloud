import page, { RequestHandlerParams } from '/lib/page.ts';
import { basename } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import {
  createZipArchiveResponse,
  ensureUserPathIsValidAndSecurelyAccessible,
  getDirectorySizes,
} from '/lib/models/files.ts';

async function get({ request, user }: RequestHandlerParams) {
  const config = await AppConfig.getConfig();

  // Check if multiple file downloads are enabled
  if (!config.files?.allowMultipleFileDownloads) {
    return new Response('Multiple file downloads are not enabled', { status: 403 });
  }

  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parentPath = searchParams.get('parentPath') || '/';
  const names = [...new Set(searchParams.getAll('name'))];

  if (names.length === 0) {
    return new Response('At least one name is required', { status: 400 });
  }

  // Only direct children of the parent path can be chosen
  if (
    !parentPath.startsWith('/') || parentPath.split('/').includes('..') ||
    names.some((name) => !name || name === '.' || name === '..' || basename(name) !== name)
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    const fullParentPath = await ensureUserPathIsValidAndSecurelyAccessible(user!.id, parentPath);

    const directoryPaths: string[] = [];
    let totalFilesSizeInBytes = 0;

    // Pre-flight: every entry must exist and be readable before we spawn zip
    for (const name of names) {
      const fullPath = await ensureUserPathIsValidAndSecurelyAccessible(user!.id, parentPath, name);

      let stat: Deno.FileInfo;
      try {
        stat = await Deno.stat(fullPath);
      } catch (error) {
        if (error instanceof Deno.errors.PermissionDenied) {
          console.error('Permission denied accessing file or directory for zip download:', error);
          return new Response('Forbidden', { status: 403 });
        }

        console.error('File or directory not accessible for zip download:', error);
        return new Response('File or directory not found', { status: 404 });
      }

      if (stat.isDirectory) {
        if (!config.files.allowDirectoryDownloads) {
          return new Response('Directory downloads are not enabled', { status: 403 });
        }

        directoryPaths.push(fullPath);
      } else {
        totalFilesSizeInBytes += stat.size;
      }
    }

    const directorySizes = await getDirectorySizes(directoryPaths);

    // An unknown size for any directory makes the total unknown
    const totalSizeInBytes = directorySizes.includes(null)
      ? null
      : (directorySizes as number[]).reduce((total, sizeInBytes) => total + sizeInBytes, totalFilesSizeInBytes);

    // A single entry keeps its own name, otherwise the archive is named after the directory the entries are in
    const parentDirectoryName = basename(parentPath);
    const archiveName = names.length === 1 ? names[0] : parentDirectoryName === '/' ? 'files' : parentDirectoryName;

    return createZipArchiveResponse({
      request,
      workingDirectoryPath: fullParentPath,
      entryNames: names,
      sizeInBytes: totalSizeInBytes,
      archiveFileName: `${archiveName}.zip`,
    });
  } catch (error) {
    console.error('Error creating zip of multiple files:', error);

    if ((error as Error).message === 'Invalid file path') {
      return new Response('Invalid path', { status: 400 });
    }

    return new Response('Error creating zip archive', { status: 500 });
  }
}

export default page({
  get,
  accessMode: 'user',
});
