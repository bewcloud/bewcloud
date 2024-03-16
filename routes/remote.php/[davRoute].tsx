// Nextcloud/ownCloud mimicry
export function handler(): Response {
  return new Response('Redirecting...', {
    status: 307,
    headers: { Location: '/dav' },
  });
}
