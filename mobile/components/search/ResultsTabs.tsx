import { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';
import type { VideoDoc } from '@/lib/firestore';
import type { UserDoc } from '@/lib/users';
import type { PlaceDoc } from '@/lib/search/queries';

export type SearchTab = 'all' | 'users' | 'videos' | 'hashtags' | 'places';

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'users', label: 'Users' },
  { id: 'videos', label: 'Videos' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'places', label: 'Places' },
];

export type SearchResults = {
  users: UserDoc[];
  videos: VideoDoc[];
  hashtags: { tag: string; count: number }[];
  places: PlaceDoc[];
};

type Props = {
  query: string;
  loading: boolean;
  tab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  results: SearchResults;
};

export function ResultsTabs({ query, loading, tab, onTabChange, results }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onTabChange(t.id)}
              hitSlop={6}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ResultsBody query={query} tab={tab} results={results} />
      )}
    </View>
  );
}

function ResultsBody({
  query,
  tab,
  results,
}: {
  query: string;
  tab: SearchTab;
  results: SearchResults;
}) {
  const totalResults =
    results.users.length +
    results.videos.length +
    results.hashtags.length +
    results.places.length;

  if (totalResults === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No results for &ldquo;{query}&rdquo;</Text>
      </View>
    );
  }

  if (tab === 'all') {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {results.users.length > 0 ? (
          <SectionHeader label="Users" total={results.users.length} />
        ) : null}
        {results.users.slice(0, 3).map((u) => (
          <UserRow key={u.uid} user={u} />
        ))}

        {results.hashtags.length > 0 ? (
          <SectionHeader label="Hashtags" total={results.hashtags.length} />
        ) : null}
        {results.hashtags.slice(0, 3).map((h) => (
          <HashtagRow key={h.tag} hashtag={h} />
        ))}

        {results.places.length > 0 ? (
          <SectionHeader label="Places" total={results.places.length} />
        ) : null}
        {results.places.slice(0, 3).map((p) => (
          <PlaceRow key={p.slug} place={p} />
        ))}

        {results.videos.length > 0 ? (
          <SectionHeader label="Videos" total={results.videos.length} />
        ) : null}
        {results.videos.slice(0, 4).map((v) => (
          <VideoRow key={v.id} video={v} query={query} />
        ))}
      </ScrollView>
    );
  }

  if (tab === 'users') {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {results.users.length === 0 ? (
          <EmptyTab tab="users" query={query} />
        ) : (
          results.users.map((u) => <UserRow key={u.uid} user={u} />)
        )}
      </ScrollView>
    );
  }

  if (tab === 'videos') {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {results.videos.length === 0 ? (
          <EmptyTab tab="videos" query={query} />
        ) : (
          results.videos.map((v) => <VideoRow key={v.id} video={v} query={query} />)
        )}
      </ScrollView>
    );
  }

  if (tab === 'hashtags') {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {results.hashtags.length === 0 ? (
          <EmptyTab tab="hashtags" query={query} />
        ) : (
          results.hashtags.map((h) => <HashtagRow key={h.tag} hashtag={h} />)
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      {results.places.length === 0 ? (
        <EmptyTab tab="places" query={query} />
      ) : (
        results.places.map((p) => <PlaceRow key={p.slug} place={p} />)
      )}
    </ScrollView>
  );
}

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionCount}>{total}</Text>
    </View>
  );
}

function EmptyTab({ tab, query }: { tab: SearchTab; query: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>No {tab} for &ldquo;{query}&rdquo;</Text>
    </View>
  );
}

function UserRow({ user }: { user: UserDoc }) {
  const router = useRouter();
  const initials = useMemo(() => {
    const name = (user.displayName ?? '').trim();
    if (!name) return '?';
    return name.slice(0, 1).toUpperCase();
  }, [user.displayName]);
  return (
    <Pressable
      onPress={() => router.push(`/user/${user.uid}` as never)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {user.photoURL ? (
        <Image source={{ uri: user.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {user.displayName ?? 'Unnamed'}
        </Text>
        {user.email ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            @{(user.username ?? user.displayName ?? '').toLowerCase().replace(/\s+/g, '')}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function HashtagRow({ hashtag }: { hashtag: { tag: string; count: number } }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/tag/${encodeURIComponent(hashtag.tag)}` as never)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.hashIcon}>
        <Text style={styles.hashIconText}>#</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          #{hashtag.tag}
        </Text>
        <Text style={styles.rowSub}>
          {hashtag.count} {hashtag.count === 1 ? 'post' : 'posts'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function PlaceRow({ place }: { place: PlaceDoc }) {
  const router = useRouter();
  function open() {
    const params = new URLSearchParams({ label: place.label });
    router.push(`/place/${encodeURIComponent(place.slug)}?${params.toString()}` as never);
  }
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.placeIcon}>
        <Ionicons name="location" size={18} color={colors.bg} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {place.label}
        </Text>
        <Text style={styles.rowSub}>
          {place.videoCount} {place.videoCount === 1 ? 'video' : 'videos'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function VideoRow({ video, query: _query }: { video: VideoDoc; query: string }) {
  const router = useRouter();
  function open() {
    router.push(
      `/posts/${video.ownerId}?start=${video.id}&source=mine` as never,
    );
  }
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.videoRow, pressed && styles.rowPressed]}
    >
      <View style={styles.videoThumb}>
        <Ionicons name="play" size={20} color={colors.text} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {video.caption?.trim() || 'Untitled'}
        </Text>
        {video.location?.label ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            📍 {video.location.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Without flexGrow: 0 a horizontal ScrollView absorbs the parent's height
  // when its sibling is non-flex (empty-state view), stretching the chips.
  tabBarScroll: { flexGrow: 0 },
  tabBar: {
    paddingHorizontal: 12,
    gap: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabLabelActive: { color: colors.bg },
  loading: { padding: 24, alignItems: 'center' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 14 },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  sectionCount: { color: colors.textDim, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  rowPressed: { backgroundColor: colors.surface },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: colors.text, fontWeight: '700' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: colors.textDim, fontSize: 12 },
  hashIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashIconText: { color: colors.accent, fontWeight: '800', fontSize: 18 },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    alignItems: 'center',
  },
  videoThumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
