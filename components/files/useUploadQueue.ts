import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import { ResponseBody as ChunkUploadResponseBody } from '/pages/api/files/upload-chunk.ts';
import { RequestBody as GetFilesRequestBody, ResponseBody as GetFilesResponseBody } from '/pages/api/files/get.ts';
import { postToUploadServiceWorker } from '/public/ts/service-worker.ts';

// 10 MB chunks keep each request faster.
const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;

interface UploadQueueItem {
  file: File;
  parentPath: string;
}

interface UseUploadQueueOptions {
  isEnabled: boolean;
  path: Signal<string>;
  files: Signal<DirectoryFile[]>;
  directories: Signal<Directory[]>;
  uploadSessionTag?: string;
  uploadKind?: 'file' | 'photo' | 'note';
}

// Uploads run inside a service worker (public/sw.js) so they survive a page refresh. This tab just enqueues files and listens for progress here; on mount it also queries whether a job is already running (e.g. right after a refresh) to hydrate the UI from it.
export function useUploadQueue(
  { isEnabled, path, files, directories, uploadSessionTag = '', uploadKind = 'file' }: UseUploadQueueOptions,
) {
  const isUploading = useSignal<boolean>(false);
  const uploadProgress = useSignal<string>('');
  const uploadError = useSignal<string>('');

  useEffect(() => {
    if (!isEnabled || !('serviceWorker' in navigator)) {
      return;
    }

    const uploadChannel = new BroadcastChannel('bewcloud-uploads');

    let lastSeenErrorId = 0;

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
        errorId?: number;
        errorKind?: string;
        errorSessionTag?: string;
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

      // The worker keeps the last error around so a tab that was frozen when it happened still gets it on resync, which means it rides on every later broadcast too. Only act on an id this tab hasn't seen, or one failure would be logged again on every progress tick.
      if (
        state.error && state.errorKind === uploadKind && state.errorSessionTag === uploadSessionTag &&
        state.errorId !== lastSeenErrorId
      ) {
        lastSeenErrorId = state.errorId!;
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

    // Prevents isUploading/uploadProgress from getting stuck
    function resyncState() {
      if (document.visibilityState === 'visible') {
        postToUploadServiceWorker({ type: 'QUERY_STATE', sessionTag: uploadSessionTag });
      }
    }

    document.addEventListener('visibilitychange', resyncState);
    globalThis.addEventListener('pageshow', resyncState);

    postToUploadServiceWorker({ type: 'QUERY_STATE', sessionTag: uploadSessionTag });

    return () => {
      uploadChannel.close();
      document.removeEventListener('visibilitychange', resyncState);
      globalThis.removeEventListener('pageshow', resyncState);
    };
  }, []);

  async function uploadFileSingle(file: File, parentPath: string, pathInView: string) {
    const requestBody = new FormData();
    requestBody.set('path_in_view', pathInView);
    requestBody.set('parent_path', parentPath);
    requestBody.set('name', file.name);
    requestBody.set('upload_session_tag', uploadSessionTag);
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

  async function uploadFileChunked(file: File, parentPath: string, pathInView: string, itemLabel: string) {
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

  // A directory's existing file names, for skipping upload items that would just hit "already exists".
  async function findExistingNames(parentPath: string): Promise<Set<string>> {
    try {
      const requestBody: GetFilesRequestBody = { parentPath };

      // Same reasoning as sw.js's fetchForJob: don't let a hung server response block the upload from ever starting.
      const response = await fetch('/api/files/get', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return new Set();
      }

      const result = await response.json() as GetFilesResponseBody;

      return new Set(result.files.map((file) => file.file_name));
    } catch (error) {
      console.error(error);
      // Fail open: an upload that turns out to clash still gets caught (just later, by the server) instead of being blocked by this check itself failing.
      return new Set();
    }
  }

  async function enqueueUpload(items: UploadQueueItem[]) {
    if (items.length === 0) {
      return;
    }

    // Capture once, before any await: the user may navigate away while the pre-upload existence check or the upload itself is in flight, which would change path.value and cause the eventual response to refresh the wrong directory listing.
    const pathInView = path.value;

    isUploading.value = true;
    uploadProgress.value = '';
    uploadError.value = '';

    const uniqueParentPaths = [...new Set(items.map((item) => item.parentPath))];
    const existingNamesByParentPath = new Map(
      await Promise.all(
        uniqueParentPaths.map(async (parentPath) => [parentPath, await findExistingNames(parentPath)] as const),
      ),
    );

    const itemsToUpload = items.filter((item) => {
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

    const wasEnqueuedInServiceWorker = isEnabled && await postToUploadServiceWorker({
      type: 'ENQUEUE_UPLOAD',
      sessionTag: uploadSessionTag,
      items: itemsToUpload.map((item) => ({ ...item, pathInView, kind: uploadKind })),
    });

    if (wasEnqueuedInServiceWorker) {
      return;
    }

    // Fallback for browsers/contexts without an active service worker: upload directly, as before.
    for (const [index, item] of itemsToUpload.entries()) {
      const itemLabel = itemsToUpload.length > 1
        ? `Uploading ${item.file.name} (${index + 1}/${itemsToUpload.length})`
        : `Uploading ${item.file.name}`;
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

  return { isUploading, uploadProgress, uploadError, enqueueUpload };
}
