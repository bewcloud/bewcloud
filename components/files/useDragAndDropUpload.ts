import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import {
  ExistingNames,
  fetchExistingNamesByPath,
  findDirectoryTakenByFile,
  getPathsFromBase,
} from './existingFileNames.ts';
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';

interface FileConflictState {
  isOpen: boolean;
  filePath: string;
  onReplace: () => void;
  onSkip: () => void;
  onReplaceAll: () => void;
  onSkipAll: () => void;
  onAbort: () => void;
}

type ConflictResolution = 'upload' | 'replace' | 'skip' | 'abort';

interface UseDragAndDropUploadOptions {
  path: Signal<string>;
  // Shared with useUploadQueue, so all upload errors show in one place.
  uploadError: Signal<string>;
  enqueueUpload: (items: { file: File; parentPath: string; overwrite: boolean; batchId: string }[]) => Promise<void>;
  // Called once, right before conflict resolution starts, e.g. to close an open dropdown.
  onBeforeUpload?: () => void;
  // Restricts which dropped/chosen files are uploaded, e.g. Photos only wants images and videos.
  fileFilter?: (file: File) => boolean;
  // Called for each empty directory in a drop (Files creates them, Photos ignores them).
  onEmptyDirectory?: (directoryPath: string, parentPath: string) => Promise<void>;
  // The service worker only accepts an abort from the session that owns the job.
  sessionTag?: string;
}

// readEntries() returns at most ~100 entries per call (Chromium), so keep calling until it returns none.
export function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const allEntries: FileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    function readNextBatch() {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
          return;
        }

        allEntries.push(...entries);
        readNextBatch();
      }, reject);
    }

    readNextBatch();
  });
}

// Drag-and-drop and file picker uploads with a replace/skip prompt for conflicts, shared by MainFiles and MainPhotos. The uploads themselves go through each caller's useUploadQueue.
export function useDragAndDropUpload(
  {
    path,
    uploadError,
    enqueueUpload,
    onBeforeUpload,
    fileFilter,
    onEmptyDirectory,
    sessionTag = '',
  }: UseDragAndDropUploadOptions,
) {
  // Own signals, since the service worker overwrites useUploadQueue's on every broadcast, even mid-prompt.
  const isResolvingConflicts = useSignal<boolean>(false);
  const resolveProgress = useSignal<string>('');
  // Not an error: the rest of the drop still uploads.
  const skippedFilesNotice = useSignal<string>('');
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);
  const fileConflictModal = useSignal<FileConflictState | null>(null);
  const replaceAllMode = useSignal<boolean>(false);
  const skipAllMode = useSignal<boolean>(false);

  // Stops a drop outside the drop zone (e.g. on the header) from navigating to the dropped file.
  useEffect(() => {
    function preventDefaultDrop(event: DragEvent) {
      event.preventDefault();
    }

    globalThis.addEventListener('dragover', preventDefaultDrop);
    globalThis.addEventListener('drop', preventDefaultDrop);

    return () => {
      globalThis.removeEventListener('dragover', preventDefaultDrop);
      globalThis.removeEventListener('drop', preventDefaultDrop);
    };
  }, []);

  function getTargetPath(file: File, basePath: string): string {
    if (!file.webkitRelativePath) {
      return basePath;
    }

    // Resolve the parent path, keeping any sub-directory structure from directory uploads. We don't need to worry about path joining here, the API will handle it (and make sure it's secure)
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${basePath}${directoryPath}`;
  }

  // Resolves a naming conflict for a single file, prompting the user unless already in "replace all"/"skip all" mode.
  function resolveFileConflict(
    file: File,
    basePath: string,
    targetPath: string,
    existingNamesByPath: Map<string, ExistingNames>,
  ): Promise<ConflictResolution> {
    const directoryTakenByFile = findDirectoryTakenByFile(basePath, targetPath, existingNamesByPath);

    if (directoryTakenByFile) {
      uploadError.value = `(${directoryTakenByFile}): A file with this name already exists.`;
      return Promise.resolve('skip');
    }

    const existingNames = existingNamesByPath.get(targetPath);

    if (existingNames?.directoryNames.has(file.name)) {
      // A file can't replace a directory, so report it instead of prompting.
      uploadError.value = `(${targetPath}${file.name}): A directory with this name already exists.`;
      return Promise.resolve('skip');
    }

    if (!existingNames?.fileNames.has(file.name)) {
      return Promise.resolve('upload');
    }

    if (replaceAllMode.value) {
      return Promise.resolve('replace');
    }

    if (skipAllMode.value) {
      return Promise.resolve('skip');
    }

    return new Promise((resolve) => {
      fileConflictModal.value = {
        isOpen: true,
        filePath: `${targetPath}${file.name}`,
        onReplace: () => {
          fileConflictModal.value = null;
          resolve('replace');
        },
        onSkip: () => {
          fileConflictModal.value = null;
          resolve('skip');
        },
        onReplaceAll: () => {
          replaceAllMode.value = true;
          fileConflictModal.value = null;
          resolve('replace');
        },
        onSkipAll: () => {
          skipAllMode.value = true;
          fileConflictModal.value = null;
          resolve('skip');
        },
        onAbort: () => {
          fileConflictModal.value = null;
          resolve('abort');
        },
      };
    });
  }

  // One drop or pick at a time, or a second one overwrites the first's conflict prompt and leaves it hanging.
  function tryStartResolving(): boolean {
    if (isResolvingConflicts.value) {
      uploadError.value = 'Another upload is still being prepared. Wait for it to finish before adding more.';
      return false;
    }

    isResolvingConflicts.value = true;
    uploadError.value = '';
    skippedFilesNotice.value = '';
    replaceAllMode.value = false;
    skipAllMode.value = false;
    return true;
  }

  function finishResolving() {
    isResolvingConflicts.value = false;
    resolveProgress.value = '';
    replaceAllMode.value = false;
    skipAllMode.value = false;
  }

  async function uploadFiles(candidateFiles: File[]) {
    if (!tryStartResolving()) {
      return;
    }

    try {
      await resolveAndEnqueue(candidateFiles, path.value);
    } finally {
      finishResolving();
    }
  }

  // Resolves conflicts one file at a time, so a "Replace All" mid-batch applies to the rest. basePath is captured when the drop or pick starts, since the user may navigate away meanwhile.
  async function resolveAndEnqueue(candidateFiles: File[], basePath: string) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;

    if (filesToUpload.length === 0) {
      if (candidateFiles.length > 0) {
        // Something was dropped, but the filter (e.g. Photos wanting only images/videos) rejected all of it.
        uploadError.value = 'No supported files were found in the dropped items.';
      }
      return;
    }

    const unsupportedCount = candidateFiles.length - filesToUpload.length;

    if (unsupportedCount > 0) {
      skippedFilesNotice.value = `Skipped ${unsupportedCount} unsupported file${unsupportedCount === 1 ? '' : 's'}.`;
    }

    onBeforeUpload?.();

    // Lets Abort take back only this batch's items.
    const batchId = crypto.randomUUID();

    // Immediate feedback for the conflict-check below, which is a network round-trip per target path.
    resolveProgress.value = 'Checking for conflicts...';

    // Every directory on the way down, to also catch a dropped directory whose name a file already has.
    const targetPaths = [...new Set(filesToUpload.map((file) => getTargetPath(file, basePath)))];
    const existingNamesByPath = await fetchExistingNamesByPath(
      targetPaths.flatMap((targetPath) => getPathsFromBase(basePath, targetPath)),
    );

    // Enqueue each file as soon as it's answered, so uploads start during the prompts. Chained, not awaited: without a service worker enqueueUpload uploads in-page and would block the next prompt.
    let enqueued: Promise<void> = Promise.resolve();

    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file, basePath);
      const resolution = await resolveFileConflict(file, basePath, targetPath, existingNamesByPath);

      if (resolution === 'abort') {
        // Wait for the chain first, so no item of this batch reaches the worker after the abort.
        await enqueued.catch(() => {});
        postToUploadServiceWorker({ type: 'ABORT_UPLOADS', sessionTag, batchId });

        return;
      }

      if (resolution === 'upload' || resolution === 'replace') {
        const item = { file, parentPath: targetPath, overwrite: resolution === 'replace', batchId };
        enqueued = enqueued.then(() => enqueueUpload([item]));
      }
    }

    await enqueued;
  }

  // Walks one dropped entry, setting webkitRelativePath on files to keep the directory structure, and collecting empty directories.
  async function processEntry(
    entry: FileSystemEntry,
    currentPath: string,
    filesToUpload: File[],
    directoriesToCreate: string[],
  ): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));

      // Add webkitRelativePath to maintain directory structure
      Object.defineProperty(file, 'webkitRelativePath', {
        value: currentPath ? `${currentPath}/${file.name}` : file.name,
        writable: false,
      });
      filesToUpload.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      const entries = await readAllDirectoryEntries(dirEntry.createReader());

      if (entries.length === 0) {
        // Empty directory - add to directories to create
        directoriesToCreate.push(dirPath);
      } else {
        await Promise.all(
          entries.map((childEntry) => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)),
        );
      }
    }
  }

  // Recursively walks dropped items (which may be directories) into a flat file list plus any empty directory paths.
  async function processDroppedItems(
    items: DataTransferItemList,
  ): Promise<{ files: File[]; emptyDirectories: string[] }> {
    const filesToUpload: File[] = [];
    const directoriesToCreate: string[] = [];
    const promises: Promise<void>[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(processEntry(entry, '', filesToUpload, directoriesToCreate));
        }
      }
    }

    await Promise.all(promises);

    return { files: filesToUpload, emptyDirectories: directoriesToCreate };
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.value++;
    if (event.dataTransfer?.types.includes('Files')) {
      isDraggingOver.value = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    isDraggingOver.value = false;
    dragCounter.value = 0;

    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;

    if (!hasItems && !hasFiles) {
      return;
    }

    // dataTransfer is emptied once the handler yields, so read it before any await.
    const fallbackFiles = hasFiles ? Array.from(event.dataTransfer!.files) : [];

    // Feedback while walking a big dropped directory.
    const topLevelNames = hasItems
      ? Array.from(event.dataTransfer!.items)
        .map((item) => item.kind === 'file' ? item.webkitGetAsEntry()?.name : undefined)
        .filter((name): name is string => !!name)
      : fallbackFiles.map((file) => file.name);

    if (!tryStartResolving()) {
      return;
    }

    resolveProgress.value = topLevelNames.length === 1
      ? `Uploading ${topLevelNames[0]}...`
      : topLevelNames.length > 1
      ? `Uploading ${topLevelNames.length} items...`
      : '';

    // Captured before the tree walk, so everything lands where the drop happened even if the user navigates away.
    const pathAtDropStart = path.value;

    try {
      // Items are what carry directory structure, so they're walked first when present.
      const { files: droppedFiles, emptyDirectories } = hasItems
        ? await processDroppedItems(event.dataTransfer!.items)
        : { files: [] as File[], emptyDirectories: [] as string[] };

      for (const directoryPath of emptyDirectories) {
        await onEmptyDirectory?.(directoryPath, pathAtDropStart);
      }

      // webkitGetAsEntry() may return null, so fall back to the plain file list when the walk finds nothing.
      const filesToUpload = droppedFiles.length === 0 && emptyDirectories.length === 0 ? fallbackFiles : droppedFiles;

      await resolveAndEnqueue(filesToUpload, pathAtDropStart);
    } catch (error) {
      console.error('Failed to process dropped files:', error);
      uploadError.value = error instanceof Error ? error.message : String(error);
    } finally {
      finishResolving();
    }
  }

  return {
    isResolvingConflicts,
    resolveProgress,
    skippedFilesNotice,
    isDraggingOver,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
