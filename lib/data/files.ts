import { join } from 'std/path/join.ts';

// import Database, { sql } from '/lib/interfaces/database.ts';
import { getFilesRootPath } from '/lib/config.ts';
import { Directory, DirectoryFile, FileShare } from '/lib/types.ts';
import { sortDirectoriesByName, sortEntriesByName, sortFilesByName, TRASH_PATH } from '/lib/utils/files.ts';

// const db = new Database();

export async function getDirectories(userId: string, path: string): Promise<Directory[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

  // const directoryShares = await db.query<FileShare>(sql`SELECT * FROM "bewcloud_file_shares"
  //   WHERE "parent_path" = $2
  //   AND "type" = 'directory'
  //   AND (
  //     "owner_user_id" = $1
  //     OR ANY("user_ids_with_read_access") = $1
  //     OR ANY("user_ids_with_write_access") = $1
  //     )`, [
  //   userId,
  //   path,
  // ]);

  const directoryShares: FileShare[] = [];

  // TODO: Remove this mock test
  if (path === '/') {
    directoryShares.push({
      id: 'test-ing-123',
      owner_user_id: userId,
      parent_path: '/',
      name: 'Testing',
      type: 'directory',
      user_ids_with_read_access: [],
      user_ids_with_write_access: [],
      extra: {
        read_share_links: [],
        write_share_links: [],
      },
      updated_at: new Date('2024-04-01'),
      created_at: new Date('2024-03-31'),
    });
  }

  const directories: Directory[] = [];

  const directoryEntries = (await getPathEntries(userId, path)).filter((entry) => entry.isDirectory);

  for (const entry of directoryEntries) {
    const stat = await Deno.stat(join(rootPath, entry.name));

    const directory: Directory = {
      owner_user_id: userId,
      parent_path: path,
      directory_name: entry.name,
      has_write_access: true,
      file_share: directoryShares.find((share) =>
        share.owner_user_id === userId && share.parent_path === path && share.name === entry.name
      ),
      size_in_bytes: stat.size,
      updated_at: stat.mtime || new Date(),
      created_at: stat.birthtime || new Date(),
    };

    directories.push(directory);
  }

  // TODO: Add directoryShares that aren't owned by this user

  directories.sort(sortDirectoriesByName);

  return directories;
}

export async function getFiles(userId: string, path: string): Promise<DirectoryFile[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

  // const fileShares = await db.query<FileShare>(sql`SELECT * FROM "bewcloud_file_shares"
  //   WHERE "parent_path" = $2
  //   AND "type" = 'file'
  //   AND (
  //     "owner_user_id" = $1
  //     OR ANY("user_ids_with_read_access") = $1
  //     OR ANY("user_ids_with_write_access") = $1
  //     )`, [
  //   userId,
  //   path,
  // ]);

  const fileShares: FileShare[] = [];

  const files: DirectoryFile[] = [];

  const fileEntries = (await getPathEntries(userId, path)).filter((entry) => entry.isFile);

  for (const entry of fileEntries) {
    const stat = await Deno.stat(join(rootPath, entry.name));

    const file: DirectoryFile = {
      owner_user_id: userId,
      parent_path: path,
      file_name: entry.name,
      has_write_access: true,
      file_share: fileShares.find((share) =>
        share.owner_user_id === userId && share.parent_path === path && share.name === entry.name
      ),
      size_in_bytes: stat.size,
      updated_at: stat.mtime || new Date(),
      created_at: stat.birthtime || new Date(),
    };

    files.push(file);
  }

  // TODO: Add fileShares that aren't owned by this user

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

    // TODO: Update any matching file shares
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

      // TODO: Delete any matching file shares
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
  const rootPath = `${getFilesRootPath()}/${userId}${path}`;

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
  name: string,
): Promise<{ success: boolean; contents?: Uint8Array; contentType?: string }> {
  const rootPath = `${getFilesRootPath()}/${userId}${path}`;

  try {
    const contents = await Deno.readFile(join(rootPath, name));

    let contentType = 'application/octet-stream';

    // NOTE: Detecting based on extension is not accurate, but installing a dependency like `npm:file-types` just for this seems unnecessary
    const extension = name.split('.').slice(-1).join('').toLowerCase();

    if (extension === 'jpg' || extension === 'jpeg') {
      contentType = 'image/jpeg';
    } else if (extension === 'png') {
      contentType = 'image/png';
    } else if (extension === 'pdf') {
      contentType = 'application/pdf';
    } else if (extension === 'txt' || extension === 'md') {
      contentType = 'text/plain';
    }

    return {
      success: true,
      contents,
      contentType,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
    };
  }
}
