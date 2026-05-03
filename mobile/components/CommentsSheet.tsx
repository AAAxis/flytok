import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { commentsCol, getCachedUserLabel, getUserLabel, postComment, type CommentDoc } from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

export function CommentsSheet({
  videoId,
  visible,
  onClose,
}: {
  videoId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const unsub = commentsCol(videoId)
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snap) => {
          setComments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommentDoc, 'id'>) })),
          );
        },
        () => setComments([]),
      );
    return unsub;
  }, [videoId, visible]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await postComment(videoId, text);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['70%']}
      title="Comments"
    >
      <BottomSheetFlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <CommentRow comment={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Be the first to comment</Text>
        }
      />

      <View style={styles.composer}>
        <BottomSheetTextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          editable={!sending}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => [
            styles.send,
            (!text.trim() || sending) && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          )}
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

function CommentRow({ comment }: { comment: CommentDoc }) {
  const initial = getCachedUserLabel(comment.authorId) ?? `User ${comment.authorId.slice(0, 6)}`;
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    getUserLabel(comment.authorId).then((l) => {
      if (!cancelled) setLabel(l);
    });
    return () => {
      cancelled = true;
    };
  }, [comment.authorId]);
  return (
    <View style={styles.commentRow}>
      <Text style={styles.author}>{label}</Text>
      <Text style={styles.text}>{comment.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, gap: 12 },
  commentRow: { gap: 2 },
  author: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  text: { color: colors.text, fontSize: 14 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 24 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    maxHeight: 120,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: colors.accentDim },
  sendDisabled: { opacity: 0.4 },
});
