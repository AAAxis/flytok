import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import {
  listMessages,
  newLocalId,
  sendImage as sendImageMessage,
  sendText as sendTextMessage,
  sendVideoCard as sendVideoCardMessage,
} from '../messages';
import type { MessageDoc, SharedVideo } from '../schema';

/**
 * A message in the optimistic list. `pending: true` means the doc isn't on
 * the server yet — we render it slightly faded with a spinner. Image
 * uploads also expose `progress` while the bytes travel.
 */
export type ChatMessage = MessageDoc & {
  pending?: boolean;
  failed?: boolean;
  progress?: number;
  /** Local-only preview uri while an image upload is in flight. */
  localPreviewUri?: string;
};

type PendingEntry = ChatMessage;

export type UseMessagesResult = {
  messages: ChatMessage[];
  loading: boolean;
  error: Error | null;
  sendText: (text: string) => Promise<void>;
  sendImage: (args: {
    uri: string;
    width?: number;
    height?: number;
    contentType?: string;
    caption?: string;
  }) => Promise<void>;
  sendVideoCard: (video: SharedVideo) => Promise<void>;
};

function makeNowTs(): FirebaseFirestoreTypes.Timestamp {
  return firestore.Timestamp.now();
}

/**
 * Subscribes to the thread's messages and merges in any locally-pending
 * sends that haven't appeared on the server yet. Optimistic items are keyed
 * by `localId` and removed once a server doc with the same `localId` shows up.
 */
export function useMessages(threadId: string | undefined): UseMessagesResult {
  const [serverMessages, setServerMessages] = useState<MessageDoc[]>([]);
  const [pendingMap, setPendingMap] = useState<Map<string, PendingEntry>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!threadId) {
      setServerMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listMessages(
      threadId,
      (items) => {
        if (!mountedRef.current) return;
        setServerMessages(items);
        setLoading(false);
        // Reconcile: drop any pending entries whose localId now exists on server.
        setPendingMap((prev) => {
          if (prev.size === 0) return prev;
          const next = new Map(prev);
          for (const m of items) {
            if (m.localId && next.has(m.localId)) next.delete(m.localId);
          }
          return next.size === prev.size ? prev : next;
        });
      },
      (err) => {
        if (!mountedRef.current) return;
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [threadId]);

  const setPending = useCallback((localId: string, patch: Partial<PendingEntry>) => {
    setPendingMap((prev) => {
      const existing = prev.get(localId);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(localId, { ...existing, ...patch });
      return next;
    });
  }, []);

  const removePending = useCallback((localId: string) => {
    setPendingMap((prev) => {
      if (!prev.has(localId)) return prev;
      const next = new Map(prev);
      next.delete(localId);
      return next;
    });
  }, []);

  const addPending = useCallback((entry: PendingEntry) => {
    setPendingMap((prev) => {
      const next = new Map(prev);
      next.set(entry.localId as string, entry);
      return next;
    });
  }, []);

  const sendText = useCallback(
    async (text: string): Promise<void> => {
      if (!threadId) return;
      const me = auth().currentUser;
      if (!me) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const localId = newLocalId();
      addPending({
        id: `local:${localId}`,
        localId,
        authorId: me.uid,
        type: 'text',
        text: trimmed,
        createdAt: makeNowTs(),
        pending: true,
      });
      try {
        await sendTextMessage(threadId, trimmed, localId);
      } catch (err) {
        setPending(localId, { pending: false, failed: true });
        throw err;
      }
    },
    [threadId, addPending, setPending],
  );

  const sendImage = useCallback(
    async (args: {
      uri: string;
      width?: number;
      height?: number;
      contentType?: string;
      caption?: string;
    }): Promise<void> => {
      if (!threadId) return;
      const me = auth().currentUser;
      if (!me) return;
      const localId = newLocalId();
      addPending({
        id: `local:${localId}`,
        localId,
        authorId: me.uid,
        type: 'image',
        text: args.caption?.trim() || undefined,
        localPreviewUri: args.uri,
        createdAt: makeNowTs(),
        pending: true,
        progress: 0,
      });
      try {
        await sendImageMessage(threadId, {
          localUri: args.uri,
          width: args.width,
          height: args.height,
          contentType: args.contentType,
          caption: args.caption,
          localId,
          onProgress: (fraction) => setPending(localId, { progress: fraction }),
        });
      } catch (err) {
        setPending(localId, { pending: false, failed: true });
        // Drop the failed optimistic entry after a short delay so the user
        // sees the failure indicator before it disappears.
        setTimeout(() => removePending(localId), 4000);
        throw err;
      }
    },
    [threadId, addPending, setPending, removePending],
  );

  const sendVideoCard = useCallback(
    async (video: SharedVideo): Promise<void> => {
      if (!threadId) return;
      const me = auth().currentUser;
      if (!me) return;
      const localId = newLocalId();
      addPending({
        id: `local:${localId}`,
        localId,
        authorId: me.uid,
        type: 'video_card',
        videoId: video.id,
        videoCaption: video.caption ?? '',
        videoOwnerEmail: video.ownerEmail ?? null,
        videoDownloadURL: video.downloadURL,
        createdAt: makeNowTs(),
        pending: true,
      });
      try {
        await sendVideoCardMessage(threadId, video, localId);
      } catch (err) {
        setPending(localId, { pending: false, failed: true });
        throw err;
      }
    },
    [threadId, addPending, setPending],
  );

  const merged = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = serverMessages.map((m) => ({ ...m }));
    if (pendingMap.size > 0) {
      for (const p of pendingMap.values()) out.push(p);
    }
    out.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });
    return out;
  }, [serverMessages, pendingMap]);

  return {
    messages: merged,
    loading,
    error,
    sendText,
    sendImage,
    sendVideoCard,
  };
}
