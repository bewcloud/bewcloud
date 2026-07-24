import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { ensureUserPathIsValidAndSecurelyAccessible, getDirectorySize } from '/lib/models/files.ts';

// -1 (fastest compression) trades compression ratio for CPU time, so only use it once the directory is big enough for that to matter
const FAST_COMPRESSION_MIN_SIZE_IN_BYTES = 10 * 1024 * 1024; // 10MB

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
    const compressionArgs = directorySizeInBytes > FAST_COMPRESSION_MIN_SIZE_IN_BYTES ? ['-1'] : [];

    // Use the zip command to create the archive, streaming its stdout straight to the client instead of buffering the whole archive in memory
    let child: Deno.ChildProcess;
    try {
      child = new Deno.Command('zip', {
        args: ['-r', ...compressionArgs, '-', '.'],
        cwd: fullDirectoryPath,
        stdout: 'piped',
        stderr: 'piped',
      }).spawn();
    } catch (error) {
      console.error('zip command is not available:', error);
      return new Response('Error creating zip archive', { status: 500 });
    }

    let stderrText = '';

    // Consume stderr in the background so a full stderr buffer can't block the child
    const consumeStderr = async () => {
      try {
        stderrText = await new Response(child.stderr).text();

        if (stderrText.trim()) {
          console.error('Zip command stderr:', stderrText);
        }
      } catch (error) {
        console.error('Failed to read zip stderr:', error);
      }
    };
    consumeStderr();

    // Kill the child if the client disconnects mid-download, to avoid an orphaned `zip` process
    request.signal.addEventListener('abort', () => {
      try {
        child.kill();
      } catch {
        // Already exited, ignore
      }
    });

    // Wrap stdout so a non-zero zip exit propagates as a stream error instead of a silently-truncated "successful" download
    const stdoutReader = child.stdout.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await stdoutReader.read();

        if (done) {
          const status = await child.status;

          if (!status.success) {
            console.error(`Zip command exited with code ${status.code}: ${stderrText}`);
            controller.error(new Error(`zip exited with code ${status.code}`));
            return;
          }

          controller.close();
          return;
        }

        controller.enqueue(value);
      },
      cancel(reason) {
        stdoutReader.cancel(reason).catch(() => {});
        try {
          child.kill();
        } catch {
          // Already exited, ignore
        }
      },
    });

    return new Response(stream, {
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
