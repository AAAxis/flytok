import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  unblockUser,
  unfollow,
  type VideoDoc,
} from '@/lib/firestore';
import { ensureThread } from '@/lib/messaging';
import { useUserProfile } from '@/lib/useUserLabel';
import { VideoGrid } from '@/components/VideoGrid';
import { FollowListSheet } from '@/components/FollowListSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { useBlockedSet } from '@/lib/blockSet';
import { colors } from '@/lib/theme';
import { applyTheme, useUserTheme } from '@/lib/theme/userTheme';
import { dicebearURL } from '@/lib/avatars';

const AVATAR_SIZE = 96;

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
  const [showReport, setShowReport] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const { set: blockedSet } = useBlockedSet();

  const isMe = me?.uid === uid;
  const isBlocked = !isMe && uid != null && blockedSet.has(uid);

  async function handleUnblock() {
    if (!uid || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(uid);
    } catch (err: any) {
      Alert.alert('Could not unblock', err?.message ?? 'Try again later.');
    } finally {
      setUnblocking(false);
    }
  }

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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
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
          {isMe ? (
            <View style={styles.iconBtnSpacer} />
          ) : (
            <Pressable
              onPress={() => setShowReport(true)}
              hitSlop={10}
              style={[styles.iconBtn, { backgroundColor: themed.accentColor }]}
              accessibilityLabel="Report or block user"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.bg} />
            </Pressable>
          )}
        </View>

        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={[styles.avatarImage, styles.avatarTop]} />
        ) : (
          <View style={[styles.avatarPlaceholder, styles.avatarTop]}>
            <Ionicons name="person" size={36} color={colors.text} />
          </View>
        )}

        <View style={styles.identity}>
          {profile?.displayName?.trim() ? (
            <Text style={styles.displayName} numberOfLines={1}>
              {profile.displayName.trim()}
            </Text>
          ) : null}
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

        {!isMe && isBlocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban" size={18} color={colors.danger} />
            <Text style={styles.blockedBannerText} numberOfLines={2}>
              You blocked @{topHandle}. They can&apos;t reach you here.
            </Text>
            <Pressable
              onPress={handleUnblock}
              disabled={unblocking}
              style={({ pressed }) => [
                styles.unblockBtn,
                { backgroundColor: themed.accentColor },
                pressed && styles.actionPressed,
              ]}
            >
              {unblocking ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.unblockText}>Unblock</Text>
              )}
            </Pressable>
          </View>
        )}

        {!isMe && !isBlocked && (
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

      {!isMe && uid ? (
        <ReportSheet
          visible={showReport}
          onClose={() => setShowReport(false)}
          target={{ kind: 'user', userId: uid }}
          blockableUid={uid}
          onBlocked={() => router.back()}
        />
      ) : null}
    </View>
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

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
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

  avatarTop: { alignSelf: 'center', marginTop: 16 },
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

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  blockedBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 84,
    alignItems: 'center',
  },
  unblockText: { color: colors.bg, fontSize: 13, fontWeight: '700' },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 16,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
});
