// Drives file uploads so they keep running across a page refresh: the fetch() calls that upload each file/chunk live here instead of in the page's JS, and this worker keeps executing through a same-tab reload. The page enqueues files and listens for progress on a BroadcastChannel; on mount (including right after a refresh) it queries this worker for any job already in flight.

const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const BROADCAST_CHANNEL_NAME = 'bewcloud-uploads';
// If the server dies mid-request (a restart/deploy), the socket can sit open with no RST and no response for minutes, so a plain fetch() neither resolves nor rejects: nothing left to catch, the queue never finishes, and the UI is stuck on "Uploading" forever. A timeout guarantees the request eventually fails instead.
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

const broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

let currentJob = null; // { queue: [{ file, parentPath, pathInView }], uploadProgress, sessionTag, abortController, totalCount }

// The tab that needs to see a failure is often the one that was frozen when it happened, and by the time it asks for state again the job is gone, so the last error is kept out here instead of on the job. The id lets a tab tell a re-broadcast of an error it already showed from a new one, so the same failure isn't logged on every later progress tick.
let lastError = null; // { id, message, kind, sessionTag }
let lastErrorId = 0;

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
    kindsInProgress: getKindsInProgress(currentJob),
    kind: currentJob?.currentItemKind || '',
    error: lastError?.message || '',
    errorId: lastError?.id || 0,
    errorKind: lastError?.kind || '',
    errorSessionTag: lastError?.sessionTag || '',
    ...extra,
  });
}

function setLastError(job, fileName, message) {
  lastError = {
    id: ++lastErrorId,
    message: `(${fileName}): ${message}`,
    kind: job.currentItemKind || 'file',
    sessionTag: job.sessionTag,
  };

  broadcastState();
}

function abandonCurrentJob() {
  const job = currentJob;

  job?.abortController.abort();
  currentJob = null;

  broadcastState();
  return cleanupAbortedChunkUpload(job);
}

// Best-effort: if a chunked upload was mid-flight when the job got abandoned, tell the server to drop whatever chunks it already received instead of leaving them in .chunk-uploads until the 24h stale sweep.
async function cleanupAbortedChunkUpload(job) {
  if (!job?.currentUploadId) {
    return;
  }

  const uploadId = job.currentUploadId;
  job.currentUploadId = undefined;

  try {
    await fetch('/api/files/upload-abort', {
      method: 'POST',
      body: JSON.stringify({ upload_id: uploadId, upload_session_tag: job.sessionTag }),
    });
  } catch {
    // Best-effort only - the 24h stale sweep still catches it if this fails.
  }
}

function isUnderDeletedPath(parentPath, deletedPath) {
  return typeof parentPath === 'string' && parentPath.startsWith(deletedPath);
}

// Drops queued items that would land in the directory that just got deleted (or a subdirectory of it), without touching queued items for anywhere else. If the in-flight item is affected, only that fetch is aborted: replace the job AbortController so later items can still run.
function handleDirectoryDeleted(job, deletedPath) {
  const currentAffected = !job.currentItemCancelled && isUnderDeletedPath(job.currentItemParentPath, deletedPath);
  const queueLengthBefore = job.queue.length;
  job.queue = job.queue.filter((item) => !isUnderDeletedPath(item.parentPath, deletedPath));

  const removedCount = queueLengthBefore - job.queue.length + (currentAffected ? 1 : 0);
  job.totalCount = Math.max(0, job.totalCount - removedCount);

  if (currentAffected) {
    job.currentItemCancelled = true;
    job.currentItemKind = '';
    job.uploadProgress = '';
    const previousAbortController = job.abortController;
    job.abortController = new AbortController();
    previousAbortController.abort();
  }

  broadcastState();
}

// A 403 is the endpoints refusing this queue's session tag, and a redirect means there's no session left at all (the request was bounced to the login page). The upload endpoints use 503, not 403, when they're refusing for an unrelated reason (the app is disabled), so 403 here means the session specifically.
function throwIfUploadSessionIsGone(response) {
  if (response.status === 403 || response.redirected) {
    throw new UploadSessionGoneError('upload cancelled, this session is no longer valid');
  }
}

// Kinds still represented in the job: whatever's still queued, plus whatever's mid-flight (already shifted off the queue). Lets each tab's hook show "uploading" only for its own kind of upload (e.g. Notes shouldn't light up while Files is uploading).
function getKindsInProgress(job) {
  if (!job) {
    return [];
  }

  const kinds = new Set(job.queue.map((item) => item.kind || 'file'));

  if (job.currentItemKind) {
    kinds.add(job.currentItemKind);
  }

  return [...kinds];
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
  job.currentUploadId = uploadId;

  let completedResult = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    // Directory-delete swaps the job AbortController so later files can continue; that abort only cancels an in-flight fetch. Check between chunks or the rest of this file still gets written into the gone path.
    if (job.currentItemCancelled) {
      throw new Error('upload cancelled');
    }

    const itemNumber = job.totalCount - job.queue.length;
    job.uploadProgress = job.totalCount > 1
      ? `Uploading ${file.name} (${itemNumber}/${job.totalCount}), chunk ${chunkIndex + 1}/${totalChunks}…`
      : `Uploading ${file.name}, chunk ${chunkIndex + 1}/${totalChunks}…`;
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
    const { file, parentPath, pathInView, kind } = job.queue.shift();

    const itemNumber = job.totalCount - job.queue.length;
    job.uploadProgress = job.totalCount > 1
      ? `Uploading ${file.name} (${itemNumber}/${job.totalCount})…`
      : `Uploading ${file.name}…`;
    job.currentItemKind = kind || 'file';
    job.currentItemParentPath = parentPath;
    job.currentUploadId = undefined;
    job.currentItemCancelled = false;
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

      if (job.currentItemCancelled) {
        await cleanupAbortedChunkUpload(job);
        continue;
      }

      if (error instanceof UploadSessionGoneError) {
        const droppedCount = job.queue.length + 1;

        console.error(error);
        setLastError(
          job,
          file.name,
          `${error.message} (${droppedCount} upload${droppedCount === 1 ? '' : 's'} dropped).`,
        );
        await abandonCurrentJob();

        return;
      }

      console.error(error);
      await cleanupAbortedChunkUpload(job);
      setLastError(job, file.name, String(error?.message || error));
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

  if (message.type === 'ABORT_UPLOADS') {
    event.waitUntil(abandonCurrentJob());
    return;
  }

  // Sent by the page after it deletes a directory, so a queue still writing into it (or a subdirectory of it) doesn't keep going against a destination that's gone.
  if (message.type === 'DIRECTORY_DELETED') {
    if (currentJob && message.sessionTag === currentJob.sessionTag) {
      handleDirectoryDeleted(currentJob, message.path);
    }

    return;
  }

  if (currentJob && message.sessionTag !== currentJob.sessionTag) {
    event.waitUntil(abandonCurrentJob());
  }

  if (message.type === 'ENQUEUE_UPLOAD') {
    const isNewJob = !currentJob;

    if (isNewJob) {
      lastError = null;
      currentJob = {
        queue: [],
        uploadProgress: '',
        sessionTag: message.sessionTag,
        abortController: new AbortController(),
        totalCount: 0,
      };
    }

    currentJob.queue.push(...message.items);
    currentJob.totalCount += message.items.length;

    broadcastState();

    if (isNewJob) {
      // 'message' events only keep this worker alive for as long as the handler is extended: without waitUntil, the browser can terminate the worker before processQueue's first fetch() even starts.
      event.waitUntil(processQueue(currentJob));
    }
  } else if (message.type === 'QUERY_STATE') {
    broadcastState();
  }
});
