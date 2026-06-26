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
import { useLocalSearchParams } from 'expo-router';
import { filterPlayable, getMyVideos, getSavedVideoIds, getVideosByIds, type VideoDoc } from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { usePlayerPool, type FeedPoolItem } from '@/lib/feed/usePlayerPool';
import { getCachedVideoPath } from '@/lib/videoCache';
import { colors } from '@/lib/theme';

const FALLBACK_HEIGHT = Dimensions.get('window').height;

export default function UserPostsFeed() {
  const { uid, start, source } = useLocalSearchParams<{
    uid: string;
    start?: string;
    source?: 'mine' | 'saved';
  }>();

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_HEIGHT);
  const listRef = useRef<FlatList<VideoDoc>>(null);

  const loadList = useCallback(async () => {
    if (!uid) return [] as VideoDoc[];
    if (source === 'saved') {
      const ids = await getSavedVideoIds(uid).catch(() => []);
      const list = await getVideosByIds(ids).catch(() => []);
      return filterPlayable(list);
    }
    const list = await getMyVideos(uid).catch(() => []);
    return filterPlayable(list);
  }, [uid, source]);

  useEffect(() => {
    loadList()
      .then((list) => {
        setVideos(list);
        // Jump to the tapped video on first paint.
        if (start) {
          const idx = list.findIndex((v) => v.id === start);
          if (idx >= 0) setActiveIndex(idx);
        }
      })
      .finally(() => setLoading(false));
  }, [loadList, start]);

  useEffect(() => {
    if (videos.length === 0) return;
    if (activeIndex <= 0) return;
    // Wait for layout, then jump to the requested index.
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated: false,
      });
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

  // Mirror the trending feed's player virtualization: hold one player per
  // active-window slot (3 max) so this screen also caps native memory.
  const [cachedUriById, setCachedUriById] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const start = Math.max(0, activeIndex - 1);
    const end = Math.min(videos.length, activeIndex + 2);
    for (let i = start; i < end; i += 1) {
      const v = videos[i];
      if (!v?.downloadURL || cachedUriById[v.id]) continue;
      getCachedVideoPath(v.downloadURL)
        .then((path) => {
          if (cancelled || !path) return;
          setCachedUriById((prev) =>
            prev[v.id] === path ? prev : { ...prev, [v.id]: path },
          );
        })
        .catch(() => {
          // best-effort
        });
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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No posts to show</Text>
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
          onScrollToIndexFailed={() => {
            // best-effort — viewport sizing is async; we'll catch up on next render
          }}
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
