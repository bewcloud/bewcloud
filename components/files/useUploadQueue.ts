import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import { ResponseBody as ChunkUploadResponseBody } from '/pages/api/files/upload-chunk.ts';
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';
import { fetchExistingNames } from './existingFileNames.ts';

// 10 MB chunks keep each request faster.
const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;

interface UploadQueueItem {
  file: File;
  parentPath: string;
  overwrite?: boolean;
  // Identifies the drop this item came from, so aborting that drop's conflict prompt drops only its own items from the worker's queue.
  batchId?: string;
}

interface UseUploadQueueOptions {
  isEnabled: boolean;
  path: Signal<string>;
  files: Signal<DirectoryFile[]>;
  directories: Signal<Directory[]>;
  uploadSessionTag?: string;
  uploadKind?: 'file' | 'photo' | 'note';
  checkExistingFiles?: boolean;
}

// Uploads run inside a service worker (public/sw.js) so they survive a page refresh. This tab just enqueues files and listens for progress here; on mount it also queries whether a job is already running (e.g. right after a refresh) to hydrate the UI from it.
export function useUploadQueue(
  {
    isEnabled,
    path,
    files,
    directories,
    uploadSessionTag = '',
    uploadKind = 'file',
    checkExistingFiles = true,
  }: UseUploadQueueOptions,
) {
  const isUploading = useSignal<boolean>(false);
  const uploadProgress = useSignal<string>('');
  const uploadError = useSignal<string>('');

  useEffect(() => {
    if (!isEnabled || !('serviceWorker' in navigator)) {
      return;
    }

    const uploadChannel = new BroadcastChannel('bewcloud-uploads');

    uploadChannel.onmessage = (event) => {
      const state = event.data as {
        type: string;
        isUploading: boolean;
        uploadProgress: string;
        kindsInProgress?: string[];
        kind?: string;
        newFiles?: DirectoryFile[];
        newDirectories?: Directory[];
        pathInView?: string;
        error?: string;
        sessionTag?: string;
      };

      if (!state || state.type !== 'STATE') {
        return;
      }

      if (state.sessionTag && state.sessionTag !== uploadSessionTag) {
        return;
      }

      isUploading.value = state.kindsInProgress ? state.kindsInProgress.includes(uploadKind) : state.isUploading;
      uploadProgress.value = state.kind === uploadKind ? (state.uploadProgress || '') : '';

      if (state.error && state.kind === uploadKind) {
        console.error(new Error(state.error));
        uploadError.value = state.error;
      }

      // Only apply the file/directory listing from an upload if it matches this tab's own current path; another tab may have uploaded into a different directory.
      if (state.newFiles && state.pathInView === path.value) {
        files.value = [...state.newFiles];
      }

      if (state.newDirectories && state.pathInView === path.value) {
        directories.value = [...state.newDirectories];
      }
    };

    postToUploadServiceWorker({ type: 'QUERY_STATE', sessionTag: uploadSessionTag });

    return () => {
      uploadChannel.close();
    };
  }, []);

  async function uploadFileSingle(file: File, parentPath: string, pathInView: string, overwrite: boolean) {
    const requestBody = new FormData();
    requestBody.set('path_in_view', pathInView);
    requestBody.set('parent_path', parentPath);
    requestBody.set('name', file.name);
    requestBody.set('upload_session_tag', uploadSessionTag);
    requestBody.set('overwrite', String(overwrite));
    requestBody.set('contents', file);

    const response = await fetch(`/api/files/upload`, {
      method: 'POST',
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file. ${response.statusText} ${await response.text()}`);
    }

    const result = await response.json() as UploadResponseBody;

    if (!result.success) {
      throw new Error(result.error || 'Failed to upload file!');
    }

    files.value = [...result.newFiles];
    directories.value = [...result.newDirectories];
  }

  async function uploadFileChunked(file: File, parentPath: string, pathInView: string, overwrite: boolean) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
    const uploadId = crypto.randomUUID();

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        uploadProgress.value = `Uploading ${file.name} (${chunkIndex + 1}/${totalChunks})…`;

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
        requestBody.set('overwrite', String(overwrite));
        requestBody.set('chunk', chunkBlob);

        const response = await fetch(`/api/files/upload-chunk`, {
          method: 'POST',
          body: requestBody,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}. ${response.statusText} ${await response.text()}`,
          );
        }

        const result = await response.json() as ChunkUploadResponseBody;

        if (!result.success) {
          throw new Error(result.error || `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}!`);
        }

        if (result.isComplete) {
          files.value = [...result.newFiles!];
          directories.value = [...result.newDirectories!];
        }
      }
    } catch (error) {
      fetch('/api/files/upload-abort', {
        method: 'POST',
        body: JSON.stringify({ upload_id: uploadId, upload_session_tag: uploadSessionTag }),
      }).catch(() => {});
      throw error;
    }
  }

  async function enqueueUpload(items: UploadQueueItem[]) {
    if (items.length === 0) {
      // A caller (like useDragAndDropUpload after a "Skip All") may resolve every candidate to nothing left to upload. Still clear any stale isUploading/error from a previous run, or that leftover state keeps showing after this no-op call.
      isUploading.value = false;
      uploadProgress.value = '';
      uploadError.value = '';
      return;
    }

    // Capture once, before any await: the user may navigate away while the pre-upload existence check or the upload itself is in flight, which would change path.value and cause the eventual response to refresh the wrong directory listing.
    const pathInView = path.value;

    // A drop is enqueued file by file as each conflict is answered (see useDragAndDropUpload), and clears these itself before it starts. By then it may already have reported a clash of its own, so a batched item never resets them here.
    const isPartOfBatch = items.some((item) => item.batchId);

    if (!isPartOfBatch) {
      uploadProgress.value = '';
      uploadError.value = '';
    }

    isUploading.value = true;

    let itemsToUpload = items;

    if (checkExistingFiles) {
      const uniqueParentPaths = [...new Set(items.map((item) => item.parentPath))];
      const existingNamesByParentPath = new Map(
        await Promise.all(
          uniqueParentPaths.map(
            async (parentPath) => [parentPath, await fetchExistingNames(parentPath)] as const,
          ),
        ),
      );

      itemsToUpload = items.filter((item) => {
        if (existingNamesByParentPath.get(item.parentPath)?.fileNames.has(item.file.name)) {
          uploadError.value = `${item.file.name}: A file with this name already exists.`;
          return false;
        }

        return true;
      });
    }

    if (itemsToUpload.length === 0) {
      isUploading.value = false;
      return;
    }

    const wasEnqueuedInServiceWorker = isEnabled && await postToUploadServiceWorker({
      type: 'ENQUEUE_UPLOAD',
      sessionTag: uploadSessionTag,
      items: itemsToUpload.map((item) => ({ ...item, pathInView, kind: uploadKind })),
    });

    if (wasEnqueuedInServiceWorker) {
      return;
    }

    // Fallback for browsers/contexts without an active service worker: upload directly, as before.
    for (const item of itemsToUpload) {
      try {
        if (item.file.size >= CHUNK_SIZE_BYTES) {
          await uploadFileChunked(item.file, item.parentPath, pathInView, !!item.overwrite);
        } else {
          await uploadFileSingle(item.file, item.parentPath, pathInView, !!item.overwrite);
        }
      } catch (error) {
        console.error(error);
        uploadError.value = `${item.file.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    isUploading.value = false;
  }

  return { isUploading, uploadProgress, uploadError, enqueueUpload };
}
