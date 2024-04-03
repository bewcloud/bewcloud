import { Directory, DirectoryFile } from '/lib/types.ts';

export const TRASH_PATH = `/.Trash/`;

export function humanFileSize(bytes: number) {
  if (Math.abs(bytes) < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  let unitIndex = -1;
  const roundedPower = 10 ** 2;

  do {
    bytes /= 1024;
    ++unitIndex;
  } while (Math.round(Math.abs(bytes) * roundedPower) / roundedPower >= 1024 && unitIndex < units.length - 1);

  return `${bytes.toFixed(2)} ${units[unitIndex]}`;
}

export function sortEntriesByName(entryA: Deno.DirEntry, entryB: Deno.DirEntry) {
  if (entryA.name > entryB.name) {
    return 1;
  }

  if (entryA.name < entryB.name) {
    return -1;
  }

  return 0;
}

export function sortDirectoriesByName(directoryA: Directory, directoryB: Directory) {
  if (directoryA.directory_name > directoryB.directory_name) {
    return 1;
  }

  if (directoryA.directory_name < directoryB.directory_name) {
    return -1;
  }

  return 0;
}

export function sortFilesByName(fileA: DirectoryFile, fileB: DirectoryFile) {
  if (fileA.file_name > fileB.file_name) {
    return 1;
  }

  if (fileA.file_name < fileB.file_name) {
    return -1;
  }

  return 0;
}
