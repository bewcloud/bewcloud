import { join } from 'std/path/join.ts';
import { resolve } from 'std/path/resolve.ts';
import { lookup } from 'mrmime';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

import { AppConfig } from '/lib/config.ts';
import { Directory, DirectoryFile } from '/lib/types.ts';
import { sortDirectoriesByName, sortEntriesByName, sortFilesByName, TRASH_PATH } from '/lib/utils/files.ts';

export class DirectoryModel {
  static async list(userId: string, path: string): Promise<Directory[]> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    const directories: Directory[] = [];

    const directoryEntries = (await getPathEntries(userId, path)).filter((entry) =>
      entry.isDirectory || entry.isSymlink
    );

    for (const entry of directoryEntries) {
      const stat = await Deno.stat(join(rootPath, entry.name));

      const directory: Directory = {
        user_id: userId,
        parent_path: path,
        directory_name: entry.name,
        has_write_access: true,
        size_in_bytes: stat.size,
        updated_at: stat.mtime || new Date(),
        created_at: stat.birthtime || new Date(),
      };

      directories.push(directory);
    }

    directories.sort(sortDirectoriesByName);

    return directories;
  }

  static async create(userId: string, path: string, name: string): Promise<boolean> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    try {
      await Deno.mkdir(join(rootPath, name), { recursive: true });
    } catch (error) {
      console.error(error);
      return false;
    }

    return true;
  }

  static async rename(
    userId: string,
    oldPath: string,
    newPath: string,
    oldName: string,
    newName: string,
  ): Promise<boolean> {
    return await renameDirectoryOrFile(userId, oldPath, newPath, oldName, newName);
  }

  static async delete(userId: string, path: string, name: string): Promise<boolean> {
    return await deleteDirectoryOrFile(userId, path, name);
  }

  static async searchNames(
    userId: string,
    searchTerm: string,
  ): Promise<{ success: boolean; directories: Directory[] }> {
    const rootPath = join(await AppConfig.getFilesRootPath(), userId);

    const directories: Directory[] = [];

    try {
      const controller = new AbortController();
      const commandTimeout = setTimeout(() => controller.abort(), 10_000);

      const command = new Deno.Command(`find`, {
        args: [
          `.`, // proper cwd is sent below
          `-type`,
          `d,l`, // directories and symbolic links
          `-iname`,
          `*${searchTerm}*`,
        ],
        cwd: rootPath,
        signal: controller.signal,
      });

      const { code, stdout, stderr } = await command.output();

      if (commandTimeout) {
        clearTimeout(commandTimeout);
      }

      if (code !== 0) {
        if (stderr) {
          throw new Error(new TextDecoder().decode(stderr));
        }

        throw new Error(`Unknown error running "find"`);
      }

      const output = new TextDecoder().decode(stdout);
      const matchingDirectories = output.split('\n').map((directoryPath) => directoryPath.trim()).filter(Boolean);

      for (const relativeDirectoryPath of matchingDirectories) {
        const stat = await Deno.stat(join(rootPath, relativeDirectoryPath));
        let parentPath = `/${relativeDirectoryPath.replace('./', '/').split('/').slice(0, -1).join('')}/`;
        const directoryName = relativeDirectoryPath.split('/').pop()!;

        if (parentPath === '//') {
          parentPath = '/';
        }

        const directory: Directory = {
          user_id: userId,
          parent_path: parentPath,
          directory_name: directoryName,
          has_write_access: true,
          size_in_bytes: stat.size,
          updated_at: stat.mtime || new Date(),
          created_at: stat.birthtime || new Date(),
        };

        directories.push(directory);
      }

      return { success: true, directories };
    } catch (error) {
      console.error(error);
    }

    return { success: false, directories };
  }
}

export class FileModel {
  static async list(userId: string, path: string): Promise<DirectoryFile[]> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

    const s3Config = await AppConfig.getS3Config();
    if (!s3Config) {
      console.error('S3 configuration is missing. File listing from S3 aborted.');
      throw new Error('S3 configuration is not available, cannot list files.');
    }

    const s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyID,
        secretAccessKey: s3Config.secretAccessKey,
      },
      endpoint: s3Config.endpoint,
    });

    // Ensure path starts with '/' and ends with '/' for S3 prefix consistency
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (!normalizedPath.endsWith('/')) {
      normalizedPath = `${normalizedPath}/`;
    }
    // Remove leading '/' for S3 key construction as "users/" is the root
    const s3Prefix = `users/${userId}${normalizedPath.substring(1)}`;

    const files: DirectoryFile[] = [];

    try {
      let continuationToken: string | undefined = undefined;
      do {
        const listObjectsCommand = new ListObjectsV2Command({
          Bucket: s3Config.bucket,
          Prefix: s3Prefix,
          ContinuationToken: continuationToken,
          // Delimiter: '/', // Use Delimiter if you only want direct children and not all nested objects
        });

        const listObjectsResponse = await s3Client.send(listObjectsCommand);

        if (listObjectsResponse.Contents) {
          for (const object of listObjectsResponse.Contents) {
            if (!object.Key || object.Key === s3Prefix || object.Key.endsWith('/')) {
              // Skip the prefix itself if it's listed as an object, or objects ending with '/' (pseudo-directories)
              continue;
            }

            const fileName = object.Key.substring(s3Prefix.length);
            if (!fileName || fileName.includes('/')) {
              // Skip files in sub-prefixes if not using Delimiter, or if filename is empty
              // This check helps to list only immediate children if Delimiter wasn't used or didn't filter enough
              continue;
            }

            const file: DirectoryFile = {
              user_id: userId,
              parent_path: path, // The original requested path
              file_name: fileName,
              has_write_access: true, // Assuming true, S3 permissions are handled differently
              size_in_bytes: object.Size || 0,
              updated_at: object.LastModified || new Date(),
              created_at: object.LastModified || new Date(), // S3 doesn't have a distinct creation date via ListObjectsV2, using LastModified
            };
            files.push(file);
          }
        }
        continuationToken = listObjectsResponse.NextContinuationToken;
      } while (continuationToken);

      files.sort(sortFilesByName);
      return files;
    } catch (error) {
      console.error(`Error listing files from S3 (prefix: ${s3Prefix}):`, error);
      return []; // Return empty array on error, or re-throw if preferred
    }
  }

  static async create(
    userId: string,
    path: string,
    name: string,
    contents: string | ArrayBuffer,
  ): Promise<boolean> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

    const s3Config = await AppConfig.getS3Config();

    if (!s3Config) {
      console.error('S3 configuration is missing. File upload to S3 aborted.');
      // As per requirement, throw an error if S3 config is missing.
      // Alternatively, could fall back to filesystem, but requirement is to use S3.
      throw new Error('S3 configuration is not available, cannot upload file.');
    }

    const s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyID,
        secretAccessKey: s3Config.secretAccessKey,
      },
      endpoint: s3Config.endpoint,
    });

    // Construct S3 object key: users/<userId>/<path>/<filename>
    // Ensure path starts with a slash and doesn't have one at the end for clean joining
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    const s3KeyPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
    const s3Key = `users/${userId}/${s3KeyPath}${name}`;

    // Determine ContentType
    const extension = name.split('.').pop()?.toLowerCase() || '';
    const contentType = lookup(extension) || 'application/octet-stream';

    try {
      const putObjectCommand = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
        Body: contents instanceof ArrayBuffer ? new Uint8Array(contents) : contents,
        ContentType: contentType,
      });

      await s3Client.send(putObjectCommand);
      return true;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      return false;
    }
  }

  static async update(
    userId: string,
    path: string,
    name: string,
    contents: string,
  ): Promise<boolean> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    try {
      await Deno.writeTextFile(join(rootPath, name), contents, { append: false, createNew: false });
    } catch (error) {
      console.error(error);
      return false;
    }

    return true;
  }

  static async get(
    userId: string,
    path: string,
    name?: string,
  ): Promise<{ success: boolean; contents?: Uint8Array; contentType?: string; byteSize?: number }> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name || ''));

    const s3Config = await AppConfig.getS3Config();

    if (!s3Config) {
      console.error('S3 configuration is missing. File retrieval from S3 aborted.');
      throw new Error('S3 configuration is not available, cannot retrieve file.');
    }

    const s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyID,
        secretAccessKey: s3Config.secretAccessKey,
      },
      endpoint: s3Config.endpoint,
    });

    const objectName = name || path.split('/').pop() || '';
    if (!objectName) {
      console.error('Could not determine object name from path.');
      return { success: false };
    }

    // Construct S3 object key: users/<userId>/<path>/<filename>
    // Ensure path starts with a slash for consistency if it's a full path, or join appropriately if it's directory + name
    let s3Key;
    if (name) { // If name is provided, path is the directory
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
      const s3KeyPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
      s3Key = `users/${userId}/${s3KeyPath}${name}`;
    } else { // If name is not provided, path is the full object path
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
      s3Key = `users/${userId}/${normalizedPath}`;
    }
    // Remove trailing slash if path was to a directory (e.g. get /users/id/dir/ instead of /users/id/dir/filename)
    if (s3Key.endsWith('/')) {
        s3Key = s3Key.substring(0, s3Key.length -1);
    }


    try {
      const headObjectCommand = new HeadObjectCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
      });
      const headObjectResponse = await s3Client.send(headObjectCommand);

      const contentType = headObjectResponse.ContentType || 'application/octet-stream';
      const byteSize = headObjectResponse.ContentLength;

      if (byteSize === undefined) {
        console.error('Could not determine file size from S3 metadata.');
        return { success: false };
      }

      const getObjectCommand = new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
      });
      const getObjectResponse = await s3Client.send(getObjectCommand);

      if (getObjectResponse.Body) {
        const stream = getObjectResponse.Body as ReadableStream<Uint8Array>;
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalLength += value.length;
          }
        }

        const contents = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          contents.set(chunk, offset);
          offset += chunk.length;
        }

        return {
          success: true,
          contents,
          contentType,
          byteSize,
        };
      } else {
        console.error('S3 GetObjectResponse body is undefined.');
        return { success: false };
      }
    } catch (error) {
      // Check if the error is because the object was not found
      if (error.name === 'NotFound' || (error as any).$metadata?.httpStatusCode === 404) {
        console.info(`File not found in S3: ${s3Key}`);
      } else {
        console.error(`Error getting file from S3 (${s3Key}):`, error);
      }
      return { success: false };
    }
  }

  static async rename(
    userId: string,
    oldPath: string,
    newPath: string,
    oldName: string,
    newName: string,
  ): Promise<boolean> {
    return await renameDirectoryOrFile(userId, oldPath, newPath, oldName, newName);
  }

  static async delete(userId: string, path: string, name: string): Promise<boolean> {
    return await deleteDirectoryOrFile(userId, path, name);
  }

  static async searchNames(
    userId: string,
    searchTerm: string,
  ): Promise<{ success: boolean; files: DirectoryFile[] }> {
    const rootPath = join(await AppConfig.getFilesRootPath(), userId);

    const files: DirectoryFile[] = [];

    try {
      const controller = new AbortController();
      const commandTimeout = setTimeout(() => controller.abort(), 10_000);

      const command = new Deno.Command(`find`, {
        args: [
          `.`, // proper cwd is sent below
          `-type`,
          `f`,
          `-iname`,
          `*${searchTerm}*`,
        ],
        cwd: rootPath,
        signal: controller.signal,
      });

      const { code, stdout, stderr } = await command.output();

      if (commandTimeout) {
        clearTimeout(commandTimeout);
      }

      if (code !== 0) {
        if (stderr) {
          throw new Error(new TextDecoder().decode(stderr));
        }

        throw new Error(`Unknown error running "find"`);
      }

      const output = new TextDecoder().decode(stdout);
      const matchingFiles = output.split('\n').map((filePath) => filePath.trim()).filter(Boolean);

      for (const relativeFilePath of matchingFiles) {
        const stat = await Deno.stat(join(rootPath, relativeFilePath));
        let parentPath = `/${relativeFilePath.replace('./', '/').split('/').slice(0, -1).join('')}/`;
        const fileName = relativeFilePath.split('/').pop()!;

        if (parentPath === '//') {
          parentPath = '/';
        }

        const file: DirectoryFile = {
          user_id: userId,
          parent_path: parentPath,
          file_name: fileName,
          has_write_access: true,
          size_in_bytes: stat.size,
          updated_at: stat.mtime || new Date(),
          created_at: stat.birthtime || new Date(),
        };

        files.push(file);
      }

      return { success: true, files };
    } catch (error) {
      console.error(error);
    }

    return { success: false, files };
  }

  static async searchContents(
    userId: string,
    searchTerm: string,
  ): Promise<{ success: boolean; files: DirectoryFile[] }> {
    const rootPath = join(await AppConfig.getFilesRootPath(), userId);

    const files: DirectoryFile[] = [];

    try {
      const controller = new AbortController();
      const commandTimeout = setTimeout(() => controller.abort(), 10_000);

      const command = new Deno.Command(`grep`, {
        args: [
          `-rHisl`,
          `${searchTerm}`,
          `.`, // proper cwd is sent below
        ],
        cwd: rootPath,
        signal: controller.signal,
      });

      const { code, stdout, stderr } = await command.output();

      if (commandTimeout) {
        clearTimeout(commandTimeout);
      }

      if (code > 1) {
        if (stderr) {
          throw new Error(new TextDecoder().decode(stderr));
        }

        throw new Error(`Unknown error running "grep"`);
      }

      const output = new TextDecoder().decode(stdout);
      const matchingFiles = output.split('\n').map((filePath) => filePath.trim()).filter(Boolean);

      for (const relativeFilePath of matchingFiles) {
        const stat = await Deno.stat(join(rootPath, relativeFilePath));
        let parentPath = `/${relativeFilePath.replace('./', '/').split('/').slice(0, -1).join('')}/`;
        const fileName = relativeFilePath.split('/').pop()!;

        if (parentPath === '//') {
          parentPath = '/';
        }

        const file: DirectoryFile = {
          user_id: userId,
          parent_path: parentPath,
          file_name: fileName,
          has_write_access: true,
          size_in_bytes: stat.size,
          updated_at: stat.mtime || new Date(),
          created_at: stat.birthtime || new Date(),
        };

        files.push(file);
      }

      return { success: true, files };
    } catch (error) {
      console.error(error);
    }

    return { success: false, files };
  }
}

/**
 * Ensures the user path is valid and securely accessible (meaning it's not trying to access files outside of the user's root directory).
 * Does not check if the path exists.
 *
 * @param userId - The user ID
 * @param path - The relative path (user-provided) to check
 */
export async function ensureUserPathIsValidAndSecurelyAccessible(userId: string, path: string): Promise<void> {
  const userRootPath = join(await AppConfig.getFilesRootPath(), userId, '/');

  const fullPath = join(userRootPath, path);

  const resolvedFullPath = `${resolve(fullPath)}/`;

  if (!resolvedFullPath.startsWith(userRootPath)) {
    throw new Error('Invalid file path');
  }
}

async function getPathEntries(userId: string, path: string): Promise<Deno.DirEntry[]> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

  const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

  // Ensure the user directory exists
  if (path === '/') {
    try {
      await Deno.stat(rootPath);
    } catch (error) {
      if ((error as Error).toString().includes('NotFound')) {
        await Deno.mkdir(join(rootPath, TRASH_PATH), { recursive: true });
      }
    }
  }

  // Ensure the Notes or Photos directories exist, if being requested
  if (path === '/Notes/' || path === '/Photos/') {
    try {
      await Deno.stat(rootPath);
    } catch (error) {
      if ((error as Error).toString().includes('NotFound')) {
        await Deno.mkdir(rootPath, { recursive: true });
      }
    }
  }

  const entries: Deno.DirEntry[] = [];

  for await (const dirEntry of Deno.readDir(rootPath)) {
    entries.push(dirEntry);
  }

  entries.sort(sortEntriesByName);

  return entries;
}

async function renameDirectoryOrFile(
  userId: string,
  oldPath: string,
  newPath: string,
  oldName: string,
  newName: string,
): Promise<boolean> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, join(oldPath, oldName));
  await ensureUserPathIsValidAndSecurelyAccessible(userId, join(newPath, newName));

  const s3Config = await AppConfig.getS3Config();
  if (!s3Config) {
    console.error('S3 configuration is missing. File rename operation aborted.');
    throw new Error('S3 configuration is not available, cannot rename file.');
  }

  const s3Client = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyID,
      secretAccessKey: s3Config.secretAccessKey,
    },
    endpoint: s3Config.endpoint,
  });

  const normalizedOldPath = oldPath.startsWith('/') ? oldPath.substring(1) : oldPath;
  const s3KeyOldPath = normalizedOldPath.endsWith('/') ? normalizedOldPath : `${normalizedOldPath}/`;
  const sourceKey = `users/${userId}/${s3KeyOldPath}${oldName}`;

  const normalizedNewPath = newPath.startsWith('/') ? newPath.substring(1) : newPath;
  const s3KeyNewPath = normalizedNewPath.endsWith('/') ? normalizedNewPath : `${normalizedNewPath}/`;
  const destinationKey = `users/${userId}/${s3KeyNewPath}${newName}`;

  try {
    // Copy the object to the new key
    // Source key needs to be bucket_name/key_name and URL encoded.
    const copySource = encodeURI(`${s3Config.bucket}/${sourceKey}`);
    const copyCommand = new CopyObjectCommand({
      Bucket: s3Config.bucket,
      CopySource: copySource,
      Key: destinationKey,
    });
    await s3Client.send(copyCommand);
    console.info(`Copied ${sourceKey} to ${destinationKey} for rename.`);

    // Delete the original object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: sourceKey,
    });
    await s3Client.send(deleteCommand);
    console.info(`Deleted original ${sourceKey} after copy for rename.`);

    return true;
  } catch (error) {
    console.error(`Error during S3 rename (copy + delete) operation from ${sourceKey} to ${destinationKey}:`, error);
    // It's possible the copy succeeded but delete failed.
    // Or copy failed and delete was never attempted.
    // For simplicity, returning false. Consider more robust error handling or cleanup if needed.
    return false;
  }
}

async function deleteDirectoryOrFile(userId: string, path: string, name: string): Promise<boolean> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

  const s3Config = await AppConfig.getS3Config();
  if (!s3Config) {
    console.error('S3 configuration is missing. File deletion from S3 aborted.');
    throw new Error('S3 configuration is not available, cannot delete file.');
  }

  const s3Client = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyID,
      secretAccessKey: s3Config.secretAccessKey,
    },
    endpoint: s3Config.endpoint,
  });

  const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
  const s3KeyPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
  const sourceKey = `users/${userId}/${s3KeyPath}${name}`;

  try {
    if (path.startsWith(TRASH_PATH)) {
      // Permanently delete from S3 if it's in the trash path
      const deleteCommand = new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: sourceKey,
      });
      await s3Client.send(deleteCommand);
      console.info(`Permanently deleted ${sourceKey} from S3.`);
    } else {
      // Move to S3 trash path
      const trashS3Path = TRASH_PATH.startsWith('/') ? TRASH_PATH.substring(1) : TRASH_PATH;
      const destinationKey = `users/${userId}/${trashS3Path}${name}`;

      // Ensure the destinationKey (especially filename part) is URL encoded if necessary,
      // S3 keys should be. However, AWS SDK typically handles this.
      // For CopySource, it needs to be bucket_name/key_name. Key name should be URL encoded if it contains special characters.
      // The SDK might handle encoding for Key in CopyObjectCommand and DeleteObjectCommand, but CopySource often needs manual encoding if not already.
      // Assuming `name` and `s3KeyPath` are already valid for S3 key construction or appropriately encoded if needed.
      const copySource = encodeURI(`${s3Config.bucket}/${sourceKey}`);

      const copyCommand = new CopyObjectCommand({
        Bucket: s3Config.bucket,
        CopySource: copySource,
        Key: destinationKey,
      });
      await s3Client.send(copyCommand);
      console.info(`Copied ${sourceKey} to ${destinationKey} (S3 trash).`);

      // If copy is successful, delete the original object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: sourceKey,
      });
      await s3Client.send(deleteCommand);
      console.info(`Deleted original ${sourceKey} after moving to S3 trash.`);
    }
    return true;
  } catch (error) {
    console.error(`Error during S3 delete/move-to-trash operation for ${sourceKey}:`, error);
    return false;
  }
}

export async function searchFilesAndDirectories(
  userId: string,
  searchTerm: string,
): Promise<{ success: boolean; directories: Directory[]; files: DirectoryFile[] }> {
  const directoryNamesResult = await DirectoryModel.searchNames(userId, searchTerm);
  const fileNamesResult = await FileModel.searchNames(userId, searchTerm);
  const fileContentsResult = await FileModel.searchContents(userId, searchTerm);

  const success = directoryNamesResult.success && fileNamesResult.success && fileContentsResult.success;

  const directories = [...directoryNamesResult.directories];
  directories.sort(sortDirectoriesByName);

  const files = [...fileNamesResult.files, ...fileContentsResult.files];
  files.sort(sortFilesByName);

  return {
    success,
    directories,
    files,
  };
}
