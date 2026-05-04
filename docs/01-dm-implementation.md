# Task 1 — Direct Messages (refactor + features)

## What exists today

Scaffolding only — written quickly, not production quality. Found in:
- `mobile/lib/firestore.ts` — types `ThreadDoc`, `MessageDoc`; helpers `ensureThread`, `sendTextMessage`, `sendVideoCard`, `threadIdFor`.
- `mobile/app/(tabs)/inbox.tsx` — thread list + new-chat user picker (loads all users, no search beyond name).
- `mobile/app/chat/[threadId].tsx` — single thread screen, text + video-card bubbles only.
- `mobile/components/ShareToChatSheet.tsx` — share-to-thread bottom sheet.

What's missing: read receipts, unread badges, optimistic send, FCM push delivery, image attachments, block-list filtering, message search, typing indicator, message delete (mine only), proper presentation/state separation.

Firestore rules deployed in the previous session already enforce per-thread privacy — any change you make to the schema must keep working under those rules (see `firestore.rules`).

## Goal

Refactor the DM code into a small, well-typed feature module with:
1. Single source of truth for messaging primitives (`mobile/lib/messaging/`).
2. Separation of *data* (Firestore queries, types, mutations) from *presentation* (screens, sheets, bubbles).
3. New features users expect from a 2026 messenger: optimistic send, unread tracking, push, image attach.

## Architecture target

```
mobile/lib/messaging/
  index.ts              -- public surface (re-exports)
  schema.ts             -- ThreadDoc, MessageDoc, attachment types, constants
  threads.ts            -- ensureThread, listMyThreads(), getThread(), markRead()
  messages.ts           -- sendText, sendImage, sendVideoCard, listMessages, deleteOwnMessage
  unread.ts             -- per-thread unread count, total badge
  push.ts               -- registerFcmTokenForUser(), notification handler wiring
  hooks/
    useThreadList.ts
    useThread.ts
    useMessages.ts
    useUnreadBadge.ts
mobile/components/messaging/
  ThreadRow.tsx
  MessageBubble.tsx
  Composer.tsx          -- text + attach button + send
  AttachmentPicker.tsx
mobile/app/(tabs)/inbox.tsx       -- consumes hooks only, no Firestore calls inline
mobile/app/chat/[threadId].tsx    -- consumes hooks only
```

## Schema additions (Firestore)

Update `firestore.rules` and verify against deploy script.

`threads/{threadId}` (additive — keep existing fields):
```ts
{
  participants: string[];                       // existing
  // remove: participantEmails (PII leak, replace with public users/{uid}.displayName)
  lastMessage: string;                          // existing
  lastMessageAt: Timestamp;                     // existing
  lastMessageType: 'text' | 'image' | 'video_card';  // NEW
  lastMessageAuthorId: string;                  // NEW — used by inbox UI to bold/dim previews
  // unread tracking: per-participant lastRead pointer
  lastReadAt: Record<string, Timestamp>;        // NEW — { [uid]: ts }
  // a denormalised counter for FCM payload size
  participantCount: number;                     // NEW (always 2 for now)
}
```

`threads/{threadId}/messages/{messageId}`:
```ts
{
  authorId: string;
  type: 'text' | 'image' | 'video_card';
  text?: string;                                // text and image (caption)
  imageURL?: string;                            // NEW — Storage download URL
  imageStoragePath?: string;                    // NEW — for delete-own-message cleanup
  videoId?: string;                             // existing video_card
  videoCaption?: string;
  videoDownloadURL?: string;
  createdAt: Timestamp;                         // server timestamp
  // soft-delete pattern (rules forbid hard delete)
  deletedAt?: Timestamp;                        // NEW
  deletedBy?: string;                           // NEW
}
```

`users/{uid}` additive fields:
```ts
{
  fcmTokens?: string[];                         // NEW — multi-device tokens
  fcmTokensUpdatedAt?: Timestamp;               // NEW
}
```

## Storage rules (write a `storage.rules` file too — the project doesn't have one)

```
service firebase.storage {
  match /b/{bucket}/o {
    match /chat/{threadId}/{uid}/{file=**} {
      allow read: if request.auth != null;  // tighten via thread participant check via Cloud Function later
      allow write: if request.auth != null && request.auth.uid == uid
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Deploy through the same REST-API approach as Firestore rules but the endpoint is `firebasestorage.googleapis.com` — verify what works with the existing service account before committing.

## Push notifications

- On login (`AuthProvider` after `ensureUserDoc`), call `registerFcmTokenForUser()`:
  - `messaging().getToken()` → arrayUnion into `users/{uid}.fcmTokens`.
  - Listen to `messaging().onTokenRefresh` and update.
- A Cloud Function `onMessageCreated` is required for actual delivery (does not exist yet — this project has zero functions). For the first cut, implement it as a `firebase/functions/` directory with the standard skeleton:
  - Trigger: `onDocumentCreated('threads/{threadId}/messages/{messageId}')`
  - Read parent thread, find recipient uids (`participants` minus author), fetch their `fcmTokens`, send via Admin SDK `messaging.sendEachForMulticast`.
  - Handle invalid tokens (UNREGISTERED → arrayRemove).
- Add deploy: `firebase deploy --only functions` requires interactive login OR write a service-account-auth deploy similar to the rules script.

## Message rules update

Existing rules already cover the create case. Add:
- `update`: allow only the author, and only to set `deletedAt`/`deletedBy` (soft delete).
- `lastReadAt` updates on the parent thread doc — already permitted under `update: if isParticipant()`.

## UX polish

- Optimistic send: append to local state with a temporary `id` and `pending: true`, replace when server timestamp arrives.
- Unread badge on tab bar: `useUnreadBadge()` listens to `threads where participants array-contains me`, sums (server `lastMessageAt > local lastReadAt[me]).
- Long-press a message: copy / delete (mine) / report (theirs).
- Block-list integration: filter inbox + new-chat picker against `users/{me}/blocked`.
- Image attach: Storage upload to `chat/{threadId}/{uid}/{ts}.{ext}` then write `messageDoc` with the resulting URL. Don't write the doc until upload completes.

## Testing

- Two real accounts (signin via two profiles on the same device, or two devices). The connected device is `0010934AE002636`.
- Verify message arrives in real-time, badge updates, push wakes the screen, image attaches, deleted-by-me message renders as "Message deleted".
- Run the existing app smoke-flow (feed → like → save → comment) afterwards to confirm no rule regressions.

## Dispatch hint for the orchestrator

Single agent. Don't split. Frontend agent that owns Firestore data layer.
Allow ~3-4 commits: data layer, UI refactor, push, polish.
