import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';

// Local LRU video cache backed by FileSystem.cacheDirectory.
// iOS auto-evicts cacheDirectory under storage pressure, so unbounded cache
// growth is OK for v1 — no manual LRU needed yet.

const CACHE_DIR = FileSystem.cacheDirectory + 'flytok-videos/';
const ensured = (async () => {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch {
    // best-effort
  }
})();

function fileForUrl(url: string): string {
  // Stable filename per URL. base64url avoids slashes/punctuation.
  const safe = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-150);
  return CACHE_DIR + safe;
}

/** Returns the cached local path if it already exists, else null. */
export async function getCachedVideoPath(url: string): Promise<string | null> {
  if (!url) return null;
  await ensured;
  const dest = fileForUrl(url);
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && info.size && info.size > 0) return dest;
  } catch {
    // fall through to null
  }
  return null;
}

const inFlight = new Map<string, Promise<string | null>>();

/** Downloads to cache if missing. Returns the cached path on success. */
export async function ensureCachedVideo(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('file://')) return url;
  const existing = await getCachedVideoPath(url);
  if (existing) return existing;

  const ongoing = inFlight.get(url);
  if (ongoing) return ongoing;

  const promise = (async () => {
    try {
      const dest = fileForUrl(url);
      const result = await FileSystem.downloadAsync(url, dest);
      if (result.status >= 200 && result.status < 300) return result.uri;
      // Download was non-2xx — clean up the partial file and bail.
      try { await FileSystem.deleteAsync(result.uri, { idempotent: true }); } catch { /* ignore */ }
      return null;
    } catch {
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, promise);
  return promise;
}

/**
 * Returns the URL the player should use right now.
 * - If we already have a cached copy, returns the file:// path immediately.
 * - Otherwise returns the remote URL so playback starts without delay, and
 *   kicks off a background download so the *next* mount uses the cached copy.
 *
 * The returned value never swaps mid-mount once the player has started — we
 * latch the chosen source on the first resolution.
 */
export function useCachedVideoUri(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url ?? null);
  const latched = useRef(false);

  useEffect(() => {
    latched.current = false;
    if (!url) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const cached = await getCachedVideoPath(url);
      if (cancelled || latched.current) return;
      if (cached) {
        latched.current = true;
        setResolved(cached);
      } else {
        latched.current = true;
        setResolved(url);
        // Background download for next time.
        ensureCachedVideo(url).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}

/** Optional: pre-warm the cache for a list of URLs (e.g. next-in-feed). */
export async function prefetchVideos(urls: string[], maxConcurrent = 2) {
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      await ensureCachedVideo(next).catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: maxConcurrent }, () => worker()));
}

export async function clearVideoCache() {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    // best-effort
  }
}
