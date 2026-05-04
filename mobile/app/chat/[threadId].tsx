import { useEffect, useMemo, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  markRead,
  useMessages,
  useThread,
  type ChatMessage,
} from '@/lib/messaging';
import {
  getCachedUserBrief,
  getUserBrief,
  unblockUser,
  type UserBrief,
} from '@/lib/firestore';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { Composer } from '@/components/messaging/Composer';
import { ReportSheet } from '@/components/ReportSheet';
import { useBlockedSet } from '@/lib/blockSet';
import { colors } from '@/lib/theme';

export default function ChatThread() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();
  const { thread } = useThread(threadId);
  const { messages, sendText, sendImage } = useMessages(threadId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [reportTargetUid, setReportTargetUid] = useState<string | null>(null);
  const { set: blockedSet } = useBlockedSet();
  const [unblocking, setUnblocking] = useState(false);

  const otherUid = useMemo(() => {
    if (!thread || !me) return null;
    return thread.participants.find((p) => p !== me.uid) ?? null;
  }, [thread, me]);

  const isBlocked = otherUid != null && blockedSet.has(otherUid);

  const visibleMessages = useMemo(
    () => (isBlocked ? messages.filter((m) => m.authorId !== otherUid) : messages),
    [messages, isBlocked, otherUid],
  );

  async function handleUnblock() {
    if (!otherUid || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(otherUid);
    } catch (err: any) {
      Alert.alert('Could not unblock', err?.message ?? 'Try again later.');
    } finally {
      setUnblocking(false);
    }
  }

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

  const [otherBrief, setOtherBrief] = useState<UserBrief>({ label: 'Chat', photoURL: null });
  useEffect(() => {
    if (!thread || !me) return;
    const otherUid = thread.participants.find((p) => p !== me.uid);
    if (!otherUid) return;
    const cached = getCachedUserBrief(otherUid);
    if (cached) setOtherBrief(cached);
    else setOtherBrief({ label: `User ${otherUid.slice(0, 6)}`, photoURL: null });
    getUserBrief(otherUid).then(setOtherBrief);
  }, [thread, me]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => <ChatHeaderTitle brief={otherBrief} />,
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerBackTitle: 'Inbox',
        }}
      />
      <View style={styles.safe}>
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(m) => m.id}
          style={styles.flex}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 56 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
          ListEmptyComponent={
            <Text style={styles.empty}>{isBlocked ? '' : 'Say hi 👋'}</Text>
          }
        />

        {/*
          KeyboardStickyView (from react-native-keyboard-controller) sticks the
          composer to the keyboard top when open and to the safe-area bottom
          when closed. RNKC's translateY is `height + interpolate([closed,
          opened])` — `height` is -keyboardHeight when open, 0 when closed,
          so a *negative* `closed` lifts the composer above the home indicator.
          `opened: 0` keeps the input flush against the keyboard with no gap.
        */}
        <KeyboardStickyView offset={{ closed: -insets.bottom, opened: 0 }}>
          {isBlocked ? (
            <View style={[styles.blockedBanner, { paddingBottom: insets.bottom + 12 }]}>
              <Ionicons name="ban" size={18} color={colors.danger} />
              <Text style={styles.blockedBannerText} numberOfLines={2}>
                You blocked {otherBrief.label}. Unblock to send messages.
              </Text>
              <Pressable
                onPress={handleUnblock}
                disabled={unblocking}
                style={({ pressed }) => [
                  styles.unblockBtn,
                  pressed && styles.unblockPressed,
                ]}
              >
                {unblocking ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </Pressable>
            </View>
          ) : (
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
          )}
        </KeyboardStickyView>
      </View>

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

function ChatHeaderTitle({ brief }: { brief: UserBrief }) {
  return (
    <View style={styles.headerTitle}>
      <View style={styles.headerAvatar}>
        {brief.photoURL ? (
          <Image source={{ uri: brief.photoURL }} style={styles.headerAvatarImage} />
        ) : (
          <Ionicons name="person" size={14} color={colors.text} />
        )}
      </View>
      <Text numberOfLines={1} style={styles.headerLabel}>
        {brief.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: 12, gap: 6 },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 32 },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 28, height: 28 },
  headerLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  blockedBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
    minWidth: 84,
    alignItems: 'center',
  },
  unblockPressed: { opacity: 0.85 },
  unblockText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
});
