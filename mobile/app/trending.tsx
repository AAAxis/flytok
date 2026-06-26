import { useCallback, useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { filterPlayable, videosCol, type VideoDoc } from '@/lib/firestore';
import { VideoGrid } from '@/components/VideoGrid';
import { colors } from '@/lib/theme';

const SECTION_LIMIT = 9;

type Snap = Awaited<ReturnType<ReturnType<typeof videosCol>['get']>>;
function toDocs(snap: Snap): VideoDoc[] {
  return filterPlayable(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) })),
  );
}

/**
 * Trending places — same grid look as the Saved tab, but ranked by
 * engagement instead of the viewer's own saves.
 */
export default function Trending() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mostLiked, setMostLiked] = useState<VideoDoc[]>([]);
  const [fresh, setFresh] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [likedSnap, freshSnap] = await Promise.all([
      videosCol().orderBy('likeCount', 'desc').limit(30).get(),
      videosCol().orderBy('createdAt', 'desc').limit(30).get(),
    ]);
    setMostLiked(toDocs(likedSnap).slice(0, SECTION_LIMIT));
    setFresh(toDocs(freshSnap).slice(0, SECTION_LIMIT));
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.warn('[trending] load failed:', err))
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openVideo = useCallback(
    (v: VideoDoc) => {
      router.push(`/v/${v.id}` as never);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Trending places</Text>
        <Pressable
          onPress={() => router.push('/search' as never)}
          hitSlop={8}
          style={styles.iconBtnCircle}
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <Text style={styles.section}>Most liked videos</Text>
            <VideoGrid videos={mostLiked} emptyLabel="No trending videos yet" onPress={openVideo} />

            <Text style={styles.section}>Fresh &amp; trending</Text>
            <VideoGrid videos={fresh} emptyLabel="Nothing new yet" onPress={openVideo} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  content: {},
  loading: { paddingVertical: 60, alignItems: 'center' },
  section: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
});
