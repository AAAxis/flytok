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
import { filterPlayable, getBlockedIds, videosCol, type VideoDoc } from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { usePlayerPool, type FeedPoolItem } from '@/lib/feed/usePlayerPool';
import { getCachedVideoPath } from '@/lib/videoCache';
import { colors } from '@/lib/theme';

const FALLBACK_HEIGHT = Dimensions.get('window').height;

export default function PlaceFeed() {
  const { slug, label, start } = useLocalSearchParams<{
    slug: string;
    label?: string;
    start?: string;
  }>();

  // The route param is encodeURIComponent(label.toLowerCase()) — `label` query
  // carries the original-case display string for the header. Fall back to the
  // decoded slug when label is missing.
  const placeLabel = label ?? (slug ? decodeURIComponent(slug) : '');
  const matchKey = placeLabel.trim().toLowerCase();

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_HEIGHT);
  const listRef = useRef<FlatList<VideoDoc>>(null);

  const load = useCallback(async () => {
    if (!matchKey) return [] as VideoDoc[];
    // Firestore can't do case-insensitive equality on a string field without
    // a denormalised lower-cased copy on every video doc. The map screen
    // already pulls all videos into memory; here we replicate the simplest
    // approach (200-doc scan) until the W3 places aggregator lands.
    try {
      const [snap, blockedIds] = await Promise.all([
        videosCol().limit(500).get(),
        getBlockedIds(),
      ]);
      return filterPlayable(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
          .filter(
            (v) =>
              v.location?.label?.trim().toLowerCase() === matchKey &&
              !blockedIds.has(v.ownerId),
          ),
      );
    } catch (err) {
      console.warn('[place-feed] load failed:', err);
      return [];
    }
  }, [matchKey]);

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

  const pool = usePlayerPool(poolItems, activeIndex);

  return (
    <View style={styles.root} onLayout={onContainerLayout}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: placeLabel || 'Place',
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
          <Text style={styles.emptyTitle}>No posts in this place yet</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FeedItem
              item={item}
              active={index === activeIndex}
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
              ? Math.max(
                  0,
                  videos.findIndex((v) => v.id === start),
                )
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
