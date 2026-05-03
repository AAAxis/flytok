import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { usersCol } from '../firestore';
import { colors } from '../theme';
import type { AvatarStyle } from '../avatars';

export type ThemePreset =
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'purple'
  | 'rose'
  | 'dark'
  | 'custom';

export type UserTheme = {
  preset?: ThemePreset;
  backgroundColor: string;
  backgroundImageURL?: string | null;
  backgroundImagePath?: string | null;
  accentColor: string;
  avatarStyle: AvatarStyle;
  avatarSeed?: string;
};

/**
 * Default theme — used when a user doc has no `theme` field. Keep it visually
 * close to the existing dark surface so legacy users see no jarring change.
 */
export const defaultTheme: UserTheme = {
  preset: 'dark',
  backgroundColor: colors.surface,
  backgroundImageURL: null,
  backgroundImagePath: null,
  accentColor: colors.accent,
  avatarStyle: 'default',
};

export const THEME_PRESETS: Record<Exclude<ThemePreset, 'custom'>, {
  backgroundColor: string;
  accentColor: string;
}> = {
  ocean:  { backgroundColor: '#0c4a6e', accentColor: '#38bdf8' },
  sunset: { backgroundColor: '#7c2d12', accentColor: '#fb923c' },
  forest: { backgroundColor: '#14532d', accentColor: '#4ade80' },
  purple: { backgroundColor: '#581c87', accentColor: '#c084fc' },
  rose:   { backgroundColor: '#831843', accentColor: '#fb7185' },
  dark:   { backgroundColor: colors.surface, accentColor: colors.accent },
};

export const BACKGROUND_COLORS: string[] = [
  colors.surface,
  '#0c4a6e', // ocean
  '#7c2d12', // sunset
  '#14532d', // forest
  '#581c87', // purple
  '#831843', // rose
  '#1e293b', // slate
  '#1f2937', // gray
  '#3b0764', // violet deep
  '#082f49', // sky deep
  '#422006', // amber deep
  '#064e3b', // emerald deep
];

export const ACCENT_COLORS: string[] = [
  colors.accent,
  '#fb923c',
  '#4ade80',
  '#c084fc',
  '#fb7185',
  '#facc15',
  '#22d3ee',
  '#f472b6',
  '#a3e635',
  '#34d399',
  '#fbbf24',
  '#e879f9',
];

export function applyTheme(theme: UserTheme | null | undefined) {
  const t = theme ?? defaultTheme;
  return {
    headerBackgroundColor: t.backgroundColor,
    headerBackgroundImageURL: t.backgroundImageURL ?? null,
    accentColor: t.accentColor,
    accentButton: {
      backgroundColor: t.accentColor,
    },
    accentButtonText: {
      color: '#ffffff',
    },
    avatarBorder: {
      borderColor: t.accentColor,
      borderWidth: 2,
    },
  };
}

export type AppliedTheme = ReturnType<typeof applyTheme>;

/** Live-subscribe to a user's theme. Falls back to `defaultTheme`. */
export function useUserTheme(uid: string | null | undefined): UserTheme {
  const [theme, setTheme] = useState<UserTheme>(defaultTheme);

  useEffect(() => {
    if (!uid) {
      setTheme(defaultTheme);
      return;
    }
    const unsub = usersCol()
      .doc(uid)
      .onSnapshot(
        (snap) => {
          const data = snap.data();
          const raw = (data?.theme as Partial<UserTheme> | undefined) ?? null;
          if (!raw) {
            setTheme(defaultTheme);
            return;
          }
          setTheme({
            ...defaultTheme,
            ...raw,
            backgroundColor: raw.backgroundColor || defaultTheme.backgroundColor,
            accentColor: raw.accentColor || defaultTheme.accentColor,
            avatarStyle: (raw.avatarStyle as AvatarStyle) || defaultTheme.avatarStyle,
          });
        },
        () => setTheme(defaultTheme),
      );
    return unsub;
  }, [uid]);

  return theme;
}

export async function saveUserTheme(uid: string, partial: Partial<UserTheme>): Promise<void> {
  const themeUpdate: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) themeUpdate[k] = v;
  }
  if (Object.keys(themeUpdate).length === 0) return;
  await usersCol().doc(uid).set({ theme: themeUpdate }, { merge: true });
}

const BACKGROUND_PATH = (uid: string) => `users/${uid}/profile/background.jpg`;

/**
 * Resize → JPEG @0.85 → upload to fixed path → write theme.* fields. Cleans up
 * the previous background image (if any & different) so per-user storage stays
 * bounded.
 */
export async function uploadBackgroundImage(
  uid: string,
  uri: string,
  prevPath?: string | null,
): Promise<{ url: string; path: string }> {
  const manipulated = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });

  const path = BACKGROUND_PATH(uid);
  const ref = storage().ref(path);
  await ref.putFile(manipulated.uri, { contentType: 'image/jpeg' });
  const url = await ref.getDownloadURL();

  if (prevPath && prevPath !== path) {
    try {
      await storage().ref(prevPath).delete();
    } catch (err: any) {
      if (err?.code !== 'storage/object-not-found') {
        console.warn('[theme] previous background delete failed:', err);
      }
    }
  }

  await usersCol().doc(uid).set(
    {
      theme: {
        backgroundImageURL: url,
        backgroundImagePath: path,
        preset: 'custom',
      },
    },
    { merge: true },
  );

  return { url, path };
}

export async function clearBackgroundImage(
  uid: string,
  prevPath?: string | null,
): Promise<void> {
  if (prevPath) {
    try {
      await storage().ref(prevPath).delete();
    } catch (err: any) {
      if (err?.code !== 'storage/object-not-found') {
        console.warn('[theme] background clear failed:', err);
      }
    }
  }
  await usersCol().doc(uid).set(
    {
      theme: {
        backgroundImageURL: firestore.FieldValue.delete(),
        backgroundImagePath: firestore.FieldValue.delete(),
      },
    },
    { merge: true },
  );
}
