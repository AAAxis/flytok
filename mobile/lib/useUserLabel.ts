import { useEffect, useState } from 'react';
import { getUserLabel } from './firestore';

/**
 * Resolves a uid to a displayable label (displayName, username, or "User abc123")
 * — never an email address. Use this anywhere user identity is shown to *other*
 * users. Caches via getUserLabel's internal cache.
 */
export function useUserLabel(uid: string | null | undefined, fallback?: string): string {
  const [label, setLabel] = useState<string>(
    fallback ?? (uid ? `User ${uid.slice(0, 6)}` : 'user'),
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getUserLabel(uid).then((l) => {
      if (!cancelled) setLabel(l);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return label;
}
