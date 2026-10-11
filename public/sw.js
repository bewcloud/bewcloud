// Drives file uploads so they keep running across a page refresh: the fetch() calls that upload each file/chunk live here instead of in the page's JS, and this worker keeps executing through a same-tab reload. The page enqueues files and listens for progress on a BroadcastChannel; on mount (including right after a refresh) it queries this worker for any job already in flight.

const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const BROADCAST_CHANNEL_NAME = 'bewcloud-uploads';
// If the server dies mid-request (a restart/deploy), the socket can sit open with no RST and no response for minutes, so a plain fetch() neither resolves nor rejects: nothing left to catch, the queue never finishes, and the UI is stuck on "Uploading" forever. A timeout guarantees the request eventually fails instead.
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
// Long enough for a tab frozen mid-upload to pick up a failure on resync, short enough that it doesn't resurface on later visits.
const LAST_ERROR_TTL_MS = 5 * 60 * 1000;

const broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

let currentJob = null; // { queue: [{ file, parentPath, pathInView, overwrite, batchId }], uploadProgress, sessionTag, abortController, totalCount, uploadedCountByBatchId }

// A drop enqueues one file at a time, so its next file may start a new job after the queue drains.
let drainedCountByBatchId = null; // Map<batchId, uploaded count>

// Outlives the job so a tab that was frozen when the upload failed still gets the error on resync.
let lastError = null; // { id, message, kind, sessionTag, batchId, createdAt }

// A queue outlives the session that created it, so the upload endpoints refuse requests tagged with a session other than the one their cookie now belongs to. When that happens there's nothing left to retry: the rest of the queue is dropped instead of being uploaded as whoever is logged in now.
class UploadSessionGoneError extends Error {}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function broadcastState(extra = {}) {
  if (lastError && Date.now() - lastError.createdAt > LAST_ERROR_TTL_MS) {
    lastError = null;
  }

  broadcastChannel.postMessage({
    type: 'STATE',
    isUploading: Boolean(currentJob),
    uploadProgress: currentJob?.uploadProgress || '',
    sessionTag: currentJob?.sessionTag || '',
    kindsInProgress: getKindsInProgress(currentJob),
    kind: currentJob?.currentItemKind || '',
    error: lastError?.message || '',
    errorId: lastError?.id || '',
    errorKind: lastError?.kind || '',
    errorSessionTag: lastError?.sessionTag || '',
    // The tab clears it itself at this time, since this worker may not broadcast again (or even be running) by then.
    errorExpiresAt: lastError ? lastError.createdAt + LAST_ERROR_TTL_MS : 0,
    ...extra,
  });
}

function setLastError(job, fileName, message) {
  lastError = {
    // A UUID instead of a counter, since a restarted worker would reuse ids a tab has already seen.
    id: crypto.randomUUID(),
    message: `(${fileName}): ${message}`,
    kind: job.currentItemKind || 'file',
    sessionTag: job.sessionTag,
    batchId: job.currentItemBatchId,
    createdAt: Date.now(),
  };

  broadcastState();
}

// Rebuilt whenever totalCount changes too, not just when an item starts, since files of a drop join one at a time.
function updateUploadProgress(job) {
  if (job.currentItemCancelled || !job.currentFileName) {
    job.uploadProgress = '';
    return;
  }

  const itemNumber = job.totalCount - job.queue.length;
  const countLabel = job.totalCount > 1 ? ` (${itemNumber}/${job.totalCount})` : '';
  const chunkLabel = job.currentChunk ? `, chunk ${job.currentChunk.index + 1}/${job.currentChunk.total}` : '';
  job.uploadProgress = `Uploading ${job.currentFileName}${countLabel}${chunkLabel}…`;
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
    const previousAbortController = job.abortController;
    job.abortController = new AbortController();
    previousAbortController.abort();
  }

  updateUploadProgress(job);
  broadcastState();
}

// Drops one batch's items, leaving other batches alone. Same approach as handleDirectoryDeleted for the in-flight item.
function handleBatchAborted(job, batchId) {
  const currentAffected = !job.currentItemCancelled && job.currentItemBatchId === batchId;
  const queueLengthBefore = job.queue.length;
  job.queue = job.queue.filter((item) => item.batchId !== batchId);

  const removedCount = queueLengthBefore - job.queue.length + (currentAffected ? 1 : 0);
  job.totalCount = Math.max(0, job.totalCount - removedCount);

  if (currentAffected) {
    job.currentItemCancelled = true;
    job.currentItemKind = '';
    const previousAbortController = job.abortController;
    job.abortController = new AbortController();
    previousAbortController.abort();
  }

  updateUploadProgress(job);
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

async function uploadFileSingle(job, file, parentPath, pathInView, overwrite) {
  const requestBody = new FormData();
  requestBody.set('path_in_view', pathInView);
  requestBody.set('parent_path', parentPath);
  requestBody.set('name', file.name);
  requestBody.set('upload_session_tag', job.sessionTag);
  requestBody.set('overwrite', String(!!overwrite));
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

async function uploadFileChunked(job, file, parentPath, pathInView, overwrite) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  const uploadId = crypto.randomUUID();
  job.currentUploadId = uploadId;

  let completedResult = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    // Directory-delete swaps the job AbortController so later files can continue; that abort only cancels an in-flight fetch. Check between chunks or the rest of this file still gets written into the gone path.
    if (job.currentItemCancelled) {
      throw new Error('upload cancelled');
    }

    job.currentChunk = { index: chunkIndex, total: totalChunks };
    updateUploadProgress(job);
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
    requestBody.set('overwrite', String(!!overwrite));
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
    const { file, parentPath, pathInView, kind, overwrite, batchId } = job.queue.shift();

    job.currentFileName = file.name;
    job.currentChunk = undefined;
    job.currentItemKind = kind || 'file';
    job.currentItemParentPath = parentPath;
    job.currentItemBatchId = batchId;
    job.currentUploadId = undefined;
    job.currentItemCancelled = false;
    updateUploadProgress(job);
    broadcastState();

    try {
      const result = file.size >= CHUNK_SIZE_BYTES
        ? await uploadFileChunked(job, file, parentPath, pathInView, overwrite)
        : await uploadFileSingle(job, file, parentPath, pathInView, overwrite);

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

    if (batchId && !job.currentItemCancelled) {
      job.uploadedCountByBatchId.set(batchId, (job.uploadedCountByBatchId.get(batchId) || 0) + 1);
    }
  }

  drainedCountByBatchId = job.uploadedCountByBatchId;
  currentJob = null;
  broadcastState();
}

self.addEventListener('message', (event) => {
  const message = event.data;

  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.type === 'ABORT_UPLOADS') {
    // A batch id scopes the abort to one drop, since the session tag is shared by every view and tab. Without one (logout), everything goes.
    if (message.batchId) {
      if (currentJob && message.sessionTag === currentJob.sessionTag) {
        handleBatchAborted(currentJob, message.batchId);
      }

      return;
    }

    // Sent on logout, so the next user on this browser doesn't get this user's failure (basic auth shares an empty session tag).
    lastError = null;
    drainedCountByBatchId = null;

    if (!message.sessionTag || !currentJob || message.sessionTag === currentJob.sessionTag) {
      event.waitUntil(abandonCurrentJob());
    }

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
      // A drop enqueues each file as it's answered, so the queue can drain between two files of the same drop.
      const isSameBatchAsLastError = Boolean(lastError?.batchId) &&
        message.items.some((item) => item.batchId === lastError.batchId);

      if (!isSameBatchAsLastError) {
        lastError = null;
      }

      const continuedBatchId = message.items.find((item) => drainedCountByBatchId?.has(item.batchId))?.batchId;

      currentJob = {
        queue: [],
        uploadProgress: '',
        sessionTag: message.sessionTag,
        abortController: new AbortController(),
        totalCount: continuedBatchId ? drainedCountByBatchId.get(continuedBatchId) : 0,
        uploadedCountByBatchId: continuedBatchId ? drainedCountByBatchId : new Map(),
      };
      drainedCountByBatchId = null;
    }

    currentJob.queue.push(...message.items);
    currentJob.totalCount += message.items.length;

    updateUploadProgress(currentJob);
    broadcastState();

    if (isNewJob) {
      // 'message' events only keep this worker alive for as long as the handler is extended: without waitUntil, the browser can terminate the worker before processQueue's first fetch() even starts.
      event.waitUntil(processQueue(currentJob));
    }
  } else if (message.type === 'QUERY_STATE') {
    broadcastState();
  }
});
