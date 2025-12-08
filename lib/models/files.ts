import { join, resolve } from '@std/path';
import { lookup } from 'mrmime';
import { Cookie, getCookies, setCookie } from '@std/http';

import { AppConfig } from '/lib/config.ts';
import { Directory, DirectoryFile, FileShare } from '/lib/types.ts';
import { sortDirectoriesByName, sortEntriesByName, sortFilesByName, TRASH_PATH } from '/lib/utils/files.ts';
import Database, { sql } from '/lib/interfaces/database.ts';
import {
  COOKIE_NAME as AUTH_COOKIE_NAME,
  generateKey,
  generateToken,
  JWT_SECRET,
  resolveCookieDomain,
  verifyAuthJwt,
} from '/lib/auth.ts';
import { isRunningLocally } from '/lib/utils/misc.ts';

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

    for (const entry of directoryEntries) {
      const stat = await Deno.stat(join(rootPath, entry.name));

      const directory: Directory = {
        user_id: userId,
        parent_path: path,
        directory_name: entry.name,
        has_write_access: true,
        size_in_bytes: stat.size,
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
        const fileShares = (await AppConfig.isPublicFileSharingAllowed())
          ? await FileShareModel.getByParentFilePath(userId, relativeDirectoryPath)
          : [];

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
  ): Promise<boolean> {
    await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    try {
      // Ensure the directory exist, if being requested
      try {
        await Deno.stat(rootPath);
      } catch (error) {
        if ((error as Error).toString().includes('NotFound')) {
          await Deno.mkdir(rootPath, { recursive: true });
        }
      }

      if (typeof contents === 'string') {
        await Deno.writeTextFile(join(rootPath, name), contents, { append: false, createNew: true });
      } else {
        await Deno.writeFile(join(rootPath, name), new Uint8Array(contents), { append: false, createNew: true });
      }
    } catch (error) {
      console.error(error);
      return false;
    }

    return true;
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

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    try {
      const stat = await Deno.stat(join(rootPath, name || ''));

      if (stat) {
        const contents = await Deno.readFile(join(rootPath, name || ''));

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
      console.error(error);
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
 * @param userId - The user ID
 * @param path - The relative path (user-provided) to check
 */
export async function ensureUserPathIsValidAndSecurelyAccessible(userId: string, path: string): Promise<void> {
  const userRootPath = join(await AppConfig.getFilesRootPath(), userId, '/');

  const fullPath = join(userRootPath, path);

  const resolvedFullPath = `${resolve(fullPath)}/`;

  // Normalize path separators for consistent comparison on Windows
  const normalizedUserRootPath = userRootPath.replaceAll('\\', '/');
  const normalizedResolvedFullPath = resolvedFullPath.replaceAll('\\', '/');

  if (!normalizedResolvedFullPath.startsWith(normalizedUserRootPath)) {
    throw new Error('Invalid file path');
  }
}

/**
 * Ensures the file share path is valid and securely accessible (meaning it's not trying to access files outside of the file share's root directory).
 * Does not check if the path exists.
 *
 * @param userId - The user ID
 * @param fileSharePath - The file share path
 * @param path - The relative path (user-provided) to check
 */
export async function ensureFileSharePathIsValidAndSecurelyAccessible(
  userId: string,
  fileSharePath: string,
  path: string,
): Promise<void> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, fileSharePath);

  const userRootPath = join(await AppConfig.getFilesRootPath(), userId, '/');

  const fileShareRootPath = join(userRootPath, fileSharePath);

  const fullPath = join(fileShareRootPath, path);

  const resolvedFullPath = `${resolve(fullPath)}/`;

  if (!resolvedFullPath.startsWith(fileShareRootPath)) {
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

  const oldRootPath = join(await AppConfig.getFilesRootPath(), userId, oldPath);
  const newRootPath = join(await AppConfig.getFilesRootPath(), userId, newPath);

  try {
    await Deno.rename(join(oldRootPath, oldName), join(newRootPath, newName));
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

async function deleteDirectoryOrFile(userId: string, path: string, name: string): Promise<boolean> {
  await ensureUserPathIsValidAndSecurelyAccessible(userId, join(path, name));

  const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

  const fileShares = (await AppConfig.isPublicFileSharingAllowed())
    ? await FileShareModel.getByParentFilePath(userId, path)
    : [];

  const fileSharesForPath = fileShares.filter((fileShare) =>
    fileShare.file_path === `${join(path, name)}/` || fileShare.file_path === join(path, name)
  );

  try {
    if (path.startsWith(TRASH_PATH)) {
      await Deno.remove(join(rootPath, name), { recursive: true });
    } else {
      const trashPath = join(await AppConfig.getFilesRootPath(), userId, TRASH_PATH);
      await Deno.rename(join(rootPath, name), join(trashPath, name));
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
