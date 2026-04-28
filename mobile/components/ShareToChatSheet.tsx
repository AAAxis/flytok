import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureThread,
  sendVideoCard,
  threadsCol,
  type ThreadDoc,
  type VideoDoc,
} from '@/lib/firestore';
import { colors } from '@/lib/theme';

export function ShareToChatSheet({
  video,
  visible,
  onClose,
  onSent,
}: {
  video: VideoDoc;
  visible: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const me = auth().currentUser;
  const [threads, setThreads] = useState<ThreadDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !me) return;
    const unsub = threadsCol()
      .where('participants', 'array-contains', me.uid)
      .onSnapshot(
        (snap) => {
          setThreads(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ThreadDoc, 'id'>) })),
          );
        },
        () => setThreads([]),
      );
    return unsub;
  }, [visible, me]);

  async function shareTo(thread: ThreadDoc) {
    setBusy(thread.id);
    try {
      await sendVideoCard(thread.id, video);
      onSent?.();
      onClose();
    } finally {
      setBusy(null);
    }
  }

  async function shareToVideoOwner() {
    if (!me || video.ownerId === me.uid) return;
    setBusy(video.ownerId);
    try {
      const id = await ensureThread(video.ownerId, video.ownerEmail ?? null);
      await sendVideoCard(id, video);
      onSent?.();
      onClose();
    } finally {
      setBusy(null);
    }
  }

  function otherEmail(t: ThreadDoc) {
    if (!me) return '';
    const otherUid = t.participants.find((p) => p !== me.uid);
    if (!otherUid) return '';
    return t.participantEmails?.[otherUid] ?? otherUid.slice(0, 8);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Share to</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            me && video.ownerId !== me.uid ? (
              <Pressable
                onPress={shareToVideoOwner}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.avatar}>
                  <Ionicons name="paper-plane" size={18} color={colors.text} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name}>Send to {video.ownerEmail ?? 'creator'}</Text>
                  <Text style={styles.sub}>Start a new chat</Text>
                </View>
                {busy === video.ownerId && <ActivityIndicator color={colors.accent} />}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => shareTo(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={18} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{otherEmail(item)}</Text>
                {item.lastMessage ? (
                  <Text style={styles.sub} numberOfLines={1}>{item.lastMessage}</Text>
                ) : null}
              </View>
              {busy === item.id && <ActivityIndicator color={colors.accent} />}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No chats yet</Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderAlt,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  list: { padding: 8 },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '500' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', padding: 24 },
});
