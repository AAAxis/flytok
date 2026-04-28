import { useEffect, useState } from 'react';
import { getUserLabel, usersCol } from './firestore';

export type UserProfileSummary = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
};

const profileCache = new Map<string, UserProfileSummary>();

export function getCachedUserProfile(uid: string | null | undefined): UserProfileSummary | null {
  if (!uid) return null;
  return profileCache.get(uid) ?? null;
}

/** Resolves a uid to a small profile summary (name, avatar, bio). */
export function useUserProfile(uid: string | null | undefined): UserProfileSummary | null {
  const [profile, setProfile] = useState<UserProfileSummary | null>(() =>
    getCachedUserProfile(uid),
  );
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    usersCol()
      .doc(uid)
      .get()
      .then((snap) => {
        if (cancelled) return;
        const d = snap.data() ?? {};
        const summary: UserProfileSummary = {
          uid,
          displayName: (d.displayName as string) ?? null,
          photoURL: (d.photoURL as string) ?? null,
          bio: (d.bio as string) ?? null,
        };
        profileCache.set(uid, summary);
        setProfile(summary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);
  return profile;
}

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
