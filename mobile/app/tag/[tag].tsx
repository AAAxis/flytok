import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { filterPlayable, getBlockedIds, videosCol, type VideoDoc } from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { usePlayerPool, type FeedPoolItem } from '@/lib/feed/usePlayerPool';
import { getCachedVideoPath } from '@/lib/videoCache';
import { colors } from '@/lib/theme';

const FALLBACK_HEIGHT = Dimensions.get('window').height;

/**
 * Hashtag-filtered feed. Routed to from the W3 search screen. Same
 * pagination, player pool, and FeedItem as the trending feed — the only
 * twist is the Firestore query: `where('hashtags', 'array-contains', tag)`
 * (lowercased; that's how `extractHashtags` writes them).
 */
export default function TagFeed() {
  const isFocused = useIsFocused();
  const { tag, start } = useLocalSearchParams<{ tag: string; start?: string }>();
  const normalised = (tag ?? '').replace(/^#/, '').toLowerCase();

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_HEIGHT);
  const listRef = useRef<FlatList<VideoDoc>>(null);

  const load = useCallback(async () => {
    if (!normalised) return [] as VideoDoc[];
    try {
      const [snap, blockedIds] = await Promise.all([
        videosCol()
          .where('hashtags', 'array-contains', normalised)
          .limit(200)
          .get(),
        getBlockedIds(),
      ]);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
        .filter((v) => !blockedIds.has(v.ownerId));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      return filterPlayable(list);
    } catch (err) {
      console.warn('[tag-feed] load failed:', err);
      return [];
    }
  }, [normalised]);

  useEffect(() => {
    load()
      .then((list) => {
        setVideos(list);
        if (start) {
          const idx = list.findIndex((v) => v.id === start);
          if (idx >= 0) setActiveIndex(idx);
        }
      })
      .finally(() => setLoading(false));
  }, [load, start]);

  useEffect(() => {
    if (videos.length === 0) return;
    if (activeIndex <= 0) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: activeIndex, animated: false });
    }, 16);
    return () => clearTimeout(id);
  }, [videos.length, activeIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  function onContainerLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== viewportHeight) setViewportHeight(h);
  }

  const [cachedUriById, setCachedUriById] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const winStart = Math.max(0, activeIndex - 1);
    const winEnd = Math.min(videos.length, activeIndex + 2);
    for (let i = winStart; i < winEnd; i += 1) {
      const v = videos[i];
      if (!v?.downloadURL || cachedUriById[v.id]) continue;
      getCachedVideoPath(v.downloadURL)
        .then((path) => {
          if (cancelled || !path) return;
          setCachedUriById((prev) =>
            prev[v.id] === path ? prev : { ...prev, [v.id]: path },
          );
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [videos, activeIndex, cachedUriById]);

  const poolItems = useMemo<FeedPoolItem[]>(
    () =>
      videos
        .map((v) => {
          const uri = cachedUriById[v.id] ?? v.downloadURL;
          return uri ? { id: v.id, uri } : null;
        })
        .filter((x): x is FeedPoolItem => x != null),
    [videos, cachedUriById],
  );

  const pool = usePlayerPool(poolItems, activeIndex, undefined, isFocused);

  return (
    <View style={styles.root} onLayout={onContainerLayout}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: normalised ? `#${normalised}` : 'Tag',
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleStyle: { color: '#fff' },
          headerTintColor: '#fff',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No posts for #{normalised}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FeedItem
              item={item}
              active={isFocused && index === activeIndex}
              height={viewportHeight}
              player={pool.getPlayerForIndex(index)}
            />
          )}
          pagingEnabled
          snapToInterval={viewportHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({
            length: viewportHeight,
            offset: viewportHeight * i,
            index: i,
          })}
          windowSize={3}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          initialScrollIndex={
            start
              ? Math.max(0, videos.findIndex((v) => v.id === start))
              : 0
          }
          onScrollToIndexFailed={() => {}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
