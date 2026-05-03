import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { updateOwnVideoCaption } from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
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
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['65%']}
      title="Edit caption"
    >
      <BottomSheetView style={styles.body}>
        <BottomSheetTextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell people about this place… add #tags"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.input}
          editable={!busy}
        />
        <Text style={styles.counter}>{caption.length}/2200</Text>

        <View style={styles.actions}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={save} disabled={busy} style={styles.saveBtn}>
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16 },
  input: {
    backgroundColor: colors.bg,
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
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  saveText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
});
