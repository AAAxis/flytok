import { useCallback, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getMyVideos,
  getSavedVideoIds,
  getVideosByIds,
  usersCol,
  type VideoDoc,
} from '@/lib/firestore';
import { VideoGrid } from '@/components/VideoGrid';
import { SettingsSheet } from '@/components/SettingsSheet';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { colors } from '@/lib/theme';

type Tab = 'mine' | 'saved';

export default function Profile() {
  const me = auth().currentUser;
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [mine, setMine] = useState<VideoDoc[]>([]);
  const [saved, setSaved] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('mine');
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    const [profileSnap, myVideos, savedIds] = await Promise.all([
      usersCol().doc(me.uid).get(),
      getMyVideos(me.uid).catch(() => []),
      getSavedVideoIds(me.uid).catch(() => []),
    ]);
    const profileData = profileSnap.data() ?? {};
    setDisplayName((profileData.displayName as string) ?? null);
    setBio((profileData.bio as string) ?? null);
    setMine(myVideos);
    const savedVideos = await getVideosByIds(savedIds).catch(() => []);
    setSaved(savedVideos);
  }, [me]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
        contentContainerStyle={styles.content}
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
                <View style={styles.avatar}>
                  <Ionicons name="person" size={32} color={colors.text} />
                </View>
                <View style={styles.editBadge}>
                  <Ionicons name="pencil" size={12} color={colors.bg} />
                </View>
              </Pressable>

              <Text style={styles.displayName}>{displayName ?? handle}</Text>
              <Text style={styles.email}>{me.email ?? ''}</Text>

              {bio ? <Text style={styles.bio}>{bio}</Text> : null}

              <View style={styles.statsRow}>
                <Stat label="Posts" value={mine.length} />
                <Stat label="Saved" value={saved.length} />
              </View>

              <Pressable onPress={() => setShowEdit(true)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit profile</Text>
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
              <VideoGrid videos={mine} emptyLabel="No videos yet" />
            ) : (
              <VideoGrid videos={saved} emptyLabel="Nothing saved yet" />
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
  content: { paddingBottom: 60 },
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
  displayName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 12 },
  email: { color: colors.text, fontSize: 13, marginTop: 4, fontWeight: '500' },
  bio: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 24 },
  statsRow: { flexDirection: 'row', gap: 32, marginTop: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  editBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  editBtnText: { color: colors.text, fontSize: 13, fontWeight: '500' },
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
