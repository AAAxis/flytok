import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { pickImageAttachment, type PickedImage } from './AttachmentPicker';

type Props = {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage: (img: PickedImage) => Promise<void> | void;
  disabled?: boolean;
};

/**
 * Bottom-of-screen composer used by the chat thread. Owns the input draft
 * state and an in-flight image preview that gets cleared once the parent
 * acknowledges the send.
 */
export function Composer({ onSendText, onSendImage, disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSendText(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  async function handleAttach() {
    if (uploadingImage) return;
    const picked = await pickImageAttachment();
    if (!picked) return;
    setPickedImage(picked);
    setUploadingImage(true);
    try {
      await onSendImage(picked);
    } finally {
      setUploadingImage(false);
      setPickedImage(null);
    }
  }

  const canSend = text.trim().length > 0 && !sending && !disabled;

  return (
    <View style={styles.wrap}>
      {pickedImage ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: pickedImage.uri }} style={styles.previewImg} />
          <View style={styles.previewMeta}>
            <Text style={styles.previewText}>
              {uploadingImage ? 'Uploading photo…' : 'Photo ready'}
            </Text>
            {uploadingImage ? <ActivityIndicator color={colors.accent} /> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={handleAttach}
          disabled={uploadingImage || disabled}
          hitSlop={8}
          style={({ pressed }) => [styles.attach, pressed && styles.attachPressed]}
          accessibilityLabel="Attach photo"
        >
          <Ionicons
            name="image-outline"
            size={22}
            color={uploadingImage ? colors.textDim : colors.textMuted}
          />
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          editable={!sending && !disabled}
          accessibilityLabel="Message text"
        />

        <Pressable
          onPress={handleSendText}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.send,
            !canSend && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  previewImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  previewMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: { color: colors.textMuted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
  },
  attach: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachPressed: { backgroundColor: colors.surfaceAlt },
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
});
