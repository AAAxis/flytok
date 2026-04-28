import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { videosCol, type VideoDoc } from '@/lib/firestore';
import { useUserLabel } from '@/lib/useUserLabel';
import { colors } from '@/lib/theme';

export default function DeepLinkVideo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    videosCol()
      .doc(id)
      .get()
      .then((snap) => {
        if (snap.exists) {
          setVideo({ id: snap.id, ...(snap.data() as Omit<VideoDoc, 'id'>) });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const player = useVideoPlayer(video?.downloadURL ?? '', (p) => {
    p.loop = true;
    p.muted = false;
    if (video?.downloadURL) p.play();
  });

  const ownerLabel = useUserLabel(video?.ownerId);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!video) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.notFoundTitle}>Video not found</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to feed</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <Pressable onPress={() => router.replace('/')} style={styles.close} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <View style={styles.bottom}>
          <Text style={styles.author}>{ownerLabel}</Text>
          {video.caption ? <Text style={styles.caption}>{video.caption}</Text> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
  },
  bottom: { padding: 16, gap: 6 },
  author: { color: '#fff', fontSize: 14, fontWeight: '700' },
  caption: { color: '#fff', fontSize: 13 },
  notFoundTitle: { color: colors.text, fontSize: 16 },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  backBtnText: { color: colors.bg, fontWeight: '600' },
});
