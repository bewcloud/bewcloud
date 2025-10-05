import { Handlers } from 'fresh/server.ts';
import { join } from '@std/path';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { ensureUserPathIsValidAndSecurelyAccessible } from '/lib/models/files.ts';

interface Data {}

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

    const searchParams = new URL(request.url).searchParams;
    const parentPath = searchParams.get('parentPath') || '/';
    const name = searchParams.get('name');

    if (!name) {
      return new Response('Directory name is required', { status: 400 });
    }

    // Construct the full directory path
    const directoryPath = join(parentPath, name) + '/';

    try {
      await ensureUserPathIsValidAndSecurelyAccessible(context.state.user.id, directoryPath);

      // Get the actual filesystem path
      const filesRootPath = config.files?.rootPath || 'data-files';
      const userRootPath = join(filesRootPath, context.state.user.id);
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
      if (error.message === 'Invalid file path') {
        return new Response('Invalid directory path', { status: 400 });
      }
      return new Response('Error creating zip archive', { status: 500 });
    }
  },
};

interface FileEntry {
  path: string;
  content: Uint8Array;
  isDirectory: boolean;
}

async function getDirectoryContentsRecursively(
  userId: string,
  directoryPath: string,
  parentPath = '',
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  try {
    // Get directories in current path
    const directories = await DirectoryModel.list(userId, directoryPath);
    for (const directory of directories) {
      const fullDirPath = join(directoryPath, directory.directory_name) + '/';
      const relativePath = join(parentPath, directory.directory_name);

      // Add directory entry
      entries.push({
        path: relativePath + '/',
        content: new Uint8Array(0),
        isDirectory: true,
      });

      // Recursively get contents of subdirectory
      const subEntries = await getDirectoryContentsRecursively(
        userId,
        fullDirPath,
        relativePath,
      );
      entries.push(...subEntries);
    }

    // Get files in current path
    const files = await FileModel.list(userId, directoryPath);
    for (const file of files) {
      const fileResult = await FileModel.get(userId, directoryPath, file.file_name);
      if (fileResult.success && fileResult.contents) {
        const relativePath = join(parentPath, file.file_name);
        entries.push({
          path: relativePath,
          content: fileResult.contents as Uint8Array,
          isDirectory: false,
        });
      }
    }
  } catch (error) {
    console.error('Error getting directory contents:', error);
  }

  return entries;
}

async function createZipArchive(entries: FileEntry[], basePath: string): Promise<Uint8Array> {
  // Create a simple ZIP archive manually since we don't have a zip library
  // This is a basic implementation - in the future, we may want to consider using a robust library

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = encoder.encode(entry.path);
    const fileData = entry.content;

    // Local file header
    const localHeader = new Uint8Array(30 + fileName.length);
    const headerView = new DataView(localHeader.buffer);

    headerView.setUint32(0, 0x04034b50, true); // Local file header signature
    headerView.setUint16(4, 20, true); // Version needed to extract
    headerView.setUint16(6, 0, true); // General purpose bit flag
    headerView.setUint16(8, 0, true); // Compression method (stored)
    headerView.setUint16(10, 0, true); // File last modification time
    headerView.setUint16(12, 0, true); // File last modification date
    headerView.setUint32(14, crc32(fileData), true); // CRC-32
    headerView.setUint32(18, fileData.length, true); // Compressed size
    headerView.setUint32(22, fileData.length, true); // Uncompressed size
    headerView.setUint16(26, fileName.length, true); // File name length
    headerView.setUint16(28, 0, true); // Extra field length

    localHeader.set(fileName, 30);
    chunks.push(localHeader);
    chunks.push(fileData);

    // Central directory file header
    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0, true); // General purpose bit flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, 0, true); // File last modification time
    centralView.setUint16(14, 0, true); // File last modification date
    centralView.setUint32(16, crc32(fileData), true); // CRC-32
    centralView.setUint32(20, fileData.length, true); // Compressed size
    centralView.setUint32(24, fileData.length, true); // Uncompressed size
    centralView.setUint16(28, fileName.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header

    centralHeader.set(fileName, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + fileData.length;
  }

  // Central directory end record
  const centralDirData = new Uint8Array(centralDirectory.reduce((sum, arr) => sum + arr.length, 0));
  let centralOffset = 0;
  for (const dir of centralDirectory) {
    centralDirData.set(dir, centralOffset);
    centralOffset += dir.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  endView.setUint32(0, 0x06054b50, true); // End of central directory signature
  endView.setUint16(4, 0, true); // Number of this disk
  endView.setUint16(6, 0, true); // Disk where central directory starts
  endView.setUint16(8, centralDirectory.length, true); // Central directory entries on this disk
  endView.setUint16(10, centralDirectory.length, true); // Total central directory entries
  endView.setUint32(12, centralDirData.length, true); // Central directory size
  endView.setUint32(16, offset, true); // Central directory offset
  endView.setUint16(20, 0, true); // ZIP file comment length

  // Combine all parts
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    centralDirData.length + endRecord.length;
  const result = new Uint8Array(totalLength);

  let resultOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }

  result.set(centralDirData, resultOffset);
  resultOffset += centralDirData.length;
  result.set(endRecord, resultOffset);

  return result;
}

// Simple CRC32 implementation
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
