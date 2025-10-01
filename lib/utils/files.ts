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
  const nameA = entryA.name.toLocaleLowerCase();
  const nameB = entryB.name.toLocaleLowerCase();

  if (nameA > nameB) {
    return 1;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 0;
}

export function sortDirectoriesByName(directoryA: Directory, directoryB: Directory) {
  const nameA = directoryA.directory_name.toLocaleLowerCase();
  const nameB = directoryB.directory_name.toLocaleLowerCase();

  if (nameA > nameB) {
    return 1;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 0;
}

export function sortFilesByName(fileA: DirectoryFile, fileB: DirectoryFile) {
  const nameA = fileA.file_name.toLocaleLowerCase();
  const nameB = fileB.file_name.toLocaleLowerCase();

  if (nameA > nameB) {
    return 1;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 0;
}
