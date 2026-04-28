import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { commentsCol, getCachedUserLabel, getUserLabel, postComment, type CommentDoc } from '@/lib/firestore';
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
  const inputRef = useRef<TextInput>(null);

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CommentRow comment={item} />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Be the first to comment</Text>
            }
          />

          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
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
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
  kav: { flex: 1 },
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
  list: { maxHeight: 360 },
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
