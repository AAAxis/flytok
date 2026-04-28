import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  follow,
  followingCol,
  getFollowCounts,
  getMyVideos,
  unfollow,
  type VideoDoc,
} from '@/lib/firestore';
import { useUserLabel, useUserProfile } from '@/lib/useUserLabel';
import { VideoGrid } from '@/components/VideoGrid';
import { colors } from '@/lib/theme';

export default function UserProfile() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const me = auth().currentUser;
  const profile = useUserProfile(uid);
  const handle = useUserLabel(uid);

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [counts, setCounts] = useState({ following: 0, followers: 0 });
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isMe = me?.uid === uid;

  const load = useCallback(async () => {
    if (!uid) return;
    const [list, c] = await Promise.all([
      getMyVideos(uid).catch(() => []),
      getFollowCounts(uid),
    ]);
    setVideos(list);
    setCounts(c);
  }, [uid]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!me || !uid || isMe) return;
    return followingCol(me.uid)
      .doc(uid)
      .onSnapshot(
        (snap) => setFollowing(snap.exists),
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

  if (!uid) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>User not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: `@${handle}`,
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerArea}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color={colors.text} />
            </View>
          )}

          <Text style={styles.displayName}>{profile?.displayName ?? handle}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            <Stat label="Posts" value={videos.length} />
            <Stat label="Following" value={counts.following} />
            <Stat label="Followers" value={counts.followers} />
          </View>

          {!isMe && (
            <Pressable
              onPress={toggleFollow}
              disabled={busy}
              style={({ pressed }) => [
                styles.followButton,
                following && styles.followingButton,
                pressed && styles.followPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={following ? colors.text : colors.bg} />
              ) : (
                <Text
                  style={[styles.followText, following && styles.followingText]}
                >
                  {following ? 'Following' : 'Follow'}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.divider} />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <VideoGrid videos={videos} emptyLabel="No posts yet" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: colors.textDim, fontSize: 13 },
  content: { paddingBottom: 60 },
  headerArea: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
  },
  displayName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  bio: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 32, marginTop: 12 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  followButton: {
    marginTop: 14,
    paddingHorizontal: 36,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  followingButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  followPressed: { opacity: 0.85 },
  followText: { color: colors.bg, fontWeight: '600', fontSize: 14 },
  followingText: { color: colors.text },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
});
