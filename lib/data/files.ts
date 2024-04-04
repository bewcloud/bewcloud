import { join } from 'std/path/join.ts';

import Database, { sql } from '/lib/interfaces/database.ts';
import { getFilesRootPath } from '/lib/config.ts';
import { Directory, DirectoryFile, FileShare, FileShareLink } from '/lib/types.ts';
import { sortDirectoriesByName, sortEntriesByName, sortFilesByName, TRASH_PATH } from '/lib/utils/files.ts';

const db = new Database();

export async function getDirectories(userId: string, path: string): Promise<Directory[]> {
  const rootPath = join(getFilesRootPath(), userId, path);

  const directoryShares = await db.query<FileShare>(
    sql`SELECT * FROM "bewcloud_file_shares"
    WHERE "parent_path" = $2
    AND "type" = 'directory'
    AND (
      "owner_user_id" = $1
      OR ANY("user_ids_with_read_access") = $1
      OR ANY("user_ids_with_write_access") = $1
    )`,
    [
      userId,
      path,
    ],
  );

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

  // Add directoryShares that aren't owned by this user
  const foreignDirectoryShares = directoryShares.filter((directoryShare) => directoryShare.owner_user_id !== userId);
  for (const share of foreignDirectoryShares) {
    const stat = await Deno.stat(join(getFilesRootPath(), share.owner_user_id, path, share.name));

    const hasWriteAccess = share.user_ids_with_write_access.includes(userId);

    const directory: Directory = {
      owner_user_id: share.owner_user_id,
      parent_path: path,
      directory_name: share.name,
      has_write_access: hasWriteAccess,
      file_share: share,
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

  const fileShares = await db.query<FileShare>(
    sql`SELECT * FROM "bewcloud_file_shares"
    WHERE "parent_path" = $2
    AND "type" = 'file'
    AND (
      "owner_user_id" = $1
      OR ANY("user_ids_with_read_access") = $1
      OR ANY("user_ids_with_write_access") = $1
    )`,
    [
      userId,
      path,
    ],
  );

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

  // Add fileShares that aren't owned by this user
  const foreignFileShares = fileShares.filter((fileShare) => fileShare.owner_user_id !== userId);
  for (const share of foreignFileShares) {
    const stat = await Deno.stat(join(getFilesRootPath(), share.owner_user_id, path, share.name));

    const hasWriteAccess = share.user_ids_with_write_access.includes(userId);

    const file: DirectoryFile = {
      owner_user_id: share.owner_user_id,
      parent_path: path,
      file_name: share.name,
      has_write_access: hasWriteAccess,
      file_share: share,
      size_in_bytes: stat.size,
      updated_at: stat.mtime || new Date(),
      created_at: stat.birthtime || new Date(),
    };

    files.push(file);
  }

  // TODO: Check fileshare directories and list files from there too

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

    // Update any matching file shares
    await db.query<FileShare>(
      sql`UPDATE "bewcloud_file_shares" SET
      "parent_path" = $4,
      "name" = $5
      WHERE "parent_path" = $2
      AND "name" = $3
      AND "owner_user_id" = $1`,
      [
        userId,
        oldPath,
        oldName,
        newPath,
        newName,
      ],
    );
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

      // Delete any matching file shares
      await db.query<FileShare>(
        sql`DELETE FROM "bewcloud_file_shares"
        WHERE "parent_path" = $2
        AND "name" = $3
        AND "owner_user_id" = $1`,
        [
          userId,
          path,
          name,
        ],
      );
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

export async function createFileShare(
  userId: string,
  path: string,
  name: string,
  type: 'directory' | 'file',
  userIdsWithReadAccess: string[],
  userIdsWithWriteAccess: string[],
  readShareLinks: FileShareLink[],
  writeShareLinks: FileShareLink[],
): Promise<FileShare> {
  const extra: FileShare['extra'] = {
    read_share_links: readShareLinks,
    write_share_links: writeShareLinks,
  };

  const newFileShare = (await db.query<FileShare>(
    sql`INSERT INTO "bewcloud_file_shares" (
      "owner_user_id",
      "owner_parent_path",
      "parent_path",
      "name",
      "type",
      "user_ids_with_read_access",
      "user_ids_with_write_access",
      "extra"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      userId,
      path,
      '/',
      name,
      type,
      userIdsWithReadAccess,
      userIdsWithWriteAccess,
      JSON.stringify(extra),
    ],
  ))[0];

  return newFileShare;
}

export async function updateFileShare(fileShare: FileShare) {
  await db.query(
    sql`UPDATE "bewcloud_file_shares" SET
      "owner_parent_path" = $2,
      "parent_path" = $3,
      "name" = $4,
      "user_ids_with_read_access" = $5,
      "user_ids_with_write_access" = $6,
      "extra" = $7
    WHERE "id" = $1`,
    [
      fileShare.id,
      fileShare.owner_parent_path,
      fileShare.parent_path,
      fileShare.name,
      fileShare.user_ids_with_read_access,
      fileShare.user_ids_with_write_access,
      JSON.stringify(fileShare.extra),
    ],
  );
}

export async function getDirectoryAccess(
  userId: string,
  parentPath: string,
  name?: string,
): Promise<{ hasReadAccess: boolean; hasWriteAccess: boolean; ownerUserId: string; ownerParentPath: string }> {
  const rootPath = join(getFilesRootPath(), userId, parentPath, name || '');

  // If it exists in the correct filesystem path, it's the user's
  try {
    await Deno.stat(rootPath);

    return { hasReadAccess: true, hasWriteAccess: true, ownerUserId: userId, ownerParentPath: parentPath };
  } catch (error) {
    console.error(error);
  }

  // Otherwise check if it's been shared with them
  const parentPaths: string[] = [];
  let nextParentPath: string | null = rootPath;

  while (nextParentPath !== null) {
    parentPaths.push(nextParentPath);

    nextParentPath = `/${nextParentPath.split('/').filter(Boolean).slice(0, -1).join('/')}`;

    if (nextParentPath === '/') {
      parentPaths.push(nextParentPath);
      nextParentPath = null;
    }
  }

  const fileShare = (await db.query<FileShare>(
    sql`SELECT * FROM "bewcloud_file_shares"
    WHERE "parent_path" = ANY($2)
    AND "name" = $3
    AND "type" = 'directory'
    AND (
      ANY("user_ids_with_read_access") = $1
      OR ANY("user_ids_with_write_access") = $1
    )
    ORDER BY "parent_path" ASC
    LIMIT 1`,
    [
      userId,
      parentPaths,
      name,
    ],
  ))[0];

  if (fileShare) {
    return {
      hasReadAccess: fileShare.user_ids_with_read_access.includes(userId) ||
        fileShare.user_ids_with_write_access.includes(userId),
      hasWriteAccess: fileShare.user_ids_with_write_access.includes(userId),
      ownerUserId: fileShare.owner_user_id,
      ownerParentPath: fileShare.owner_parent_path,
    };
  }

  return { hasReadAccess: false, hasWriteAccess: false, ownerUserId: userId, ownerParentPath: parentPath };
}

export async function getFileAccess(
  userId: string,
  parentPath: string,
  name: string,
): Promise<{ hasReadAccess: boolean; hasWriteAccess: boolean; ownerUserId: string; ownerParentPath: string }> {
  const rootPath = join(getFilesRootPath(), userId, parentPath, name);

  // If it exists in the correct filesystem path, it's the user's
  try {
    await Deno.stat(rootPath);

    return { hasReadAccess: true, hasWriteAccess: true, ownerUserId: userId, ownerParentPath: parentPath };
  } catch (error) {
    console.error(error);
  }

  // Otherwise check if it's been shared with them
  let fileShare = (await db.query<FileShare>(
    sql`SELECT * FROM "bewcloud_file_shares"
    WHERE "parent_path" = $2
    AND "name" = $3
    AND "type" = 'file'
    AND (
      ANY("user_ids_with_read_access") = $1
      OR ANY("user_ids_with_write_access") = $1
    )
    ORDER BY "parent_path" ASC
    LIMIT 1`,
    [
      userId,
      parentPath,
      name,
    ],
  ))[0];

  if (fileShare) {
    return {
      hasReadAccess: fileShare.user_ids_with_read_access.includes(userId) ||
        fileShare.user_ids_with_write_access.includes(userId),
      hasWriteAccess: fileShare.user_ids_with_write_access.includes(userId),
      ownerUserId: fileShare.owner_user_id,
      ownerParentPath: fileShare.owner_parent_path,
    };
  }

  // Otherwise check if it's a parent directory has been shared with them, which would also give them access
  const parentPaths: string[] = [];
  let nextParentPath: string | null = rootPath;

  while (nextParentPath !== null) {
    parentPaths.push(nextParentPath);

    nextParentPath = `/${nextParentPath.split('/').filter(Boolean).slice(0, -1).join('/')}`;

    if (nextParentPath === '/') {
      parentPaths.push(nextParentPath);
      nextParentPath = null;
    }
  }

  fileShare = (await db.query<FileShare>(
    sql`SELECT * FROM "bewcloud_file_shares"
    WHERE "parent_path" = ANY($2)
    AND "name" = $3
    AND "type" = 'directory'
    AND (
      ANY("user_ids_with_read_access") = $1
      OR ANY("user_ids_with_write_access") = $1
    )
    ORDER BY "parent_path" ASC
    LIMIT 1`,
    [
      userId,
      parentPaths,
      name,
    ],
  ))[0];

  if (fileShare) {
    return {
      hasReadAccess: fileShare.user_ids_with_read_access.includes(userId) ||
        fileShare.user_ids_with_write_access.includes(userId),
      hasWriteAccess: fileShare.user_ids_with_write_access.includes(userId),
      ownerUserId: fileShare.owner_user_id,
      ownerParentPath: fileShare.owner_parent_path,
    };
  }

  return { hasReadAccess: false, hasWriteAccess: false, ownerUserId: userId, ownerParentPath: parentPath };
}
