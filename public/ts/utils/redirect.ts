// Browsers treat "\" as "/" and a leading "//" as another host. Control characters can split a Location header.
export function getSafeRedirectUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return '/';
  }

  for (const character of url) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return '/';
    }
  }

  return url;
}
