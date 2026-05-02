import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { track } from '@/lib/analytics';
import type { ThreadDoc } from './schema';

/** Deterministic 1:1 thread id — sorting guarantees both sides resolve the same doc. */
export function threadIdFor(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export const threadsCol = () => firestore().collection('threads');

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
}

/**
 * Idempotent. Creates the thread doc if missing. Initialises the per-user
 * `lastReadAt` for the caller so unread math works the moment the thread exists.
 */
export async function ensureThread(otherUid: string): Promise<string> {
  const me = requireUser();
  if (me.uid === otherUid) throw new Error('Cannot chat with yourself');
  const id = threadIdFor(me.uid, otherUid);
  const ref = threadsCol().doc(id);
  const snap = await ref.get();
  const existed = snap.exists;
  const participants = [me.uid, otherUid].sort();
  const base: Record<string, unknown> = {
    participants,
    participantCount: 2,
  };
  // Seed the caller's lastReadAt so the inbox badge starts at zero.
  base[`lastReadAt.${me.uid}`] = firestore.FieldValue.serverTimestamp();
  await ref.set(base, { merge: true });
  if (!existed) track.chatStarted(id);
  return id;
}

export async function getThread(threadId: string): Promise<ThreadDoc | null> {
  const snap = await threadsCol().doc(threadId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<ThreadDoc, 'id'>) };
}

export type ThreadListSubscriber = (threads: ThreadDoc[]) => void;
export type ThreadListErrorHandler = (err: Error) => void;

/**
 * Subscribes to the caller's threads ordered by `lastMessageAt` desc. Sorts
 * client-side to avoid a composite index requirement on the (`participants`,
 * `lastMessageAt`) pair.
 */
export function listMyThreads(
  onChange: ThreadListSubscriber,
  onError?: ThreadListErrorHandler,
): () => void {
  const me = auth().currentUser;
  if (!me) {
    onChange([]);
    return () => {};
  }
  return threadsCol()
    .where('participants', 'array-contains', me.uid)
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ThreadDoc, 'id'>) }))
          .sort((a, b) => {
            const ta = a.lastMessageAt?.toMillis?.() ?? 0;
            const tb = b.lastMessageAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        onChange(items);
      },
      (err: Error) => {
        onChange([]);
        onError?.(err);
      },
    );
}

/** Bumps `lastReadAt[me]` to now. Safe to call on every screen mount. */
export async function markRead(threadId: string): Promise<void> {
  const me = auth().currentUser;
  if (!me) return;
  await threadsCol().doc(threadId).set(
    { [`lastReadAt.${me.uid}`]: firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
}
