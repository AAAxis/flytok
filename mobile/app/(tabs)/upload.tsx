import { useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { extractHashtags, uploadVideo, type VideoLocation } from '@/lib/firestore';
import { geocodeAddress, getCurrentLocationLabeled, type GeoResult } from '@/lib/geocode';
import { colors } from '@/lib/theme';

type LocationState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'results'; results: GeoResult[] }
  | { status: 'error'; message: string };

export default function Upload() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<'idle' | 'uploading'>('idle');

  const [locationQuery, setLocationQuery] = useState('');
  const [location, setLocation] = useState<VideoLocation | null>(null);
  const [locState, setLocState] = useState<LocationState>({ status: 'idle' });
  const [usingCurrent, setUsingCurrent] = useState(false);

  const player = useVideoPlayer(uri ?? '', (p) => {
    p.loop = true;
    p.muted = true;
    if (uri) p.play();
  });

  const hashtags = useMemo(() => extractHashtags(caption), [caption]);

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

  async function searchLocation() {
    const q = locationQuery.trim();
    if (!q) return;
    setLocState({ status: 'searching' });
    try {
      const results = await geocodeAddress(q);
      if (!results.length) {
        setLocState({ status: 'error', message: 'No matches found' });
      } else {
        setLocState({ status: 'results', results });
      }
    } catch (err: any) {
      setLocState({ status: 'error', message: err?.message ?? 'Search failed' });
    }
  }

  async function useCurrentLocation() {
    setUsingCurrent(true);
    setLocState({ status: 'idle' });
    try {
      const result = await getCurrentLocationLabeled();
      setLocation({ latitude: result.latitude, longitude: result.longitude, label: result.label });
      setLocationQuery(result.label);
    } catch (err: any) {
      Alert.alert('Could not get location', err?.message ?? 'Try searching instead.');
    } finally {
      setUsingCurrent(false);
    }
  }

  function pickResult(r: GeoResult) {
    setLocation({ latitude: r.latitude, longitude: r.longitude, label: r.label });
    setLocationQuery(r.label);
    setLocState({ status: 'idle' });
  }

  function clearLocation() {
    setLocation(null);
    setLocationQuery('');
    setLocState({ status: 'idle' });
  }

  async function handleUpload() {
    if (!uri) return;
    setProgress('uploading');
    try {
      await uploadVideo({ uri, caption, location, hashtags });
      setUri(null);
      setCaption('');
      clearLocation();
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Unknown error');
    } finally {
      setProgress('idle');
    }
  }

  const editable = progress === 'idle';

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
            placeholder="Say something about this place… add #tags to be found"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.input}
            editable={editable}
          />
          {hashtags.length > 0 && (
            <View style={styles.tagRow}>
              {hashtags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Location</Text>
          {location ? (
            <View style={styles.locationPill}>
              <Ionicons name="location" size={16} color={colors.accent} />
              <Text style={styles.locationLabel} numberOfLines={1}>
                {location.label ?? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`}
              </Text>
              <Pressable onPress={clearLocation} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.locationInputRow}>
                <TextInput
                  value={locationQuery}
                  onChangeText={setLocationQuery}
                  onSubmitEditing={searchLocation}
                  placeholder="Search a place"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, styles.locationInput]}
                  editable={editable}
                  returnKeyType="search"
                />
                <Pressable
                  onPress={searchLocation}
                  disabled={!locationQuery.trim() || locState.status === 'searching'}
                  style={({ pressed }) => [
                    styles.searchButton,
                    (!locationQuery.trim() || locState.status === 'searching') && styles.submitDisabled,
                    pressed && styles.pickerPressed,
                  ]}
                  hitSlop={8}
                >
                  {locState.status === 'searching' ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <Ionicons name="search" size={18} color={colors.text} />
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={useCurrentLocation}
                disabled={usingCurrent}
                style={({ pressed }) => [styles.currentBtn, pressed && styles.pickerPressed]}
                hitSlop={6}
              >
                {usingCurrent ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Ionicons name="navigate" size={14} color={colors.accent} />
                )}
                <Text style={styles.currentBtnText}>
                  {usingCurrent ? 'Locating…' : 'Use current location'}
                </Text>
              </Pressable>

              {locState.status === 'results' && (
                <View style={styles.resultsList}>
                  {locState.results.map((r, i) => (
                    <Pressable
                      key={`${r.label}-${i}`}
                      onPress={() => pickResult(r)}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.pickerPressed]}
                    >
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.resultText} numberOfLines={1}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {locState.status === 'error' && (
                <Text style={styles.errorText}>{locState.message}</Text>
              )}
            </>
          )}

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
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  locationInputRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  locationInput: { flex: 1, minHeight: 0, paddingVertical: 10 },
  searchButton: {
    width: 44,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  currentBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  resultsList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultText: { color: colors.text, fontSize: 14, flex: 1 },
  errorText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  locationLabel: { color: colors.text, fontSize: 13, fontWeight: '500', maxWidth: 240 },
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
