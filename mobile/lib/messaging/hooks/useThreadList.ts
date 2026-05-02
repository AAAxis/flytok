import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { listMyThreads } from '../threads';
import type { ThreadDoc } from '../schema';

export type UseThreadListResult = {
  threads: ThreadDoc[];
  loading: boolean;
  error: Error | null;
};

/** Live-subscribed list of my DM threads, sorted by most-recent activity. */
export function useThreadList(): UseThreadListResult {
  const [threads, setThreads] = useState<ThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const me = auth().currentUser;
    if (!me) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const unsub = listMyThreads(
      (items) => {
        setThreads(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { threads, loading, error };
}
