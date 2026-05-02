// Public surface of the messaging module. Screens and components import from
// `@/lib/messaging` only — they should never reach into the individual files
// below. Anything not re-exported here is implementation detail.

export type {
  ImageAttachment,
  MessageDoc,
  MessageType,
  SharedVideo,
  ThreadDoc,
} from './schema';
export { COLLECTIONS } from './schema';

export {
  ensureThread,
  getThread,
  listMyThreads,
  markRead,
  threadIdFor,
  threadsCol,
} from './threads';

export {
  listMessages,
  messagesCol,
  newLocalId,
  sendImage,
  sendText,
  sendVideoCard,
  softDeleteOwnMessage,
} from './messages';

export { threadUnreadIndicator, totalUnreadCount } from './unread';

export {
  registerFcmTokenForUser,
  unregisterCurrentDeviceToken,
} from './push';

export { setupBackgroundMessageHandler } from './background';

export { useThreadList } from './hooks/useThreadList';
export type { UseThreadListResult } from './hooks/useThreadList';
export { useThread } from './hooks/useThread';
export { useMessages } from './hooks/useMessages';
export type { ChatMessage, UseMessagesResult } from './hooks/useMessages';
export { useUnreadBadge } from './hooks/useUnreadBadge';
