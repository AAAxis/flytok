import { useEffect, useState } from 'react';
import { threadsCol } from '../threads';
import type { ThreadDoc } from '../schema';

export function useThread(threadId: string | undefined): {
  thread: ThreadDoc | null;
  loading: boolean;
} {
  const [thread, setThread] = useState<ThreadDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) {
      setThread(null);
      setLoading(false);
      return;
    }
    const unsub = threadsCol()
      .doc(threadId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists()) {
            setThread(null);
          } else {
            setThread({ id: snap.id, ...(snap.data() as Omit<ThreadDoc, 'id'>) });
          }
          setLoading(false);
        },
        () => {
          setThread(null);
          setLoading(false);
        },
      );
    return unsub;
  }, [threadId]);

  return { thread, loading };
}
