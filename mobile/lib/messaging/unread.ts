import type { ThreadDoc } from './schema';

/**
 * Returns 1 (unread) or 0 (read) for a single thread relative to `myUid`.
 *
 * We don't have per-message read receipts — instead the app stores
 * `lastReadAt[uid]` on each thread doc. A thread is unread when:
 *   - it has any messages (`lastMessageAt` exists), AND
 *   - the most recent message wasn't sent by me, AND
 *   - my `lastReadAt` is missing or older than `lastMessageAt`.
 *
 * Returning 1 vs N is good enough for an inbox dot — Firestore doesn't store
 * the count anywhere we'd want to read on every snapshot.
 */
export function threadUnreadIndicator(thread: ThreadDoc, myUid: string): 0 | 1 {
  if (!thread.lastMessageAt) return 0;
  if (thread.lastMessageAuthorId === myUid) return 0;
  const lastReadMs = thread.lastReadAt?.[myUid]?.toMillis?.() ?? 0;
  const lastMsgMs = thread.lastMessageAt.toMillis();
  return lastMsgMs > lastReadMs ? 1 : 0;
}

/** Total unread-thread count across all of my threads. */
export function totalUnreadCount(threads: ThreadDoc[], myUid: string): number {
  let total = 0;
  for (const t of threads) total += threadUnreadIndicator(t, myUid);
  return total;
}
