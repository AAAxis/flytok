import { useEffect, useMemo, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ensureThread,
  useThreadList,
  type ThreadDoc,
} from '@/lib/messaging';
import { getBlockedIds, getUserLabel } from '@/lib/firestore';
import {
  getFollowedUserProfiles,
  searchUsersByHandle,
  type UserDoc,
} from '@/lib/users';
import { ensureNotificationPermission } from '@/lib/notifications';
import { ThreadRow } from '@/components/messaging/ThreadRow';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

export default function Inbox() {
  const me = auth().currentUser;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { threads, loading } = useThreadList();
  const [showNew, setShowNew] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBlockedIds()
      .then((set) => {
        if (!cancelled) setBlocked(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredThreads = useMemo(() => {
    if (!me) return [];
    return threads.filter((t) => {
      // Defensive: skip docs without a `participants` array (corrupted writes).
      if (!Array.isArray(t.participants)) return false;
      if (blocked.size === 0) return true;
      const otherUid = t.participants.find((p) => p !== me.uid);
      return otherUid ? !blocked.has(otherUid) : true;
    });
  }, [threads, blocked, me]);

  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!me) return;
    const otherUids = Array.from(
      new Set(
        filteredThreads
          .map((t) => t.participants?.find((p) => p !== me.uid))
          .filter((u): u is string => typeof u === 'string' && u.length > 0),
      ),
    );
    if (otherUids.length === 0) return;
    Promise.all(
      otherUids.map((uid) => getUserLabel(uid).then((label) => [uid, label] as const)),
    ).then((entries) => {
      setLabels((prev) => {
        const next = { ...prev };
        for (const [uid, label] of entries) next[uid] = label;
        return next;
      });
    });
  }, [filteredThreads, me]);

  function otherLabel(t: ThreadDoc): string {
    if (!me) return '';
    const otherUid = t.participants?.find((p) => p !== me.uid);
    if (!otherUid) return '';
    return labels[otherUid] ?? `User ${otherUid.slice(0, 6)}`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Pressable onPress={() => setShowNew(true)} hitSlop={12}>
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 60 }]}
          renderItem={({ item }) =>
            me ? (
              <ThreadRow
                thread={item}
                myUid={me.uid}
                otherLabel={otherLabel(item)}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No conversations yet. Tap the pencil to start one.
            </Text>
          }
        />
      )}

      <NewChatSheet
        visible={showNew}
        blocked={blocked}
        onClose={() => setShowNew(false)}
      />
    </SafeAreaView>
  );
}

function NewChatSheet({
  visible,
  blocked,
  onClose,
}: {
  visible: boolean;
  blocked: Set<string>;
  onClose: () => void;
}) {
  const me = auth().currentUser;
  const router = useRouter();
  const [follows, setFollows] = useState<UserDoc[]>([]);
  const [followsLoading, setFollowsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserDoc[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Load follows the first time the sheet opens (and refresh whenever blocked
  // set changes so blocked users disappear immediately after blocking).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setFollowsLoading(true);
    getFollowedUserProfiles({ limit: 200 })
      .then((users) => {
        if (cancelled) return;
        setFollows(users.filter((u) => u.uid !== me?.uid && !blocked.has(u.uid)));
      })
      .catch(() => setFollows([]))
      .finally(() => {
        if (!cancelled) setFollowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, me, blocked]);

  // Debounced handle search. <2 chars clears results to fall back to follows.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      searchUsersByHandle(trimmed, { limit: 25, excludeUid: me?.uid })
        .then((users) => {
          if (cancelled) return;
          setResults(users.filter((u) => !blocked.has(u.uid)));
        })
        .catch((err) => {
          console.warn('[new-chat] search failed:', err);
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, me, blocked]);

  async function open(u: UserDoc) {
    setBusy(u.uid);
    try {
      const id = await ensureThread(u.uid);
      onClose();
      router.push(`/chat/${id}`);
    } finally {
      setBusy(null);
    }
  }

  const isSearching = query.trim().length >= 2;
  const data = isSearching ? results : follows;
  const showLoading = isSearching ? searching : followsLoading;

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['85%']}
      title="New message"
    >
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <BottomSheetTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or handle (min 2)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>
        {isSearching ? 'Search results' : 'People you follow'}
      </Text>

      {showLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <BottomSheetFlatList
          data={data}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.sheetList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <UserPickerRow
              user={item}
              busy={busy === item.uid}
              onPress={() => open(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isSearching
                ? 'No discoverable users matched.'
                : 'Follow people to start chats with them — or search above.'}
            </Text>
          }
        />
      )}
    </AppBottomSheet>
  );
}

function UserPickerRow({
  user,
  busy,
  onPress,
}: {
  user: UserDoc;
  busy: boolean;
  onPress: () => void;
}) {
  const label =
    user.displayName?.trim() ||
    user.username?.trim() ||
    `User ${user.uid.slice(0, 6)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {user.photoURL ? (
        <Image source={{ uri: user.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons name="person" size={20} color={colors.text} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{label}</Text>
        {user.username ? (
          <Text style={styles.handle} numberOfLines={1}>@{user.username}</Text>
        ) : null}
      </View>
      {busy && <ActivityIndicator color={colors.accent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  center: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 8 },
  sheetList: { paddingHorizontal: 8, paddingBottom: 24 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 14, fontWeight: '500' },
  handle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', padding: 24 },
});
