import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
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

  async function send() {
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
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['90%']}
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

      <View style={styles.composer}>
        <BottomSheetTextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about a place, caption, hashtag…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          editable={!thinking}
          multiline
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit
        />
        <Pressable
          onPress={send}
          disabled={!input.trim() || thinking}
          style={({ pressed }) => [
            styles.send,
            (!input.trim() || thinking) && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          <Ionicons name="arrow-up" size={18} color={colors.bg} />
        </Pressable>
      </View>
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
  listContent: { padding: 16, gap: 8 },
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
