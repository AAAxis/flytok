import auth from '@react-native-firebase/auth';
import firestore, {
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {
  usersCol,
  videosCol,
  type VideoDoc,
} from '@/lib/firestore';
export { captionTokens } from './tokens';

/**
 * Search videos by their denormalised `captionTokens` array. The token must
 * appear in the caption verbatim (after lowercasing) — no stemming, no
 * fuzzy matching, since Firestore can't do that natively.
 */
export async function searchVideos(
  query: string,
  opts: { limit?: number } = {},
): Promise<VideoDoc[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const limit = opts.limit ?? 20;
  try {
    const snap = await videosCol()
      .where('captionTokens', 'array-contains', q)
      .limit(limit)
      .get();
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }),
    );
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return items;
  } catch (err) {
    console.warn('[search] videos query failed:', err);
    return [];
  }
}

/**
 * Search videos that include a hashtag. Returns up to `limit` recent matches.
 * Hashtags are stored already lowercased on the video doc by `extractHashtags`.
 */
export async function searchHashtags(
  query: string,
  opts: { limit?: number } = {},
): Promise<{ tag: string; count: number }[]> {
  const q = query.trim().replace(/^#/, '').toLowerCase();
  if (q.length < 2) return [];
  const limit = opts.limit ?? 10;
  try {
    const snap = await videosCol()
      .where('hashtags', 'array-contains', q)
      .limit(50)
      .get();
    if (snap.empty) return [];
    return [{ tag: q, count: snap.size }].slice(0, limit);
  } catch (err) {
    console.warn('[search] hashtags query failed:', err);
    return [];
  }
}

export type PlaceDoc = {
  slug: string;
  label: string;
  videoCount: number;
  lastVideoAt?: FirebaseFirestoreTypes.Timestamp;
};

/**
 * Prefix-search the places collection on the denormalised `label_lower` field
 * written by the `onVideoCreatePlaceCounter` Cloud Function.
 */
export async function searchPlaces(
  query: string,
  opts: { limit?: number } = {},
): Promise<PlaceDoc[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const limit = opts.limit ?? 10;
  try {
    const snap = await firestore()
      .collection('places')
      .where('label_lower', '>=', q)
      .where('label_lower', '<', q + '')
      .limit(limit)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        slug: d.id,
        label: (data.label as string | undefined) ?? d.id,
        videoCount: (data.videoCount as number | undefined) ?? 0,
        lastVideoAt: data.lastVideoAt as FirebaseFirestoreTypes.Timestamp | undefined,
      };
    });
  } catch (err) {
    console.warn('[search] places query failed:', err);
    return [];
  }
}

export type TrendingPlace = {
  slug: string;
  label: string;
  count: number;
};

/**
 * Reads the single `trending_places/snapshot` doc written by the
 * `rebuildTrendingPlaces` scheduled function. One read per search-screen
 * mount — effectively free on Firestore's pricing.
 */
export async function getTrendingPlaces(): Promise<TrendingPlace[]> {
  try {
    const snap = await firestore().collection('trending_places').doc('snapshot').get();
    if (!snap.exists()) return [];
    const data = snap.data() as
      | { topPlaces?: TrendingPlace[] }
      | undefined;
    return data?.topPlaces ?? [];
  } catch (err) {
    console.warn('[search] trending_places read failed:', err);
    return [];
  }
}

/**
 * Helpers that the search-screen empty state writes to. Stored as a top-level
 * `preferred_searches: string[]` array on the user doc — bounded to 20 items
 * by the Firestore rule (and mirrored client-side here).
 */
export const MAX_PREFERRED_SEARCHES = 20;
export const MAX_PREFERRED_LENGTH = 32;

export function normaliseSearchTerm(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_PREFERRED_LENGTH) return null;
  return trimmed;
}

export async function getPreferredSearches(): Promise<string[]> {
  const me = auth().currentUser;
  if (!me) return [];
  try {
    const snap = await usersCol().doc(me.uid).get();
    const data = snap.data() ?? {};
    const list = (data.preferred_searches as unknown[] | undefined) ?? [];
    return list.filter((x): x is string => typeof x === 'string').slice(0, MAX_PREFERRED_SEARCHES);
  } catch (err) {
    console.warn('[search] read preferred_searches failed:', err);
    return [];
  }
}

export async function addPreferredSearch(value: string): Promise<string[]> {
  const me = auth().currentUser;
  if (!me) throw new Error('Not signed in');
  const term = normaliseSearchTerm(value);
  if (!term) throw new Error('Invalid search term');

  const current = await getPreferredSearches();
  if (current.includes(term)) return current;
  const next = [term, ...current].slice(0, MAX_PREFERRED_SEARCHES);

  await usersCol().doc(me.uid).set({ preferred_searches: next }, { merge: true });
  return next;
}

export async function removePreferredSearch(value: string): Promise<string[]> {
  const me = auth().currentUser;
  if (!me) throw new Error('Not signed in');
  const term = value.trim();
  const current = await getPreferredSearches();
  const next = current.filter((x) => x !== term);
  if (next.length === current.length) return current;
  await usersCol().doc(me.uid).set({ preferred_searches: next }, { merge: true });
  return next;
}

export async function setPreferredSearches(values: string[]): Promise<string[]> {
  const me = auth().currentUser;
  if (!me) throw new Error('Not signed in');
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const term = normaliseSearchTerm(v);
    if (!term) continue;
    if (seen.has(term)) continue;
    seen.add(term);
    cleaned.push(term);
    if (cleaned.length >= MAX_PREFERRED_SEARCHES) break;
  }
  await usersCol().doc(me.uid).set({ preferred_searches: cleaned }, { merge: true });
  return cleaned;
}

/**
 * Fetch recent hashtag activity to power the empty-state popular chips when
 * we don't have a curated server-side list. Returns the top tags by usage
 * across the most recent ~200 videos. v1; can move to a Cloud Function later
 * if the cost bites.
 */
export async function getPopularHashtags(opts: { limit?: number } = {}): Promise<
  { tag: string; count: number }[]
> {
  const limit = opts.limit ?? 7;
  try {
    const snap = await videosCol()
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    const counts = new Map<string, number>();
    snap.docs.forEach((d) => {
      const tags = (d.data().hashtags as string[] | undefined) ?? [];
      for (const t of tags) {
        if (typeof t !== 'string' || t.length === 0) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (err) {
    console.warn('[search] popular hashtags failed:', err);
    return [];
  }
}
