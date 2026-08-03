// Registers the upload service worker (public/sw.js) so uploads survive a page refresh.
export async function registerUploadServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register('/public/sw.js', { scope: '/' });
  } catch (error) {
    console.error(error);
  }
}
