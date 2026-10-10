import { assertEquals } from '@std/assert';

let messageListener: (event: { data: unknown; waitUntil: (promise: Promise<unknown>) => void }) => void;
let pendingWork: Promise<unknown>[] = [];

// sw.js is a plain worker script, so stub the worker globals it touches before loading it.
(globalThis as any).BroadcastChannel = class {
  postMessage() {}
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

function makeItem(name: string, batchId: string) {
  return { file: new File(['contents'], name), parentPath: '/', pathInView: '/', kind: 'file', batchId };
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

async function withStubs(test: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    postMessage({ type: 'ABORT_UPLOADS' });
    await settle();

    await test();
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
}

Deno.test('that aborting one drop leaves an earlier drop that is uploading alone', async () => {
  await withStubs(async () => {
    const { started, aborted, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('first.txt', 'first-drop')] });
    await untilStarted(started, 1);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('second.txt', 'second-drop')] });
    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'second-drop' });

    release('first.txt');
    await settle();

    assertEquals(started, ['first.txt']);
    assertEquals(aborted, []);
  });
});

Deno.test('that aborting the drop that is uploading cancels it, but the next drop still uploads', async () => {
  await withStubs(async () => {
    const { started, aborted, release } = stubHangingFetch();

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('first.txt', 'first-drop')] });
    await untilStarted(started, 1);

    postMessage({ type: 'ENQUEUE_UPLOAD', sessionTag, items: [makeItem('second.txt', 'second-drop')] });
    postMessage({ type: 'ABORT_UPLOADS', sessionTag, batchId: 'first-drop' });

    await untilStarted(started, 2);
    release('second.txt');
    await settle();

    assertEquals(started, ['first.txt', 'second.txt']);
    assertEquals(aborted, ['first.txt']);
  });
});
