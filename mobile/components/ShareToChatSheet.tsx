import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { getUserLabel, usersCol, type VideoDoc } from '@/lib/firestore';
import {
  ensureThread,
  listMyThreads,
  sendVideoCard,
  type ThreadDoc,
} from '@/lib/messaging';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

type Profile = { displayName: string | null; photoURL: string | null };

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
    const unsub = listMyThreads(
      (items) => setThreads(items),
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
      const id = await ensureThread(video.ownerId);
      await sendVideoCard(id, video);
      onSent?.();
      onClose();
    } finally {
      setBusy(null);
    }
  }

  // Profiles for thread counterparties (label + avatar).
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    if (!me) return;
    const otherUids = Array.from(
      new Set(
        threads
          .map((t) => t.participants.find((p) => p !== me.uid))
          .filter((u): u is string => Boolean(u)),
      ),
    );
    const missing = otherUids.filter((uid) => !profiles[uid]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (uid) => {
        const [label, snap] = await Promise.all([
          getUserLabel(uid),
          usersCol().doc(uid).get().catch(() => null),
        ]);
        const data = snap?.data() ?? {};
        return [
          uid,
          { displayName: label, photoURL: (data.photoURL as string | undefined) ?? null },
        ] as const;
      }),
    ).then((entries) => {
      setProfiles((prev) => {
        const next = { ...prev };
        for (const [uid, p] of entries) next[uid] = p;
        return next;
      });
    });
  }, [threads, me, profiles]);

  function profileFor(t: ThreadDoc): Profile {
    if (!me) return { displayName: '', photoURL: null };
    const otherUid = t.participants.find((p) => p !== me.uid);
    if (!otherUid) return { displayName: '', photoURL: null };
    return profiles[otherUid] ?? { displayName: `User ${otherUid.slice(0, 6)}`, photoURL: null };
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['70%']}
      title="Share to"
    >
      <BottomSheetFlatList
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
                <Text style={styles.name}>Send to creator</Text>
                <Text style={styles.sub}>Start a new chat</Text>
              </View>
              {busy === video.ownerId && <ActivityIndicator color={colors.accent} />}
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => {
          const p = profileFor(item);
          return (
            <Pressable
              onPress={() => shareTo(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              {p.photoURL ? (
                <Image source={{ uri: p.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={18} color={colors.text} />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.name}>{p.displayName ?? ''}</Text>
                {item.lastMessage ? (
                  <Text style={styles.sub} numberOfLines={1}>{item.lastMessage}</Text>
                ) : null}
              </View>
              {busy === item.id && <ActivityIndicator color={colors.accent} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No chats yet</Text>
        }
      />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
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
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '500' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', padding: 24 },
});
