import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showEditor, isValidFile } from 'react-native-video-trim';
import { colors } from '@/lib/theme';

type Props = {
  /** Source video URI from the picker. */
  uri: string;
  /** Whether the parent flow is busy (uploading) — disables the button. */
  disabled?: boolean;
  /** Called with the trimmed file URI when the editor finishes successfully. */
  onTrimmed: (trimmedUri: string) => void;
  /** Called when the user dismisses the editor without trimming. */
  onCancel?: () => void;
};

/**
 * Optional native trim step. Tapping opens
 * `react-native-video-trim`'s editor (UIVideoEditorController-style on iOS,
 * native picker on Android). On success the parent's `uri` is replaced with
 * the trimmed file path so the upload uploads the trimmed clip.
 *
 * The app runs on the old architecture (`newArchEnabled: false`), so we use
 * `NativeEventEmitter` + `'VideoTrim'` event name per the lib's old-arch
 * docs. New-arch consumers would subscribe via the typed `Spec.onX(...)`
 * EventEmitters instead.
 */
export function TrimButton({ uri, disabled, onTrimmed, onCancel }: Props) {
  const [opening, setOpening] = useState(false);
  const onTrimmedRef = useRef(onTrimmed);
  const onCancelRef = useRef(onCancel);
  onTrimmedRef.current = onTrimmed;
  onCancelRef.current = onCancel;

  useEffect(() => {
    const native = NativeModules.VideoTrim;
    if (!native) {
      console.warn('[TrimButton] VideoTrim native module missing — was the app rebuilt after install?');
      return;
    }
    const emitter = new NativeEventEmitter(native);
    const sub = emitter.addListener('VideoTrim', (event: { name?: string; outputPath?: string; message?: string }) => {
      switch (event?.name) {
        case 'onFinishTrimming':
          setOpening(false);
          if (event.outputPath) onTrimmedRef.current(event.outputPath);
          break;
        case 'onCancelTrimming':
        case 'onCancel':
          setOpening(false);
          onCancelRef.current?.();
          break;
        case 'onError':
          setOpening(false);
          Alert.alert('Trim failed', event.message || 'The trimmer ran into an error.');
          break;
        default:
          break;
      }
    });
    return () => sub.remove();
  }, []);

  async function open() {
    if (!uri || disabled) return;
    try {
      const valid = await isValidFile(uri);
      if (!valid?.isValid) {
        Alert.alert('Cannot trim', 'This file is not a video the trimmer can read.');
        return;
      }
      setOpening(true);
      // showEditor returns synchronously; results come via the event emitter.
      showEditor(uri, {
        type: 'video',
        saveToPhoto: false,
        // Editor expects milliseconds. 60s ceiling matches the upload screen.
        maxDuration: 60_000,
        minDuration: 1_000,
        cancelButtonText: 'Cancel',
        saveButtonText: 'Save trim',
      });
    } catch (err: any) {
      setOpening(false);
      Alert.alert('Could not open trimmer', err?.message ?? 'Try a different video.');
    }
  }

  return (
    <Pressable
      onPress={open}
      disabled={!uri || disabled || opening}
      style={({ pressed }) => [
        styles.btn,
        (!uri || disabled) && styles.disabled,
        pressed && styles.pressed,
      ]}
      hitSlop={6}
    >
      {opening ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Ionicons name="cut-outline" size={16} color={colors.text} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Trim</Text>
        <Text style={styles.helper}>Optional — pick the clip range.</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  disabled: { opacity: 0.5 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  helper: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
