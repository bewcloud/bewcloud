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

export type SortColumn = 'name' | 'updated_at' | 'size_in_bytes';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  sortBy: SortColumn;
  sortOrder: SortOrder;
}

export function sortEntriesByName(entryA: Deno.DirEntry, entryB: Deno.DirEntry) {
  const nameA = entryA.name.toLowerCase();
  const nameB = entryB.name.toLowerCase();
  
  if (nameA > nameB) {
    return 1;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 0;
}

export function sortDirectoriesByName(directoryA: Directory, directoryB: Directory) {
  const nameA = directoryA.directory_name.toLowerCase();
  const nameB = directoryB.directory_name.toLowerCase();
  
  if (nameA > nameB) {
    return 1;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 0;
}

export function sortFilesByName(fileA: DirectoryFile, fileB: DirectoryFile) {
  const nameA = fileA.file_name.toLowerCase();
  const nameB = fileB.file_name.toLowerCase();
  
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
        result = a.size_in_bytes - b.size_in_bytes;
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
