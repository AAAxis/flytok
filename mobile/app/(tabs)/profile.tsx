import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
  followersCol,
  followingCol,
  deleteOwnVideo,
  getFollowCounts,
  getMyTrips,
  getMyVideos,
  usersCol,
  type Trip,
  type VideoDoc,
} from '@/lib/firestore';
import { VideoGrid } from '@/components/VideoGrid';
import { ProfileVideoMap } from '@/components/profile/ProfileVideoMap';
import { ProfileRoutesList } from '@/components/profile/ProfileRoutesList';
import { FollowListSheet } from '@/components/FollowListSheet';
import { RouteIcon } from '@/components/RouteIcon';
import { getCachedProfile, setCachedProfile } from '@/lib/profileCache';
import { colors } from '@/lib/theme';
import { useUserTheme } from '@/lib/theme/userTheme';
import { dicebearURL } from '@/lib/avatars';
import { ROUTES_CREATE_ENABLED, ROUTES_DISPLAY_ENABLED } from '@/lib/features';
import { presentTopupPaywall } from '@/lib/purchases';

type Tab = 'mine' | 'map' | 'routes';

const AVATAR_SIZE = 84;

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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [counts, setCounts] = useState(cached?.counts ?? { following: 0, followers: 0 });
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('mine');
  const [followList, setFollowList] = useState<null | 'following' | 'followers'>(null);

  const theme = useUserTheme(me?.uid);
  const dicebear = me ? dicebearURL(theme.avatarStyle, theme.avatarSeed ?? me.uid, 256) : null;

  // Tap the avatar to flip between the DiceBear avatar and the real photo.
  const [showPhoto, setShowPhoto] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const avatarUri = showPhoto ? (photoURL ?? dicebear) : (dicebear ?? photoURL);
  const hasBoth = !!photoURL && !!dicebear;

  function flipAvatar() {
    if (!hasBoth) {
      router.push('/edit-profile' as never);
      return;
    }
    setShowPhoto((s) => !s);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }

  const avatarRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // "Home base" — the most frequent location across the user's videos.
  const homeBase = useMemo(() => {
    const tally = new Map<string, number>();
    for (const v of mine) {
      const l = v.location?.label;
      if (l) tally.set(l, (tally.get(l) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    tally.forEach((n, l) => {
      if (n > bestN) {
        best = l;
        bestN = n;
      }
    });
    return best;
  }, [mine]);

  const load = useCallback(async () => {
    if (!me) return;
    const [profileSnap, myVideos, myTrips, followCounts] = await Promise.all([
      usersCol().doc(me.uid).get(),
      getMyVideos(me.uid).catch((err) => {
        console.warn('[profile] getMyVideos failed:', err);
        return [];
      }),
      ROUTES_DISPLAY_ENABLED
        ? getMyTrips(me.uid).catch((err) => {
            console.warn('[profile] getMyTrips failed:', err);
            return [];
          })
        : Promise.resolve([]),
      getFollowCounts(me.uid),
    ]);
    const profileData = profileSnap.data() ?? {};
    setUsername((profileData.username as string) ?? null);
    setDisplayName((profileData.displayName as string) ?? null);
    setPhotoURL((profileData.photoURL as string) ?? null);
    setBio((profileData.bio as string) ?? null);
    setMine(myVideos);
    setTrips(myTrips);
    setCounts(followCounts);
    if (me) {
      setCachedProfile(me.uid, {
        displayName: (profileData.displayName as string) ?? null,
        photoURL: (profileData.photoURL as string) ?? null,
        bio: (profileData.bio as string) ?? null,
        mine: myVideos,
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

  const confirmDeleteVideo = useCallback((video: VideoDoc) => {
    Alert.alert(
      'Delete this post?',
      'This permanently removes the video. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOwnVideo(video);
              setMine((prev) => prev.filter((v) => v.id !== video.id));
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message ?? 'Try again later.');
            }
          },
        },
      ],
    );
  }, []);

  if (!me) return null;

  const topHandle = username ?? `user_${me.uid.slice(0, 6)}`;

  async function showPremiumPaywall() {
    try {
      await presentTopupPaywall();
    } catch (err: any) {
      Alert.alert('Paywall unavailable', err?.message ?? 'Try again later.');
    }
  }

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
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Identity row — avatar + stats */}
            <View style={styles.headerRow}>
              <Pressable onPress={flipAvatar} hitSlop={6}>
                <Animated.View style={{ transform: [{ rotateY: avatarRotate }] }}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={32} color={colors.text} />
                    </View>
                  )}
                </Animated.View>
              </Pressable>
              <View style={styles.statsCol}>
                <View style={styles.statsRow}>
                  <Stat label="Followers" value={counts.followers} onPress={() => setFollowList('followers')} />
                  <Stat label="Following" value={counts.following} onPress={() => setFollowList('following')} />
                  {ROUTES_DISPLAY_ENABLED ? <Stat label="Routes" value={trips.length} /> : null}
                </View>
              </View>
            </View>

            {displayName?.trim() || bio ? (
              <View style={styles.nameRow}>
                {displayName?.trim() ? <Text style={styles.name}>{displayName.trim()}</Text> : null}
                {bio ? (
                  <Text style={styles.bioInline} numberOfLines={1}>
                    {bio}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Pressable onPress={() => router.push('/edit-profile' as never)} style={styles.usernameRow} hitSlop={6}>
              <Text
                style={[styles.usernameValue, !displayName?.trim() && styles.usernameValueLead]}
                numberOfLines={1}
              >
                @{topHandle}
              </Text>
              <Ionicons name="create-outline" size={18} color={colors.textMuted} style={styles.usernamePencil} />
            </Pressable>
            {homeBase ? (
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={styles.locText} numberOfLines={1}>{homeBase}</Text>
              </View>
            ) : null}

            {/* Tabs */}
            <View style={styles.tabsBar}>
              <TabButton active={tab === 'mine'} icon="grid" label="My videos" onPress={() => setTab('mine')} />
              <TabButton active={tab === 'map'} icon="map" label="My map" onPress={() => setTab('map')} />
              {ROUTES_DISPLAY_ENABLED ? (
                <TabButton
                  active={tab === 'routes'}
                  icon="location"
                  label="My routes"
                  onPress={() => setTab('routes')}
                  customIcon={<RouteIcon size={20} />}
                />
              ) : null}
            </View>

            {tab === 'mine' ? (
              <VideoGrid
                videos={mine}
                emptyLabel="No videos yet"
                onPress={(v) => router.push(`/posts/${me.uid}?start=${v.id}&source=mine` as never)}
                onLongPress={confirmDeleteVideo}
              />
            ) : tab === 'map' ? (
              <ProfileVideoMap
                videos={mine}
                loading={loading}
                onPressVideo={(v) => router.push(`/posts/${me.uid}?start=${v.id}&source=mine` as never)}
              />
            ) : ROUTES_DISPLAY_ENABLED ? (
              <ProfileRoutesList
                trips={trips}
                ownerUid={me.uid}
                canCreate={ROUTES_CREATE_ENABLED}
                onCreate={() => router.push('/create-trip' as never)}
                onGetPremium={showPremiumPaywall}
                emptyLabel="No routes yet. Premium members can create trip routes from their videos."
              />
            ) : (
              <VideoGrid
                videos={mine}
                emptyLabel="No videos yet"
                onPress={(v) => router.push(`/posts/${me.uid}?start=${v.id}&source=mine` as never)}
                onLongPress={confirmDeleteVideo}
              />
            )}
          </>
        )}
      </ScrollView>

      <FollowListSheet
        uid={me?.uid ?? null}
        mode={followList ?? 'following'}
        visible={followList !== null}
        onClose={() => setFollowList(null)}
      />
    </View>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
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

function TabButton({
  active,
  icon,
  label,
  onPress,
  customIcon,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  customIcon?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      {customIcon ?? <Ionicons name={icon} size={18} color={active ? colors.accent : colors.textDim} />}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {},
  loading: { paddingVertical: 60, alignItems: 'center' },

  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#000',
  },
  appBarIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandLogo: { width: 26, height: 26 },
  brandText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderColor: '#000',
    borderWidth: 2,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 18,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
  },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statsCol: { flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stat: { alignItems: 'center', paddingHorizontal: 6 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  handle: { color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginTop: 14 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  bioInline: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, marginTop: 4 },
  locText: { color: colors.textMuted, fontSize: 13 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 6 },
  usernameLabel: { color: colors.textMuted, fontSize: 13 },
  usernameValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  usernameValueLead: { fontSize: 16, fontWeight: '700' },
  usernamePencil: { marginLeft: 8 },
  bio: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginTop: 8 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginHorizontal: 20 },
  actionBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
  },
  actionBtnSecondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  actionPressed: { opacity: 0.85 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  tabsBar: {
    flexDirection: 'row',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 3,
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
  },
  tabButtonActive: { borderBottomColor: colors.accent },
  tabLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: colors.text },

});
