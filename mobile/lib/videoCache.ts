import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

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

/** Extracts the original file extension from a Firebase Storage download URL.
 *
 * Firebase URLs look like
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/videos%2F<uid>%2F<ts>.mov?alt=media&token=...
 * so the real extension is URL-encoded inside the path. We percent-decode the
 * path part (everything before `?`), then take the trailing extension. Falls
 * back to `mp4` so the cached file is never extensionless — AVPlayer on iOS
 * can fail to detect format from a no-extension `file://` URL and silently
 * leave the card black.
 */
function extensionForUrl(url: string): string {
  try {
    const path = url.split('?')[0] ?? url;
    const decoded = decodeURIComponent(path);
    const m = decoded.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (m) return m[1].toLowerCase();
  } catch {
    // malformed URL — fall through to default
  }
  return 'mp4';
}

function fileForUrl(url: string): string {
  // Stable filename per URL. Non-alphanumerics collapse to `_` so we get a
  // valid POSIX filename. We keep the extension out of the slice() window so
  // it always survives even when the URL is long (Firebase tokens are ~120
  // chars on their own and would otherwise eat the filename).
  const ext = extensionForUrl(url);
  const safe = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-140);
  return CACHE_DIR + safe + '.' + ext;
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
