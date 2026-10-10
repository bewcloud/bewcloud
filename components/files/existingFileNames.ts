import { RequestBody as GetFilesRequestBody, ResponseBody as GetFilesResponseBody } from '/pages/api/files/get.ts';

export interface ExistingNames {
  fileNames: Set<string>;
  directoryNames: Set<string>;
}

// Names already taken in a directory. Fails open, so a failed check doesn't block the upload.
export async function fetchExistingNames(parentPath: string): Promise<ExistingNames> {
  try {
    const requestBody: GetFilesRequestBody = { parentPath };

    // Same reasoning as sw.js's fetchForJob: don't let a hung server response block the upload from ever starting.
    const response = await fetch('/api/files/get', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { fileNames: new Set(), directoryNames: new Set() };
    }

    const result = await response.json() as GetFilesResponseBody;

    return {
      fileNames: new Set(result.files.map((file) => file.file_name)),
      directoryNames: new Set(result.directories.map((directory) => directory.directory_name)),
    };
  } catch (error) {
    console.error(error);
    return { fileNames: new Set(), directoryNames: new Set() };
  }
}

const MAX_CONCURRENT_LISTINGS = 4;

// A few listings at a time, since a drop like node_modules can span hundreds of directories.
export async function fetchExistingNamesByPath(paths: string[]): Promise<Map<string, ExistingNames>> {
  const existingNamesByPath = new Map<string, ExistingNames>();
  const pathsToList = [...new Set(paths)];

  async function listRemainingPaths() {
    for (let path = pathsToList.shift(); path !== undefined; path = pathsToList.shift()) {
      existingNamesByPath.set(path, await fetchExistingNames(path));
    }
  }

  await Promise.all(Array.from({ length: MAX_CONCURRENT_LISTINGS }, listRemainingPaths));

  return existingNamesByPath;
}

// Every directory from basePath down to targetPath, e.g. ['/base/', '/base/a/', '/base/a/b/'].
export function getPathsFromBase(basePath: string, targetPath: string): string[] {
  const paths = [basePath];

  for (const directoryName of targetPath.slice(basePath.length).split('/').filter(Boolean)) {
    paths.push(`${paths[paths.length - 1]}${directoryName}/`);
  }

  return paths;
}

// The first directory on the way to targetPath whose name is already taken by a file, so nothing can be uploaded into it.
export function findDirectoryTakenByFile(
  basePath: string,
  targetPath: string,
  existingNamesByPath: Map<string, ExistingNames>,
): string | undefined {
  const paths = getPathsFromBase(basePath, targetPath);

  for (let index = 1; index < paths.length; index++) {
    const parentPath = paths[index - 1];
    const directoryName = paths[index].slice(parentPath.length, -1);

    if (existingNamesByPath.get(parentPath)?.fileNames.has(directoryName)) {
      return `${parentPath}${directoryName}`;
    }
  }

  return undefined;
}
