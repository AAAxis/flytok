import AsyncStorage from '@react-native-async-storage/async-storage';

// v1 suffix lets us reset the flag for everyone if we ship a different
// onboarding flow later — bump to v2 instead of forcing a migration.
const KEY = 'flytok.hasSeenOnboarding.v1';

export async function getHasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setHasSeenOnboarding(seen: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, seen ? '1' : '0');
  } catch {
    // best-effort — failure here just means the user re-sees onboarding
  }
}
