import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { askAssistant, type AiMessage } from '@/lib/aiAssistant';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

const STARTER_MESSAGE: AiMessage = {
  role: 'assistant',
  content:
    "Hey, I'm your travel assistant. Ask me where to go next, what to film at a place, or how to caption a video.",
};

export function AiAssistantSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AiMessage[]>([STARTER_MESSAGE]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      // Reset on each open so the conversation feels fresh.
      setMessages([STARTER_MESSAGE]);
      setInput('');
      setThinking(false);
    }
  }, [visible]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: AiMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const reply = await askAssistant(next);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Hmm, I couldn't reach the assistant. ${err?.message ?? ''}`.trim(),
        },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
    }
  }, [input, thinking, messages]);

  // Composer renders as a `BottomSheetFooter` so gorhom's animated footer
  // position tracks the keyboard the same way `KeyboardStickyView` does in
  // the chat thread (`app/chat/[threadId].tsx`) — flush above the keyboard
  // when open, lifted above the home indicator by `insets.bottom` when
  // closed. The footer's animated position is internal to gorhom; we only
  // supply the resting bottom inset.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[styles.composer, { paddingBottom: 8 + insets.bottom }]}>
          <BottomSheetTextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            editable={!thinking}
            multiline
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit
            accessibilityLabel="Message text"
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || thinking}
            style={({ pressed }) => [
              styles.send,
              (!input.trim() || thinking) && styles.sendDisabled,
              pressed && styles.sendPressed,
            ]}
            accessibilityLabel="Send message"
          >
            {thinking ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={18} color={colors.bg} />
            )}
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [input, thinking, send, insets.bottom],
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['90%']}
      // `extend` ensures the sheet snaps up to its highest stop the moment
      // the input gains focus, so the footer can rest flush above the
      // keyboard without the user seeing a content-shift in flight.
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      footerComponent={renderFooter}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={16} color={colors.accent} />
          <Text style={styles.title}>Travel assistant</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <BottomSheetFlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
      />
      {thinking && (
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.thinkingText}>Thinking…</Text>
        </View>
      )}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  // Bottom padding leaves room for the footer composer so the last message
  // isn't hidden under the input.
  listContent: { padding: 16, gap: 8, paddingBottom: 96 },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  thinkingText: { color: colors.textMuted, fontSize: 12 },
  // Mirror the chat composer (`components/messaging/Composer.tsx`) — same
  // hairline top border, flex-end alignment, surface-tinted rounded input,
  // and accent send button. Wrapping it in `BottomSheetFooter` is what
  // gives it the keyboard-tracking behavior the chat thread gets from
  // `KeyboardStickyView`.
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    backgroundColor: colors.surface,
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
