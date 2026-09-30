let uploadServiceWorkerRegistration: ServiceWorkerRegistration | undefined;

// Registers the upload service worker (public/sw.js) so uploads survive a page refresh.
export async function registerUploadServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    uploadServiceWorkerRegistration = await navigator.serviceWorker.register('/public/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.error(error);
  }
}

// Messages go to the registration's active worker instead of `navigator.serviceWorker.controller`, because a freshly-installed worker is already active while `controller` is still null until its `clients.claim()` lands, which would silently skip the service worker for the first upload after a hard load.
// Do not in-page-fallback after a successful postMessage: every shipped worker handles ENQUEUE_UPLOAD, and treating a missing ACK as failure double-uploads during the upgrade window.
export async function postToUploadServiceWorker(message: Record<string, unknown>): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<undefined>((resolve) => setTimeout(resolve, 5_000)),
    ]);

    if (!registration?.active) {
      return false;
    }

    uploadServiceWorkerRegistration = registration;
    registration.active.postMessage(message);

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export function bindUploadLogoutAbort() {
  document.getElementById('logout-link')?.addEventListener('click', () => {
    try {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      const worker = uploadServiceWorkerRegistration?.active ?? navigator.serviceWorker.controller;

      if (worker) {
        worker.postMessage({ type: 'ABORT_UPLOADS' });
        return;
      }

      // ready is already resolved after any SW enqueue; its then() runs as a microtask before the browser follows /logout. Don't preventDefault or assign location after an await: that overwrites a later click.
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: 'ABORT_UPLOADS' });
      }).catch((error) => {
        console.error(error);
      });
    } catch (error) {
      console.error(error);
    }
  });
}
