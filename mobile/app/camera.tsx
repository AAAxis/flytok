import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  extractHashtags,
  extractMentions,
  getSavedLocations,
  uploadVideo,
  type VideoLocation,
} from '@/lib/firestore';
import { geocodeAddress, getCurrentLocationLabeled, type GeoResult } from '@/lib/geocode';
import { colors } from '@/lib/theme';

type Mode = 'camera' | 'review';

const MIN_RECORDING_MS = 1200;

export default function CameraScreen() {
  const router = useRouter();
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const recordingStartedAtRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState<VideoLocation | null>(null);
  const [mode, setMode] = useState<Mode>('camera');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCamPerm();
  }, [camPerm, requestCamPerm]);
  useEffect(() => {
    if (micPerm && !micPerm.granted && micPerm.canAskAgain) requestMicPerm();
  }, [micPerm, requestMicPerm]);
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  async function pickFromLibrary() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photos access needed',
          'Enable Photos access for Roamerz in Settings to pick a video from your library.',
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 60,
        quality: 1,
        // Force the asset to be exported as a local file so iCloud-only
        // videos get downloaded before we hand back a URI.
        videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
      });
      if (!res.canceled && res.assets[0]) {
        setUri(res.assets[0].uri);
        setMode('review');
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      const isCloud = /3164|iCloud|could not be completed/i.test(msg);
      Alert.alert(
        'Could not load that video',
        isCloud
          ? "iOS couldn't load this clip — it's likely in iCloud and not yet downloaded to your phone. Open it in Photos first to download it, then try again."
          : msg || 'Try a different video.',
      );
    }
  }

  async function startRecording() {
    if (Platform.OS === 'android') {
      await recordWithSystemCamera();
      return;
    }
    if (!cameraRef.current || !cameraReady || recording) return;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    stopRequestedRef.current = false;
    recordingStartedAtRef.current = Date.now();
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) {
        setUri(result.uri);
        setMode('review');
      }
    } catch (err: any) {
      const message = err?.message ?? 'Try again.';
      const stoppedTooEarly = /stopped before any data could be produced/i.test(message);
      if (!stoppedTooEarly) {
        Alert.alert('Recording failed', message);
      }
    } finally {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      stopRequestedRef.current = false;
      setRecording(false);
    }
  }

  async function recordWithSystemCamera() {
    if (recording) return;
    setRecording(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera access needed',
          'Enable Camera access for Roamerz in Settings to record a video.',
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 60,
        quality: 1,
        cameraType: facing === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setUri(res.assets[0].uri);
        setMode('review');
      }
    } catch (err: any) {
      Alert.alert('Recording failed', err?.message ?? 'Try again.');
    } finally {
      setRecording(false);
    }
  }

  function stopRecording() {
    if (!recording || stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    const elapsed = Date.now() - recordingStartedAtRef.current;
    const remaining = Math.max(0, MIN_RECORDING_MS - elapsed);
    const stop = () => {
      stopTimerRef.current = null;
      cameraRef.current?.stopRecording();
    };
    if (remaining > 0) {
      stopTimerRef.current = setTimeout(stop, remaining);
    } else {
      stop();
    }
  }

  async function post() {
    if (!uri) return;
    if (!location) {
      Alert.alert('Location required', 'Choose a location before posting.');
      return;
    }
    setPosting(true);
    try {
      await uploadVideo({
        uri,
        caption,
        location,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
      });
      reset();
      router.back();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again.');
    } finally {
      setPosting(false);
    }
  }

  function reset() {
    setUri(null);
    setCaption('');
    setLocation(null);
    setMode('camera');
  }

  if (!camPerm) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!camPerm.granted) {
    return (
      <SafeAreaView style={styles.permSafe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionBox}>
          <Pressable onPress={() => router.back()} style={styles.permClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Ionicons name="videocam-outline" size={32} color={colors.textMuted} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Roamerz needs the camera to record travel videos.
          </Text>
          <Pressable onPress={requestCamPerm} style={styles.permButton}>
            <Text style={styles.permButtonText}>Grant access</Text>
          </Pressable>
          <Pressable onPress={pickFromLibrary} style={styles.altButton}>
            <Text style={styles.altButtonText}>Pick from library instead</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'review' && uri) {
    return (
      <ReviewScreen
        uri={uri}
        caption={caption}
        onCaptionChange={setCaption}
        location={location}
        onLocationChange={setLocation}
        posting={posting}
        onPost={post}
        onRetake={reset}
      />
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, styles.androidCameraFallback]} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          videoQuality="1080p"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => Alert.alert('Camera unavailable', e.message ?? 'Try again.')}
        />
      )}


      <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              setCameraReady(false);
              setFacing((f) => (f === 'back' ? 'front' : 'back'));
            }}
            hitSlop={10}
            style={styles.iconButton}
          >
            <Ionicons name="camera-reverse" size={28} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <Pressable onPress={pickFromLibrary} style={styles.libraryButton} hitSlop={10}>
            <Ionicons name="images" size={26} color="#fff" />
            <Text style={styles.libraryLabel}>Library</Text>
          </Pressable>

          <Pressable
            onPress={recording ? stopRecording : startRecording}
            disabled={Platform.OS !== 'android' && !cameraReady && !recording}
            style={[
              styles.recordButton,
              recording && styles.recordButtonActive,
              Platform.OS !== 'android' && !cameraReady && !recording && styles.recordButtonDisabled,
            ]}
          >
            <View style={[styles.recordInner, recording && styles.recordInnerActive]} />
          </Pressable>

          <View style={styles.libraryButton} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ReviewScreen({
  uri,
  caption,
  onCaptionChange,
  location,
  onLocationChange,
  posting,
  onPost,
  onRetake,
}: {
  uri: string;
  caption: string;
  onCaptionChange: (v: string) => void;
  location: VideoLocation | null;
  onLocationChange: (loc: VideoLocation | null) => void;
  posting: boolean;
  onPost: () => void;
  onRetake: () => void;
}) {
  const [showLocation, setShowLocation] = useState(false);
  const hashtags = extractHashtags(caption);
  const mentions = extractMentions(caption);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  return (
    <View style={styles.detailsScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.detailsHeader}>
            <Pressable onPress={onRetake} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.detailsTitle}>New post</Text>
            <View style={styles.iconButton} />
          </View>

          <ScrollView
            contentContainerStyle={styles.detailsContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.captionRow}>
              <TextInput
                value={caption}
                onChangeText={onCaptionChange}
                placeholder="Describe your post — use #tags and @mentions"
                placeholderTextColor={colors.textFaint}
                multiline
                style={styles.captionField}
                editable={!posting}
              />
              <View style={styles.thumbWrap}>
                <VideoView
                  player={player}
                  style={styles.thumbVideo}
                  contentFit="cover"
                  nativeControls={false}
                  allowsVideoFrameAnalysis={false}
                />
              </View>
            </View>

            {(hashtags.length > 0 || mentions.length > 0) && (
              <View style={styles.chipRow}>
                {hashtags.map((t) => (
                  <View key={`h-${t}`} style={styles.chipTagLight}>
                    <Text style={styles.chipTextLight}>#{t}</Text>
                  </View>
                ))}
                {mentions.map((m) => (
                  <View key={`m-${m}`} style={styles.chipMentionLight}>
                    <Text style={styles.chipTextLight}>@{m}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.optionList}>
              <Pressable
                onPress={() => setShowLocation(true)}
                disabled={posting}
                style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
              >
                <Ionicons
                  name={location ? 'location' : 'location-outline'}
                  size={20}
                  color={location ? colors.accent : colors.textMuted}
                />
                <Text style={styles.optionLabel} numberOfLines={1}>
                  {location ? prettyLocationLabel(location) : 'Add location'}
                </Text>
                {location ? (
                  <Pressable onPress={() => onLocationChange(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                )}
              </Pressable>
            </View>

            <Text style={styles.detailsHint}>
              Tip: type #tags and @mentions in the caption — they'll be linked
              automatically and help others find your post.
            </Text>
          </ScrollView>

          <View style={styles.detailsFooter}>
            <Pressable
              onPress={onRetake}
              disabled={posting}
              style={({ pressed }) => [
                styles.draftButton,
                pressed && styles.draftPressed,
              ]}
            >
              <Text style={styles.draftText}>Discard</Text>
            </Pressable>
            <Pressable
              onPress={onPost}
              disabled={posting || !location}
              style={({ pressed }) => [
                styles.postButton,
                styles.postButtonFlex,
                (posting || !location) && styles.postDisabled,
                pressed && styles.postPressed,
              ]}
            >
              {posting ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.postText}>Post</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <LocationPickerModal
        visible={showLocation}
        onClose={() => setShowLocation(false)}
        onPick={(loc) => {
          onLocationChange(loc);
          setShowLocation(false);
        }}
      />
    </View>
  );
}

function prettyLocationLabel(loc: VideoLocation): string {
  const label = loc.label?.trim();
  if (!label) return 'Pinned location';
  // Reject pure "lat, lng" strings — iOS sometimes returns those as place.name.
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(label)) return 'Pinned location';
  return label;
}

function LocationPickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (loc: VideoLocation) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [savedLocations, setSavedLocations] = useState<VideoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [usingCurrent, setUsingCurrent] = useState(false);

  useEffect(() => {
    if (!visible || !auth().currentUser) return;
    getSavedLocations()
      .then(setSavedLocations)
      .catch(() => setSavedLocations([]));
  }, [visible]);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await geocodeAddress(q);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function useCurrent() {
    setUsingCurrent(true);
    try {
      const here = await getCurrentLocationLabeled();
      onPick({ latitude: here.latitude, longitude: here.longitude, label: here.label });
    } catch (err: any) {
      Alert.alert('Location unavailable', err?.message ?? 'Try searching instead.');
    } finally {
      setUsingCurrent(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.locModalScreen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.locModalHeader}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.locModalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.locModalTitle}>Add location</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.locModalBody}>
            <View style={styles.locSearchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                placeholder="Search a place…"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                returnKeyType="search"
                style={styles.locInput}
              />
              <Pressable
                onPress={search}
                disabled={!query.trim() || searching}
                style={[styles.locSearchBtn, (!query.trim() || searching) && styles.postDisabled]}
              >
                {searching ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Ionicons name="search" size={18} color={colors.bg} />
                )}
              </Pressable>
            </View>

            <Pressable onPress={useCurrent} disabled={usingCurrent} style={styles.locCurrentBtn}>
              <Ionicons name="locate" size={18} color={colors.accent} />
              <Text style={styles.locCurrentText}>
                {usingCurrent ? 'Locating…' : 'Use my current location'}
              </Text>
            </Pressable>

            {savedLocations.length > 0 ? (
              <View style={styles.locSavedList}>
                <Text style={styles.locSavedTitle}>Saved places</Text>
                {savedLocations.map((r, i) => (
                  <Pressable
                    key={`${r.label ?? 'saved'}-${r.latitude}-${r.longitude}-${i}`}
                    onPress={() => onPick(r)}
                    style={styles.locResult}
                  >
                    <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.locResultText} numberOfLines={2}>
                      {r.label ?? `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {results.map((r, i) => (
              <Pressable
                key={`${r.latitude}-${r.longitude}-${i}`}
                onPress={() => onPick(r)}
                style={styles.locResult}
              >
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                <Text style={styles.locResultText} numberOfLines={2}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  permSafe: { flex: 1, backgroundColor: colors.bg },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  permClose: { position: 'absolute', top: 12, right: 12 },
  permTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  permBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  permButton: {
    marginTop: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: { color: colors.bg, fontWeight: '600' },
  altButton: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 10 },
  altButtonText: { color: colors.accent, fontSize: 14 },

  cameraScreen: { flex: 1, backgroundColor: '#000' },
  androidCameraFallback: { backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  libraryButton: { width: 60, alignItems: 'center', gap: 4 },
  libraryLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: '#fff',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { borderColor: '#ef4444' },
  recordButtonDisabled: { opacity: 0.45 },
  recordInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ef4444' },
  recordInnerActive: { width: 30, height: 30, borderRadius: 6 },

  reviewScreen: { flex: 1, backgroundColor: '#000' },
  reviewOverlay: { ...StyleSheet.absoluteFillObject },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  reviewTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reviewBottom: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 8,
  },
  captionInput: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  postButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  postPressed: { backgroundColor: colors.accentDim },
  postDisabled: { opacity: 0.5 },
  postText: { color: colors.bg, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  chipMention: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  locationText: { color: '#fff', fontSize: 14, flex: 1 },
  locModalScreen: { flex: 1, backgroundColor: colors.bg },
  locModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locModalCancel: { color: colors.textMuted, fontSize: 14, width: 60 },
  locModalTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  locModalBody: { padding: 16, gap: 12 },
  locSearchRow: { flexDirection: 'row', gap: 8 },
  locInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  locSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  locCurrentText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  locSavedList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  locSavedTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textTransform: 'uppercase',
  },
  locResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  locResultText: { color: colors.text, fontSize: 14, flex: 1 },

  // Details / "step 2" screen — TikTok-style post editor
  detailsScreen: { flex: 1, backgroundColor: colors.bg },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailsTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  detailsContent: { padding: 16, gap: 16 },
  captionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  captionField: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 110,
    padding: 0,
    textAlignVertical: 'top',
  },
  thumbWrap: {
    width: 80,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbVideo: { width: '100%', height: '100%' },
  chipTagLight: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  chipMentionLight: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  chipTextLight: { color: colors.text, fontSize: 12, fontWeight: '500' },
  optionList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionPressed: { backgroundColor: colors.surfaceAlt },
  optionLabel: { flex: 1, color: colors.text, fontSize: 14 },
  detailsHint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  detailsFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  draftButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftPressed: { backgroundColor: colors.surfaceAlt },
  draftText: { color: colors.text, fontWeight: '600' },
  postButtonFlex: { flex: 1 },
});
