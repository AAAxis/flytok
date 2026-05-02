import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { VideoDoc } from '@/lib/firestore';

/**
 * Direct-message data model. Source of truth — every other file in the
 * messaging module imports its types from here. Mirrors the Firestore
 * rules in `firestore.rules`.
 */

export type MessageType = 'text' | 'image' | 'video_card';

/** Image attachment metadata kept on a message doc. */
export type ImageAttachment = {
  imageURL: string;
  imageStoragePath: string;
  width?: number;
  height?: number;
};

export type ThreadDoc = {
  id: string;
  participants: string[];
  /** Pre-existing 1:1 threads still carry this map. New writes omit it. */
  participantEmails?: Record<string, string | null>;
  participantCount?: number;
  lastMessage?: string;
  lastMessageAt?: FirebaseFirestoreTypes.Timestamp;
  lastMessageType?: MessageType;
  lastMessageAuthorId?: string;
  /** uid -> last-read server timestamp; used by the inbox unread badge. */
  lastReadAt?: Record<string, FirebaseFirestoreTypes.Timestamp>;
};

export type MessageDoc = {
  id: string;
  authorId: string;
  type: MessageType;
  /** Text body for `text`, caption for `image`. */
  text?: string;
  imageURL?: string;
  imageStoragePath?: string;
  /** Optional client-generated id used to reconcile optimistic sends. */
  localId?: string;

  // video_card payload (preserved for shared-video previews from the feed)
  videoId?: string;
  videoCaption?: string;
  videoOwnerEmail?: string | null;
  videoDownloadURL?: string;

  createdAt?: FirebaseFirestoreTypes.Timestamp;

  // soft-delete (rules forbid hard delete)
  deletedAt?: FirebaseFirestoreTypes.Timestamp;
  deletedBy?: string;
};

/** Re-exported video card payload type so the UI doesn't reach into firestore.ts. */
export type SharedVideo = VideoDoc;

export const COLLECTIONS = {
  threads: 'threads',
  messages: 'messages',
  users: 'users',
} as const;
