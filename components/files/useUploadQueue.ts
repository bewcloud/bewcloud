import { Signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { ResponseBody as UploadResponseBody } from '/pages/api/files/upload.ts';
import { ResponseBody as ChunkUploadResponseBody } from '/pages/api/files/upload-chunk.ts';

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
}

// Uploads run inside a service worker (public/sw.js) so they survive a page refresh. This tab just enqueues files and listens for progress here; on mount it also queries whether a job is already running (e.g. right after a refresh) to hydrate the UI from it.
export function useUploadQueue({ isEnabled, path, files, directories, uploadSessionTag = '' }: UseUploadQueueOptions) {
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

      isUploading.value = state.isUploading;
      uploadProgress.value = state.uploadProgress || '';

      if (state.error) {
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

    async function queryUploadState() {
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'QUERY_STATE', sessionTag: uploadSessionTag });
      } catch (error) {
        console.error(error);
      }
    }

    queryUploadState();

    return () => {
      uploadChannel.close();
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
      throw new Error('Failed to upload file!');
    }

    files.value = [...result.newFiles];
    directories.value = [...result.newDirectories];
  }

  async function uploadFileChunked(file: File, parentPath: string, pathInView: string) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
    const uploadId = crypto.randomUUID();

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
        throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}!`);
      }

      if (result.isComplete) {
        files.value = [...result.newFiles!];
        directories.value = [...result.newDirectories!];
      }
    }
  }

  function enqueueUpload(items: UploadQueueItem[]) {
    if (items.length === 0) {
      return;
    }

    // Capture once: the user may navigate away during a long upload, which would change path.value and cause the final response to refresh the wrong directory listing.
    const pathInView = path.value;

    isUploading.value = true;
    uploadProgress.value = '';
    uploadError.value = '';

    const serviceWorker = isEnabled ? navigator.serviceWorker?.controller : undefined;

    if (serviceWorker) {
      serviceWorker.postMessage({
        type: 'ENQUEUE_UPLOAD',
        sessionTag: uploadSessionTag,
        items: items.map((item) => ({ ...item, pathInView })),
      });

      return;
    }

    // Fallback for browsers/contexts without an active service worker: upload directly, as before.
    (async () => {
      for (const item of items) {
        try {
          if (item.file.size >= CHUNK_SIZE_BYTES) {
            await uploadFileChunked(item.file, item.parentPath, pathInView);
          } else {
            await uploadFileSingle(item.file, item.parentPath, pathInView);
          }
        } catch (error) {
          console.error(error);
          uploadError.value = `${item.file.name}: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      isUploading.value = false;
    })();
  }

  return { isUploading, uploadProgress, uploadError, enqueueUpload };
}
