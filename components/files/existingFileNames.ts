import { RequestBody as GetFilesRequestBody, ResponseBody as GetFilesResponseBody } from '/pages/api/files/get.ts';

export interface ExistingNames {
  fileNames: Set<string>;
  directoryNames: Set<string>;
}

// The names already taken in a directory, used to detect naming conflicts before an upload. Directory names count: a file can't be written over a directory, so that clash has to be caught here rather than failing mid-upload. Fails open (empty sets) on any error, so a check that itself fails doesn't block an upload that turns out fine, or wrongly report a clash.
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
