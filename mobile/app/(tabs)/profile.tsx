import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { VideoGrid } from '@/components/VideoGrid';
import { SettingsSheet } from '@/components/SettingsSheet';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { CustomizeThemeSheet } from '@/components/CustomizeThemeSheet';
import { FollowListSheet } from '@/components/FollowListSheet';
import { getCachedProfile, setCachedProfile } from '@/lib/profileCache';
import { colors } from '@/lib/theme';
import { applyTheme, useUserTheme } from '@/lib/theme/userTheme';
import { dicebearURL } from '@/lib/avatars';

type Tab = 'mine' | 'saved';

const COVER_VISIBLE = 200;
const AVATAR_SIZE = 96;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

export default function Profile() {
  const router = useRouter();
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();
  const cached = me ? getCachedProfile(me.uid) : null;
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(cached?.displayName ?? null);
  const [photoURL, setPhotoURL] = useState<string | null>(cached?.photoURL ?? null);
  const [bio, setBio] = useState<string | null>(cached?.bio ?? null);
  const [mine, setMine] = useState<VideoDoc[]>(cached?.mine ?? []);
  const [saved, setSaved] = useState<VideoDoc[]>(cached?.saved ?? []);
  const [counts, setCounts] = useState(cached?.counts ?? { following: 0, followers: 0 });
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('mine');
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [followList, setFollowList] = useState<null | 'following' | 'followers'>(null);

  const theme = useUserTheme(me?.uid);
  const themed = applyTheme(theme);
  const dicebear = me ? dicebearURL(theme.avatarStyle, theme.avatarSeed ?? me.uid, 256) : null;
  const avatarUri = dicebear ?? photoURL;

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
    const profileData = profileSnap.data() ?? {};
    setUsername((profileData.username as string) ?? null);
    setDisplayName((profileData.displayName as string) ?? null);
    setPhotoURL((profileData.photoURL as string) ?? null);
    setBio((profileData.bio as string) ?? null);
    setMine(myVideos);
    setCounts(followCounts);
    const savedVideos = await getVideosByIds(savedIds).catch((err) => {
      console.warn('[profile] getVideosByIds failed:', err);
      return [];
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

  useEffect(() => {
    if (!me) return;
    return savesCol(me.uid).onSnapshot(
      async (snap) => {
        const ids = snap.docs.map((d) => d.id);
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

  // Top-bar handle: prefer the persisted username; fall back to a uid-derived
  // placeholder for legacy accounts (ensureUsername() will replace it on the
  // next foreground tick). Crucially, the displayName is NEVER used here —
  // editing the user's name must not change their @handle.
  const topHandle = username ?? `user_${me.uid.slice(0, 6)}`;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[styles.loading, { paddingTop: insets.top + 80 }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <Cover
              backgroundColor={themed.headerBackgroundColor}
              backgroundImageURL={themed.headerBackgroundImageURL}
              topInset={insets.top}
            />

            <View
              style={[
                styles.topBarOverlay,
                { top: insets.top + 8 },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.handlePill}>
                <Text style={styles.handlePillText} numberOfLines={1}>
                  @{topHandle}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowSettings(true)}
                hitSlop={10}
                style={[styles.menuBtn, { backgroundColor: themed.accentColor }]}
              >
                <Ionicons name="menu" size={20} color={colors.bg} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setShowEdit(true)}
              style={styles.avatarWrap}
              hitSlop={6}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color={colors.text} />
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: themed.accentColor }]}>
                <Ionicons name="pencil" size={12} color={colors.bg} />
              </View>
            </Pressable>

            <View style={styles.identity}>
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName?.trim() || `@${topHandle}`}
              </Text>
              {bio ? (
                <Text style={styles.bio} numberOfLines={2}>
                  {bio}
                </Text>
              ) : null}
            </View>

            <View style={styles.statsCard}>
              <Stat label="Posts" value={mine.length} />
              <StatDivider />
              <Stat label="Saved" value={saved.length} />
              <StatDivider />
              <Stat
                label="Following"
                value={counts.following}
                onPress={() => setFollowList('following')}
              />
              <StatDivider />
              <Stat
                label="Followers"
                value={counts.followers}
                onPress={() => setFollowList('followers')}
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => setShowEdit(true)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="pencil" size={14} color={colors.text} />
                <Text style={styles.actionText}>Edit profile</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCustomize(true)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: themed.accentColor },
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="color-palette-outline" size={14} color={colors.bg} />
                <Text style={[styles.actionText, { color: colors.bg }]}>Customize</Text>
              </Pressable>
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
      <CustomizeThemeSheet
        visible={showCustomize}
        onClose={() => setShowCustomize(false)}
      />
      <FollowListSheet
        uid={me?.uid ?? null}
        mode={followList ?? 'following'}
        visible={followList !== null}
        onClose={() => setFollowList(null)}
      />
    </View>
  );
}

function Cover({
  backgroundColor,
  backgroundImageURL,
  topInset,
}: {
  backgroundColor: string;
  backgroundImageURL: string | null;
  topInset: number;
}) {
  const height = COVER_VISIBLE + topInset;
  if (backgroundImageURL) {
    return (
      <ImageBackground
        source={{ uri: backgroundImageURL }}
        style={[styles.cover, { height }]}
        imageStyle={styles.coverImage}
      >
        <View style={styles.coverScrim} />
      </ImageBackground>
    );
  }
  return <View style={[styles.cover, { height, backgroundColor }]} />;
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
  if (!onPress) return <View style={styles.stat}>{content}</View>;
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.stat}>
      {content}
    </Pressable>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: {},
  loading: { alignItems: 'center' },

  cover: {
    width: '100%',
    overflow: 'hidden',
  },
  coverImage: { resizeMode: 'cover' },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  topBarOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handlePill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 220,
  },
  handlePillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarWrap: {
    alignSelf: 'center',
    marginTop: -AVATAR_OVERLAP,
    position: 'relative',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.bg,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.bg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.bg,
    borderWidth: 2,
  },

  identity: { alignItems: 'center', paddingHorizontal: 24, marginTop: 10 },
  displayName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  bio: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginHorizontal: 16,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  actionPressed: { opacity: 0.85 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  tabsBar: {
    flexDirection: 'row',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
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
