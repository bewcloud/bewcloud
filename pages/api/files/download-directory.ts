import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import {
  createZipArchiveResponse,
  ensureUserPathIsValidAndSecurelyAccessible,
  getDirectorySize,
} from '/lib/models/files.ts';

async function get({ request, user }: RequestHandlerParams) {
  const config = await AppConfig.getConfig();

  // Check if directory downloads are enabled
  if (!config.files?.allowDirectoryDownloads) {
    return new Response('Directory downloads are not enabled', { status: 403 });
  }

  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parentPath = searchParams.get('parentPath') || '/';
  const name = searchParams.get('name');

  if (!name) {
    return new Response('Directory name is required', { status: 400 });
  }

  // Construct the full directory path
  const directoryPath = `${join(parentPath, name)}/`;

  try {
    const fullDirectoryPath = await ensureUserPathIsValidAndSecurelyAccessible(user!.id, directoryPath);

    // Pre-flight: directory must exist and be readable before we spawn zip
    try {
      const directoryStat = await Deno.stat(fullDirectoryPath);

      if (!directoryStat.isDirectory) {
        return new Response('Not a directory', { status: 400 });
      }
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        console.error('Permission denied accessing directory for zip download:', error);
        return new Response('Forbidden', { status: 403 });
      }

      console.error('Directory not accessible for zip download:', error);
      return new Response('Directory not found', { status: 404 });
    }

    const directorySizeInBytes = await getDirectorySize(fullDirectoryPath);

    return createZipArchiveResponse({
      request,
      workingDirectoryPath: fullDirectoryPath,
      entryNames: ['.'],
      sizeInBytes: directorySizeInBytes,
      archiveFileName: `${name}.zip`,
    });
  } catch (error) {
    console.error('Error creating directory zip:', error);

    if ((error as Error).message === 'Invalid file path') {
      return new Response('Invalid directory path', { status: 400 });
    }

    return new Response('Error creating zip archive', { status: 500 });
  }
}

export default page({
  get,
  accessMode: 'user',
});
