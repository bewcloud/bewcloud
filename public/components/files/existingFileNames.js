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