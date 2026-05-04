import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  follow,
  followersCol,
  followingCol,
  getMyVideos,
  unfollow,
  type VideoDoc,
} from '@/lib/firestore';
import { ensureThread } from '@/lib/messaging';
import { useUserProfile } from '@/lib/useUserLabel';
import { VideoGrid } from '@/components/VideoGrid';
import { FollowListSheet } from '@/components/FollowListSheet';
import { colors } from '@/lib/theme';
import { applyTheme, useUserTheme } from '@/lib/theme/userTheme';
import { dicebearURL } from '@/lib/avatars';

const COVER_VISIBLE = 200;
const AVATAR_SIZE = 96;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

export default function UserProfile() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const me = auth().currentUser;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useUserProfile(uid);

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [counts, setCounts] = useState({ following: 0, followers: 0 });
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [followList, setFollowList] = useState<null | 'following' | 'followers'>(null);

  const isMe = me?.uid === uid;

  const theme = useUserTheme(uid);
  const themed = applyTheme(theme);
  const dicebear = uid ? dicebearURL(theme.avatarStyle, theme.avatarSeed ?? uid, 256) : null;
  const avatarUri = dicebear ?? profile?.photoURL ?? null;

  const load = useCallback(async () => {
    if (!uid) return;
    const list = await getMyVideos(uid).catch(() => []);
    setVideos(list);
  }, [uid]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    return followingCol(uid).onSnapshot(
      (snap) => setCounts((c) => ({ ...c, following: snap.size })),
      () => {},
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return followersCol(uid).onSnapshot(
      (snap) => setCounts((c) => ({ ...c, followers: snap.size })),
      () => {},
    );
  }, [uid]);

  useEffect(() => {
    if (!me || !uid || isMe) return;
    return followingCol(me.uid)
      .doc(uid)
      .onSnapshot(
        (snap) => setFollowing(snap.exists()),
        () => setFollowing(false),
      );
  }, [me, uid, isMe]);

  async function toggleFollow() {
    if (!me || !uid || isMe) return;
    setBusy(true);
    try {
      if (following) await unfollow(uid);
      else await follow(uid);
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    if (!me || !uid || isMe || openingChat) return;
    setOpeningChat(true);
    try {
      const id = await ensureThread(uid);
      router.push(`/chat/${id}`);
    } catch (err) {
      console.warn('[profile] ensureThread failed', err);
    } finally {
      setOpeningChat(false);
    }
  }

  if (!uid) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>User not found.</Text>
      </View>
    );
  }

  // Same rule as own profile: top-bar handle is the @username, NEVER the
  // displayName. Falls back to a uid stub for legacy accounts.
  const topHandle = profile?.username ?? `user_${uid.slice(0, 6)}`;
  const nameOnCard = profile?.displayName?.trim() || `@${topHandle}`;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <Cover
          backgroundColor={themed.headerBackgroundColor}
          backgroundImageURL={themed.headerBackgroundImageURL}
          topInset={insets.top}
        />

        <View style={[styles.topBarOverlay, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={[styles.iconBtn, { backgroundColor: themed.accentColor }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.bg} />
          </Pressable>
          <View style={styles.handlePill}>
            <Text style={styles.handlePillText} numberOfLines={1}>
              @{topHandle}
            </Text>
          </View>
          <View style={styles.iconBtnSpacer} />
        </View>

        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={[styles.avatarImage, styles.avatarOverlap]} />
        ) : (
          <View style={[styles.avatarPlaceholder, styles.avatarOverlap]}>
            <Ionicons name="person" size={36} color={colors.text} />
          </View>
        )}

        <View style={styles.identity}>
          <Text style={styles.displayName} numberOfLines={1}>
            {nameOnCard}
          </Text>
          {profile?.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          ) : null}
        </View>

        <View style={styles.statsCard}>
          <Stat label="Posts" value={videos.length} />
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

        {!isMe && (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={toggleFollow}
              disabled={busy}
              style={({ pressed }) => [
                styles.actionBtn,
                following ? styles.actionBtnSecondary : { backgroundColor: themed.accentColor },
                pressed && styles.actionPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={following ? colors.text : colors.bg} />
              ) : (
                <Text style={[styles.actionText, !following && { color: colors.bg }]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={openChat}
              disabled={openingChat}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnSecondary,
                pressed && styles.actionPressed,
              ]}
            >
              {openingChat ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.actionText}>Message</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.divider} />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <VideoGrid
            videos={videos}
            emptyLabel="No posts yet"
            onPress={(v) => {
              router.push(`/posts/${uid}?start=${v.id}&source=mine` as never);
            }}
          />
        )}
      </ScrollView>

      <FollowListSheet
        uid={uid}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: colors.textDim, fontSize: 13 },
  content: {},

  cover: { width: '100%', overflow: 'hidden' },
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSpacer: { width: 36, height: 36 },
  handlePill: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 220,
  },
  handlePillText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  avatarOverlap: { alignSelf: 'center', marginTop: -AVATAR_OVERLAP },
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

  identity: { alignItems: 'center', paddingHorizontal: 24, marginTop: 10 },
  displayName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  bio: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 },

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

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 16,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
});
