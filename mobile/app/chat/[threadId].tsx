import { useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  getUserLabel,
  messagesCol,
  sendTextMessage,
  threadsCol,
  type MessageDoc,
  type ThreadDoc,
} from '@/lib/firestore';
import { colors } from '@/lib/theme';

export default function ChatThread() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const me = auth().currentUser;
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [thread, setThread] = useState<ThreadDoc | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MessageDoc>>(null);

  useEffect(() => {
    if (!threadId) return;
    const unsub = messagesCol(threadId)
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snap) => {
          setMessages(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessageDoc, 'id'>) })),
          );
        },
        () => setMessages([]),
      );
    return unsub;
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    return threadsCol()
      .doc(threadId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          setThread({ id: snap.id, ...(snap.data() as Omit<ThreadDoc, 'id'>) });
        },
        () => setThread(null),
      );
  }, [threadId]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim() || !threadId) return;
    setSending(true);
    try {
      await sendTextMessage(threadId, text);
      setText('');
    } finally {
      setSending(false);
    }
  }

  const [otherLabel, setOtherLabel] = useState('Chat');
  useEffect(() => {
    if (!thread || !me) return;
    const otherUid = thread.participants.find((p) => p !== me.uid);
    if (!otherUid) return;
    setOtherLabel(`User ${otherUid.slice(0, 6)}`);
    getUserLabel(otherUid).then((label) => setOtherLabel(label));
  }, [thread, me]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: otherLabel,
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerBackTitle: 'Inbox',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                mine={item.authorId === me?.uid}
                onOpenVideo={() => {
                  router.dismiss();
                  router.push('/');
                }}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Say hi 👋</Text>
            }
          />

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              multiline
              editable={!sending}
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
    </>
  );
}

function MessageBubble({
  message,
  mine,
  onOpenVideo,
}: {
  message: MessageDoc;
  mine: boolean;
  onOpenVideo: () => void;
}) {
  if (message.type === 'video_card') {
    return (
      <Pressable
        onPress={onOpenVideo}
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}
      >
        <View style={[styles.videoCard, mine ? styles.mineCard : styles.theirsCard]}>
          <View style={styles.videoCardThumb}>
            {message.videoDownloadURL ? (
              <Image
                source={{ uri: message.videoDownloadURL }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
            <Ionicons name="play" size={28} color="#fff" style={styles.playIcon} />
          </View>
          <View style={styles.videoCardMeta}>
            <Text style={styles.videoCardLabel}>Shared a video</Text>
            {message.videoOwnerEmail ? (
              <Text style={styles.videoCardOwner}>Shared video</Text>
            ) : null}
            {message.videoCaption ? (
              <Text style={styles.videoCardCaption} numberOfLines={2}>
                {message.videoCaption}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.bubbleText, mine ? styles.mineText : styles.theirsText]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: 12, gap: 6 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 32 },
  bubbleRow: { flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14 },
  mineText: { color: colors.bg },
  theirsText: { color: colors.text },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
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
  videoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '78%',
    backgroundColor: colors.surface,
  },
  mineCard: { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1 },
  theirsCard: { backgroundColor: colors.surface },
  videoCardThumb: {
    width: 72,
    height: 96,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { opacity: 0.85 },
  videoCardMeta: { flex: 1, padding: 10, gap: 2 },
  videoCardLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  videoCardOwner: { color: colors.text, fontSize: 13, fontWeight: '600' },
  videoCardCaption: { color: colors.textMuted, fontSize: 12 },
});
