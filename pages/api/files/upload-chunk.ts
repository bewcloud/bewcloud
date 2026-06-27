import { join } from '@std/path';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { Directory, DirectoryFile } from '/lib/types.ts';
import { DirectoryModel, ensureUserPathIsValidAndSecurelyAccessible, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';

export interface ResponseBody {
  success: boolean;
  isComplete: boolean;
  newFiles?: DirectoryFile[];
  newDirectories?: Directory[];
}

// Deno.FsFile.write() may do short writes (like POSIX write()), so loop until all bytes are written.
async function writeAll(file: Deno.FsFile, data: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    offset += await file.write(data.subarray(offset));
  }
}

// Remove upload dirs for this user that have not been touched in over 24 hours.
async function cleanStaleUploads(userUploadDir: string): Promise<void> {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  try {
    for await (const entry of Deno.readDir(userUploadDir)) {
      const entryPath = join(userUploadDir, entry.name);
      try {
        const stat = await Deno.stat(entryPath);
        if (now - (stat.mtime?.getTime() ?? 0) > maxAgeMs) {
          await Deno.remove(entryPath, { recursive: true });
        }
      } catch {
        // ignore per-entry errors
      }
    }
  } catch {
    // ignore if the user upload dir doesn't exist yet
  }
}

async function post({ request, user }: RequestHandlerParams) {
  if (
    !(await AppConfig.isAppEnabled('files')) && !(await AppConfig.isAppEnabled('photos')) &&
    !(await AppConfig.isAppEnabled('notes'))
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const requestBody = await request.clone().formData();

  const uploadId = requestBody.get('upload_id') as string;
  const chunkIndexStr = requestBody.get('chunk_index') as string;
  const totalChunksStr = requestBody.get('total_chunks') as string;
  const pathInView = requestBody.get('path_in_view') as string;
  const parentPath = requestBody.get('parent_path') as string;
  const name = requestBody.get('name') as string;
  const chunk = requestBody.get('chunk') as File | null;

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const totalChunks = parseInt(totalChunksStr, 10);

  if (
    !uploadId ||
    !/^[a-zA-Z0-9-]+$/.test(uploadId) ||
    isNaN(chunkIndex) || chunkIndex < 0 ||
    isNaN(totalChunks) || totalChunks < 1 ||
    chunkIndex >= totalChunks ||
    !parentPath ||
    !pathInView ||
    !name?.trim() ||
    !chunk ||
    !parentPath.startsWith('/') ||
    parentPath.includes('../') ||
    !pathInView.startsWith('/') ||
    pathInView.includes('../')
  ) {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    await ensureUserPathIsValidAndSecurelyAccessible(user!.id, join(parentPath, name.trim()));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const filesRootPath = await AppConfig.getFilesRootPath();
  const userUploadDir = join(filesRootPath, user!.id, '.chunk-uploads');
  const uploadDir = join(userUploadDir, uploadId);

  // On the first chunk of a new upload, evict any stale sessions from this user.
  if (chunkIndex === 0) {
    await cleanStaleUploads(userUploadDir);
  }

  try {
    await Deno.mkdir(uploadDir, { recursive: true });

    const chunkData = await chunk.arrayBuffer();
    await Deno.writeFile(join(uploadDir, String(chunkIndex)), new Uint8Array(chunkData));

    // Count how many chunk files are present so far
    let receivedCount = 0;
    for await (const _entry of Deno.readDir(uploadDir)) {
      receivedCount++;
    }

    if (receivedCount < totalChunks) {
      const responseBody: ResponseBody = { success: true, isComplete: false };

      return new Response(JSON.stringify(responseBody));
    }

    // All chunks present — assemble the final file
    const finalParentDir = join(filesRootPath, user!.id, parentPath);
    await Deno.mkdir(finalParentDir, { recursive: true });

    const finalFilePath = join(finalParentDir, name.trim());

    // Open with createNew:true to match the single-upload behaviour (reject if file already exists)
    let finalFile: Deno.FsFile;

    try {
      finalFile = await Deno.open(finalFilePath, { write: true, createNew: true });
    } catch (error) {
      await Deno.remove(uploadDir, { recursive: true }).catch(() => {});
      await Deno.remove(userUploadDir, { recursive: true }).catch(() => {});

      console.error(error);

      const responseBody: ResponseBody = { success: false, isComplete: true };

      return new Response(JSON.stringify(responseBody));
    }

    // Write chunks in order, using writeAll to guard against short writes
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkBytes = await Deno.readFile(join(uploadDir, String(i)));
        await writeAll(finalFile, chunkBytes);
      }
    } catch (error) {
      finalFile.close();

      await Deno.remove(finalFilePath).catch(() => {});
      await Deno.remove(uploadDir, { recursive: true }).catch(() => {});
      await Deno.remove(userUploadDir, { recursive: true }).catch(() => {});

      throw error;
    }

    finalFile.close();
    await Deno.remove(uploadDir, { recursive: true });
    await Deno.remove(userUploadDir, { recursive: true }).catch(() => {});

    const newFiles = await FileModel.list(user!.id, pathInView);
    const newDirectories = await DirectoryModel.list(user!.id, pathInView);

    const responseBody: ResponseBody = { success: true, isComplete: true, newFiles, newDirectories };

    return new Response(JSON.stringify(responseBody));
  } catch (error) {
    console.error(error);
    await Deno.remove(uploadDir, { recursive: true }).catch(() => {});
    await Deno.remove(userUploadDir, { recursive: true }).catch(() => {});

    return new Response('Internal Server Error', { status: 500 });
  }
}

export default page({
  post,
  accessMode: 'user',
});
