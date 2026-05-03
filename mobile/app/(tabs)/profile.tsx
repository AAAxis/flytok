import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  diagnoseSaves,
  followersCol,
  followingCol,
  getFollowCounts,
  getMyVideos,
  getSavedVideoIds,
  getVideosByIds,
  savesCol,
  usersCol,
  type VideoDoc,
} from '@/lib/firestore';
import { Alert } from 'react-native';
import { VideoGrid } from '@/components/VideoGrid';
import { SettingsSheet } from '@/components/SettingsSheet';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { FollowListSheet } from '@/components/FollowListSheet';
import { getCachedProfile, setCachedProfile } from '@/lib/profileCache';
import { colors } from '@/lib/theme';

type Tab = 'mine' | 'saved';

export default function Profile() {
  const router = useRouter();
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();
  const cached = me ? getCachedProfile(me.uid) : null;
  const [displayName, setDisplayName] = useState<string | null>(cached?.displayName ?? null);
  const [photoURL, setPhotoURL] = useState<string | null>(cached?.photoURL ?? null);
  const [bio, setBio] = useState<string | null>(cached?.bio ?? null);
  const [mine, setMine] = useState<VideoDoc[]>(cached?.mine ?? []);
  const [saved, setSaved] = useState<VideoDoc[]>(cached?.saved ?? []);
  const [counts, setCounts] = useState(cached?.counts ?? { following: 0, followers: 0 });
  // Only block on the spinner if we have nothing cached at all.
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('mine');
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [followList, setFollowList] = useState<null | 'following' | 'followers'>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const [profileSnap, myVideos, savedIds, followCounts] = await Promise.all([
      usersCol().doc(me.uid).get(),
      getMyVideos(me.uid).catch((err) => {
        console.warn('[profile] getMyVideos failed:', err);
        return [];
      }),
      getSavedVideoIds(me.uid).catch((err) => {
        console.warn('[profile] getSavedVideoIds failed:', err);
        return [];
      }),
      getFollowCounts(me.uid),
    ]);
    console.log('[profile] loaded', {
      uid: me.uid,
      mine: myVideos.length,
      savedIds: savedIds.length,
    });
    const profileData = profileSnap.data() ?? {};
    setDisplayName((profileData.displayName as string) ?? null);
    setPhotoURL((profileData.photoURL as string) ?? null);
    setBio((profileData.bio as string) ?? null);
    setMine(myVideos);
    setCounts(followCounts);
    const savedVideos = await getVideosByIds(savedIds).catch((err) => {
      console.warn('[profile] getVideosByIds failed:', err);
      return [];
    });
    console.log('[profile] saved fetched', {
      requestedIds: savedIds.length,
      gotVideos: savedVideos.length,
      missingIds: savedIds.filter((id) => !savedVideos.find((v) => v.id === id)),
    });
    setSaved(savedVideos);
    if (me) {
      setCachedProfile(me.uid, {
        displayName: (profileData.displayName as string) ?? null,
        photoURL: (profileData.photoURL as string) ?? null,
        bio: (profileData.bio as string) ?? null,
        mine: myVideos,
        saved: savedVideos,
        counts: followCounts,
        fetchedAt: Date.now(),
      });
    }
  }, [me]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // One-shot diagnostic to expose silent rule failures on the saves
  // subcollection. Runs once per session per uid.
  useEffect(() => {
    if (!me) return;
    const flag = `__savesDiagRun_${me.uid}`;
    const g = globalThis as Record<string, unknown>;
    if (g[flag]) return;
    g[flag] = true;
    diagnoseSaves().then((err) => {
      if (err) {
        Alert.alert(
          'Saves diagnostic',
          `Saves cannot be persisted:\n\n${err}\n\nFix: publish the Firestore rule for users/{uid}/saves.`,
        );
      }
    });
  }, [me]);

  // Live-update follow counts so following/unfollowing in the feed reflects
  // immediately on this screen without requiring a pull-to-refresh.
  useEffect(() => {
    if (!me) return;
    return followingCol(me.uid).onSnapshot(
      (snap) => setCounts((c) => ({ ...c, following: snap.size })),
      () => {},
    );
  }, [me]);

  useEffect(() => {
    if (!me) return;
    return followersCol(me.uid).onSnapshot(
      (snap) => setCounts((c) => ({ ...c, followers: snap.size })),
      () => {},
    );
  }, [me]);

  // Live-update the Saved tab whenever the user saves/unsaves anywhere in the app.
  useEffect(() => {
    if (!me) return;
    return savesCol(me.uid).onSnapshot(
      async (snap) => {
        const ids = snap.docs.map((d) => d.id);
        console.log('[profile] saves snapshot', { count: ids.length });
        if (!ids.length) {
          setSaved([]);
          return;
        }
        try {
          const videos = await getVideosByIds(ids);
          setSaved(videos);
        } catch (err) {
          console.warn('[profile] saves snapshot fetch failed:', err);
        }
      },
      (err) => console.warn('[profile] saves listener error:', err),
    );
  }, [me]);

  // Re-fetch when the tab is focused so saves/follows made in the feed
  // surface immediately when the user switches back here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (!me) return null;

  const handle = displayName ?? (me.email ? me.email.split('@')[0] : me.uid.slice(0, 8));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.handle}>@{handle}</Text>
        <Pressable onPress={() => setShowSettings(true)} hitSlop={10}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <View style={styles.headerArea}>
              <Pressable onPress={() => setShowEdit(true)} style={styles.avatarWrap} hitSlop={6}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={32} color={colors.text} />
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="pencil" size={12} color={colors.bg} />
                </View>
              </Pressable>

              {bio ? <Text style={styles.bio}>{bio}</Text> : null}

              <View style={styles.statsRow}>
                <Stat label="Posts" value={mine.length} />
                <Stat label="Saved" value={saved.length} />
                <Stat
                  label="Following"
                  value={counts.following}
                  onPress={() => setFollowList('following')}
                />
                <Stat
                  label="Followers"
                  value={counts.followers}
                  onPress={() => setFollowList('followers')}
                />
              </View>
            </View>

            <View style={styles.tabsBar}>
              <TabButton
                active={tab === 'mine'}
                icon="grid-outline"
                onPress={() => setTab('mine')}
              />
              <TabButton
                active={tab === 'saved'}
                icon="bookmark-outline"
                onPress={() => setTab('saved')}
              />
            </View>

            {tab === 'mine' ? (
              <VideoGrid
                videos={mine}
                emptyLabel="No videos yet"
                onPress={(v) => {
                  router.push(`/posts/${me.uid}?start=${v.id}&source=mine` as never);
                }}
              />
            ) : (
              <VideoGrid
                videos={saved}
                emptyLabel="Nothing saved yet"
                onPress={(v) => {
                  router.push(`/posts/${me.uid}?start=${v.id}&source=saved` as never);
                }}
              />
            )}
          </>
        )}
      </ScrollView>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditProfile={() => {
          setShowSettings(false);
          setShowEdit(true);
        }}
      />
      <EditProfileSheet
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={load}
      />
      <FollowListSheet
        uid={me?.uid ?? null}
        mode={followList ?? 'following'}
        visible={followList !== null}
        onClose={() => setFollowList(null)}
      />
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.stat}>{content}</View>;
  }
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.stat}>
      {content}
    </Pressable>
  );
}

function TabButton({
  active,
  icon,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Ionicons name={icon} size={20} color={active ? colors.text : colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  handle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  content: {},
  loading: { paddingVertical: 60, alignItems: 'center' },
  headerArea: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.bg,
    borderWidth: 2,
  },
  bio: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  tabsBar: {
    flexDirection: 'row',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
  },
  tabButtonActive: { borderBottomColor: colors.text },
});
