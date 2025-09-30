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
  // Always put .Trash directory first
  const fullPathA = `${directoryA.parent_path}${directoryA.directory_name}/`;
  const fullPathB = `${directoryB.parent_path}${directoryB.directory_name}/`;
  
  if (fullPathA === TRASH_PATH || directoryA.directory_name === '.Trash') {
    return -1;
  }
  if (fullPathB === TRASH_PATH || directoryB.directory_name === '.Trash') {
    return 1;
  }
  
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
  // Always put .Trash file first (if it exists)
  if (fileA.file_name === '.Trash') {
    return -1;
  }
  if (fileB.file_name === '.Trash') {
    return 1;
  }
  
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
  // Separate .Trash folder from other directories
  const trashDir = directories.find(dir => 
    `${dir.parent_path}${dir.directory_name}/` === TRASH_PATH || 
    dir.directory_name === '.Trash'
  );
  const otherDirs = directories.filter(dir => 
    `${dir.parent_path}${dir.directory_name}/` !== TRASH_PATH && 
    dir.directory_name !== '.Trash'
  );
  
  // Sort the non-trash directories
  const sorted = [...otherDirs].sort((a, b) => {
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
  
  // Return with .Trash folder first (if it exists), followed by sorted directories
  return trashDir ? [trashDir, ...sorted] : sorted;
}

export function sortFiles(files: DirectoryFile[], options: SortOptions): DirectoryFile[] {
  // Separate .Trash file from other files (if it exists)
  const trashFile = files.find(file => file.file_name === '.Trash');
  const otherFiles = files.filter(file => file.file_name !== '.Trash');
  
  // Sort the non-trash files
  const sorted = [...otherFiles].sort((a, b) => {
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
  
  // Return with .Trash file first (if it exists), followed by sorted files
  return trashFile ? [trashFile, ...sorted] : sorted;
}
