import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

export type VideoLocation = { latitude: number; longitude: number; label?: string };

export type VideoDoc = {
  id: string;
  ownerId: string;
  ownerEmail?: string | null;
  storagePath: string;
  downloadURL: string;
  caption?: string;
  location?: VideoLocation | null;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
};

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

export function threadIdFor(uidA: string, uidB: string) {
  return [uidA, uidB].sort().join('_');
}

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
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
}: {
  uri: string;
  caption: string;
  location?: VideoLocation | null;
}) {
  const user = requireUser();

  const ts = Date.now();
  const ext = uri.split('.').pop()?.toLowerCase() || 'mp4';
  const storagePath = `videos/${user.uid}/${ts}.${ext}`;

  const ref = storage().ref(storagePath);
  await ref.putFile(uri);
  const downloadURL = await ref.getDownloadURL();

  const doc = await videosCol().add({
    ownerId: user.uid,
    ownerEmail: user.email ?? null,
    storagePath,
    downloadURL,
    caption: caption.trim(),
    location: location ?? null,
    createdAt: firestore.FieldValue.serverTimestamp(),
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
}

export async function follow(targetUid: string) {
  const user = requireUser();
  if (user.uid === targetUid) return;
  await followingCol(user.uid).doc(targetUid).set({
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function unfollow(targetUid: string) {
  const user = requireUser();
  await followingCol(user.uid).doc(targetUid).delete();
}

export async function ensureThread(otherUid: string, otherEmail: string | null) {
  const user = requireUser();
  if (user.uid === otherUid) throw new Error('Cannot chat with yourself');
  const id = threadIdFor(user.uid, otherUid);
  await threadsCol().doc(id).set(
    {
      participants: [user.uid, otherUid].sort(),
      participantEmails: {
        [user.uid]: user.email ?? null,
        [otherUid]: otherEmail,
      },
    },
    { merge: true },
  );
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
}
