import { useCallback, useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  followingCol,
  getBlockedIds,
  videosCol,
  type VideoDoc,
} from '@/lib/firestore';
import { FeedItem } from '@/components/FeedItem';
import { AiAssistantSheet } from '@/components/AiAssistantSheet';
import { prefetchVideos } from '@/lib/videoCache';
import { colors } from '@/lib/theme';

const { height } = Dimensions.get('window');

type FeedTab = 'trending' | 'following';

const TABS: { id: FeedTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'trending', label: 'Trending', icon: 'flame' },
  { id: 'following', label: 'Following', icon: 'people' },
];

export default function Feed() {
  const me = auth().currentUser;
  const [tab, setTab] = useState<FeedTab>('trending');
  const [showAi, setShowAi] = useState(false);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
      const sorted = all
        .filter((v) => !blockedIds.has(v.ownerId))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      setVideos(sorted);
      prefetchVideos(sorted.slice(0, 5).map((v) => v.downloadURL).filter(Boolean));
      return;
    }

    // Trending pulls recent videos and sorts by likeCount.
    const snap = await videosCol().orderBy('createdAt', 'desc').limit(50).get();
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
      .filter((v) => !blockedIds.has(v.ownerId))
      .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));

    setVideos(list);
    prefetchVideos(list.slice(0, 5).map((v) => v.downloadURL).filter(Boolean));
  }, [tab, me]);

  const handleBlocked = useCallback((uid: string) => {
    setVideos((prev) => prev.filter((v) => v.ownerId !== uid));
  }, []);

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

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {tab === 'following' ? 'No videos from your follows yet' : 'No videos yet'}
          </Text>
          <Text style={styles.emptyHint}>
            {tab === 'following'
              ? 'Follow people whose videos you want to see here.'
              : 'Upload one from the + tab.'}
          </Text>
        </View>
      ) : (
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
              tintColor="#fff"
            />
          }
          style={styles.list}
        />
      )}

      <View style={styles.topTabs} pointerEvents="box-none">
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
        onPress={() => setShowAi(true)}
        hitSlop={8}
        style={styles.aiButton}
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
    top: 56,
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
    top: 56,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
