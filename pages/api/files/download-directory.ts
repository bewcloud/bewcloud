import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { ensureUserPathIsValidAndSecurelyAccessible } from '/lib/models/files.ts';

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
    await ensureUserPathIsValidAndSecurelyAccessible(user!.id, directoryPath);

    // Get the actual filesystem path
    const filesRootPath = config.files?.rootPath || 'data-files';
    const userRootPath = join(filesRootPath, user!.id);
    const fullDirectoryPath = join(userRootPath, directoryPath);

    // Use the zip command to create the archive
    const zipProcess = new Deno.Command('zip', {
      args: ['-r', '-', '.'],
      cwd: fullDirectoryPath,
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout, stderr } = await zipProcess.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);

      console.error('Zip command failed:', errorText);

      return new Response('Error creating zip archive', { status: 500 });
    }

    return new Response(stdout, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${name}.zip"`,
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
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
