import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { ExistingNames, fetchExistingNames } from './existingFileNames.ts';
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
  // Caller's own error signal (from useUploadQueue), reused here so a tree-walk failure (before enqueueUpload is ever reached) still shows up in the same place upload failures do.
  uploadError: Signal<string>;
  enqueueUpload: (items: { file: File; parentPath: string; overwrite: boolean; batchId: string }[]) => Promise<void>;
  // Called once, right before conflict resolution starts, e.g. to close an open dropdown.
  onBeforeUpload?: () => void;
  // Restricts which dropped/chosen files are uploaded, e.g. Photos only wants images and videos.
  fileFilter?: (file: File) => boolean;
  // Called (in order) for each empty directory found in a directory drop. Files-only wants these created; Photos ignores them.
  onEmptyDirectory?: (directoryPath: string, parentPath: string) => Promise<void>;
  // Identifies this view's upload session to the service worker, so Abort Upload only cancels this session's own in-flight job.
  sessionTag?: string;
}

// A single readEntries() call can return a partial batch (historically capped around 100 in Chromium) per the File and Directory Entries API spec, so it must be called repeatedly until it resolves with an empty array to get every entry in the directory. Exported so it can be unit tested directly.
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

// Drag-and-drop (and file-input) upload with naming-conflict resolution (replace/skip/replace-all), shared by MainFiles and MainPhotos. Uploads themselves still go through each caller's own useUploadQueue instance (different upload kind/session per view); this hook only resolves conflicts and hands the survivors over.
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
  // The tree walk and the conflict prompts happen before anything is handed to the upload queue, so this phase needs its own signals. useUploadQueue's isUploading/uploadProgress can't stand in: the service worker overwrites both on every broadcast (including the QUERY_STATE any other tab fires on mount), which would wipe the status mid-prompt and let a second drop land on top of the first.
  const isResolvingConflicts = useSignal<boolean>(false);
  const resolveProgress = useSignal<string>('');
  const isDraggingOver = useSignal<boolean>(false);
  const dragCounter = useSignal<number>(0);
  const fileConflictModal = useSignal<FileConflictState | null>(null);
  const replaceAllMode = useSignal<boolean>(false);
  const skipAllMode = useSignal<boolean>(false);

  // Safety net: a drop landing outside the handled area below (e.g. the page header) would otherwise navigate the browser away to the dropped file/URL instead of being ignored.
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

  function getTargetPath(file: File): string {
    if (!file.webkitRelativePath) {
      return path.value;
    }

    // Resolve the parent path, keeping any sub-directory structure from directory uploads. We don't need to worry about path joining here, the API will handle it (and make sure it's secure)
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${path.value}${directoryPath}`;
  }

  // Resolves a naming conflict for a single file, prompting the user unless already in "replace all"/"skip all" mode.
  function resolveFileConflict(
    file: File,
    targetPath: string,
    existingNamesByPath: Map<string, ExistingNames>,
  ): Promise<ConflictResolution> {
    const existingNames = existingNamesByPath.get(targetPath);

    if (existingNames?.directoryNames.has(file.name)) {
      // None of the modal's answers apply to a directory of the same name: a file can't be written over one, so replacing it isn't on offer. Skipping it here reports the clash straight away instead of letting the upload fail part-way through.
      uploadError.value = `${targetPath}${file.name}: A directory with this name already exists.`;
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

  // Resolves conflicts one file at a time (so a "replace all" picked mid-batch applies to the rest), then enqueues the survivors.
  async function uploadFiles(candidateFiles: File[]) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;

    if (filesToUpload.length === 0) {
      if (candidateFiles.length > 0) {
        // Something was dropped, but the filter (e.g. Photos wanting only images/videos) rejected all of it.
        uploadError.value = 'No supported files were found in the dropped items.';
      }
      isResolvingConflicts.value = false;
      resolveProgress.value = '';
      return;
    }

    isResolvingConflicts.value = true;
    uploadError.value = '';
    onBeforeUpload?.();
    replaceAllMode.value = false; // Reset replace/skip all mode for new upload session
    skipAllMode.value = false;

    // Identifies every item this call hands to the queue, so an Abort part-way through takes back exactly what this call already enqueued and nothing else.
    const batchId = crypto.randomUUID();

    try {
      // Immediate feedback for the conflict-check below, which is a network round-trip per target path.
      resolveProgress.value = 'Checking for conflicts...';

      // Check every target path a dropped file will land in (not just the currently-viewed directory), so conflicts in dragged subdirectories are caught too.
      const targetPaths = [...new Set(filesToUpload.map(getTargetPath))];
      const existingNamesByPath = new Map(
        await Promise.all(
          targetPaths.map(async (targetPath) => [targetPath, await fetchExistingNames(targetPath)] as const),
        ),
      );

      // Each answered file is handed over immediately rather than after the whole batch, so uploading starts while the user is still working through the prompts, and an Abort has this batch's own queued items to take back. Chained instead of awaited in the loop: without a service worker enqueueUpload does the upload itself, and awaiting it here would stall the next prompt behind it.
      let enqueued: Promise<void> = Promise.resolve();

      for (const file of filesToUpload) {
        const targetPath = getTargetPath(file);
        const resolution = await resolveFileConflict(file, targetPath, existingNamesByPath);

        if (resolution === 'abort') {
          // Takes back everything already handed over for this batch too, not just the files not yet answered for. Letting the chain settle first means no item can still be on its way to the worker when the abort message arrives. Scoped to the batch, so an upload from an earlier drop (or another view or tab, which share the session tag) keeps running.
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
    } finally {
      isResolvingConflicts.value = false;
      resolveProgress.value = '';
      replaceAllMode.value = false;
      skipAllMode.value = false;
    }
  }

  // Process a single dropped file system entry (file or directory), tagging files with a webkitRelativePath so directory structure survives the upload, and collecting empty directory paths for the caller to create.
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

    if (isResolvingConflicts.value) {
      // A drop is still being resolved - a second one landing on top of it would overwrite the open conflict prompt and leave the first batch waiting on an answer that can never arrive.
      uploadError.value = 'Another drop is still being processed. Wait for it to finish before dropping more.';
      return;
    }

    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;

    if (!hasItems && !hasFiles) {
      return;
    }

    // Both of these must be read synchronously here (before any await), since dataTransfer becomes invalid once the drop event handler yields.
    const fallbackFiles = hasFiles ? Array.from(event.dataTransfer!.files) : [];

    // Immediate feedback while we walk the dropped tree below, which (for a directory with many files) can itself take a moment before uploadFiles even starts its own conflict check.
    const topLevelNames = hasItems
      ? Array.from(event.dataTransfer!.items)
        .map((item) => item.kind === 'file' ? item.webkitGetAsEntry()?.name : undefined)
        .filter((name): name is string => !!name)
      : fallbackFiles.map((file) => file.name);

    isResolvingConflicts.value = true;
    uploadError.value = '';
    resolveProgress.value = topLevelNames.length === 1
      ? `Uploading ${topLevelNames[0]}...`
      : topLevelNames.length > 1
      ? `Uploading ${topLevelNames.length} items...`
      : '';

    // Captured before the tree walk below (which can itself take a while for a large directory), so every empty directory this drop creates lands under the path that was in view at drop time, even if the user has since navigated elsewhere.
    const pathAtDropStart = path.value;

    try {
      // Items are what carry directory structure, so they're walked first when present.
      const { files: droppedFiles, emptyDirectories } = hasItems
        ? await processDroppedItems(event.dataTransfer!.items)
        : { files: [] as File[], emptyDirectories: [] as string[] };

      for (const directoryPath of emptyDirectories) {
        await onEmptyDirectory?.(directoryPath, pathAtDropStart);
      }

      // The walk can come back with nothing even though the drop did carry files, because webkitGetAsEntry() is allowed to return null. Decide on what the walk actually produced rather than on whether items were present, or that case is a silent no-op.
      const filesToUpload = droppedFiles.length === 0 && emptyDirectories.length === 0 ? fallbackFiles : droppedFiles;

      await uploadFiles(filesToUpload);
    } catch (error) {
      console.error('Failed to process dropped files:', error);
      uploadError.value = error instanceof Error ? error.message : String(error);
      isResolvingConflicts.value = false;
      resolveProgress.value = '';
    }
  }

  return {
    isResolvingConflicts,
    resolveProgress,
    isDraggingOver,
    fileConflictModal,
    uploadFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
