import { join } from 'std/path/join.ts';
import { resolve } from 'std/path/resolve.ts';
import { lookup } from 'mrmime';

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

    const rootPath = join(await AppConfig.getFilesRootPath(), userId, path);

    const files: DirectoryFile[] = [];

    const fileEntries = (await getPathEntries(userId, path)).filter((entry) => entry.isFile);

    for (const entry of fileEntries) {
      const stat = await Deno.stat(join(rootPath, entry.name));

      const file: DirectoryFile = {
        user_id: userId,
        parent_path: path,
        file_name: entry.name,
        has_write_access: true,
        size_in_bytes: stat.size,
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

  try {
    if (path.startsWith(TRASH_PATH)) {
      await Deno.remove(join(rootPath, name), { recursive: true });
    } else {
      const trashPath = join(await AppConfig.getFilesRootPath(), userId, TRASH_PATH);
      await Deno.rename(join(rootPath, name), join(trashPath, name));
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
