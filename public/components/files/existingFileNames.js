export async function fetchExistingNames(parentPath) {
  try {
    const requestBody = {
      parentPath
    };
    const response = await fetch('/api/files/get', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      return {
        fileNames: new Set(),
        directoryNames: new Set()
      };
    }
    const result = await response.json();
    return {
      fileNames: new Set(result.files.map(file => file.file_name)),
      directoryNames: new Set(result.directories.map(directory => directory.directory_name))
    };
  } catch (error) {
    console.error(error);
    return {
      fileNames: new Set(),
      directoryNames: new Set()
    };
  }
}
const MAX_CONCURRENT_LISTINGS = 4;
export async function fetchExistingNamesByPath(paths) {
  const existingNamesByPath = new Map();
  const pathsToList = [...new Set(paths)];
  async function listRemainingPaths() {
    for (let path = pathsToList.shift(); path !== undefined; path = pathsToList.shift()) {
      existingNamesByPath.set(path, await fetchExistingNames(path));
    }
  }
  await Promise.all(Array.from({
    length: MAX_CONCURRENT_LISTINGS
  }, listRemainingPaths));
  return existingNamesByPath;
}
export function getPathsFromBase(basePath, targetPath) {
  const paths = [basePath];
  for (const directoryName of targetPath.slice(basePath.length).split('/').filter(Boolean)) {
    paths.push(`${paths[paths.length - 1]}${directoryName}/`);
  }
  return paths;
}
export function findDirectoryTakenByFile(basePath, targetPath, existingNamesByPath) {
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