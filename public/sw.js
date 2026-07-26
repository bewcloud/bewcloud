// Drives file uploads so they keep running across a page refresh: the fetch() calls that upload each file/chunk live here instead of in the page's JS, and this worker keeps executing through a same-tab reload. The page enqueues files and listens for progress on a BroadcastChannel; on mount (including right after a refresh) it queries this worker for any job already in flight.

const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const BROADCAST_CHANNEL_NAME = 'bewcloud-uploads';

const broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

let currentJob = null; // { queue: [{ file, parentPath, pathInView }], uploadProgress }

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function broadcastState(extra = {}) {
  broadcastChannel.postMessage({
    type: 'STATE',
    isUploading: Boolean(currentJob),
    uploadProgress: currentJob?.uploadProgress || '',
    ...extra,
  });
}

async function uploadFileSingle(file, parentPath, pathInView) {
  const requestBody = new FormData();
  requestBody.set('path_in_view', pathInView);
  requestBody.set('parent_path', parentPath);
  requestBody.set('name', file.name);
  requestBody.set('contents', file);

  const response = await fetch('/api/files/upload', { method: 'POST', body: requestBody });

  if (!response.ok) {
    throw new Error(`Failed to upload file. ${response.statusText} ${await response.text()}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error('Failed to upload file!');
  }

  return { newFiles: result.newFiles, newDirectories: result.newDirectories };
}

async function uploadFileChunked(file, parentPath, pathInView) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  const uploadId = crypto.randomUUID();

  let completedResult = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    currentJob.uploadProgress = `Uploading ${file.name} (${chunkIndex + 1}/${totalChunks})…`;
    broadcastState();

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
    requestBody.set('chunk', chunkBlob);

    const response = await fetch('/api/files/upload-chunk', { method: 'POST', body: requestBody });

    if (!response.ok) {
      throw new Error(
        `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}. ${response.statusText} ${await response.text()}`,
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}!`);
    }

    if (result.isComplete) {
      completedResult = { newFiles: result.newFiles, newDirectories: result.newDirectories };
    }
  }

  return completedResult;
}

async function processQueue() {
  while (currentJob.queue.length > 0) {
    const { file, parentPath, pathInView } = currentJob.queue.shift();

    currentJob.uploadProgress = '';
    broadcastState();

    try {
      const result = file.size >= CHUNK_SIZE_BYTES
        ? await uploadFileChunked(file, parentPath, pathInView)
        : await uploadFileSingle(file, parentPath, pathInView);

      if (result) {
        broadcastState({ ...result, pathInView });
      }
    } catch (error) {
      console.error(error);
      broadcastState({ error: String(error?.message || error) });
    }
  }

  currentJob = null;
  broadcastState();
}

self.addEventListener('message', (event) => {
  const message = event.data;

  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type === 'ENQUEUE_UPLOAD') {
    const isNewJob = !currentJob;

    if (isNewJob) {
      currentJob = { queue: [], uploadProgress: '' };
    }

    currentJob.queue.push(...message.items);

    broadcastState();

    if (isNewJob) {
      // 'message' events only keep this worker alive for as long as the handler is extended: without waitUntil, the browser can terminate the worker before processQueue's first fetch() even starts.
      event.waitUntil(processQueue());
    }
  } else if (message.type === 'QUERY_STATE') {
    broadcastState();
  }
});
