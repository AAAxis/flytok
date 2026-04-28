import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ensureThread,
  threadsCol,
  usersCol,
  type ThreadDoc,
} from '@/lib/firestore';
import { ensureNotificationPermission } from '@/lib/notifications';
import { colors } from '@/lib/theme';

type UserDoc = { uid: string; email: string | null };

export default function Inbox() {
  const me = auth().currentUser;
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!me) return;
    const unsub = threadsCol()
      .where('participants', 'array-contains', me.uid)
      .onSnapshot(
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ThreadDoc, 'id'>) }))
            .sort((a, b) => {
              const ta = a.lastMessageAt?.toMillis?.() ?? 0;
              const tb = b.lastMessageAt?.toMillis?.() ?? 0;
              return tb - ta;
            });
          setThreads(items);
          setLoading(false);
        },
        () => {
          setThreads([]);
          setLoading(false);
        },
      );
    return unsub;
  }, [me]);

  function otherEmail(t: ThreadDoc) {
    if (!me) return '';
    const otherUid = t.participants.find((p) => p !== me.uid);
    if (!otherUid) return '';
    return t.participantEmails?.[otherUid] ?? otherUid.slice(0, 8);
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
          data={threads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{otherEmail(item)}</Text>
                {item.lastMessage ? (
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                ) : (
                  <Text style={styles.previewDim}>No messages yet</Text>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No conversations yet. Tap the pencil to start one.</Text>
          }
        />
      )}

      <NewChatModal visible={showNew} onClose={() => setShowNew(false)} />
    </SafeAreaView>
  );
}

function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const me = auth().currentUser;
  const router = useRouter();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    usersCol()
      .limit(100)
      .get()
      .then((snap) => {
        setUsers(
          snap.docs
            .map((d) => ({ uid: d.id, email: (d.data().email as string | null) ?? null }))
            .filter((u) => u.uid !== me?.uid),
        );
      })
      .catch(() => setUsers([]));
  }, [visible, me]);

  async function open(u: UserDoc) {
    setBusy(u.uid);
    try {
      const id = await ensureThread(u.uid, u.email);
      onClose();
      router.push(`/chat/${id}`);
    } finally {
      setBusy(null);
    }
  }

  const filtered = filter
    ? users.filter((u) => (u.email ?? '').toLowerCase().includes(filter.toLowerCase()))
    : users;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>New message</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search by email…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          style={styles.search}
        />
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.email ?? item.uid.slice(0, 8)}</Text>
              </View>
              {busy === item.uid && <ActivityIndicator color={colors.accent} />}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No users to show</Text>}
        />
      </SafeAreaView>
    </Modal>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: colors.surface },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '500' },
  preview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  previewDim: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', padding: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderAlt,
    alignSelf: 'center',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
});
