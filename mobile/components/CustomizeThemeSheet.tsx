/* eslint-disable react-compiler/react-compiler */
'use no memo';
import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import {
  ACCENT_COLORS,
  BACKGROUND_COLORS,
  THEME_PRESETS,
  clearBackgroundImage,
  saveUserTheme,
  uploadBackgroundImage,
  useUserTheme,
  type ThemePreset,
} from '@/lib/theme/userTheme';
import { AVATAR_STYLES, AVATAR_STYLE_LABEL, dicebearURL, type AvatarStyle } from '@/lib/avatars';
import { colors } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PRESET_LABEL: Record<Exclude<ThemePreset, 'custom'>, string> = {
  ocean: 'Ocean',
  sunset: 'Sunset',
  forest: 'Forest',
  purple: 'Purple',
  rose: 'Rose',
  dark: 'Dark',
};

export function CustomizeThemeSheet({ visible, onClose }: Props) {
  const me = auth().currentUser;
  const theme = useUserTheme(me?.uid);
  const [uploading, setUploading] = useState(false);

  const seed = theme.avatarSeed ?? me?.uid ?? 'flytok';

  // Snapshot the previous storage path so we can clean it up when the user
  // uploads a fresh background image.
  const [prevPath, setPrevPath] = useState<string | null>(null);
  useEffect(() => {
    setPrevPath(theme.backgroundImagePath ?? null);
  }, [theme.backgroundImagePath]);

  if (!me) return null;

  async function applyPreset(preset: Exclude<ThemePreset, 'custom'>) {
    if (!me) return;
    const p = THEME_PRESETS[preset];
    await saveUserTheme(me.uid, {
      preset,
      backgroundColor: p.backgroundColor,
      accentColor: p.accentColor,
    });
  }

  async function setBackgroundColor(color: string) {
    if (!me) return;
    await saveUserTheme(me.uid, {
      preset: 'custom',
      backgroundColor: color,
    });
  }

  async function setAccentColor(color: string) {
    if (!me) return;
    await saveUserTheme(me.uid, {
      preset: 'custom',
      accentColor: color,
    });
  }

  async function setAvatarStyle(style: AvatarStyle) {
    if (!me) return;
    await saveUserTheme(me.uid, {
      avatarStyle: style,
      avatarSeed: seed,
    });
  }

  async function pickBackgroundImage() {
    if (!me) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;

    setUploading(true);
    try {
      await uploadBackgroundImage(me.uid, res.assets[0].uri, prevPath);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again later.');
    } finally {
      setUploading(false);
    }
  }

  async function removeBackgroundImage() {
    if (!me) return;
    try {
      await clearBackgroundImage(me.uid, theme.backgroundImagePath ?? null);
    } catch (err: any) {
      Alert.alert('Could not remove background', err?.message ?? 'Try again later.');
    }
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['90%']}
      title="Customize profile"
    >
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        <Section label="Presets">
          <View style={styles.row}>
            {(Object.keys(PRESET_LABEL) as Array<keyof typeof PRESET_LABEL>).map((preset) => {
              const cfg = THEME_PRESETS[preset];
              const active = theme.preset === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => applyPreset(preset)}
                  style={[
                    styles.presetTile,
                    { backgroundColor: cfg.backgroundColor },
                    active && { borderColor: cfg.accentColor, borderWidth: 3 },
                  ]}
                >
                  <View style={[styles.presetDot, { backgroundColor: cfg.accentColor }]} />
                  <Text style={styles.presetLabel}>{PRESET_LABEL[preset]}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="Background color">
          <View style={styles.swatchGrid}>
            {BACKGROUND_COLORS.map((c) => {
              const active = theme.backgroundColor === c && !theme.backgroundImageURL;
              return (
                <Pressable
                  key={c}
                  onPress={() => setBackgroundColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    active && styles.swatchActive,
                  ]}
                />
              );
            })}
          </View>
        </Section>


        <Section label="Accent color">
          <View style={styles.swatchGrid}>
            {ACCENT_COLORS.map((c) => {
              const active = theme.accentColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setAccentColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    active && styles.swatchActive,
                  ]}
                />
              );
            })}
          </View>
        </Section>

        <Section label="Avatar style">
          <View style={styles.row}>
            {AVATAR_STYLES.map((style) => {
              const url = dicebearURL(style, seed, 96);
              const active = theme.avatarStyle === style;
              return (
                <Pressable
                  key={style}
                  onPress={() => setAvatarStyle(style)}
                  style={[styles.avatarTile, active && { borderColor: theme.accentColor }]}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarPhoto]}>
                      <Ionicons name="person" size={26} color={colors.text} />
                    </View>
                  )}
                  <Text style={styles.avatarLabel} numberOfLines={1}>
                    {AVATAR_STYLE_LABEL[style]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Pressable onPress={onClose} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  section: { marginTop: 8 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetTile: {
    width: 92,
    height: 64,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presetDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  presetLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  swatchActive: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  bgImageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  bgUpload: {
    width: 120,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  bgPreview: { width: '100%', height: '100%' },
  bgEmpty: { alignItems: 'center', justifyContent: 'center' },
  bgUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgActions: { flex: 1, gap: 8 },
  bgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  bgActionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  avatarTile: {
    width: 76,
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bg,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
  },
  avatarPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: colors.textMuted, fontSize: 11 },
  doneBtn: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
});
