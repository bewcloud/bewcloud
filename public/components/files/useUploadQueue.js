import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';
const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
export function useUploadQueue({
  isEnabled,
  path,
  files,
  directories,
  uploadSessionTag = '',
  uploadKind = 'file'
}) {
  const isUploading = useSignal(false);
  const uploadProgress = useSignal('');
  const uploadError = useSignal('');
  useEffect(() => {
    if (!isEnabled || !('serviceWorker' in navigator)) {
      return;
    }
    const uploadChannel = new BroadcastChannel('bewcloud-uploads');
    let lastSeenErrorId = 0;
    uploadChannel.onmessage = event => {
      const state = event.data;
      if (!state || state.type !== 'STATE') {
        return;
      }
      if (state.sessionTag && state.sessionTag !== uploadSessionTag) {
        return;
      }
      isUploading.value = state.kindsInProgress ? state.kindsInProgress.includes(uploadKind) : state.isUploading;
      uploadProgress.value = state.kind === uploadKind ? state.uploadProgress || '' : '';
      if (state.error && state.errorKind === uploadKind && state.errorSessionTag === uploadSessionTag && state.errorId !== lastSeenErrorId) {
        lastSeenErrorId = state.errorId;
        console.error(new Error(state.error));
        uploadError.value = state.error;
      }
      if (state.newFiles && state.pathInView === path.value) {
        files.value = [...state.newFiles];
      }
      if (state.newDirectories && state.pathInView === path.value) {
        directories.value = [...state.newDirectories];
      }
    };
    function resyncState() {
      if (document.visibilityState === 'visible') {
        postToUploadServiceWorker({
          type: 'QUERY_STATE',
          sessionTag: uploadSessionTag
        });
      }
    }
    document.addEventListener('visibilitychange', resyncState);
    globalThis.addEventListener('pageshow', resyncState);
    postToUploadServiceWorker({
      type: 'QUERY_STATE',
      sessionTag: uploadSessionTag
    });
    return () => {
      uploadChannel.close();
      document.removeEventListener('visibilitychange', resyncState);
      globalThis.removeEventListener('pageshow', resyncState);
    };
  }, []);
  async function uploadFileSingle(file, parentPath, pathInView) {
    const requestBody = new FormData();
    requestBody.set('path_in_view', pathInView);
    requestBody.set('parent_path', parentPath);
    requestBody.set('name', file.name);
    requestBody.set('upload_session_tag', uploadSessionTag);
    requestBody.set('contents', file);
    const response = await fetch(`/api/files/upload`, {
      method: 'POST',
      body: requestBody
    });
    if (!response.ok) {
      throw new Error(`Failed to upload file. ${response.statusText} ${await response.text()}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to upload file!');
    }
    files.value = [...result.newFiles];
    directories.value = [...result.newDirectories];
  }
  async function uploadFileChunked(file, parentPath, pathInView, itemLabel) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
    const uploadId = crypto.randomUUID();
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        uploadProgress.value = `${itemLabel}, chunk ${chunkIndex + 1}/${totalChunks}…`;
        const start = chunkIndex * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
        const chunkBlob = file.slice(start, end);
        const requestBody = new FormData();
        requestBody.set('upload_id', uploadId);
        requestBody.set('chunk_index', String(chunkIndex));
        requestBody.set('total_chunks', String(totalChunks));
        requestBody.set('path_in_view', pathInView);
        requestBody.set('parent_path', parentPath);
        requestBody.set('name', file.name);
        requestBody.set('upload_session_tag', uploadSessionTag);
        requestBody.set('chunk', chunkBlob);
        const response = await fetch(`/api/files/upload-chunk`, {
          method: 'POST',
          body: requestBody
        });
        if (!response.ok) {
          throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}. ${response.statusText} ${await response.text()}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}!`);
        }
        if (result.isComplete) {
          files.value = [...result.newFiles];
          directories.value = [...result.newDirectories];
        }
      }
    } catch (error) {
      fetch('/api/files/upload-abort', {
        method: 'POST',
        body: JSON.stringify({
          upload_id: uploadId,
          upload_session_tag: uploadSessionTag
        })
      }).catch(() => {});
      throw error;
    }
  }
  async function findExistingNames(parentPath) {
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
        return new Set();
      }
      const result = await response.json();
      return new Set(result.files.map(file => file.file_name));
    } catch (error) {
      console.error(error);
      return new Set();
    }
  }
  async function enqueueUpload(items) {
    if (items.length === 0) {
      return;
    }
    const pathInView = path.value;
    isUploading.value = true;
    uploadProgress.value = '';
    uploadError.value = '';
    const uniqueParentPaths = [...new Set(items.map(item => item.parentPath))];
    const existingNamesByParentPath = new Map(await Promise.all(uniqueParentPaths.map(async parentPath => [parentPath, await findExistingNames(parentPath)])));
    const itemsToUpload = items.filter(item => {
      if (existingNamesByParentPath.get(item.parentPath)?.has(item.file.name)) {
        uploadError.value = `(${item.file.name}): A file with this name already exists.`;
        return false;
      }
      return true;
    });
    if (itemsToUpload.length === 0) {
      isUploading.value = false;
      return;
    }
    const wasEnqueuedInServiceWorker = isEnabled && (await postToUploadServiceWorker({
      type: 'ENQUEUE_UPLOAD',
      sessionTag: uploadSessionTag,
      items: itemsToUpload.map(item => ({
        ...item,
        pathInView,
        kind: uploadKind
      }))
    }));
    if (wasEnqueuedInServiceWorker) {
      return;
    }
    for (const [index, item] of itemsToUpload.entries()) {
      const itemLabel = itemsToUpload.length > 1 ? `Uploading ${item.file.name} (${index + 1}/${itemsToUpload.length})` : `Uploading ${item.file.name}`;
      uploadProgress.value = `${itemLabel}…`;
      try {
        if (item.file.size >= CHUNK_SIZE_BYTES) {
          await uploadFileChunked(item.file, item.parentPath, pathInView, itemLabel);
        } else {
          await uploadFileSingle(item.file, item.parentPath, pathInView);
        }
      } catch (error) {
        console.error(error);
        uploadError.value = `(${item.file.name}): ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    isUploading.value = false;
  }
  return {
    isUploading,
    uploadProgress,
    uploadError,
    enqueueUpload
  };
}