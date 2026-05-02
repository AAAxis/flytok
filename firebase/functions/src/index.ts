/**
 * Cloud Functions for Roamrez/Flytok.
 *
 * Currently a single trigger: when a new message lands under
 * `threads/{threadId}/messages/{messageId}`, fan it out as an FCM push to
 * every recipient's registered devices.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

type MessageType = 'text' | 'image' | 'video_card';

interface MessageDoc {
  authorId: string;
  type: MessageType;
  text?: string;
  videoCaption?: string;
}

interface ThreadDoc {
  participants?: string[];
}

interface UserDoc {
  fcmTokens?: string[];
  displayName?: string | null;
}

function previewBody(msg: MessageDoc): string {
  switch (msg.type) {
    case 'image':
      return msg.text?.trim() || 'Sent a photo';
    case 'video_card':
      return msg.videoCaption?.trim() || 'Shared a video';
    case 'text':
    default:
      return msg.text?.trim() || 'New message';
  }
}

async function pruneInvalidTokens(uid: string, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db
    .collection('users')
    .doc(uid)
    .update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens),
    })
    .catch((err) => {
      logger.warn('failed to prune tokens', { uid, err: err?.message });
    });
}

export const onMessageCreated = onDocumentCreated(
  {
    document: 'threads/{threadId}/messages/{messageId}',
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('no snapshot on event');
      return;
    }
    const message = snap.data() as MessageDoc | undefined;
    if (!message) return;
    if (message.text === undefined && message.type === 'text') return;

    const { threadId } = event.params as { threadId: string };

    const threadSnap = await db.collection('threads').doc(threadId).get();
    const thread = threadSnap.data() as ThreadDoc | undefined;
    if (!thread?.participants?.length) {
      logger.warn('thread has no participants', { threadId });
      return;
    }

    const recipientUids = thread.participants.filter((u) => u !== message.authorId);
    if (recipientUids.length === 0) return;

    // Author display name powers the notification title.
    const authorSnap = await db.collection('users').doc(message.authorId).get();
    const author = authorSnap.data() as UserDoc | undefined;
    const title = (author?.displayName?.trim() || 'New message').slice(0, 80);
    const body = previewBody(message).slice(0, 240);

    // Walk each recipient: collect their tokens, send via multicast, prune
    // any that come back UNREGISTERED.
    await Promise.all(
      recipientUids.map(async (uid) => {
        const userSnap = await db.collection('users').doc(uid).get();
        const user = userSnap.data() as UserDoc | undefined;
        const tokens = (user?.fcmTokens ?? []).filter(
          (t): t is string => typeof t === 'string' && t.length > 0,
        );
        if (tokens.length === 0) return;

        const response = await fcm.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            threadId,
            messageId: event.params.messageId as string,
            type: message.type,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'chat-messages',
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: { sound: 'default', badge: 1 },
            },
          },
        });

        const dead: string[] = [];
        response.responses.forEach((r, idx) => {
          if (r.success) return;
          const code = r.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            dead.push(tokens[idx]);
          } else {
            logger.warn('fcm send failed', { uid, code, msg: r.error?.message });
          }
        });
        if (dead.length > 0) await pruneInvalidTokens(uid, dead);
      }),
    );
  },
);
