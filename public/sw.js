// Drives file uploads so they keep running across a page refresh: the fetch() calls that upload each file/chunk live here instead of in the page's JS, and this worker keeps executing through a same-tab reload. The page enqueues files and listens for progress on a BroadcastChannel; on mount (including right after a refresh) it queries this worker for any job already in flight.

const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const BROADCAST_CHANNEL_NAME = 'bewcloud-uploads';
// If the server dies mid-request (a restart/deploy), the socket can sit open with no RST and no response for minutes, so a plain fetch() neither resolves nor rejects: nothing left to catch, the queue never finishes, and the UI is stuck on "Uploading" forever. A timeout guarantees the request eventually fails instead.
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

const broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

let currentJob = null; // { queue: [{ file, parentPath, pathInView }], uploadProgress, sessionTag, abortController }

// A queue outlives the session that created it, so the upload endpoints refuse requests tagged with a session other than the one their cookie now belongs to. When that happens there's nothing left to retry: the rest of the queue is dropped instead of being uploaded as whoever is logged in now.
class UploadSessionGoneError extends Error {}

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
    sessionTag: currentJob?.sessionTag || '',
    ...extra,
  });
}

function abandonCurrentJob() {
  currentJob?.abortController.abort();
  currentJob = null;

  broadcastState();
}

// A 403 is the endpoints refusing this queue's session tag, and a redirect means there's no session left at all (the request was bounced to the login page).
function throwIfUploadSessionIsGone(response) {
  if (response.status === 403 || response.redirected) {
    throw new UploadSessionGoneError('upload cancelled, this session is no longer valid');
  }
}

// fetch() tied to the job's own AbortController so the request cancels when the job is abandoned, plus a timeout so a server that's gone dark doesn't hang it forever.
async function fetchForJob(job, url, options) {
  const timeoutController = new AbortController();

  if (job.abortController.signal.aborted) {
    timeoutController.abort();
  }

  const onJobAbort = () => timeoutController.abort();
  job.abortController.signal.addEventListener('abort', onJobAbort);

  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error(`Request to ${url} timed out`)),
    REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(url, { ...options, signal: timeoutController.signal });
  } finally {
    clearTimeout(timeoutId);
    job.abortController.signal.removeEventListener('abort', onJobAbort);
  }
}

async function uploadFileSingle(job, file, parentPath, pathInView) {
  const requestBody = new FormData();
  requestBody.set('path_in_view', pathInView);
  requestBody.set('parent_path', parentPath);
  requestBody.set('name', file.name);
  requestBody.set('upload_session_tag', job.sessionTag);
  requestBody.set('contents', file);

  const response = await fetchForJob(job, '/api/files/upload', { method: 'POST', body: requestBody });

  throwIfUploadSessionIsGone(response);

  if (!response.ok) {
    throw new Error(`Failed to upload file. ${response.statusText} ${await response.text()}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to upload file!');
  }

  return { newFiles: result.newFiles, newDirectories: result.newDirectories };
}

async function uploadFileChunked(job, file, parentPath, pathInView) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  const uploadId = crypto.randomUUID();

  let completedResult = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    job.uploadProgress = `Uploading ${file.name} (${chunkIndex + 1}/${totalChunks})…`;
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
    requestBody.set('upload_session_tag', job.sessionTag);
    requestBody.set('chunk', chunkBlob);

    const response = await fetchForJob(job, '/api/files/upload-chunk', { method: 'POST', body: requestBody });

    throwIfUploadSessionIsGone(response);

    if (!response.ok) {
      throw new Error(
        `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}. ${response.statusText} ${await response.text()}`,
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || `Failed to upload chunk ${chunkIndex + 1}/${totalChunks}!`);
    }

    if (result.isComplete) {
      completedResult = { newFiles: result.newFiles, newDirectories: result.newDirectories };
    }
  }

  return completedResult;
}

async function processQueue(job) {
  while (job.queue.length > 0) {
    const { file, parentPath, pathInView } = job.queue.shift();

    job.uploadProgress = '';
    broadcastState();

    try {
      const result = file.size >= CHUNK_SIZE_BYTES
        ? await uploadFileChunked(job, file, parentPath, pathInView)
        : await uploadFileSingle(job, file, parentPath, pathInView);

      if (result) {
        broadcastState({ ...result, pathInView });
      }
    } catch (error) {
      // The job was already abandoned while this upload was in flight, so its aborted fetch has nothing left to report.
      if (currentJob !== job) {
        return;
      }

      if (error instanceof UploadSessionGoneError) {
        const droppedCount = job.queue.length + 1;

        console.error(error);
        broadcastState({
          error: `${file.name}: ${error.message} (${droppedCount} upload${droppedCount === 1 ? '' : 's'} dropped).`,
        });
        abandonCurrentJob();

        return;
      }

      console.error(error);
      broadcastState({ error: `${file.name}: ${String(error?.message || error)}` });
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

  if (currentJob && message.sessionTag !== currentJob.sessionTag) {
    abandonCurrentJob();
  }

  if (message.type === 'ENQUEUE_UPLOAD') {
    const isNewJob = !currentJob;

    if (isNewJob) {
      currentJob = {
        queue: [],
        uploadProgress: '',
        sessionTag: message.sessionTag,
        abortController: new AbortController(),
      };
    }

    currentJob.queue.push(...message.items);

    broadcastState();

    if (isNewJob) {
      // 'message' events only keep this worker alive for as long as the handler is extended: without waitUntil, the browser can terminate the worker before processQueue's first fetch() even starts.
      event.waitUntil(processQueue(currentJob));
    }
  } else if (message.type === 'QUERY_STATE') {
    broadcastState();
  }
});
