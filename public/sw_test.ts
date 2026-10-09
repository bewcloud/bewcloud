import { assertEquals } from '@std/assert';

interface BroadcastState {
  type: string;
  isUploading: boolean;
  uploadProgress: string;
  error: string;
  errorId: string;
  errorKind: string;
  errorSessionTag: string;
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

function failingFetch() {
  return Promise.resolve(new Response('nope', { status: 500, statusText: 'Internal Server Error' }));
}

function succeedingFetch() {
  return Promise.resolve(Response.json({ success: true, newFiles: [], newDirectories: [] }));
}

Deno.test('that the last upload error survives the job ending and is restored on resync', async () => {
  await withFetch(failingFetch, async () => {
    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('a.txt')] });
    await settle();

    const finished = lastBroadcast();
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
