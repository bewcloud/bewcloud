import { Handlers } from 'fresh/server.ts';
import { join } from '@std/path';
import { Buffer } from 'node:buffer';
import JSZip from 'jszip';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { ensureUserPathIsValidAndSecurelyAccessible } from '/lib/models/files.ts';

interface Data {}

// Recursively add files to the zip with optimizations
async function addFilesToZip(currentPath: string, zipFolder: JSZip, basePath = '') {
  const entries = [];
  for await (const entry of Deno.readDir(currentPath)) {
    entries.push(entry);
  }

  // Process files in parallel batches
  const batchSize = 10;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (entry) => {
        const entryPath = join(currentPath, entry.name);
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isFile) {
          // Use async file reading with streaming hint
          const fileContent = await Deno.readFile(entryPath);
          zipFolder.file(entry.name, fileContent, {
            binary: true,
            createFolders: false,
          });
        } else if (entry.isDirectory) {
          // Create a folder in the zip and recursively add its contents
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) {
            await addFilesToZip(entryPath, subFolder, relativePath);
          }
        }
      }),
    );
  }
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

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
      await ensureUserPathIsValidAndSecurelyAccessible(context.state.user.id, directoryPath);

      // Get the actual filesystem path
      const filesRootPath = config.files?.rootPath || 'data-files';
      const userRootPath = join(filesRootPath, context.state.user.id);
      const fullDirectoryPath = join(userRootPath, directoryPath);

      // Create a JSZip instance
      const zip = new JSZip();

      // Add all files from the directory
      await addFilesToZip(fullDirectoryPath, zip);

      // Generate the zip file as a stream
      const zipStream = zip.generateNodeStream({
        type: 'nodebuffer',
        streamFiles: true,
        compression: 'DEFLATE',
        compressionOptions: {
          level: 1,
        },
      });

      // Convert Node.js stream to Web ReadableStream
      const readableStream = new ReadableStream({
        start(controller) {
          let isCancelled = false;

          zipStream.on('data', (chunk: Buffer) => {
            try {
              if (!isCancelled) {
                controller.enqueue(new Uint8Array(chunk));
              }
            } catch (error) {
              // Stream already closed/cancelled, ignore
              isCancelled = true;
            }
          });

          zipStream.on('end', () => {
            try {
              if (!isCancelled) {
                controller.close();
              }
            } catch (error) {
              // Stream already closed, ignore
            }
          });

          zipStream.on('error', (error: Error) => {
            if (!isCancelled) {
              console.error('Zip stream error:', error);
              try {
                controller.error(error);
              } catch {
                // Stream already closed, ignore
              }
            }
          });
        },
        cancel() {
          // Clean up when client cancels the download
          try {
            zipStream.destroy();
          } catch {
            // Ignore cleanup errors
          }
        },
      });

      return new Response(readableStream, {
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
  },
};
