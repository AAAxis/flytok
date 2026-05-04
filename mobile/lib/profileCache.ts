import type { VideoDoc } from './firestore';

// In-memory cache for profile-tab data so the screen renders immediately on
// re-mount instead of flashing through "loading…" every time the user
// switches tabs. The cache is keyed by uid; entries are best-effort and may
// be stale, so the screen still re-fetches in the background.

export type CachedProfile = {
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  mine: VideoDoc[];
  counts: { following: number; followers: number };
  fetchedAt: number;
};

const cache = new Map<string, CachedProfile>();

export function getCachedProfile(uid: string): CachedProfile | null {
  return cache.get(uid) ?? null;
}

export function setCachedProfile(uid: string, data: CachedProfile) {
  cache.set(uid, data);
}

export function patchCachedProfile(uid: string, patch: Partial<CachedProfile>) {
  const existing = cache.get(uid);
  if (!existing) return;
  cache.set(uid, { ...existing, ...patch, fetchedAt: Date.now() });
}

export function clearProfileCache() {
  cache.clear();
}
