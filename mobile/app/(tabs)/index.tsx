import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { getBlockedIds, videosCol, type VideoDoc } from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { prefetchVideos } from '@/lib/videoCache';
import { colors } from '@/lib/theme';

const { height } = Dimensions.get('window');

export default function Feed() {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    const [snap, blockedIds] = await Promise.all([
      videosCol().orderBy('createdAt', 'desc').limit(50).get(),
      getBlockedIds(),
    ]);
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
      .filter((v) => !blockedIds.has(v.ownerId));
    setVideos(list);
    // Pre-warm the cache for the first handful of videos so scrolling forward
    // is snappy. Fire-and-forget; failures are silently ignored.
    prefetchVideos(list.slice(0, 5).map((v) => v.downloadURL).filter(Boolean));
  }, []);

  const handleBlocked = useCallback((uid: string) => {
    setVideos((prev) => prev.filter((v) => v.ownerId !== uid));
  }, []);

  useEffect(() => {
    load()
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No videos yet</Text>
        <Text style={styles.emptyHint}>Upload one from the + tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <FeedItem item={item} active={index === activeIndex} onBlocked={handleBlocked} />
      )}
      pagingEnabled
      snapToInterval={height}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: colors.textMuted, fontSize: 13 },
});
