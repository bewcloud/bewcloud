import { join } from 'std/path/join.ts';
import { lookup } from 'mrmime';

import { getFilesRootPath } from '/lib/config.ts';
import { Directory, DirectoryFile } from '/lib/types.ts';
import { sortDirectoriesByName, sortEntriesByName, sortFilesByName, TRASH_PATH } from '/lib/utils/files.ts';

export async function getDirectories(userId: string, path: string): Promise<Directory[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

  const directories: Directory[] = [];

  const directoryEntries = (await getPathEntries(userId, path)).filter((entry) => entry.isDirectory || entry.isSymlink);

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

export async function getFiles(userId: string, path: string): Promise<DirectoryFile[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

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

async function getPathEntries(userId: string, path: string): Promise<Deno.DirEntry[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

  // Ensure the user directory exists
  if (path === '/') {
    try {
      await Deno.stat(rootPath);
    } catch (error) {
      if (error.toString().includes('NotFound')) {
        await Deno.mkdir(join(rootPath, TRASH_PATH), { recursive: true });
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

export async function createDirectory(userId: string, path: string, name: string): Promise<boolean> {
  const rootPath = join(getFilesRootPath(), userId, path);

  try {
    await Deno.mkdir(join(rootPath, name), { recursive: true });
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

export async function renameDirectoryOrFile(
  userId: string,
  oldPath: string,
  newPath: string,
  oldName: string,
  newName: string,
): Promise<boolean> {
  const oldRootPath = join(getFilesRootPath(), userId, oldPath);
  const newRootPath = join(getFilesRootPath(), userId, newPath);

  try {
    await Deno.rename(join(oldRootPath, oldName), join(newRootPath, newName));
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

export async function deleteDirectoryOrFile(userId: string, path: string, name: string): Promise<boolean> {
  const rootPath = join(getFilesRootPath(), userId, path);

  try {
    if (path.startsWith(TRASH_PATH)) {
      await Deno.remove(join(rootPath, name), { recursive: true });
    } else {
      const trashPath = join(getFilesRootPath(), userId, TRASH_PATH);
      await Deno.rename(join(rootPath, name), join(trashPath, name));
    }
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

export async function createFile(
  userId: string,
  path: string,
  name: string,
  contents: string | ArrayBuffer,
): Promise<boolean> {
  const rootPath = join(getFilesRootPath(), userId, path);

  try {
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

export async function getFile(
  userId: string,
  path: string,
  name?: string,
): Promise<{ success: boolean; contents?: Uint8Array; contentType?: string; byteSize?: number }> {
  const rootPath = join(getFilesRootPath(), userId, path);

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

export async function searchFilesAndDirectories(
  userId: string,
  searchTerm: string,
): Promise<{ success: boolean; directories: Directory[]; files: DirectoryFile[] }> {
  const directoryNamesResult = await searchDirectoryNames(userId, searchTerm);
  const fileNamesResult = await searchFileNames(userId, searchTerm);
  const fileContentsResult = await searchFileContents(userId, searchTerm);

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

async function searchDirectoryNames(
  userId: string,
  searchTerm: string,
): Promise<{ success: boolean; directories: Directory[] }> {
  const rootPath = join(getFilesRootPath(), userId);

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

async function searchFileNames(
  userId: string,
  searchTerm: string,
): Promise<{ success: boolean; files: DirectoryFile[] }> {
  const rootPath = join(getFilesRootPath(), userId);

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

async function searchFileContents(
  userId: string,
  searchTerm: string,
): Promise<{ success: boolean; files: DirectoryFile[] }> {
  const rootPath = join(getFilesRootPath(), userId);

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
