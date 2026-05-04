import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import {
  followersCol,
  followingCol,
  usersCol,
} from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useBlockedSet } from '@/lib/blockSet';
import { colors } from '@/lib/theme';

type Mode = 'following' | 'followers';

type Row = {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
};

export function FollowListSheet({
  uid,
  mode,
  visible,
  onClose,
}: {
  uid: string | null;
  mode: Mode;
  visible: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const { set: blockedSet } = useBlockedSet();

  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;
    setLoading(true);
    setRows([]);

    const col = mode === 'following' ? followingCol(uid) : followersCol(uid);
    col
      .limit(200)
      .get()
      .then(async (snap) => {
        const ids = snap.docs.map((d) => d.id);
        if (ids.length === 0) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
          }
          return;
        }
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

        const fetched: Row[] = [];
        for (const chunk of chunks) {
          const profileSnaps = await Promise.all(chunk.map((id) => usersCol().doc(id).get()));
          for (let i = 0; i < profileSnaps.length; i++) {
            const id = chunk[i];
            const data = profileSnaps[i].data() ?? {};
            fetched.push({
              uid: id,
              displayName: (data.displayName as string) ?? null,
              username: (data.username as string) ?? null,
              photoURL: (data.photoURL as string) ?? null,
            });
          }
        }
        if (cancelled) return;
        setRows(fetched);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[follow-list] fetch failed:', err);
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, uid, mode]);

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['75%']}
      title={mode === 'following' ? 'Following' : 'Followers'}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <BottomSheetFlatList
          data={rows.filter((r) => !blockedSet.has(r.uid))}
          keyExtractor={(r) => r.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <UserRow row={item} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {mode === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}
            </Text>
          }
        />
      )}
    </AppBottomSheet>
  );
}

function UserRow({ row }: { row: Row }) {
  const name = row.displayName?.trim() || row.username?.trim() || `User ${row.uid.slice(0, 6)}`;
  return (
    <View style={styles.row}>
      {row.photoURL ? (
        <Image source={{ uri: row.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons name="person" size={20} color={colors.text} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {row.username ? (
          <Text style={styles.handle} numberOfLines={1}>@{row.username}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  list: { padding: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  handle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
});
