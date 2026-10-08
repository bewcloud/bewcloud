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

  if (bytes.toFixed(2).split('.')[1] === '00') {
    return `${bytes.toFixed(0)} ${units[unitIndex]}`;
  }

  return `${bytes.toFixed(2)} ${units[unitIndex]}`;
}

export function bytesFromHumanFileSize(humanFileSize: string) {
  const [numberString, unit] = humanFileSize.split(' ');
  const number = Number.parseFloat(numberString);

  return number *
    (unit === 'B' ? 1 : 1024 ** (['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'].indexOf(unit) + 1));
}

export type SortColumn = 'name' | 'updated_at' | 'size_in_bytes';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  sortBy: SortColumn;
  sortOrder: SortOrder;
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

export function sortDirectories(directories: Directory[], options: SortOptions): Directory[] {
  const sorted = [...directories].sort((a, b) => {
    let result = 0;

    switch (options.sortBy) {
      case 'name':
        result = a.directory_name.toLowerCase().localeCompare(b.directory_name.toLowerCase());
        break;
      case 'updated_at':
        result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;
      case 'size_in_bytes':
        // Unknown sizes come from "du" timing out, so sort them as the biggest
        result = (a.size_in_bytes ?? Number.MAX_SAFE_INTEGER) - (b.size_in_bytes ?? Number.MAX_SAFE_INTEGER);
        break;
    }

    return options.sortOrder === 'desc' ? -result : result;
  });

  return sorted;
}

export function sortFiles(files: DirectoryFile[], options: SortOptions): DirectoryFile[] {
  const sorted = [...files].sort((a, b) => {
    let result = 0;

    switch (options.sortBy) {
      case 'name':
        result = a.file_name.toLowerCase().localeCompare(b.file_name.toLowerCase());
        break;
      case 'updated_at':
        result = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;
      case 'size_in_bytes':
        result = a.size_in_bytes - b.size_in_bytes;
        break;
    }

    return options.sortOrder === 'desc' ? -result : result;
  });

  return sorted;
}

// Whether a STATE broadcast brings a worker error this tab hasn't shown yet, or drops the one it's showing.
// Per-file errors come as "(name): message", the rest as a plain sentence.
export function formatUploadError(error: string) {
  return error.startsWith('(') ? `Upload failed ${error}` : `Upload failed: ${error}`;
}

export function getUploadErrorAction(
  state: { error?: string; errorId?: string; errorKind?: string; errorSessionTag?: string },
  uploadKind: string,
  uploadSessionTag: string,
  lastSeenErrorId: string,
  isShowingWorkerError: boolean,
): 'show' | 'clear' | null {
  if (state.error && state.errorKind === uploadKind && state.errorSessionTag === uploadSessionTag) {
    return state.errorId !== lastSeenErrorId ? 'show' : null;
  }

  return isShowingWorkerError ? 'clear' : null;
}
