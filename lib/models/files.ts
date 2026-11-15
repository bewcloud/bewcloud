import { dirname, join, resolve } from '@std/path';
import { lookup } from 'mrmime';
import { Cookie, getCookies, setCookie } from '@std/http';

import { AppConfig } from '/lib/config.ts';
import { Directory, DirectoryFile, FileShare } from '/lib/types.ts';
import {
  bytesFromHumanFileSize,
  sortDirectoriesByName,
  sortEntriesByName,
  sortFilesByName,
  TRASH_PATH,
} from '/public/ts/utils/files.ts';
import Database, { sql } from '/lib/interfaces/database.ts';
import {
  COOKIE_NAME as AUTH_COOKIE_NAME,
  generateKey,
  generateToken,
  JWT_SECRET,
  resolveCookieDomain,
  verifyAuthJwt,
} from '/lib/auth.ts';
import { isRunningLocally } from '/public/ts/utils/misc.ts';

const COOKIE_NAME = `${AUTH_COOKIE_NAME}-file-share`;

const db = new Database();

export class DirectoryModel {
  static async list(userId: string, path: string): Promise<Directory[]> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    const directories: Directory[] = [];

    const directoryEntries = (await getPathEntries(userId, path)).filter((entry) =>
      entry.isDirectory || entry.isSymlink
    );

    const fileShares = (await AppConfig.isPublicFileSharingAllowed())
      ? await FileShareModel.getByParentFilePath(userId, path)
      : [];

    const directorySizes = await getDirectorySizes(directoryEntries.map((entry) => join(rootPath, entry.name)));

    for (const [index, entry] of directoryEntries.entries()) {
      const stat = await Deno.stat(join(rootPath, entry.name));

      const directorySize = directorySizes[index];

      const directory: Directory = {
        user_id: userId,
        parent_path: path,
        directory_name: entry.name,
        has_write_access: true,
        size_in_bytes: directorySize,
        file_share_id: fileShares.find((fileShare) => fileShare.file_path === `${join(path, entry.name)}/`)?.id || null,
        updated_at: stat.mtime || new Date(),
        created_at: stat.birthtime || new Date(),
      };

      directories.push(directory);
    }

    directories.sort(sortDirectoriesByName);
    return directories;
  }

  static async create(userId: string, path: string, name: string): Promise<boolean> {
    try {
      const targetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, path, name);
      await Deno.mkdir(targetPath, { recursive: true });
    } catch (error) {
      if ((error as Error).message !== 'Invalid file path') {
        console.error(error);
      }
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

      const directorySizes = await getDirectorySizes(
        matchingDirectories.map((relativeDirectoryPath) => join(rootPath, relativeDirectoryPath)),
      );

      for (const [index, relativeDirectoryPath] of matchingDirectories.entries()) {
        const fileShares = (await AppConfig.isPublicFileSharingAllowed())
          ? await FileShareModel.getByParentFilePath(userId, relativeDirectoryPath)
          : [];

        const stat = await Deno.stat(join(rootPath, relativeDirectoryPath));
        let parentPath = `/${relativeDirectoryPath.replace('./', '/').split('/').slice(0, -1).join('')}/`;
        const directoryName = relativeDirectoryPath.split('/').pop()!;

        if (parentPath === '//') {
          parentPath = '/';
        }

        const directorySize = directorySizes[index];

        const directory: Directory = {
          user_id: userId,
          parent_path: parentPath,
          directory_name: directoryName,
          has_write_access: true,
          size_in_bytes: directorySize,
          file_share_id: fileShares.find((fileShare) =>
            fileShare.file_path === `${join(relativeDirectoryPath, directoryName)}/`
          )?.id || null,
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

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    const files: DirectoryFile[] = [];

    const fileEntries = (await getPathEntries(userId, path)).filter((entry) => entry.isFile);

    const fileShares = (await AppConfig.isPublicFileSharingAllowed())
      ? await FileShareModel.getByParentFilePath(userId, path)
      : [];

    for (const entry of fileEntries) {
      const stat = await Deno.stat(join(rootPath, entry.name));

      const file: DirectoryFile = {
        user_id: userId,
        parent_path: path,
        file_name: entry.name,
        has_write_access: true,
        size_in_bytes: stat.size,
        file_share_id: fileShares.find((fileShare) => fileShare.file_path === join(path, entry.name))?.id || null,
        updated_at: stat.mtime || new Date(),
        created_at: stat.birthtime || new Date(),
      };

      files.push(file);
    }

    files.sort(sortFilesByName);
    return files;
  }

  static async create(
    userId: string,
    path: string,
    name: string,
    contents: string | ArrayBuffer,
    overwrite = false,
  ): Promise<{ success: boolean; alreadyExists?: boolean }> {
    let targetPath: string;

    try {
      targetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, path, name);
    } catch (error) {
      if ((error as Error).message !== 'Invalid file path') {
        console.error(error);
      }
      return { success: false };
    }

    const rootPath = dirname(targetPath);
    const userRootPath = join(await AppConfig.getFilesRootPath(), userId);

    // An overwrite is written next to the chunked uploads and renamed over the target once complete, so a failed Replace can't truncate the existing file.
    const writePath = overwrite ? join(userRootPath, '.chunk-uploads', crypto.randomUUID()) : targetPath;

    try {
      // Ensure the directory exist, if being requested
      try {
        await Deno.stat(rootPath);
      } catch (error) {
        if ((error as Error).toString().includes('NotFound')) {
          await Deno.mkdir(rootPath, { recursive: true });
        }
      }

      if (overwrite) {
        await Deno.mkdir(join(userRootPath, '.chunk-uploads'), { recursive: true });
      }

      if (typeof contents === 'string') {
        await Deno.writeTextFile(writePath, contents, { append: false, createNew: true });
      } else {
        await Deno.writeFile(writePath, new Uint8Array(contents), { append: false, createNew: true });
      }

      if (overwrite) {
        await Deno.rename(writePath, targetPath);
      }
    } catch (error) {
      console.error(error);

      if (overwrite) {
        await Deno.remove(writePath).catch(() => {});
      }

      return { success: false, alreadyExists: error instanceof Deno.errors.AlreadyExists };
    }

    return { success: true };
  }

  static async update(
    userId: string,
    path: string,
    name: string,
    contents: string,
  ): Promise<boolean> {
    try {
      const targetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, path, name);
      await Deno.writeTextFile(targetPath, contents, { append: false, createNew: false });
    } catch (error) {
      if ((error as Error).message !== 'Invalid file path') {
        console.error(error);
      }
      return false;
    }

    return true;
  }

  static async get(
    userId: string,
    path: string,
    name?: string,
  ): Promise<{ success: boolean; contents?: Uint8Array; contentType?: string; byteSize?: number }> {
    try {
      const targetPath = name
        ? await ensureUserPathIsValidAndSecurelyAccessible(userId, path, name)
        : await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

      const stat = await Deno.stat(targetPath);

      if (stat) {
        const contents = await Deno.readFile(targetPath);

        const extension = (name || path).split('.').slice(-1).join('').toLowerCase();

        const contentType = lookup(extension) || 'application/octet-stream';

        return {
          success: true,
          contents,
          contentType,
          byteSize: stat.size,
        };
      }
    } catch (error) {
      if ((error as Error).message !== 'Invalid file path') {
        console.error(error);
      }
    }

    return {
      success: false,
    };
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
        const fileShares = (await AppConfig.isPublicFileSharingAllowed())
          ? await FileShareModel.getByParentFilePath(userId, relativeFilePath)
          : [];

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
          file_share_id: fileShares.find((fileShare) => fileShare.file_path === join(relativeFilePath, fileName))?.id ||
            null,
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
        const fileShares = (await AppConfig.isPublicFileSharingAllowed())
          ? await FileShareModel.getByParentFilePath(userId, relativeFilePath)
          : [];

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
          file_share_id: fileShares.find((fileShare) => fileShare.file_path === join(relativeFilePath, fileName))?.id ||
            null,
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

export interface FileShareJwtData {
  data: {
    file_share_id: string;
    hashed_password: string;
  };
}

export class FileShareModel {
  static async getById(id: string): Promise<FileShare | null> {
    const fileShare = (await db.query<FileShare>(sql`SELECT * FROM "bewcloud_file_shares" WHERE "id" = $1 LIMIT 1`, [
      id,
    ]))[0];

    return fileShare;
  }

  static async getByParentFilePath(userId: string, parentFilePath: string): Promise<FileShare[]> {
    const fileShares = await db.query<FileShare>(
      sql`SELECT * FROM "bewcloud_file_shares" WHERE "user_id" = $1 AND "file_path" LIKE $2`,
      [userId, `${parentFilePath}%`],
    );

    return fileShares;
  }

  static async create(fileShare: Omit<FileShare, 'id' | 'created_at'>): Promise<FileShare> {
    const newFileShare = (await db.query<FileShare>(
      sql`INSERT INTO "bewcloud_file_shares" (
        "user_id",
        "file_path",
        "extra"
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [
        fileShare.user_id,
        fileShare.file_path,
        JSON.stringify(fileShare.extra),
      ],
    ))[0];

    return newFileShare;
  }

  static async update(fileShare: FileShare): Promise<void> {
    await db.query(
      sql`UPDATE "bewcloud_file_shares" SET "extra" = $2 WHERE "id" = $1`,
      [fileShare.id, JSON.stringify(fileShare.extra)],
    );
  }

  static async delete(fileShareId: string): Promise<void> {
    await db.query(
      sql`DELETE FROM "bewcloud_file_shares" WHERE "id" = $1`,
      [fileShareId],
    );
  }

  static async createSessionCookie(
    request: Request,
    response: Response,
    fileShareId: string,
    hashedPassword: string,
  ) {
    const token = await generateToken<FileShareJwtData['data']>({
      file_share_id: fileShareId,
      hashed_password: hashedPassword,
    });

    const cookie: Cookie = {
      name: COOKIE_NAME,
      value: token,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      path: `/file-share/${fileShareId}`,
      secure: isRunningLocally(request) ? false : true,
      httpOnly: true,
      sameSite: 'Lax',
      domain: await resolveCookieDomain(request),
    };

    if (await AppConfig.isCookieDomainSecurityDisabled()) {
      delete cookie.domain;
    }

    setCookie(response.headers, cookie);

    return response;
  }

  static async getDataFromRequest(request: Request): Promise<{ fileShareId: string; hashedPassword: string } | null> {
    const cookies = getCookies(request.headers);

    if (cookies[COOKIE_NAME]) {
      const result = await this.getDataFromCookie(cookies[COOKIE_NAME]);

      if (result) {
        return result;
      }
    }

    return null;
  }

  private static async getDataFromCookie(
    cookieValue: string,
  ): Promise<{ fileShareId: string; hashedPassword: string } | null> {
    if (!cookieValue) {
      return null;
    }

    const key = await generateKey(JWT_SECRET);

    try {
      const token = await verifyAuthJwt<FileShareJwtData>(key, cookieValue);

      if (!token.data.file_share_id || !token.data.hashed_password) {
        throw new Error('Not Found');
      }

      return { fileShareId: token.data.file_share_id, hashedPassword: token.data.hashed_password };
    } catch (error) {
      console.error(error);
    }

    return null;
  }
}

/**
 * Ensures the user path is valid and securely accessible (meaning it's not trying to access files outside of the user's root directory).
 * Does not check if the path exists.
 *
 * Segments are joined onto the user root in one step. Joining them first collapses `..` against `/` and the check then looks at a different path than the filesystem call.
 *
 * @param userId - The user ID
 * @param pathSegments - Path segments relative to the user's root
 * @returns The resolved absolute path
 */
export async function ensureUserPathIsValidAndSecurelyAccessible(
  userId: string,
  ...pathSegments: string[]
): Promise<string> {
  const userRootPath = resolve(join(await AppConfig.getFilesRootPath(), userId));
  const fullPath = resolve(join(userRootPath, ...pathSegments));

  // Normalize path separators for consistent comparison on Windows
  const normalizedUserRootPath = `${userRootPath.replaceAll('\\', '/')}/`;
  const normalizedFullPath = `${fullPath.replaceAll('\\', '/')}/`;

  if (!normalizedFullPath.startsWith(normalizedUserRootPath)) {
    throw new Error('Invalid file path');
  }

  return fullPath;
}

/**
 * Ensures the file share path is valid and securely accessible (meaning it's not trying to access files outside of the file share's root directory).
 * Does not check if the path exists.
 *
 * @param userId - The user ID
 * @param fileSharePath - The file share path
 * @param pathSegments - Path segments relative to the file share, joined onto it in one step
 */
export async function ensureFileSharePathIsValidAndSecurelyAccessible(
  userId: string,
  fileSharePath: string,
  ...pathSegments: string[]
): Promise<void> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, fileSharePath);

  const fileShareRootPath = resolve(join(await AppConfig.getFilesRootPath(), userId, fileSharePath));
  const fullPath = resolve(join(fileShareRootPath, ...pathSegments));

  // Normalize path separators for consistent comparison on Windows
  const normalizedFileShareRootPath = fileShareRootPath.replaceAll('\\', '/');
  const normalizedFullPath = fullPath.replaceAll('\\', '/');

  if (fileSharePath.endsWith('/')) {
    const sharePrefix = normalizedFileShareRootPath.endsWith('/')
      ? normalizedFileShareRootPath
      : `${normalizedFileShareRootPath}/`;

    if (!`${normalizedFullPath}/`.startsWith(sharePrefix)) {
      throw new Error('Invalid file path');
    }

    return;
  }

  if (normalizedFullPath !== normalizedFileShareRootPath) {
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
  try {
    const oldTargetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, oldPath, oldName);
    const newTargetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, newPath, newName);
    await Deno.rename(oldTargetPath, newTargetPath);
  } catch (error) {
    if ((error as Error).message !== 'Invalid file path') {
      console.error(error);
    }
    return false;
  }

  return true;
}

async function deleteDirectoryOrFile(userId: string, path: string, name: string): Promise<boolean> {
  let targetPath: string;

  try {
    targetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, path, name);
  } catch (error) {
    if ((error as Error).message !== 'Invalid file path') {
      console.error(error);
    }
    return false;
  }

  const fileShares = (await AppConfig.isPublicFileSharingAllowed())
    ? await FileShareModel.getByParentFilePath(userId, path)
    : [];

  const fileSharesForPath = fileShares.filter((fileShare) =>
    fileShare.file_path === `${join(path, name)}/` || fileShare.file_path === join(path, name)
  );

  try {
    if (path.startsWith(TRASH_PATH)) {
      await Deno.remove(targetPath, { recursive: true });
    } else {
      const trashTargetPath = await ensureUserPathIsValidAndSecurelyAccessible(userId, TRASH_PATH, name);
      await Deno.rename(targetPath, trashTargetPath);
    }

    // Delete all file shares for this path
    for (const fileShare of fileSharesForPath) {
      await FileShareModel.delete(fileShare.id);
    }
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
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

export async function getPathInfo(userId: string, path: string): Promise<{ isDirectory: boolean; isFile: boolean }> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, path);

  const rootPath = join(await AppConfig.getFilesRootPath(), userId);

  const stat = await Deno.stat(join(rootPath, path));

  return {
    isDirectory: stat.isDirectory,
    isFile: stat.isFile,
  };
}

async function getDirectorySizeFallback(path: string, signal: AbortSignal): Promise<number> {
  let totalSize = 0;
  try {
    for await (const entry of Deno.readDir(path)) {
      signal.throwIfAborted();
      const entryPath = join(path, entry.name);
      const stat = await Deno.lstat(entryPath);
      if (stat.isDirectory) {
        totalSize += await getDirectorySizeFallback(entryPath, signal);
      } else {
        totalSize += stat.size;
      }
    }
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    console.error(error);
  }
  return totalSize;
}

const DIRECTORY_SIZE_WAIT_IN_MILLISECONDS = 1_000;
const DIRECTORY_SIZE_TIMEOUT_IN_MILLISECONDS = 5 * 60_000;
const SLOW_DIRECTORY_SIZE_MAX_AGE_IN_MILLISECONDS = 10 * 60_000;
const MAX_RUNNING_DIRECTORY_SIZES = 8;
const MAX_CACHED_DIRECTORY_SIZES = 1_000;

// NOTE: We're using `-h` (human readable) and parsing the output because that's more stable than `-B 1B` across different systems for a reliable byte size.
async function calculateDirectorySizeWithDu(path: string, signal: AbortSignal): Promise<number> {
  let output: Deno.CommandOutput;

  try {
    // Listings include directory symlinks; -H sizes their targets without following links inside the tree.
    output = await new Deno.Command(`du`, { args: [`-shH`, path], signal }).output();
  } catch (error) {
    // Only walk the tree when "du" isn't installed (looking at Windows, non WSL, mostly), as it's much slower than "du"
    if (error instanceof Deno.errors.NotFound) {
      return getDirectorySizeFallback(path, signal);
    }

    throw error;
  }

  signal.throwIfAborted();

  const value = new TextDecoder().decode(output.stdout).split('\t')[0].trim();

  if (output.code !== 0) {
    const error = new Error(new TextDecoder().decode(output.stderr) || `"du" exited with code ${output.code}`);

    if (!value) {
      throw error;
    }

    // "du" still prints the size of what it could read, e.g. past an unreadable subdirectory
    console.error(error);
  }

  const number = Number.parseFloat(value.match(/\d+(\.\d+)?/)?.[0] || '0');
  const unit = value.match(/[A-Z]+/)?.[0] || 'B'.toUpperCase();

  return bytesFromHumanFileSize(`${number} ${unit}B`);
}

// Null only when it took too long, so a failure doesn't sort as the biggest directory or zip as a big one
async function calculateDirectorySize(path: string): Promise<number | null> {
  const controller = new AbortController();
  const commandTimeout = setTimeout(() => controller.abort(), DIRECTORY_SIZE_TIMEOUT_IN_MILLISECONDS);

  try {
    return await calculateDirectorySizeWithDu(path, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return null;
    }

    console.error(error);
    return 0;
  } finally {
    clearTimeout(commandTimeout);
  }
}

interface CachedDirectorySize {
  sizeInBytes: number;
  calculatedAt: number;
}

// Only slow directories are cached, so fast ones stay current after uploads/deletes
const cachedDirectorySizes = new Map<string, CachedDirectorySize>();
const directorySizesInProgress = new Map<string, Promise<number | null>>();

// Evicts the oldest measurement, so paths that are renamed, deleted or never listed again don't stay in memory
export function cacheDirectorySize(path: string, sizeInBytes: number) {
  cachedDirectorySizes.delete(path);
  cachedDirectorySizes.set(path, { sizeInBytes, calculatedAt: Date.now() });

  if (cachedDirectorySizes.size > MAX_CACHED_DIRECTORY_SIZES) {
    const [oldestPath] = cachedDirectorySizes.keys();
    cachedDirectorySizes.delete(oldestPath);
  }
}

// Null once too many are running, since each one keeps going after its listing stops waiting
function startCalculatingDirectorySize(path: string): Promise<number | null> | null {
  const inProgress = directorySizesInProgress.get(path);

  if (inProgress) {
    return inProgress;
  }

  if (directorySizesInProgress.size >= MAX_RUNNING_DIRECTORY_SIZES) {
    return null;
  }

  const calculation = (async () => {
    const startedAt = Date.now();

    try {
      const sizeInBytes = await calculateDirectorySize(path);

      if (sizeInBytes !== null) {
        if (Date.now() - startedAt >= DIRECTORY_SIZE_WAIT_IN_MILLISECONDS) {
          cacheDirectorySize(path, sizeInBytes);
        } else {
          cachedDirectorySizes.delete(path);
        }
      }

      return sizeInBytes;
    } finally {
      directorySizesInProgress.delete(path);
    }
  })();

  directorySizesInProgress.set(path, calculation);

  return calculation;
}

/**
 * Gets the size of a directory, or its last known size (or null) if "du" takes too long, in which case it continues in the background, or if too many are already running.
 *
 * @param path - The full path of the directory
 */
export async function getDirectorySize(path: string): Promise<number | null> {
  const cached = cachedDirectorySizes.get(path);

  if (cached && Date.now() - cached.calculatedAt < SLOW_DIRECTORY_SIZE_MAX_AGE_IN_MILLISECONDS) {
    return cached.sizeInBytes;
  }

  const calculation = startCalculatingDirectorySize(path);

  if (!calculation) {
    return cached?.sizeInBytes ?? null;
  }

  const wait = Promise.withResolvers<undefined>();
  const waitTimeout = setTimeout(() => wait.resolve(undefined), DIRECTORY_SIZE_WAIT_IN_MILLISECONDS);

  const sizeInBytes = await Promise.race([calculation, wait.promise]);

  clearTimeout(waitTimeout);

  if (sizeInBytes === undefined) {
    return cached?.sizeInBytes ?? null;
  }

  return sizeInBytes;
}

// A few at a time, since a directory can have hundreds of subdirectories, each spawning "du"
export async function getDirectorySizes(paths: string[]): Promise<(number | null)[]> {
  const directorySizes: (number | null)[] = [];
  let nextIndex = 0;

  async function sizeRemainingPaths() {
    for (let index = nextIndex++; index < paths.length; index = nextIndex++) {
      directorySizes[index] = await getDirectorySize(paths[index]);
    }
  }

  await Promise.all(Array.from({ length: MAX_RUNNING_DIRECTORY_SIZES }, sizeRemainingPaths));

  return directorySizes;
}

// -1 (fastest compression) trades compression ratio for CPU time, so only use it once the content is big enough for that to matter
const FAST_ZIP_COMPRESSION_MIN_SIZE_IN_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Builds a Content-Disposition header value for downloading a file with the given name.
 * Header values can't contain non-Latin-1 characters, so the real name is sent via RFC 6266's `filename*`, with an ASCII-only `filename` fallback.
 */
export function getAttachmentContentDisposition(fileName: string): string {
  const asciiFileName = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
}

/**
 * Streams a zip archive of the given files and directories (added recursively) to the client, instead of buffering the whole archive in memory.
 *
 * @param request - The request being responded to, so `zip` is stopped if the client disconnects
 * @param workingDirectoryPath - The full, already validated, path that `entryNames` are relative to
 * @param entryNames - The names of the files and directories to add to the archive, relative to `workingDirectoryPath`
 * @param sizeInBytes - The total size of the entries, or null if it's unknown
 * @param archiveFileName - The file name of the archive, as the client should save it
 */
export function createZipArchiveResponse(
  { request, workingDirectoryPath, entryNames, sizeInBytes, archiveFileName }: {
    request: Request;
    workingDirectoryPath: string;
    entryNames: string[];
    sizeInBytes: number | null;
    archiveFileName: string;
  },
): Response {
  // An unknown size means it could not be calculated quickly, so the content is likely big
  const compressionArgs = sizeInBytes === null || sizeInBytes > FAST_ZIP_COMPRESSION_MIN_SIZE_IN_BYTES ? ['-1'] : [];

  // Use the zip command to create the archive, streaming its stdout straight to the client.
  // "-nw" stops zip from expanding wildcards in names (like "[1].jpg"), and "--" from treating names starting with "-" as options.
  let child: Deno.ChildProcess;
  try {
    child = new Deno.Command('zip', {
      args: ['-r', '-nw', ...compressionArgs, '-', '--', ...entryNames],
      cwd: workingDirectoryPath,
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
  const stderrPromise = consumeStderr();

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
        const [status] = await Promise.all([child.status, stderrPromise]);

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
      'content-disposition': getAttachmentContentDisposition(archiveFileName),
      'cache-control': 'no-cache, no-store, must-revalidate',
    },
  });
}
