import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { videosCol, type VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';

/**
 * Post-upload confirmation. Shows a paused poster of the freshly-uploaded
 * clip plus two CTAs:
 *  - "Watch your post" → my posts feed at the new video
 *  - "Keep exploring" → trending feed
 *
 * Reached via `router.replace('/upload/success?videoId=...')` so the device
 * back button doesn't return to a half-cleared upload form.
 */
export default function UploadSuccess() {
  const router = useRouter();
  const { videoId } = useLocalSearchParams<{ videoId?: string }>();
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setError('Missing video reference.');
      return;
    }
    let cancelled = false;
    videosCol()
      .doc(videoId)
      .get()
      .then((snap) => {
        if (cancelled) return;
        const data = snap.data();
        if (!data) {
          setError('Could not find your upload.');
          return;
        }
        setVideo({ id: snap.id, ...(data as Omit<VideoDoc, 'id'>) });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Could not load your upload.');
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Start muted playback once the freshly uploaded URL resolves. A paused
  // AVPlayer at time zero often has no decoded frame yet and rendered as a
  // completely black confirmation card on iOS.
  const player = useVideoPlayer(video?.downloadURL ?? '', (p) => {
    p.muted = true;
    p.loop = true;
    if (video?.downloadURL) p.play();
  });

  function watchPost() {
    const me = auth().currentUser;
    if (!me || !videoId) return;
    router.replace({ pathname: '/posts/[uid]', params: { uid: me.uid, start: videoId, source: 'mine' } });
  }

  function keepExploring() {
    router.replace('/(tabs)');
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={20} color={colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>You&apos;re up!</Text>
              <Text style={styles.subtitle}>Your post is live.</Text>
            </View>
          </View>

          <View style={styles.posterWrap}>
            {error ? (
              <View style={styles.posterFallback}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
                <Text style={styles.fallbackText}>{error}</Text>
              </View>
            ) : video?.downloadURL ? (
              <VideoView
                player={player}
                style={styles.poster}
                contentFit="cover"
                nativeControls={false}
                allowsVideoFrameAnalysis={false}
              />
            ) : (
              <View style={styles.posterFallback}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}
            {video?.caption ? (
              <View style={styles.captionRow}>
                <Text style={styles.caption} numberOfLines={2}>
                  {video.caption}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.ctaCol}>
            <Pressable
              onPress={watchPost}
              disabled={!videoId}
              style={({ pressed }) => [
                styles.primaryBtn,
                !videoId && styles.disabled,
                pressed && styles.primaryPressed,
              ]}
            >
              <Ionicons name="play" size={16} color={colors.bg} />
              <Text style={styles.primaryText}>Watch your post</Text>
            </Pressable>
            <Pressable
              onPress={keepExploring}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryPressed]}
            >
              <Ionicons name="compass-outline" size={16} color={colors.text} />
              <Text style={styles.secondaryText}>Keep exploring</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 24, gap: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  posterWrap: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  poster: { flex: 1 },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  captionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(9,9,11,0.7)',
  },
  caption: { color: colors.text, fontSize: 14 },
  ctaCol: { gap: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryPressed: { backgroundColor: colors.accentDim },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 10,
  },
  secondaryPressed: { backgroundColor: colors.surfaceAlt },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
