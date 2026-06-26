import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  extractHashtags,
  extractMentions,
  getSavedLocations,
  isValidHashtag,
  normaliseHashtags,
  uploadVideo,
  HASHTAG_MAX_COUNT,
  HASHTAG_MAX_TAG_LENGTH,
  HASHTAG_TOTAL_CHAR_LIMIT,
  totalHashtagsLength,
  type VideoLocation,
} from '@/lib/firestore';
import type { FirebaseStorageTypes } from '@react-native-firebase/storage';
import { geocodeAddress, getCurrentLocationLabeled, type GeoResult } from '@/lib/geocode';
import { colors } from '@/lib/theme';
import { TrimButton } from '@/components/upload/TrimButton';
import { MusicPickerSheet } from '@/components/upload/MusicPickerSheet';
import { UploadProgressBar } from '@/components/upload/UploadProgressBar';
import { deleteUserAudio, type AudioSelection } from '@/lib/audio';
import type { UploadPhase } from '@/lib/uploadProgress';

type LocationState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'results'; results: GeoResult[] }
  | { status: 'error'; message: string };

const ORIGINAL_AUDIO: AudioSelection = { source: 'original' };

export default function Upload() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<'idle' | 'uploading'>('idle');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [pct, setPct] = useState(0);

  const [locationQuery, setLocationQuery] = useState('');
  const [location, setLocation] = useState<VideoLocation | null>(null);
  const [locState, setLocState] = useState<LocationState>({ status: 'idle' });
  const [savedLocations, setSavedLocations] = useState<VideoLocation[]>([]);
  const [usingCurrent, setUsingCurrent] = useState(false);

  const [tagInput, setTagInput] = useState('');
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [mentionInput, setMentionInput] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  const [audio, setAudio] = useState<AudioSelection>(ORIGINAL_AUDIO);
  const [musicSheetOpen, setMusicSheetOpen] = useState(false);

  // Holds the in-flight Storage `putFile` task so we can cancel it from the
  // progress bar's Cancel button.
  const taskRef = useRef<FirebaseStorageTypes.Task | null>(null);

  const player = useVideoPlayer(uri ?? '', (p) => {
    p.loop = true;
    p.muted = true;
    if (uri) p.play();
  });

  // Tags = #hashtags found in the caption + any the user added explicitly on step 2.
  // The combined list is run through normaliseHashtags so the in-flight UI
  // already shows what will actually persist (10 max, ≤80 chars total).
  const captionHashtags = useMemo(() => extractHashtags(caption), [caption]);
  const allTags = useMemo(
    () => normaliseHashtags([...captionHashtags, ...extraTags]),
    [captionHashtags, extraTags],
  );
  const usedChars = totalHashtagsLength(allTags);
  const charsLeft = Math.max(0, HASHTAG_TOTAL_CHAR_LIMIT - usedChars);
  const atTagCap = allTags.length >= HASHTAG_MAX_COUNT;

  useEffect(() => {
    getSavedLocations()
      .then(setSavedLocations)
      .catch(() => setSavedLocations([]));
  }, []);

  function commitTag() {
    const raw = tagInput.replace(/^#+/, '').trim().toLowerCase();
    if (!raw) return;
    if (!isValidHashtag(raw)) {
      setTagError(
        raw.length > HASHTAG_MAX_TAG_LENGTH
          ? `Max ${HASHTAG_MAX_TAG_LENGTH} characters per tag`
          : 'Letters, numbers and _ only',
      );
      return;
    }
    if (allTags.includes(raw)) {
      setTagError('Already added');
      setTagInput('');
      return;
    }
    if (atTagCap) {
      setTagError(`Up to ${HASHTAG_MAX_COUNT} hashtags`);
      return;
    }
    // Budget check uses the same accounting normaliseHashtags applies, so the
    // user can't sneak past the cap by typing fast.
    const projected = totalHashtagsLength([...allTags, raw]);
    if (projected > HASHTAG_TOTAL_CHAR_LIMIT) {
      setTagError(`Only ${charsLeft} characters left`);
      return;
    }
    setTagError(null);
    setExtraTags((prev) => [...prev, raw]);
    setTagInput('');
  }
  function removeTag(tag: string) {
    // Caption-derived tags can't be removed in isolation — they'd just come
    // back from the caption next render. Strip from caption instead.
    if (captionHashtags.includes(tag)) {
      setCaption((prev) => prev.replace(new RegExp(`#${tag}\\b`, 'gi'), '').replace(/\s{2,}/g, ' ').trim());
      return;
    }
    setExtraTags((prev) => prev.filter((t) => t !== tag));
    setTagError(null);
  }

  function commitMention() {
    const raw = mentionInput.replace(/^@+/, '').trim().toLowerCase();
    if (!raw) return;
    if (!mentions.includes(raw)) setMentions((prev) => [...prev, raw]);
    setMentionInput('');
  }
  function removeMention(handle: string) {
    setMentions((prev) => prev.filter((m) => m !== handle));
  }

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

  function pickResult(r: VideoLocation) {
    setLocation({ latitude: r.latitude, longitude: r.longitude, label: r.label });
    setLocationQuery(r.label ?? `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`);
    setLocState({ status: 'idle' });
  }

  function clearLocation() {
    setLocation(null);
    setLocationQuery('');
    setLocState({ status: 'idle' });
  }

  function resetForm() {
    setUri(null);
    setCaption('');
    setExtraTags([]);
    setMentions([]);
    setTagInput('');
    setMentionInput('');
    setAudio(ORIGINAL_AUDIO);
    clearLocation();
    setStep(1);
  }

  function cancelUpload() {
    try {
      taskRef.current?.cancel?.();
    } catch (err) {
      console.warn('[upload] cancel failed:', err);
    }
  }

  async function handleUpload() {
    if (!uri) return;
    if (!location) {
      Alert.alert('Location required', 'Choose a location before posting.');
      setStep(1);
      return;
    }
    // Pull any @mentions left in the caption into the explicit list too.
    const captionMentions = extractMentions(caption);
    const finalMentions = Array.from(new Set([...mentions, ...captionMentions]));

    setProgress('uploading');
    setPhase('upload');
    setPct(0);
    try {
      const { id } = await uploadVideo({
        uri,
        caption,
        location,
        hashtags: allTags,
        mentions: finalMentions,
        audio,
        taskRef,
        onProgress: ({ phase: p, percent }) => {
          setPhase(p);
          setPct(percent);
        },
      });
      resetForm();
      router.replace({ pathname: '/upload/success', params: { videoId: id } });
    } catch (err: any) {
      // RNFB surfaces a manual cancel as `storage/cancelled` — treat gracefully.
      if (err?.code === 'storage/cancelled') {
        Alert.alert('Upload cancelled', 'Your upload was stopped.');
      } else {
        Alert.alert('Upload failed', err?.message ?? 'Unknown error');
      }
    } finally {
      setProgress('idle');
      setPhase('idle');
      setPct(0);
      taskRef.current = null;
    }
  }

  async function clearAudioSelection() {
    if (audio.source === 'user_upload') {
      // Best-effort cleanup of the orphaned upload.
      await deleteUserAudio(audio.storagePath);
    }
    setAudio(ORIGINAL_AUDIO);
  }

  const editable = progress === 'idle';
  const audioSummary =
    audio.source === 'library'
      ? `${audio.track.title} · ${audio.track.artist}`
      : audio.source === 'user_upload'
        ? audio.title
        : 'Original sound';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>New post</Text>
            <Text style={styles.stepBadge}>Step {step} of 2</Text>
          </View>

          {step === 1 && uri ? (
            <>
              <View style={styles.preview}>
                <VideoView
                  player={player}
                  style={styles.video}
                  contentFit="cover"
                  nativeControls={false}
                  allowsVideoFrameAnalysis={false}
                />
                <Pressable
                  onPress={() => setUri(null)}
                  style={styles.changeButton}
                  hitSlop={8}
                >
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              </View>
              <TrimButton
                uri={uri}
                disabled={!editable}
                onTrimmed={(trimmed) => setUri(trimmed)}
              />
              <Pressable
                onPress={() => setMusicSheetOpen(true)}
                disabled={!editable}
                style={({ pressed }) => [
                  styles.audioBtn,
                  !editable && styles.submitDisabled,
                  pressed && styles.pickerPressed,
                ]}
              >
                <Ionicons name="musical-notes-outline" size={16} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioLabel}>Music</Text>
                  <Text style={styles.audioMeta} numberOfLines={1}>
                    {audioSummary}
                  </Text>
                </View>
                {audio.source !== 'original' ? (
                  <Pressable onPress={clearAudioSelection} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                )}
              </Pressable>
            </>
          ) : step === 1 ? (
            <View style={styles.pickerRow}>
              <Pressable onPress={pickVideo} style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerPressed]}>
                <Text style={styles.pickerLabel}>Choose from library</Text>
              </Pressable>
              <Pressable onPress={recordVideo} style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerPressed]}>
                <Text style={styles.pickerLabel}>Record video</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 1 && <>
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
          {captionHashtags.length > 0 && (
            <View style={styles.tagRow}>
              {captionHashtags.map((tag) => (
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

              {savedLocations.length > 0 ? (
                <View style={styles.resultsList}>
                  <Text style={styles.savedPlacesTitle}>Saved places</Text>
                  {savedLocations.map((r, i) => (
                    <Pressable
                      key={`${r.label ?? 'saved'}-${r.latitude}-${r.longitude}-${i}`}
                      onPress={() => pickResult(r)}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.pickerPressed]}
                    >
                      <Ionicons name="bookmark-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.resultText} numberOfLines={1}>
                        {r.label ?? `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

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
          </>}

          {step === 2 && (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Hashtags</Text>
                <Text
                  style={[
                    styles.counter,
                    charsLeft <= 10 && styles.counterWarn,
                  ]}
                >
                  {usedChars}/{HASHTAG_TOTAL_CHAR_LIMIT}
                </Text>
              </View>
              <Text style={styles.helper}>
                Stored as a separate field so trending and category filters can find this video.
                Up to {HASHTAG_MAX_COUNT} tags · {HASHTAG_TOTAL_CHAR_LIMIT} characters total.
              </Text>
              <View style={styles.chipInputRow}>
                <Text style={styles.chipPrefix}>#</Text>
                <TextInput
                  value={tagInput}
                  onChangeText={(v) => {
                    setTagInput(v.slice(0, HASHTAG_MAX_TAG_LENGTH));
                    if (tagError) setTagError(null);
                  }}
                  onSubmitEditing={commitTag}
                  placeholder={atTagCap ? `Hashtag limit reached` : 'travel'}
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxLength={HASHTAG_MAX_TAG_LENGTH}
                  style={styles.chipInput}
                  editable={editable && !atTagCap}
                />
                <Pressable
                  onPress={commitTag}
                  disabled={!tagInput.trim() || atTagCap}
                  style={({ pressed }) => [
                    styles.chipAddBtn,
                    (!tagInput.trim() || atTagCap) && styles.submitDisabled,
                    pressed && styles.pickerPressed,
                  ]}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
              {tagError ? <Text style={styles.errorText}>{tagError}</Text> : null}
              {allTags.length > 0 && (
                <View style={styles.tagRow}>
                  {allTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => removeTag(tag)}
                      style={[styles.tagChip, styles.removableChip]}
                    >
                      <Text style={styles.tagText}>#{tag}</Text>
                      <Ionicons name="close" size={12} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Mentions</Text>
              <Text style={styles.helper}>Tag other travelers who were there or whose work you’re referencing.</Text>
              <View style={styles.chipInputRow}>
                <Text style={styles.chipPrefix}>@</Text>
                <TextInput
                  value={mentionInput}
                  onChangeText={setMentionInput}
                  onSubmitEditing={commitMention}
                  placeholder="username"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.chipInput}
                  editable={editable}
                />
                <Pressable
                  onPress={commitMention}
                  disabled={!mentionInput.trim()}
                  style={({ pressed }) => [
                    styles.chipAddBtn,
                    !mentionInput.trim() && styles.submitDisabled,
                    pressed && styles.pickerPressed,
                  ]}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
              {mentions.length > 0 && (
                <View style={styles.tagRow}>
                  {mentions.map((handle) => (
                    <Pressable
                      key={handle}
                      onPress={() => removeMention(handle)}
                      style={[styles.tagChip, styles.removableChip]}
                    >
                      <Text style={styles.tagText}>@{handle}</Text>
                      <Ionicons name="close" size={12} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {progress === 'uploading' ? (
            <UploadProgressBar phase={phase} percent={pct} onCancel={cancelUpload} />
          ) : null}

          {step === 1 ? (
            <Pressable
              onPress={() => setStep(2)}
              disabled={!uri || !location}
              style={({ pressed }) => [
                styles.submit,
                (!uri || !location) && styles.submitDisabled,
                pressed && styles.submitPressed,
              ]}
            >
              <Text style={styles.submitText}>Next</Text>
            </Pressable>
          ) : (
            <View style={styles.stepNav}>
              <Pressable
                onPress={() => setStep(1)}
                disabled={progress === 'uploading'}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pickerPressed]}
                hitSlop={6}
              >
                <Ionicons name="arrow-back" size={16} color={colors.text} />
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={handleUpload}
                disabled={!uri || !location || progress === 'uploading'}
                style={({ pressed }) => [
                  styles.submit,
                  styles.submitFlex,
                  (!uri || !location || progress === 'uploading') && styles.submitDisabled,
                  pressed && styles.submitPressed,
                ]}
              >
                {progress === 'uploading' ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.submitText}>Post</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <MusicPickerSheet
        visible={musicSheetOpen}
        onClose={() => setMusicSheetOpen(false)}
        selected={audio}
        onSelect={setAudio}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { padding: 24, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  stepBadge: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  helper: { color: colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 4 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  counter: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  counterWarn: { color: colors.danger },
  chipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  chipPrefix: { color: colors.textMuted, fontSize: 16, marginRight: 4 },
  chipInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  chipAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  stepNav: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  backBtnText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  submitFlex: { flex: 1, marginTop: 0 },
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
  audioBtn: {
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
  audioLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  audioMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
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
  savedPlacesTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 10,
    textTransform: 'uppercase',
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
