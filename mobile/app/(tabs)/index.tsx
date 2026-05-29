import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  filterPlayable,
  followingCol,
  getBlockedIds,
  videosCol,
  type VideoDoc,
} from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { AiAssistantSheet } from '@/components/AiAssistantSheet';
import { getCachedVideoPath, prefetchVideos } from '@/lib/videoCache';
import { usePlayerPool, type FeedPoolItem } from '@/lib/feed/usePlayerPool';
import { colors } from '@/lib/theme';

/** Gap below the status bar / camera cutout for the top overlay row. */
const TOP_OVERLAY_GAP = 8;

const FALLBACK_HEIGHT = Dimensions.get('window').height;

/**
 * Fisher–Yates in place. Used to randomise the trending feed each time the
 * user opens / refreshes — gives a different ordering on every fetch instead
 * of always leading with the most-liked clip. The pool itself is already
 * trimmed to recent uploads, so shuffling within the pool produces a
 * TikTok/Reels-style fresh mix.
 */
function shuffleFeed<T>(input: readonly T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type FeedTab = 'trending' | 'following';

const TABS: { id: FeedTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'following', label: 'Discover', icon: 'compass' },
  { id: 'trending', label: 'Trending', icon: 'flame' },
];

export default function Feed() {
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<FeedTab>('trending');
  const [showAi, setShowAi] = useState(false);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_HEIGHT);
  // Top overlays must clear the status bar / camera cutout on Android
  // edge-to-edge devices and the notch on iOS.
  const topOverlayOffset = insets.top + TOP_OVERLAY_GAP;

  function onContainerLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== viewportHeight) setViewportHeight(h);
  }

  const load = useCallback(async () => {
    const blockedIds = await getBlockedIds();

    if (tab === 'following') {
      if (!me) {
        setVideos([]);
        return;
      }
      const followingSnap = await followingCol(me.uid).get();
      const followedIds = followingSnap.docs.map((d) => d.id);
      if (followedIds.length === 0) {
        setVideos([]);
        return;
      }
      // Firestore "in" query is limited to 10 IDs — chunk if needed.
      const chunks: string[][] = [];
      for (let i = 0; i < followedIds.length; i += 10) chunks.push(followedIds.slice(i, i + 10));
      const all: VideoDoc[] = [];
      for (const chunk of chunks) {
        const snap = await videosCol().where('ownerId', 'in', chunk).limit(50).get();
        snap.docs.forEach((d) =>
          all.push({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }),
        );
      }
      const sorted = filterPlayable(
        all
          .filter((v) => !blockedIds.has(v.ownerId))
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          }),
      );
      setVideos(sorted);
      prefetchVideos(sorted.slice(0, 5).map((v) => v.downloadURL).filter(Boolean));
      return;
    }

    // Trending pulls a wider pool of recent videos and shuffles client-side
    // so each open of the feed surfaces a different mix (TikTok / Reels style)
    // instead of always leading with the most-liked clip. We still bias the
    // first card slightly toward fresh content by oversampling recent posts
    // and shuffling the rest.
    const snap = await videosCol().orderBy('createdAt', 'desc').limit(150).get();
    const pool = filterPlayable(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
        .filter((v) => !blockedIds.has(v.ownerId)),
    );

    const list = shuffleFeed(pool).slice(0, 50);

    setVideos(list);
    prefetchVideos(list.slice(0, 5).map((v) => v.downloadURL).filter(Boolean));
  }, [tab, me]);

  const listRef = useRef<FlatList<VideoDoc>>(null);

  // Move past the current card. Called after a successful report (the post
  // stays in Firestore so it doesn't disappear, but we don't want the
  // reporter staring at it) and after a block when the active item itself
  // wasn't the blocked author's only post (otherwise the in-memory filter
  // already shifts the next item up under the same index — no scroll needed).
  const advanceToNext = useCallback(() => {
    setActiveIndex((current) => {
      // Defer scrolling to next frame so any state updates that filter the
      // list (e.g. block) settle first and `getItemLayout` resolves the
      // correct offset.
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({
            index: current + 1,
            animated: true,
          });
        } catch {
          // index out of range (last post) — silently ignore
        }
      });
      return current;
    });
  }, []);

  const handleBlocked = useCallback((uid: string) => {
    // Filter the blocked author's posts from the in-memory feed immediately
    // so the user doesn't see another post from them on the very next swipe.
    // Because activeIndex is preserved, removing the active item naturally
    // shifts the next post up into the same slot — that IS the "advance to
    // next" behaviour the product requested, with no extra scrollToIndex.
    setVideos((prev) => prev.filter((v) => v.ownerId !== uid));
  }, []);

  const handleReported = useCallback(() => {
    advanceToNext();
  }, [advanceToNext]);

  useEffect(() => {
    setLoading(true);
    setActiveIndex(0);
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

  // Map<videoId, file://...> — resolved lazily when an item enters the active
  // window so the player loads from local cache instead of re-streaming.
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
          // best-effort — fall back to remote URL
        });
    }
    return () => {
      cancelled = true;
    };
  }, [videos, activeIndex, cachedUriById]);

  // Build the pool item list. Stable identity per video; the pool only
  // re-runs its rotation effect when this array changes (e.g. tab/refresh)
  // or when activeIndex shifts.
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
          <Text style={styles.emptyTitle}>
            {tab === 'following' ? 'Nothing to discover yet' : 'No videos yet'}
          </Text>
          <Text style={styles.emptyHint}>
            {tab === 'following'
              ? 'Follow creators to discover their videos here.'
              : 'Upload one from the + tab.'}
          </Text>
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
              onBlocked={handleBlocked}
              onReported={handleReported}
            />
          )}
          pagingEnabled
          snapToInterval={viewportHeight}
          getItemLayout={(_, i) => ({
            length: viewportHeight,
            offset: viewportHeight * i,
            index: i,
          })}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Tighten React mount footprint: only the active card and its
          // immediate neighbours stay rendered. Combined with the player pool
          // this caps native memory regardless of feed length.
          windowSize={3}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          style={styles.list}
        />
      )}

      <View style={[styles.topTabs, { top: topOverlayOffset }]} pointerEvents="box-none">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              hitSlop={6}
              style={styles.topTabButton}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? '#fff' : 'rgba(255,255,255,0.7)'}
              />
              <Text style={[styles.topTabLabel, active && styles.topTabLabelActive]}>
                {t.label}
              </Text>
              {active && <View style={styles.topTabUnderline} />}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/search' as never)}
        hitSlop={8}
        style={[styles.searchButton, { top: topOverlayOffset }]}
        accessibilityLabel="Open search"
      >
        <Ionicons name="search" size={18} color="#fff" />
      </Pressable>

      <Pressable
        onPress={() => setShowAi(true)}
        hitSlop={8}
        style={[styles.aiButton, { top: topOverlayOffset }]}
        accessibilityLabel="Open travel assistant"
      >
        <Ionicons name="sparkles" size={18} color="#fff" />
      </Pressable>

      <AiAssistantSheet visible={showAi} onClose={() => setShowAi(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  list: { backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  topTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 6,
  },
  topTabButton: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingVertical: 4 },
  topTabLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  topTabLabelActive: { color: '#fff' },
  topTabUnderline: {
    position: 'absolute',
    bottom: -4,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  aiButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
