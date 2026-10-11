import { assertEquals } from '@std/assert';

interface BroadcastState {
  type: string;
  isUploading: boolean;
  uploadProgress: string;
  error: string;
  errorId: string;
  errorKind: string;
  errorSessionTag: string;
  errorExpiresAt: number;
}

const broadcasts: BroadcastState[] = [];
let messageListener: (event: { data: unknown; waitUntil: (promise: Promise<unknown>) => void }) => void;
let pendingWork: Promise<unknown>[] = [];

// sw.js is a plain worker script, so stub the worker globals it touches before loading it.
(globalThis as any).BroadcastChannel = class {
  postMessage(message: BroadcastState) {
    broadcasts.push(message);
  }
};

const originalAddEventListener = globalThis.addEventListener;
(globalThis as any).addEventListener = (type: string, listener: typeof messageListener) => {
  if (type === 'message') {
    messageListener = listener;
  }
};
await import('./sw.js');
globalThis.addEventListener = originalAddEventListener;

const sessionTag = 'session-a';

function postMessage(data: Record<string, unknown>) {
  messageListener({ data, waitUntil: (promise) => pendingWork.push(promise) });
}

async function settle() {
  while (pendingWork.length > 0) {
    const work = pendingWork;
    pendingWork = [];
    await Promise.all(work);
  }
}

function lastBroadcast() {
  return broadcasts[broadcasts.length - 1];
}

function makeItem(name: string, { parentPath = '/', batchId }: { parentPath?: string; batchId?: string } = {}) {
  return { file: new File(['contents'], name), parentPath, pathInView: '/', kind: 'file', batchId };
}

async function withFetch(fetchStub: typeof fetch, test: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = fetchStub;
  console.error = () => {};

  try {
    postMessage({ type: 'ABORT_UPLOADS' });
    await settle();
    broadcasts.length = 0;

    await test();
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
}

// Every upload hangs until released (or aborted), so a test can act while a given file is in flight.
function stubHangingFetch() {
  const started: string[] = [];
  const aborted: string[] = [];
  const releases = new Map<string, () => void>();

  globalThis.fetch = ((_url: string, options: RequestInit) => {
    const name = (options.body as FormData).get('name') as string;
    started.push(name);

    return new Promise<Response>((resolve, reject) => {
      releases.set(name, () => resolve(Response.json({ success: true, newFiles: [], newDirectories: [] })));
      options.signal?.addEventListener('abort', () => {
        aborted.push(name);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }) as typeof fetch;

  return { started, aborted, release: (name: string) => releases.get(name)?.() };
}

async function untilStarted(started: string[], count: number) {
  while (started.length < count) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Each label once per run of identical broadcasts.
function progressLabels() {
  return broadcasts.map((broadcast) => broadcast.uploadProgress).filter((label, index, labels) =>
    label && label !== labels[index - 1]
  );
}

function failingFetch() {
  return Promise.resolve(new Response('nope', { status: 500, statusText: 'Internal Server Error' }));
}

function succeedingFetch() {
  return Promise.resolve(Response.json({ success: true, newFiles: [], newDirectories: [] }));
}

Deno.test('that the last upload error survives the job ending and is restored on resync', async () => {
  await withFetch(failingFetch, async () => {
    const startedAt = Date.now();
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt')] });
    await settle();

    const finished = lastBroadcast();
    const lastErrorTtlMs = 5 * 60 * 1000;
    assertEquals(finished.errorExpiresAt >= startedAt + lastErrorTtlMs, true);
    assertEquals(finished.errorExpiresAt <= Date.now() + lastErrorTtlMs, true);
    assertEquals(finished.isUploading, false);
    assertEquals(finished.error, '(a.txt): Failed to upload file. Internal Server Error nope');
    assertEquals(finished.errorKind, 'file');
    assertEquals(finished.errorSessionTag, sessionTag);

    postMessage({ type: 'QUERY_STATE', sessionTag });

    assertEquals(lastBroadcast().error, finished.error);
    assertEquals(lastBroadcast().errorId, finished.errorId);
  });
});

Deno.test('that every upload failure gets a new error id', async () => {
  await withFetch(failingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt'), makeItem('b.txt')] });
    await settle();

    const errorIds = new Set(broadcasts.map((broadcast) => broadcast.errorId).filter(Boolean));
    assertEquals(errorIds.size, 2);
  });
});

Deno.test('that a new upload job clears the last upload error', async () => {
  await withFetch(failingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt')] });
    await settle();

    globalThis.fetch = succeedingFetch;
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('b.txt')] });
    await settle();

    assertEquals(lastBroadcast().error, '');
    assertEquals(lastBroadcast().errorId, '');
  });
});

Deno.test('that aborting uploads (logout) clears the last upload error', async () => {
  await withFetch(failingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag: '', items: [makeItem('a.txt')] });
    await settle();
    assertEquals(lastBroadcast().error, '(a.txt): Failed to upload file. Internal Server Error nope');

    postMessage({ type: 'ABORT_UPLOADS' });
    await settle();
    postMessage({ type: 'QUERY_STATE', sessionTag: '' });

    assertEquals(lastBroadcast().error, '');
    assertEquals(lastBroadcast().errorId, '');
    assertEquals(lastBroadcast().errorExpiresAt, 0);
  });
});

Deno.test('that deleting the in-flight upload directory twice only removes it from the total once', async () => {
  // Hangs until aborted, so both deletes land while the first upload is still in flight.
  const hangingFetch = (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    );

  await withFetch(hangingFetch, async () => {
    postMessage({
      type: 'ENQUEUE_UPLOAD',
      sessionTag,
      items: [
        makeItem('a.txt', { parentPath: '/deleted/' }),
        makeItem('b.txt', { parentPath: '/kept/' }),
        makeItem('c.txt', { parentPath: '/kept/' }),
      ],
    });

    globalThis.fetch = succeedingFetch;
    postMessage({ type: 'DIRECTORY_DELETED', sessionTag, path: '/deleted/' });
    postMessage({ type: 'DIRECTORY_DELETED', sessionTag, path: '/deleted/' });
    await settle();

    const progress = [...new Set(broadcasts.map((broadcast) => broadcast.uploadProgress).filter(Boolean))];
    assertEquals(progress, ['Uploading a.txt (1/3)…', 'Uploading b.txt (1/2)…', 'Uploading c.txt (2/2)…']);
  });
});

Deno.test('that aborting one drop leaves an earlier drop that is uploading alone', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, aborted, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('first.txt', { batchId: 'first-drop' })] });
    await untilStarted(started, 1);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('second.txt', { batchId: 'second-drop' })] });
    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'second-drop' });

    release('first.txt');
    await settle();

    assertEquals(started, ['first.txt']);
    assertEquals(aborted, []);
  });
});

Deno.test('that aborting the drop that is uploading cancels it, but the next drop still uploads', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, aborted, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('first.txt', { batchId: 'first-drop' })] });
    await untilStarted(started, 1);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('second.txt', { batchId: 'second-drop' })] });
    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'first-drop' });

    await untilStarted(started, 2);
    release('second.txt');
    await settle();

    assertEquals(started, ['first.txt', 'second.txt']);
    assertEquals(aborted, ['first.txt']);
  });
});

Deno.test('that aborting a queued drop removes its items from the total', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, release } = stubHangingFetch();

    postMessage({
      type: 'ENQUEUE_UPLOAD',
      sessionTag,
      items: [makeItem('a.txt', { batchId: 'first-drop' }), makeItem('b.txt', { batchId: 'first-drop' })],
    });
    await untilStarted(started, 1);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('c.txt', { batchId: 'second-drop' })] });
    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'second-drop' });

    release('a.txt');
    await untilStarted(started, 2);
    release('b.txt');
    await settle();

    assertEquals(progressLabels(), [
      'Uploading a.txt (1/2)…',
      'Uploading a.txt (1/3)…',
      'Uploading a.txt (1/2)…',
      'Uploading b.txt (2/2)…',
    ]);
  });
});

Deno.test('that a drop keeps its last error when its next file starts a new job, but a batch abort does not clear it', async () => {
  await withFetch(failingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt', { batchId: 'first-drop' })] });
    await settle();
    const failure = lastBroadcast().error;
    assertEquals(failure, '(a.txt): Failed to upload file. Internal Server Error nope');

    globalThis.fetch = succeedingFetch;
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('b.txt', { batchId: 'first-drop' })] });
    await settle();
    assertEquals(lastBroadcast().error, failure);

    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'first-drop' });
    postMessage({ type: 'QUERY_STATE', sessionTag });
    assertEquals(lastBroadcast().error, failure);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('c.txt', { batchId: 'second-drop' })] });
    await settle();
    assertEquals(lastBroadcast().error, '');
  });
});

Deno.test('that the in-flight label counts files of its drop that are enqueued while it uploads', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt', { batchId: 'drop' })] });
    await untilStarted(started, 1);
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('b.txt', { batchId: 'drop' })] });
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('c.txt', { batchId: 'drop' })] });

    release('a.txt');
    await untilStarted(started, 2);
    release('b.txt');
    await untilStarted(started, 3);
    release('c.txt');
    await settle();

    assertEquals(progressLabels(), [
      'Uploading a.txt…',
      'Uploading a.txt (1/2)…',
      'Uploading a.txt (1/3)…',
      'Uploading b.txt (2/3)…',
      'Uploading c.txt (3/3)…',
    ]);
  });
});

Deno.test('that a drop keeps counting when its next file starts a new job, but another drop starts over', async () => {
  await withFetch(succeedingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('d.txt', { batchId: 'first-drop' })] });
    await settle();
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('e.txt', { batchId: 'first-drop' })] });
    await settle();
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('f.txt', { batchId: 'second-drop' })] });
    await settle();

    assertEquals(progressLabels(), ['Uploading d.txt…', 'Uploading e.txt (2/2)…', 'Uploading f.txt…']);
  });
});

Deno.test('that a drop that joined a drained job carries over only its own count', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a1.txt', { batchId: 'drop-a' })] });
    await untilStarted(started, 1);
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a2.txt', { batchId: 'drop-a' })] });
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a3.txt', { batchId: 'drop-a' })] });
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('b1.txt', { batchId: 'drop-b' })] });

    for (const [index, name] of ['a1.txt', 'a2.txt', 'a3.txt', 'b1.txt'].entries()) {
      await untilStarted(started, index + 1);
      release(name);
    }
    await settle();
    broadcasts.length = 0;

    globalThis.fetch = succeedingFetch;
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('b2.txt', { batchId: 'drop-b' })] });
    await settle();
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a4.txt', { batchId: 'drop-a' })] });
    await settle();

    assertEquals(progressLabels(), ['Uploading b2.txt (2/2)…', 'Uploading a4.txt (4/4)…']);
  });
});

Deno.test('that a file cancelled after its response arrived does not count towards its drop in a new job', async () => {
  await withFetch(succeedingFetch, async () => {
    const { started, release } = stubHangingFetch();

    postMessage({
      type: 'ENQUEUE_UPLOAD',
      sessionTag,
      items: [makeItem('a1.txt', { parentPath: '/gone/', batchId: 'drop' })],
    });
    await untilStarted(started, 1);
    release('a1.txt');
    postMessage({ type: 'DIRECTORY_DELETED', sessionTag, path: '/gone/' });
    await settle();
    broadcasts.length = 0;

    globalThis.fetch = succeedingFetch;
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a2.txt', { batchId: 'drop' })] });
    await settle();

    assertEquals(progressLabels(), ['Uploading a2.txt…']);
  });
});
