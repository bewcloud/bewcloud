const CACHE_NAME_PREFIX = 'bewcloud-v1-';

const CURRENT_CACHES: Set<string> = new Set();

const FALLBACK_CACHE: Map<string, string> = new Map();

export default class SimpleCache {
  protected cacheName = `${CACHE_NAME_PREFIX}default`;

  constructor(cacheName = 'default') {
    this.cacheName = `${CACHE_NAME_PREFIX}${cacheName}`;
  }

  public async get() {
    if (!CURRENT_CACHES.has(this.cacheName)) {
      return '';
    }

    try {
      const request = new Request(`https://fake.cache/${this.cacheName}`);
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(request);

      if (response) {
        return response.text();
      }
    } catch (error) {
      console.error(error);

      return FALLBACK_CACHE.get(this.cacheName) || '';
    }

    return '';
  }

  public async set(value: string) {
    if (!CURRENT_CACHES.has(this.cacheName)) {
      CURRENT_CACHES.add(this.cacheName);
    }

    try {
      await this.clear();

      const request = new Request(`https://fake.cache/${this.cacheName}`);
      const cache = await caches.open(this.cacheName);
      const response = new Response(value, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

      await cache.put(request, response.clone());
    } catch (error) {
      console.error(error);

      FALLBACK_CACHE.set(this.cacheName, value);
    }
  }

  public async clear() {
    if (!CURRENT_CACHES.has(this.cacheName)) {
      return null;
    }

    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.error(error);

      FALLBACK_CACHE.delete(this.cacheName);
    }
  }
}
