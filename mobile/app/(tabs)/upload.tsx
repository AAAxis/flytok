import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { uploadVideo } from '@/lib/firestore';
import { colors } from '@/lib/theme';

export default function Upload() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<'idle' | 'uploading'>('idle');

  const player = useVideoPlayer(uri ?? '', (p) => {
    p.loop = true;
    p.muted = true;
    if (uri) p.play();
  });

  async function pickVideo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setUri(res.assets[0].uri);
    }
  }

  async function recordVideo() {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access in Settings.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setUri(res.assets[0].uri);
    }
  }

  async function handleUpload() {
    if (!uri) return;
    setProgress('uploading');
    try {
      await uploadVideo({ uri, caption });
      setUri(null);
      setCaption('');
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Unknown error');
    } finally {
      setProgress('idle');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>New post</Text>

          {uri ? (
            <View style={styles.preview}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="cover"
                nativeControls={false}
              />
              <Pressable
                onPress={() => setUri(null)}
                style={styles.changeButton}
                hitSlop={8}
              >
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickerRow}>
              <Pressable onPress={pickVideo} style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerPressed]}>
                <Text style={styles.pickerLabel}>Choose from library</Text>
              </Pressable>
              <Pressable onPress={recordVideo} style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerPressed]}>
                <Text style={styles.pickerLabel}>Record video</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Say something about this place…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.input}
            editable={progress === 'idle'}
          />

          <Pressable
            onPress={handleUpload}
            disabled={!uri || progress === 'uploading'}
            style={({ pressed }) => [
              styles.submit,
              (!uri || progress === 'uploading') && styles.submitDisabled,
              pressed && styles.submitPressed,
            ]}
          >
            {progress === 'uploading' ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.submitText}>Post</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { padding: 24, gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  preview: {
    aspectRatio: 9 / 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: { flex: 1 },
  changeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeText: { color: colors.text, fontSize: 12, fontWeight: '500' },
  pickerRow: { gap: 12 },
  pickerButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 18,
    alignItems: 'center',
  },
  pickerPressed: { backgroundColor: colors.surfaceAlt },
  pickerLabel: { color: colors.text, fontSize: 14, fontWeight: '500' },
  label: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitPressed: { backgroundColor: colors.accentDim },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
});
