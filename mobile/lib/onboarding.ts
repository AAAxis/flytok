import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// v1 suffix lets us reset the flag for everyone if we ship a different
// onboarding flow later — bump to v2 instead of forcing a migration.
const KEY = 'flytok.hasSeenOnboarding.v1';

// In-process cache + listener set so a `setHasSeenOnboarding(true)` call
// inside the onboarding screen instantly updates the auth gate's state,
// without waiting for a fresh AsyncStorage read on the next mount.
//
// Without this, tapping "Get started" / "Skip" wrote the flag to disk and
// then `router.replace('/login')` fired before the Gate's `seen` state
// caught up — the Gate's gate effect saw `!user && !seen && onLogin` and
// bounced back to `/onboarding`, remounting the FlatList at slide 1.
let cached: boolean | null = null;
const listeners = new Set<(seen: boolean) => void>();

function notify(seen: boolean) {
  cached = seen;
  for (const fn of listeners) fn(seen);
}

export async function getHasSeenOnboarding(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const v = (await AsyncStorage.getItem(KEY)) === '1';
    cached = v;
    return v;
  } catch {
    return false;
  }
}

export async function setHasSeenOnboarding(seen: boolean): Promise<void> {
  // Update the in-process cache + notify subscribers FIRST so any
  // navigation that fires immediately after this call observes the new
  // value. The disk write is best-effort.
  notify(seen);
  try {
    await AsyncStorage.setItem(KEY, seen ? '1' : '0');
  } catch {
    // best-effort — failure here just means the user re-sees onboarding
    // on a fresh process restart.
  }
}

/**
 * React hook for the auth gate. Returns `null` until the first read
 * resolves (the Gate uses that to hold up its spinner). Re-renders
 * whenever any caller flips the flag via `setHasSeenOnboarding`.
 */
export function useHasSeenOnboarding(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(cached);

  useEffect(() => {
    listeners.add(setSeen);
    if (cached === null) {
      AsyncStorage.getItem(KEY)
        .then((v) => {
          // Don't clobber a value already pushed in by setHasSeenOnboarding
          // while the read was in flight.
          if (cached !== null) return;
          notify(v === '1');
        })
        .catch(() => notify(false));
    }
    return () => {
      listeners.delete(setSeen);
    };
  }, []);

  return seen;
}
