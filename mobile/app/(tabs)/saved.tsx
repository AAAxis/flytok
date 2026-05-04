import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getVideosByIds,
  savesCol,
  type VideoDoc,
} from '@/lib/firestore';
import { VideoGrid } from '@/components/VideoGrid';
import { colors } from '@/lib/theme';

export default function Saved() {
  const router = useRouter();
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live saves listener — mirrors the pattern that profile.tsx used before W6.
  // Subscribing here means the badge count and the grid update on the same
  // snapshot, so toggling save from the feed reflects on this tab without a
  // manual refresh.
  useEffect(() => {
    if (!me) return;
    const unsub = savesCol(me.uid).onSnapshot(
      async (snap) => {
        const ids = snap.docs.map((d) => d.id);
        if (ids.length === 0) {
          setVideos([]);
          setLoading(false);
          return;
        }
        try {
          const fetched = await getVideosByIds(ids);
          setVideos(fetched);
        } catch (err) {
          console.warn('[saved] snapshot fetch failed:', err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn('[saved] listener error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [me]);

  const onRefresh = useCallback(async () => {
    if (!me) return;
    setRefreshing(true);
    try {
      const snap = await savesCol(me.uid).orderBy('createdAt', 'desc').get();
      const fetched = await getVideosByIds(snap.docs.map((d) => d.id));
      setVideos(fetched);
    } catch (err) {
      console.warn('[saved] refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [me]);

  if (!me) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Saved</Text>
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
          <VideoGrid
            videos={videos}
            emptyLabel="Nothing saved yet"
            onPress={(v) => {
              router.push(`/posts/${me.uid}?start=${v.id}&source=saved` as never);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  content: {},
  loading: { paddingVertical: 60, alignItems: 'center' },
});
