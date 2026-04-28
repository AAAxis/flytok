import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { track } from './analytics';

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
};

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const tag = m.slice(1).toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
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
};

export type ThreadDoc = {
  id: string;
  participants: string[];
  participantEmails: Record<string, string | null>;
  lastMessage?: string;
  lastMessageAt?: FirebaseFirestoreTypes.Timestamp;
};

export type MessageDoc = {
  id: string;
  authorId: string;
  type: 'text' | 'video_card';
  text?: string;
  videoId?: string;
  videoCaption?: string;
  videoOwnerEmail?: string | null;
  videoDownloadURL?: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
};

export const videosCol = () => firestore().collection('videos');
export const usersCol = () => firestore().collection('users');
export const threadsCol = () => firestore().collection('threads');
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

  const snap = await likeRef.get();
  if (snap.exists) {
    await Promise.all([
      likeRef.delete(),
      videoRef.set(
        { likeCount: firestore.FieldValue.increment(-1) },
        { merge: true },
      ),
    ]);
    return false;
  }
  await Promise.all([
    likeRef.set({ createdAt: firestore.FieldValue.serverTimestamp() }),
    videoRef.set(
      { likeCount: firestore.FieldValue.increment(1) },
      { merge: true },
    ),
  ]);
  track.videoLiked(videoId);
  return true;
}

export async function toggleSave(videoId: string) {
  const user = requireUser();
  const ref = savesCol(user.uid).doc(videoId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    track.videoSaved(videoId, false);
    return false;
  }
  await ref.set({ createdAt: firestore.FieldValue.serverTimestamp() });
  track.videoSaved(videoId, true);
  return true;
}

export async function getSavedVideoIds(uid: string) {
  const snap = await savesCol(uid).orderBy('createdAt', 'desc').limit(200).get();
  return snap.docs.map((d) => d.id);
}

export async function getVideosByIds(ids: string[]): Promise<VideoDoc[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results: VideoDoc[] = [];
  for (const chunk of chunks) {
    const snap = await videosCol().where(firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach((d) =>
      results.push({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }),
    );
  }
  // Preserve original order
  const indexOf = new Map(ids.map((id, i) => [id, i]));
  results.sort((a, b) => (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0));
  return results;
}

export async function getMyVideos(uid: string): Promise<VideoDoc[]> {
  const snap = await videosCol()
    .where('ownerId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }));
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
  if (displayName !== undefined) update.displayName = displayName.trim() || null;
  if (bio !== undefined) update.bio = bio.trim() || null;
  if (Object.keys(update).length === 0) return;
  await usersCol().doc(user.uid).set(update, { merge: true });
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
  if (!snap.exists) throw new Error('Video not found');
  const data = snap.data();
  const tokenResult = await user.getIdTokenResult();
  const isAdmin = tokenResult.claims.role === 'admin';
  if (!isAdmin && data?.ownerId !== user.uid) throw new Error('Not your video');
  const tags = hashtags ?? extractHashtags(caption);
  await ref.update({
    caption: caption.trim(),
    hashtags: tags,
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

export function messagesCol(threadId: string) {
  return threadsCol().doc(threadId).collection('messages');
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

export function threadIdFor(uidA: string, uidB: string) {
  return [uidA, uidB].sort().join('_');
}

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
}

// In-memory cache for user display names. Avoids one read per chat row.
const userLabelCache = new Map<string, string>();

export function getCachedUserLabel(uid: string | null | undefined): string | null {
  if (!uid) return null;
  return userLabelCache.get(uid) ?? null;
}

export async function getUserLabel(uid: string): Promise<string> {
  if (!uid) return 'user';
  const cached = userLabelCache.get(uid);
  if (cached) return cached;
  try {
    const snap = await usersCol().doc(uid).get();
    const data = snap.data() ?? {};
    const label =
      (data.displayName as string | undefined)?.trim() ||
      (data.username as string | undefined)?.trim() ||
      `User ${uid.slice(0, 6)}`;
    userLabelCache.set(uid, label);
    return label;
  } catch {
    return `User ${uid.slice(0, 6)}`;
  }
}

export async function ensureUserDoc() {
  const u = requireUser();
  await usersCol().doc(u.uid).set(
    {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      lastSeenAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function uploadVideo({
  uri,
  caption,
  location,
  hashtags,
  mentions,
}: {
  uri: string;
  caption: string;
  location?: VideoLocation | null;
  hashtags?: string[];
  mentions?: string[];
}) {
  const user = requireUser();

  const ts = Date.now();
  const ext = uri.split('.').pop()?.toLowerCase() || 'mp4';
  const storagePath = `videos/${user.uid}/${ts}.${ext}`;

  const ref = storage().ref(storagePath);
  await ref.putFile(uri);
  const downloadURL = await ref.getDownloadURL();

  const tags = hashtags ?? extractHashtags(caption);
  const handles = mentions ?? extractMentions(caption);

  const doc = await videosCol().add({
    ownerId: user.uid,
    ownerEmail: user.email ?? null,
    storagePath,
    downloadURL,
    caption: caption.trim(),
    location: location ?? null,
    hashtags: tags,
    mentions: handles,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  track.videoUploaded({
    hasLocation: !!location,
    hashtagCount: tags.length,
  });

  return { id: doc.id, storagePath, downloadURL };
}

export async function postComment(videoId: string, text: string) {
  const user = requireUser();
  await commentsCol(videoId).add({
    authorId: user.uid,
    authorEmail: user.email ?? null,
    text: text.trim(),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
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

export async function ensureThread(otherUid: string, otherEmail: string | null) {
  const user = requireUser();
  if (user.uid === otherUid) throw new Error('Cannot chat with yourself');
  const id = threadIdFor(user.uid, otherUid);
  const ref = threadsCol().doc(id);
  const existed = (await ref.get()).exists;
  await ref.set(
    {
      participants: [user.uid, otherUid].sort(),
      participantEmails: {
        [user.uid]: user.email ?? null,
        [otherUid]: otherEmail,
      },
    },
    { merge: true },
  );
  if (!existed) track.chatStarted(id);
  return id;
}

export async function sendTextMessage(threadId: string, text: string) {
  const user = requireUser();
  const trimmed = text.trim();
  if (!trimmed) return;
  await messagesCol(threadId).add({
    authorId: user.uid,
    type: 'text',
    text: trimmed,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  await threadsCol().doc(threadId).set(
    {
      lastMessage: trimmed,
      lastMessageAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  track.messageSent(threadId, 'text');
}

export async function sendVideoCard(threadId: string, video: VideoDoc) {
  const user = requireUser();
  await messagesCol(threadId).add({
    authorId: user.uid,
    type: 'video_card',
    videoId: video.id,
    videoCaption: video.caption ?? '',
    videoOwnerEmail: video.ownerEmail ?? null,
    videoDownloadURL: video.downloadURL,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  await threadsCol().doc(threadId).set(
    {
      lastMessage: 'Shared a video',
      lastMessageAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  track.messageSent(threadId, 'video_card');
}
