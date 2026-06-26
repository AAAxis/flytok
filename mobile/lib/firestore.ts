import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage, { FirebaseStorageTypes } from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { track } from './analytics';
import { captionTokens } from './search/tokens';
import type { AudioSelection } from './audio';
import type { UploadProgressCallback } from './uploadProgress';

export type VideoLocation = { latitude: number; longitude: number; label?: string };

export type VideoDoc = {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  storagePath: string;
  downloadURL: string;
  caption?: string;
  location?: VideoLocation | null;
  hashtags?: string[];
  likeCount?: number;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  /** W4 audio metadata — denormalised so the feed can render the music row. */
  audioSource?: 'original' | 'library' | 'user_upload';
  audioTrackId?: string;
  audioUserPath?: string;
  audioTitle?: string;
  audioArtist?: string;
};

/**
 * Hashtag length budget. Each individual tag is capped at 30 chars (matches
 * Instagram), and the *combined* length of the comma-joined list is capped
 * at HASHTAG_TOTAL_CHAR_LIMIT (~80) so the bucket stays cheap to index and
 * unambiguous to render in chip rows.
 */
export const HASHTAG_MAX_TAG_LENGTH = 30;
export const HASHTAG_TOTAL_CHAR_LIMIT = 80;
export const HASHTAG_MAX_COUNT = 10;
export const BIO_MAX = 180;

export function isValidHashtag(tag: string): boolean {
  if (!tag) return false;
  if (tag.length > HASHTAG_MAX_TAG_LENGTH) return false;
  return /^[\p{L}\p{N}_]+$/u.test(tag);
}

export function totalHashtagsLength(tags: string[]): number {
  // Mirrors how the chip row renders: tag bodies + a single-char join.
  if (tags.length === 0) return 0;
  return tags.reduce((sum, t) => sum + t.length, 0) + Math.max(0, tags.length - 1);
}

export function normaliseHashtags(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.replace(/^#+/, '').trim().toLowerCase();
    if (!isValidHashtag(tag)) continue;
    if (seen.has(tag)) continue;
    if (out.length >= HASHTAG_MAX_COUNT) break;
    if (totalHashtagsLength([...out, tag]) > HASHTAG_TOTAL_CHAR_LIMIT) break;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  if (!matches) return [];
  return normaliseHashtags(matches.map((m) => m.slice(1)));
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_.\-]+/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const handle = m.slice(1).toLowerCase();
    if (handle && !seen.has(handle)) {
      seen.add(handle);
      out.push(handle);
    }
  }
  return out;
}

export type CommentDoc = {
  id: string;
  authorId: string;
  authorEmail?: string | null;
  text: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  /** Top-level comment id this is a reply to. Null/missing for root comments. */
  parentId?: string | null;
  /** Denormalised like count maintained inside `toggleCommentLike`. */
  likeCount?: number;
  /** 1–5 star rating attached to the comment. 0/undefined = unrated. */
  rating?: number;
};

/** Hard cap to keep abusive payloads out of Firestore. Mirrors the chat composer. */
export const COMMENT_MAX_LENGTH = 500;

// Messaging types now live in `lib/messaging/schema.ts`. Re-exported below for
// existing callers; new code should import from `@/lib/messaging` directly.
export type { ThreadDoc, MessageDoc } from './messaging/schema';
export {
  threadsCol,
  threadIdFor,
  ensureThread,
  messagesCol,
} from './messaging';
// Backwards-compat shim — the old `sendTextMessage` is now `sendText`.
export { sendText as sendTextMessage, sendVideoCard } from './messaging';

export const videosCol = () => firestore().collection('videos');

/**
 * Drops video docs that can't actually play.
 *
 * `videos` (the FlatList data) and `poolItems` (the player-pool input) MUST
 * have identical length so their indices align — `usePlayerPool` keys players
 * by index, and `FeedItem` looks up its player by the FlatList row index.
 * Dropping unplayable docs from `poolItems` only (the previous behaviour)
 * shifted every subsequent index in the pool, so the active card got a player
 * loaded with the *next* video's URL, the broken card never rendered, and the
 * tail of the feed silently played the wrong content. Filter at load time
 * instead so both arrays stay 1:1.
 *
 * The check is intentionally minimal — a string `downloadURL` is the only
 * field expo-video actually needs to load a source. Anything missing it (a
 * partially-written doc from a crashed upload, a manually-inserted record,
 * an older schema migration) gets dropped here and `[feed] dropped N
 * unplayable doc(s)` is logged so we see in the wild whether this is a real
 * data-quality issue.
 */
export function filterPlayable(videos: VideoDoc[]): VideoDoc[] {
  const out = videos.filter(
    (v) => typeof v.downloadURL === 'string' && v.downloadURL.length > 0,
  );
  const dropped = videos.length - out.length;
  if (dropped > 0) {
    console.warn(
      `[feed] dropped ${dropped} unplayable doc(s) (no downloadURL)`,
    );
  }
  return out;
}
export const usersCol = () => firestore().collection('users');
export const usernamesCol = () => firestore().collection('usernames');
export const reportsCol = () => firestore().collection('reports');

export function blockedCol(uid: string) {
  return usersCol().doc(uid).collection('blocked');
}

export function savesCol(uid: string) {
  return usersCol().doc(uid).collection('saves');
}

export function likesCol(videoId: string) {
  return videosCol().doc(videoId).collection('likes');
}

export async function toggleLike(videoId: string): Promise<boolean> {
  const user = requireUser();
  const videoRef = videosCol().doc(videoId);
  const likeRef = likesCol(videoId).doc(user.uid);

  // Atomic read+write so concurrent taps can't double-decrement.
  const liked = await firestore().runTransaction(async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const videoSnap = await tx.get(videoRef);
    const current = Math.max(0, (videoSnap.data()?.likeCount as number | undefined) ?? 0);

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.set(videoRef, { likeCount: Math.max(0, current - 1) }, { merge: true });
      return false;
    }
    tx.set(likeRef, { createdAt: firestore.FieldValue.serverTimestamp() });
    tx.set(videoRef, { likeCount: current + 1 }, { merge: true });
    return true;
  });

  if (liked) track.videoLiked(videoId);
  return liked;
}

export async function toggleSave(videoId: string) {
  const user = requireUser();
  const ref = savesCol(user.uid).doc(videoId);
  // Force a server read so a stale local cache doesn't fool us.
  const snap = await ref.get({ source: 'server' });
  if (snap.data()) {
    await ref.delete();
    const after = await ref.get({ source: 'server' });
    if (after.data()) throw new Error('Delete blocked by Firestore rules');
    track.videoSaved(videoId, false);
    return false;
  }
  await ref.set({ createdAt: firestore.FieldValue.serverTimestamp() });
  // Confirm the write reached the server. RNFirebase otherwise resolves the
  // promise from local cache even when the sync was rejected by rules.
  const after = await ref.get({ source: 'server' });
  if (!after.data()) {
    throw new Error('Write blocked — Firestore rules prevented saving');
  }
  track.videoSaved(videoId, true);
  return true;
}

/**
 * Diagnostic: probes the saves subcollection for the current user and returns
 * a human-readable error string, or null on success. The Profile screen runs
 * this once on mount and surfaces the result via Alert so we know exactly why
 * saves aren't sticking (rules, network, etc.) instead of failing silently.
 */
export async function diagnoseSaves(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return 'Not signed in';
  const probe = savesCol(user.uid).doc('__probe');
  try {
    await probe.set({ probe: true, at: firestore.FieldValue.serverTimestamp() });
    const snap = await probe.get({ source: 'server' });
    if (!snap.data()) {
      return 'Write succeeded locally but server has no doc — Firestore rules deny writes to users/{uid}/saves';
    }
    await probe.delete();
    return null;
  } catch (err: any) {
    return `${err?.code ?? 'error'}: ${err?.message ?? 'unknown'}`;
  }
}

export async function getSavedVideoIds(uid: string) {
  try {
    const snap = await savesCol(uid).orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.warn('[saves] ordered query failed, falling back:', err);
    const snap = await savesCol(uid).limit(200).get();
    return snap.docs.map((d) => d.id);
  }
}

export async function getVideosByIds(ids: string[]): Promise<VideoDoc[]> {
  if (ids.length === 0) return [];
  // Fetch each doc directly by id in parallel. Avoids the
  // `where(documentId() in [...])` query path which has been seen to silently
  // return zero results on some RNFB versions even when the docs exist.
  const snaps = await Promise.all(ids.map((id) => videosCol().doc(id).get()));
  const out: VideoDoc[] = [];
  snaps.forEach((s, i) => {
    const data = s.data();
    if (data) out.push({ id: ids[i], ...(data as Omit<VideoDoc, 'id'>) });
  });
  return out;
}

function locationKey(loc: VideoLocation): string {
  const label = loc.label?.trim().toLowerCase();
  if (label) return `label:${label}`;
  return `geo:${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
}

export async function getSavedLocations(): Promise<VideoLocation[]> {
  const user = requireUser();
  const [savedIds, myVideos] = await Promise.all([
    getSavedVideoIds(user.uid).catch(() => []),
    getMyVideos(user.uid).catch(() => []),
  ]);
  const savedVideos = await getVideosByIds(savedIds).catch(() => []);
  const byKey = new Map<string, VideoLocation>();
  for (const video of [...savedVideos, ...myVideos]) {
    const loc = video.location;
    if (!loc?.latitude || !loc?.longitude) continue;
    byKey.set(locationKey(loc), loc);
  }
  return [...byKey.values()].sort((a, b) =>
    (a.label ?? '').localeCompare(b.label ?? ''),
  );
}

export async function getMyVideos(uid: string): Promise<VideoDoc[]> {
  try {
    const snap = await videosCol()
      .where('ownerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }));
  } catch (err) {
    // Composite index (ownerId asc + createdAt desc) likely missing — fall back
    // to the unordered query and sort client-side.
    console.warn('[my-videos] indexed query failed, falling back:', err);
    const snap = await videosCol()
      .where('ownerId', '==', uid)
      .limit(200)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }));
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return items;
  }
}

/** A single stop on a saved trip route — mirrors what `create-trip` writes. */
export type TripStop = {
  latitude: number;
  longitude: number;
  description: string;
  imageUrl?: string | null;
};

/** A saved trip route stored at `users/{uid}/trips/{tripId}`. */
export type Trip = {
  id: string;
  name: string;
  stops: TripStop[];
  createdAt?: FirebaseFirestoreTypes.Timestamp;
};

export function tripsCol(uid: string) {
  return usersCol().doc(uid).collection('trips');
}

/** The user's saved trip routes, newest first. */
export async function getMyTrips(uid: string): Promise<Trip[]> {
  try {
    const snap = await tripsCol(uid).orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }));
  } catch (err) {
    // No composite index needed here, but fall back defensively just in case.
    console.warn('[trips] ordered query failed, falling back:', err);
    const snap = await tripsCol(uid).limit(100).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }));
    items.sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );
    return items;
  }
}

/** One saved trip by id, or null if it doesn't exist. */
export async function getTrip(uid: string, tripId: string): Promise<Trip | null> {
  const snap = await tripsCol(uid).doc(tripId).get();
  const data = snap.data();
  if (!data) return null;
  return { id: snap.id, ...(data as Omit<Trip, 'id'>) };
}

/**
 * Overwrite the stops array on a trip. Stops are stored inline on the trip doc
 * (not a subcollection), so editing one stop means writing the whole array
 * back — callers compute the new array client-side and pass it here.
 */
export async function updateTripStops(
  uid: string,
  tripId: string,
  stops: TripStop[],
): Promise<void> {
  await tripsCol(uid)
    .doc(tripId)
    .update({
      stops: stops.map((s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
        description: s.description.trim(),
        imageUrl: s.imageUrl ?? null,
      })),
    });
}

export async function updateProfile({
  displayName,
  bio,
}: {
  displayName?: string;
  bio?: string;
}) {
  const user = requireUser();
  const update: Record<string, unknown> = {};
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    update.displayName = trimmed || null;
    // Maintain the denormalised lowercase copy so prefix searches (search
    // screen, DM picker) stay in sync with profile edits.
    update.displayNameLower = trimmed ? trimmed.toLowerCase() : null;
  }
  if (bio !== undefined) update.bio = bio.trim().slice(0, BIO_MAX) || null;
  if (Object.keys(update).length === 0) return;
  await usersCol().doc(user.uid).set(update, { merge: true });
}

// Atomic, race-free username claim. Reserves usernames/{lower} as the
// uniqueness primitive: the doc's existence ⇒ that handle is taken. Old
// reservation (if any) is released in the same transaction.
//
// Throws 'username_taken' if the handle is already claimed by someone else.
// Throws 'invalid_username' if the candidate fails local validation.
export async function claimUsername(newUsername: string): Promise<void> {
  // Imported lazily to keep this file's import surface lean and avoid a
  // cycle if username.ts ever needs firestore types.
  const { validateUsername, normaliseUsername } = await import('./username');
  const user = requireUser();
  const lower = normaliseUsername(newUsername);
  if (validateUsername(lower)) throw new Error('invalid_username');

  await firestore().runTransaction(async (tx) => {
    const userRef = usersCol().doc(user.uid);
    const userSnap = await tx.get(userRef);
    const currentLower = (userSnap.data()?.usernameLower as string | undefined) ?? null;
    if (currentLower === lower) return;

    const newRef = usernamesCol().doc(lower);
    const newSnap = await tx.get(newRef);
    if (newSnap.exists() && (newSnap.data()?.uid as string) !== user.uid) {
      throw new Error('username_taken');
    }

    if (!newSnap.exists()) tx.set(newRef, { uid: user.uid });
    if (currentLower && currentLower !== lower) {
      tx.delete(usernamesCol().doc(currentLower));
    }
    tx.set(
      userRef,
      { username: lower, usernameLower: lower },
      { merge: true },
    );
  });
}

// Best-effort: if the signed-in user has no username, derive one from their
// displayName (or 'user') and try to claim it with a short uid suffix. Up to
// three attempts with random suffixes on contention. Silent on failure —
// the next foreground tick re-tries via the same caller.
//
// Idempotent: short-circuits if `usernameLower` is already set on the user
// doc. Safe to call from app launch.
const ensureUsernameInflight = new Set<string>();
export async function ensureUsername(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;
  if (ensureUsernameInflight.has(user.uid)) return;
  ensureUsernameInflight.add(user.uid);
  try {
    const ref = usersCol().doc(user.uid);
    const snap = await ref.get();
    const data = snap.data() ?? {};
    if (data.usernameLower) return;

    const { slugifyDisplayName, withSuffix, validateUsername } = await import(
      './username'
    );
    const base = slugifyDisplayName((data.displayName as string) ?? user.displayName ?? null);

    for (let attempt = 0; attempt < 3; attempt++) {
      const suffix =
        attempt === 0
          ? user.uid.slice(0, 4)
          : Math.random().toString(36).slice(2, 6);
      const candidate = withSuffix(base, suffix);
      if (validateUsername(candidate)) continue;
      try {
        await claimUsername(candidate);
        return;
      } catch (err: any) {
        if (err?.message !== 'username_taken') {
          console.warn('[ensureUsername] failed', err);
          return;
        }
        // contention — try another suffix
      }
    }
  } catch (err) {
    console.warn('[ensureUsername] unexpected', err);
  } finally {
    ensureUsernameInflight.delete(user.uid);
  }
}

export type ReportReason = 'spam' | 'harassment' | 'nudity' | 'violence' | 'other';
export type ReportTarget =
  | { kind: 'video'; videoId: string; ownerId: string }
  | { kind: 'user'; userId: string }
  | { kind: 'comment'; videoId: string; commentId: string; authorId: string };

export async function reportContent(target: ReportTarget, reason: ReportReason, note?: string) {
  const user = requireUser();
  await reportsCol().add({
    reporterId: user.uid,
    reporterEmail: user.email ?? null,
    target,
    reason,
    note: (note ?? '').trim() || null,
    status: 'open',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  track.reportSubmitted(target.kind, reason);
}

export async function blockUser(targetUid: string) {
  const user = requireUser();
  if (user.uid === targetUid) return;
  await blockedCol(user.uid).doc(targetUid).set({
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function unblockUser(targetUid: string) {
  const user = requireUser();
  await blockedCol(user.uid).doc(targetUid).delete();
}

export async function getBlockedIds() {
  const user = auth().currentUser;
  if (!user) return new Set<string>();
  const snap = await blockedCol(user.uid).get();
  return new Set(snap.docs.map((d) => d.id));
}

export async function deleteOwnVideo(video: VideoDoc) {
  const user = requireUser();
  const tokenResult = await user.getIdTokenResult();
  const isAdmin = tokenResult.claims.role === 'admin';
  if (!isAdmin && user.uid !== video.ownerId) throw new Error('Not your video');
  if (video.storagePath) {
    try {
      await storage().ref(video.storagePath).delete();
    } catch (err: any) {
      if (err?.code !== 'storage/object-not-found') {
        // continue — don't block the doc delete on a stuck storage object
      }
    }
  }
  await videosCol().doc(video.id).delete();
}

export async function updateOwnVideoCaption(
  videoId: string,
  caption: string,
  hashtags?: string[],
) {
  const user = requireUser();
  const ref = videosCol().doc(videoId);
  const snap = await ref.get();
  if (!snap.exists()) throw new Error('Video not found');
  const data = snap.data();
  const tokenResult = await user.getIdTokenResult();
  const isAdmin = tokenResult.claims.role === 'admin';
  if (!isAdmin && data?.ownerId !== user.uid) throw new Error('Not your video');
  const tags = normaliseHashtags(hashtags ?? extractHashtags(caption));
  await ref.update({
    caption: caption.trim(),
    hashtags: tags,
    captionTokens: captionTokens(caption),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteAccount() {
  const user = requireUser();
  const uid = user.uid;
  // Best-effort soft cleanup of the user doc; the auth principal goes last.
  try {
    await usersCol().doc(uid).set(
      {
        deletedAt: firestore.FieldValue.serverTimestamp(),
        email: null,
        displayName: null,
        photoURL: null,
      },
      { merge: true },
    );
  } catch {
    // ignore — we still want to delete the auth user
  }
  await user.delete();
}

export function commentsCol(videoId: string) {
  return videosCol().doc(videoId).collection('comments');
}

export function commentLikesCol(videoId: string, commentId: string) {
  return commentsCol(videoId).doc(commentId).collection('likes');
}

/**
 * Toggle the current user's like on a comment. Mirrors `toggleLike` for videos
 * — uses a transaction so concurrent taps can't corrupt `likeCount`.
 */
export async function toggleCommentLike(
  videoId: string,
  commentId: string,
): Promise<boolean> {
  const user = requireUser();
  const commentRef = commentsCol(videoId).doc(commentId);
  const likeRef = commentLikesCol(videoId, commentId).doc(user.uid);
  return firestore().runTransaction(async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const commentSnap = await tx.get(commentRef);
    const current = Math.max(
      0,
      (commentSnap.data()?.likeCount as number | undefined) ?? 0,
    );
    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.set(commentRef, { likeCount: Math.max(0, current - 1) }, { merge: true });
      return false;
    }
    tx.set(likeRef, { createdAt: firestore.FieldValue.serverTimestamp() });
    tx.set(commentRef, { likeCount: current + 1 }, { merge: true });
    return true;
  });
}

/**
 * Attach a 1–5 star rating to a comment. Tapping the already-selected star
 * value clears the rating (passes 0). Stored denormalised on the comment doc
 * so the feed/comment list can render it without an extra read.
 */
export async function setCommentRating(
  videoId: string,
  commentId: string,
  rating: number,
): Promise<void> {
  requireUser();
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  await commentsCol(videoId)
    .doc(commentId)
    .set({ rating: clamped }, { merge: true });
}

/**
 * One-shot fetch of which of the supplied comment ids the current user has
 * liked. Returns an empty set when signed out so callers can treat unknown as
 * "not liked" without branching.
 */
export async function getCommentsLikedByMe(
  videoId: string,
  commentIds: string[],
): Promise<Set<string>> {
  const user = auth().currentUser;
  if (!user || commentIds.length === 0) return new Set();
  const liked = new Set<string>();
  await Promise.all(
    commentIds.map(async (id) => {
      try {
        const snap = await commentLikesCol(videoId, id).doc(user.uid).get();
        if (snap.exists()) liked.add(id);
      } catch {
        // Best-effort — a single failed read shouldn't blank out other rows.
      }
    }),
  );
  return liked;
}

export function followingCol(uid: string) {
  return usersCol().doc(uid).collection('following');
}

export function followersCol(uid: string) {
  return usersCol().doc(uid).collection('followers');
}

export async function getFollowCounts(uid: string): Promise<{ following: number; followers: number }> {
  try {
    const [followingSnap, followersSnap] = await Promise.all([
      followingCol(uid).count().get(),
      followersCol(uid).count().get(),
    ]);
    return {
      following: followingSnap.data().count,
      followers: followersSnap.data().count,
    };
  } catch {
    return { following: 0, followers: 0 };
  }
}

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
}

export type UserBrief = { label: string; photoURL: string | null };

// In-memory cache for user display name + photoURL. Avoids one read per chat
// row / message bubble. Shared by both `getUserLabel` and `getUserBrief`.
const userBriefCache = new Map<string, UserBrief>();

export function getCachedUserBrief(uid: string | null | undefined): UserBrief | null {
  if (!uid) return null;
  return userBriefCache.get(uid) ?? null;
}

export function getCachedUserLabel(uid: string | null | undefined): string | null {
  return getCachedUserBrief(uid)?.label ?? null;
}

export async function getUserBrief(uid: string): Promise<UserBrief> {
  if (!uid) return { label: 'user', photoURL: null };
  const cached = userBriefCache.get(uid);
  if (cached) return cached;
  try {
    const snap = await usersCol().doc(uid).get();
    const data = snap.data() ?? {};
    const label =
      (data.displayName as string | undefined)?.trim() ||
      (data.username as string | undefined)?.trim() ||
      `User ${uid.slice(0, 6)}`;
    const photoURL = ((data.photoURL as string | undefined) ?? '').trim() || null;
    const brief: UserBrief = { label, photoURL };
    userBriefCache.set(uid, brief);
    return brief;
  } catch {
    return { label: `User ${uid.slice(0, 6)}`, photoURL: null };
  }
}

export async function getUserLabel(uid: string): Promise<string> {
  const brief = await getUserBrief(uid);
  return brief.label;
}

export async function ensureUserDoc() {
  const u = requireUser();
  // Read first so we can backfill defaults (discoverable) for accounts created
  // before W1 without overriding a deliberate opt-out from a later session.
  const ref = usersCol().doc(u.uid);
  const existing = await ref.get().catch(() => null);
  const data = existing?.data() ?? {};

  const trimmedName = (u.displayName ?? '').trim();
  const update: Record<string, unknown> = {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    displayNameLower: trimmedName ? trimmedName.toLowerCase() : null,
    lastSeenAt: firestore.FieldValue.serverTimestamp(),
  };

  // Default `discoverable` to true on first sign-in / for legacy users that
  // don't have it yet. Don't clobber an explicit setting from a later wave.
  if (data.discoverable === undefined) {
    update.discoverable = true;
  }

  await ref.set(update, { merge: true });
}

export type UploadVideoArgs = {
  uri: string;
  caption: string;
  location?: VideoLocation | null;
  hashtags?: string[];
  mentions?: string[];
  /**
   * W4: optional audio selection. Stored on the video doc as
   * `audioSource` + (`audioTrackId` | `audioUserPath`) so a future server-
   * side mux or playback overlay can resolve the chosen track.
   */
  audio?: AudioSelection;
  /** Progress callback fired during the storage `putFile` byte stream. */
  onProgress?: UploadProgressCallback;
  /**
   * If supplied, the upload task is registered here so the caller can cancel
   * mid-upload (`task.cancel()`). The ref is cleared once the upload settles.
   */
  taskRef?: { current: FirebaseStorageTypes.Task | null };
};

export async function uploadVideo(args: UploadVideoArgs) {
  const { uri, caption, location, hashtags, mentions, audio, onProgress, taskRef } = args;
  const user = requireUser();
  if (!location) throw new Error('Location is required');

  const ts = Date.now();
  const ext = uri.split('.').pop()?.toLowerCase() || 'mp4';
  const storagePath = `videos/${user.uid}/${ts}.${ext}`;

  // Explicit Content-Type. Without this, Firebase Storage falls back to
  // `application/octet-stream` when the platform's UTI lookup fails — which
  // (a) gets denied by the storage rule's `video/.*` matcher, and (b) leaves
  // AVPlayer with no MIME hint at playback time and is the leading cause of
  // black cards on iOS. We map the recorded extension to the correct MIME.
  const contentType =
    ext === 'mov'
      ? 'video/quicktime'
      : ext === 'm4v'
        ? 'video/x-m4v'
        : `video/${ext}`;

  const ref = storage().ref(storagePath);
  const task = ref.putFile(uri, { contentType });
  if (taskRef) taskRef.current = task;
  if (onProgress) {
    task.on('state_changed', (snap) => {
      const total = snap.totalBytes || 1;
      onProgress({ phase: 'upload', percent: Math.min(1, snap.bytesTransferred / total) });
    });
  }
  try {
    await task;
  } finally {
    if (taskRef) taskRef.current = null;
  }
  onProgress?.({ phase: 'finalize', percent: 0 });
  const downloadURL = await ref.getDownloadURL();

  const tags = normaliseHashtags(hashtags ?? extractHashtags(caption));
  const handles = mentions ?? extractMentions(caption);
  // Denormalised tokens for the W3 search-by-caption query. Stored on the
  // video doc at write time so the client can do `array-contains` instead of
  // a full-text scan we don't have anyway.
  const tokens = captionTokens(caption);

  const audioFields = audioToDocFields(audio);

  const doc = await videosCol().add({
    ownerId: user.uid,
    ownerEmail: user.email ?? null,
    storagePath,
    downloadURL,
    caption: caption.trim(),
    location: location ?? null,
    hashtags: tags,
    mentions: handles,
    captionTokens: tokens,
    ...audioFields,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  onProgress?.({ phase: 'finalize', percent: 1 });

  track.videoUploaded({
    hasLocation: !!location,
    hashtagCount: tags.length,
  });

  return { id: doc.id, storagePath, downloadURL };
}

function audioToDocFields(audio: AudioSelection | undefined) {
  if (!audio || audio.source === 'original') {
    return { audioSource: 'original' as const };
  }
  if (audio.source === 'library') {
    return {
      audioSource: 'library' as const,
      audioTrackId: audio.track.id,
      audioTitle: audio.track.title,
      audioArtist: audio.track.artist,
    };
  }
  return {
    audioSource: 'user_upload' as const,
    audioUserPath: audio.storagePath,
    audioTitle: audio.title,
  };
}

export async function postComment(
  videoId: string,
  text: string,
  parentId?: string | null,
) {
  const user = requireUser();
  const trimmed = text.trim().slice(0, COMMENT_MAX_LENGTH);
  if (!trimmed) throw new Error('Comment is empty');
  // Batch the comment write + count increment so the denormalised
  // `commentCount` can't drift if one of the two writes is rejected.
  const commentRef = commentsCol(videoId).doc();
  const batch = firestore().batch();
  batch.set(commentRef, {
    authorId: user.uid,
    authorEmail: user.email ?? null,
    text: trimmed,
    parentId: parentId ?? null,
    likeCount: 0,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  batch.set(
    videosCol().doc(videoId),
    { commentCount: firestore.FieldValue.increment(1) },
    { merge: true },
  );
  await batch.commit();
  track.commentPosted(videoId);
}

export async function follow(targetUid: string) {
  const user = requireUser();
  if (user.uid === targetUid) return;
  const ts = firestore.FieldValue.serverTimestamp();
  await Promise.all([
    followingCol(user.uid).doc(targetUid).set({ createdAt: ts }),
    followersCol(targetUid).doc(user.uid).set({ createdAt: ts }),
  ]);
  track.followAdded(targetUid);
}

export async function unfollow(targetUid: string) {
  const user = requireUser();
  await Promise.all([
    followingCol(user.uid).doc(targetUid).delete(),
    followersCol(targetUid).doc(user.uid).delete(),
  ]);
  track.followRemoved(targetUid);
}

export async function uploadProfilePhoto(uri: string): Promise<string> {
  const user = requireUser();
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const storagePath = `avatars/${user.uid}/${Date.now()}.${ext}`;
  const ref = storage().ref(storagePath);
  await ref.putFile(uri);
  const downloadURL = await ref.getDownloadURL();
  await usersCol().doc(user.uid).set(
    { photoURL: downloadURL, photoStoragePath: storagePath },
    { merge: true },
  );
  try {
    await user.updateProfile({ photoURL: downloadURL });
  } catch {
    // Auth profile mirror is best-effort
  }
  track.profilePhotoChanged();
  return downloadURL;
}
