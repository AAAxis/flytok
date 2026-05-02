import { useMemo } from 'react';
import auth from '@react-native-firebase/auth';
import { useThreadList } from './useThreadList';
import { totalUnreadCount } from '../unread';

/**
 * Total count of threads with at least one unread message addressed to me.
 * Drives the inbox tab-bar badge.
 */
export function useUnreadBadge(): number {
  const { threads } = useThreadList();
  const myUid = auth().currentUser?.uid ?? null;
  return useMemo(() => {
    if (!myUid) return 0;
    return totalUnreadCount(threads, myUid);
  }, [threads, myUid]);
}
