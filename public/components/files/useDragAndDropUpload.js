import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { fetchExistingNamesByPath, findDirectoryTakenByFile, getPathsFromBase } from "./existingFileNames.js";
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';
export function readAllDirectoryEntries(reader) {
  const allEntries = [];
  return new Promise((resolve, reject) => {
    function readNextBatch() {
      reader.readEntries(entries => {
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
export function useDragAndDropUpload({
  path,
  uploadError,
  enqueueUpload,
  onBeforeUpload,
  fileFilter,
  onEmptyDirectory,
  sessionTag = ''
}) {
  const isResolvingConflicts = useSignal(false);
  const resolveProgress = useSignal('');
  const skippedFilesNotice = useSignal('');
  const isDraggingOver = useSignal(false);
  const dragCounter = useSignal(0);
  const fileConflictModal = useSignal(null);
  const replaceAllMode = useSignal(false);
  const skipAllMode = useSignal(false);
  useEffect(() => {
    function preventDefaultDrop(event) {
      event.preventDefault();
    }
    globalThis.addEventListener('dragover', preventDefaultDrop);
    globalThis.addEventListener('drop', preventDefaultDrop);
    return () => {
      globalThis.removeEventListener('dragover', preventDefaultDrop);
      globalThis.removeEventListener('drop', preventDefaultDrop);
    };
  }, []);
  function getTargetPath(file, basePath) {
    if (!file.webkitRelativePath) {
      return basePath;
    }
    const directoryPath = file.webkitRelativePath.slice(0, -file.name.length);
    return `${basePath}${directoryPath}`;
  }
  function resolveFileConflict(file, basePath, targetPath, existingNamesByPath) {
    const directoryTakenByFile = findDirectoryTakenByFile(basePath, targetPath, existingNamesByPath);
    if (directoryTakenByFile) {
      uploadError.value = `(${directoryTakenByFile}): A file with this name already exists.`;
      return Promise.resolve('skip');
    }
    const existingNames = existingNamesByPath.get(targetPath);
    if (existingNames?.directoryNames.has(file.name)) {
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
    return new Promise(resolve => {
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
        }
      };
    });
  }
  function tryStartResolving() {
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
  async function uploadFiles(candidateFiles) {
    if (!tryStartResolving()) {
      return;
    }
    try {
      await resolveAndEnqueue(candidateFiles, path.value);
    } finally {
      finishResolving();
    }
  }
  async function resolveAndEnqueue(candidateFiles, basePath) {
    const filesToUpload = fileFilter ? candidateFiles.filter(fileFilter) : candidateFiles;
    if (filesToUpload.length === 0) {
      if (candidateFiles.length > 0) {
        uploadError.value = 'No supported files were found in the dropped items.';
      }
      return;
    }
    const unsupportedCount = candidateFiles.length - filesToUpload.length;
    if (unsupportedCount > 0) {
      skippedFilesNotice.value = `Skipped ${unsupportedCount} unsupported file${unsupportedCount === 1 ? '' : 's'}.`;
    }
    onBeforeUpload?.();
    const batchId = crypto.randomUUID();
    resolveProgress.value = 'Checking for conflicts...';
    const targetPaths = [...new Set(filesToUpload.map(file => getTargetPath(file, basePath)))];
    const existingNamesByPath = await fetchExistingNamesByPath(targetPaths.flatMap(targetPath => getPathsFromBase(basePath, targetPath)));
    let enqueued = Promise.resolve();
    for (const file of filesToUpload) {
      const targetPath = getTargetPath(file, basePath);
      const resolution = await resolveFileConflict(file, basePath, targetPath, existingNamesByPath);
      if (resolution === 'abort') {
        await enqueued.catch(() => {});
        postToUploadServiceWorker({
          type: 'ABORT_UPLOADS',
          sessionTag,
          batchId
        });
        return;
      }
      if (resolution === 'upload' || resolution === 'replace') {
        const item = {
          file,
          parentPath: targetPath,
          overwrite: resolution === 'replace',
          batchId
        };
        enqueued = enqueued.then(() => enqueueUpload([item]));
      }
    }
    await enqueued;
  }
  async function processEntry(entry, currentPath, filesToUpload, directoriesToCreate) {
    if (entry.isFile) {
      const fileEntry = entry;
      const file = await new Promise((resolve, reject) => fileEntry.file(resolve, reject));
      Object.defineProperty(file, 'webkitRelativePath', {
        value: currentPath ? `${currentPath}/${file.name}` : file.name,
        writable: false
      });
      filesToUpload.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry;
      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      const entries = await readAllDirectoryEntries(dirEntry.createReader());
      if (entries.length === 0) {
        directoriesToCreate.push(dirPath);
      } else {
        await Promise.all(entries.map(childEntry => processEntry(childEntry, dirPath, filesToUpload, directoriesToCreate)));
      }
    }
  }
  async function processDroppedItems(items) {
    const filesToUpload = [];
    const directoriesToCreate = [];
    const promises = [];
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
    return {
      files: filesToUpload,
      emptyDirectories: directoriesToCreate
    };
  }
  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.value++;
    if (event.dataTransfer?.types.includes('Files')) {
      isDraggingOver.value = true;
    }
  }
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.value--;
    if (dragCounter.value === 0) {
      isDraggingOver.value = false;
    }
  }
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }
  async function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    isDraggingOver.value = false;
    dragCounter.value = 0;
    const hasItems = !!event.dataTransfer?.items && event.dataTransfer.items.length > 0;
    const hasFiles = !!event.dataTransfer?.files && event.dataTransfer.files.length > 0;
    if (!hasItems && !hasFiles) {
      return;
    }
    const fallbackFiles = hasFiles ? Array.from(event.dataTransfer.files) : [];
    const topLevelNames = hasItems ? Array.from(event.dataTransfer.items).map(item => item.kind === 'file' ? item.webkitGetAsEntry()?.name : undefined).filter(name => !!name) : fallbackFiles.map(file => file.name);
    if (!tryStartResolving()) {
      return;
    }
    resolveProgress.value = topLevelNames.length === 1 ? `Uploading ${topLevelNames[0]}...` : topLevelNames.length > 1 ? `Uploading ${topLevelNames.length} items...` : '';
    const pathAtDropStart = path.value;
    try {
      const {
        files: droppedFiles,
        emptyDirectories
      } = hasItems ? await processDroppedItems(event.dataTransfer.items) : {
        files: [],
        emptyDirectories: []
      };
      for (const directoryPath of emptyDirectories) {
        await onEmptyDirectory?.(directoryPath, pathAtDropStart);
      }
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
    handleDrop
  };
}