import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { uploadVideo } from '@/lib/firestore';
import { colors } from '@/lib/theme';

type Mode = 'camera' | 'review';

export default function CameraScreen() {
  const router = useRouter();
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [recording, setRecording] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [mode, setMode] = useState<Mode>('camera');
  const [posting, setPosting] = useState(false);
  const [active, setActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCamPerm();
  }, [camPerm, requestCamPerm]);
  useEffect(() => {
    if (micPerm && !micPerm.granted && micPerm.canAskAgain) requestMicPerm();
  }, [micPerm, requestMicPerm]);

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) {
      setUri(res.assets[0].uri);
      setMode('review');
    }
  }

  async function startRecording() {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (result?.uri) {
        setUri(result.uri);
        setMode('review');
      }
    } catch (err: any) {
      Alert.alert('Recording failed', err?.message ?? 'Try again.');
    } finally {
      setRecording(false);
    }
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  async function post() {
    if (!uri) return;
    setPosting(true);
    try {
      await uploadVideo({ uri, caption });
      reset();
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again.');
    } finally {
      setPosting(false);
    }
  }

  function reset() {
    setUri(null);
    setCaption('');
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
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={styles.permissionBox}>
          <Pressable onPress={() => router.back()} style={styles.permClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Ionicons name="videocam-outline" size={32} color={colors.textMuted} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Flytok needs the camera to record travel videos.
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
        posting={posting}
        onPost={post}
        onRetake={reset}
      />
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      {active && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
        />
      )}

      <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
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
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.recordButton, recording && styles.recordButtonActive]}
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
  posting,
  onPost,
  onRetake,
}: {
  uri: string;
  caption: string;
  onCaptionChange: (v: string) => void;
  posting: boolean;
  onPost: () => void;
  onRetake: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  return (
    <View style={styles.reviewScreen}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <SafeAreaView style={styles.reviewOverlay} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.reviewTop}>
            <Pressable onPress={onRetake} hitSlop={10} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.reviewTitle}>New post</Text>
            <View style={styles.iconButton} />
          </View>

          <View style={styles.flex} />

          <View style={styles.reviewBottom}>
            <TextInput
              value={caption}
              onChangeText={onCaptionChange}
              placeholder="Add a caption…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              style={styles.captionInput}
              editable={!posting}
            />
            <Pressable
              onPress={onPost}
              disabled={posting}
              style={({ pressed }) => [
                styles.postButton,
                posting && styles.postDisabled,
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
    </View>
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
});
