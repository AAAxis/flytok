import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { updateOwnVideoCaption } from '@/lib/firestore';
import { colors } from '@/lib/theme';

export function EditCaptionSheet({
  visible,
  videoId,
  initialCaption,
  onClose,
  onSaved,
}: {
  visible: boolean;
  videoId: string;
  initialCaption: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [caption, setCaption] = useState(initialCaption);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setCaption(initialCaption);
  }, [visible, initialCaption]);

  async function save() {
    setBusy(true);
    try {
      await updateOwnVideoCaption(videoId, caption);
      onSaved?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Edit caption</Text>
            <Pressable onPress={save} disabled={busy} hitSlop={12}>
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.save}>Save</Text>
              )}
            </Pressable>
          </View>

          <SafeAreaView style={styles.flex} edges={['bottom']}>
            <View style={styles.body}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Tell people about this place… add #tags"
                placeholderTextColor={colors.textFaint}
                multiline
                style={styles.input}
                autoFocus
                editable={!busy}
              />
              <Text style={styles.counter}>{caption.length}/2200</Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: { color: colors.textMuted, fontSize: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  save: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  body: { padding: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  counter: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
});
