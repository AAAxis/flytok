import { useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  markRead,
  useMessages,
  useThread,
  type ChatMessage,
} from '@/lib/messaging';
import { getUserLabel } from '@/lib/firestore';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { Composer } from '@/components/messaging/Composer';
import { ReportSheet } from '@/components/ReportSheet';
import { colors } from '@/lib/theme';

export default function ChatThread() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const me = auth().currentUser;
  const headerHeight = useHeaderHeight();
  const { thread } = useThread(threadId);
  const { messages, sendText, sendImage } = useMessages(threadId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [reportTargetUid, setReportTargetUid] = useState<string | null>(null);

  // Mark the thread as read on mount and whenever a new message arrives
  // while the screen is on top.
  useEffect(() => {
    if (!threadId) return;
    markRead(threadId).catch(() => {});
  }, [threadId, messages.length]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

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
            renderItem={({ item }) =>
              threadId ? (
                <MessageBubble
                  message={item}
                  threadId={threadId}
                  mine={item.authorId === me?.uid}
                  onOpenVideo={() => {
                    router.dismiss();
                    router.push('/');
                  }}
                  onReportOther={(uid) => setReportTargetUid(uid)}
                />
              ) : null
            }
            ListEmptyComponent={<Text style={styles.empty}>Say hi 👋</Text>}
          />

          <Composer
            onSendText={async (text) => {
              try {
                await sendText(text);
              } catch (err) {
                console.warn('[chat] sendText failed', err);
              }
            }}
            onSendImage={async (img) => {
              try {
                await sendImage({
                  uri: img.uri,
                  width: img.width,
                  height: img.height,
                  contentType: img.mimeType,
                });
              } catch (err) {
                console.warn('[chat] sendImage failed', err);
              }
            }}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>

      {reportTargetUid ? (
        <ReportSheet
          target={{ kind: 'user', userId: reportTargetUid }}
          blockableUid={reportTargetUid}
          visible
          onClose={() => setReportTargetUid(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: 12, gap: 6 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 32 },
});
