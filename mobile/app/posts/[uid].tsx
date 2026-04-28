import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getMyVideos, getSavedVideoIds, getVideosByIds, type VideoDoc } from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
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
      return await getVideosByIds(ids).catch(() => []);
    }
    return await getMyVideos(uid).catch(() => []);
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

  return (
    <View style={styles.root} onLayout={onContainerLayout}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
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
            />
          )}
          pagingEnabled
          snapToInterval={viewportHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({
            length: viewportHeight,
            offset: viewportHeight * i,
            index: i,
          })}
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
