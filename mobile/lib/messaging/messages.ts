import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { track } from '@/lib/analytics';
import { threadsCol } from './threads';
import type { MessageDoc, MessageType, SharedVideo } from './schema';

export function messagesCol(threadId: string) {
  return threadsCol().doc(threadId).collection('messages');
}

function requireUser() {
  const u = auth().currentUser;
  if (!u) throw new Error('Not signed in');
  return u;
}

/** Generates a short, locally-unique id used to dedupe optimistic messages. */
export function newLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type ThreadPreviewPatch = {
  lastMessage: string;
  lastMessageType: MessageType;
  lastMessageAuthorId: string;
  lastMessageAt: FirebaseFirestoreTypes.FieldValue;
};

function previewPatch(text: string, type: MessageType, authorId: string): ThreadPreviewPatch {
  return {
    lastMessage: text,
    lastMessageType: type,
    lastMessageAuthorId: authorId,
    lastMessageAt: firestore.FieldValue.serverTimestamp(),
  };
}

export async function sendText(
  threadId: string,
  text: string,
  localId?: string,
): Promise<string> {
  const user = requireUser();
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty message');
  const docRef = await messagesCol(threadId).add({
    authorId: user.uid,
    type: 'text',
    text: trimmed,
    ...(localId ? { localId } : {}),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  await threadsCol().doc(threadId).set(previewPatch(trimmed, 'text', user.uid), { merge: true });
  track.messageSent(threadId, 'text');
  return docRef.id;
}

export async function sendVideoCard(
  threadId: string,
  video: SharedVideo,
  localId?: string,
): Promise<string> {
  const user = requireUser();
  const docRef = await messagesCol(threadId).add({
    authorId: user.uid,
    type: 'video_card',
    videoId: video.id,
    videoCaption: video.caption ?? '',
    videoOwnerEmail: video.ownerEmail ?? null,
    videoDownloadURL: video.downloadURL,
    ...(localId ? { localId } : {}),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  await threadsCol()
    .doc(threadId)
    .set(previewPatch('Shared a video', 'video_card', user.uid), { merge: true });
  track.messageSent(threadId, 'video_card');
  return docRef.id;
}

/**
 * Uploads `localUri` to `chat/{threadId}/{uid}/{ts}.{ext}`, then writes a
 * message doc pointing at the resulting download URL. Returns once both
 * Storage and Firestore writes complete.
 *
 * `onProgress` is invoked with values 0..1 during upload.
 */
export async function sendImage(
  threadId: string,
  args: {
    localUri: string;
    contentType?: string;
    width?: number;
    height?: number;
    caption?: string;
    localId?: string;
    onProgress?: (fraction: number) => void;
  },
): Promise<string> {
  const user = requireUser();
  const ts = Date.now();
  const guessedExt = args.localUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const ext = guessedExt.length > 4 ? 'jpg' : guessedExt;
  const storagePath = `chat/${threadId}/${user.uid}/${ts}.${ext}`;
  const ref = storage().ref(storagePath);

  const task = ref.putFile(args.localUri, {
    contentType: args.contentType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (args.onProgress) {
    task.on('state_changed', (snap) => {
      const total = snap.totalBytes || 1;
      args.onProgress?.(Math.min(1, snap.bytesTransferred / total));
    });
  }
  await task;
  const imageURL = await ref.getDownloadURL();

  const trimmedCaption = args.caption?.trim() ?? '';
  const docRef = await messagesCol(threadId).add({
    authorId: user.uid,
    type: 'image',
    imageURL,
    imageStoragePath: storagePath,
    ...(trimmedCaption ? { text: trimmedCaption } : {}),
    ...(args.width ? { imageWidth: args.width } : {}),
    ...(args.height ? { imageHeight: args.height } : {}),
    ...(args.localId ? { localId: args.localId } : {}),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  await threadsCol()
    .doc(threadId)
    .set(previewPatch(trimmedCaption || 'Sent a photo', 'image', user.uid), { merge: true });
  track.messageSent(threadId, 'image');
  return docRef.id;
}

export type MessagesSubscriber = (messages: MessageDoc[]) => void;
export type MessagesErrorHandler = (err: Error) => void;

export function listMessages(
  threadId: string,
  onChange: MessagesSubscriber,
  onError?: MessagesErrorHandler,
): () => void {
  return messagesCol(threadId)
    .orderBy('createdAt', 'asc')
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot) => {
        onChange(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessageDoc, 'id'>) })),
        );
      },
      (err: Error) => {
        onChange([]);
        onError?.(err);
      },
    );
}

/**
 * Soft-deletes a message authored by the caller. The Firestore rules permit
 * updates that *only* set `deletedAt` and `deletedBy`. Hard-deletes are
 * forbidden.
 */
export async function softDeleteOwnMessage(
  threadId: string,
  messageId: string,
): Promise<void> {
  const user = requireUser();
  await messagesCol(threadId)
    .doc(messageId)
    .update({
      deletedAt: firestore.FieldValue.serverTimestamp(),
      deletedBy: user.uid,
    });
}
