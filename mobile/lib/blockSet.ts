import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { blockedCol } from '@/lib/firestore';

/**
 * Live, reactive view of the current user's blocked-uids subcollection.
 *
 * The trending / following / map / inbox surfaces still use the one-shot
 * `getBlockedIds()` because they refetch on every load anyway. This hook
 * powers surfaces that need the set to react instantly to a block /
 * unblock done elsewhere in the session — currently:
 *   - the visiting-user profile (`/user/{uid}`) banner
 *   - the chat composer gate
 *   - the search screen
 *   - CommentsSheet, FollowListSheet
 *
 * `ready` flips true only after the first `onSnapshot` payload, so callers
 * can avoid showing partial state (e.g. a flash of the chat composer
 * before the banner replaces it).
 *
 * One subscription per consumer is fine — Firestore deduplicates listeners
 * to the same path on the wire.
 */
export function useBlockedSet(): { set: Set<string>; ready: boolean } {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const me = auth().currentUser;
    if (!me) {
      setSet(new Set());
      setReady(true);
      return;
    }
    const unsub = blockedCol(me.uid).onSnapshot(
      (snap) => {
        setSet(new Set(snap.docs.map((d) => d.id)));
        setReady(true);
      },
      (err) => {
        console.warn('[blockSet] onSnapshot failed:', err);
        setSet(new Set());
        setReady(true);
      },
    );
    return unsub;
  }, []);

  return { set, ready };
}
