import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import type { ChatMessage } from '@/lib/messaging';
import { softDeleteOwnMessage } from '@/lib/messaging';

type Props = {
  message: ChatMessage;
  threadId: string;
  mine: boolean;
  onOpenVideo?: () => void;
  /** Author uid of "other" message — passed to the report sheet. */
  onReportOther?: (authorId: string) => void;
};

function copyText(text: string) {
  // Clipboard from RN core is deprecated in favor of @react-native-clipboard,
  // but it's good enough for this lightweight copy action and avoids adding
  // another native module.
  Clipboard.setString(text);
}

function showOwnActions(opts: {
  hasText: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const { hasText, onCopy, onDelete } = opts;
  if (Platform.OS === 'ios') {
    const options = hasText ? ['Copy', 'Delete', 'Cancel'] : ['Delete', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: hasText ? 1 : 0,
      },
      (idx) => {
        if (hasText && idx === 0) onCopy();
        if ((hasText && idx === 1) || (!hasText && idx === 0)) onDelete();
      },
    );
    return;
  }
  // Android: use Alert as a lightweight action sheet substitute.
  const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
  if (hasText) buttons.push({ text: 'Copy', onPress: onCopy });
  buttons.push({ text: 'Delete', style: 'destructive', onPress: onDelete });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('Message', undefined, buttons);
}

function showOtherActions(opts: {
  hasText: boolean;
  onCopy: () => void;
  onReport: () => void;
}) {
  const { hasText, onCopy, onReport } = opts;
  if (Platform.OS === 'ios') {
    const options = hasText ? ['Copy', 'Report', 'Cancel'] : ['Report', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: hasText ? 1 : 0,
      },
      (idx) => {
        if (hasText && idx === 0) onCopy();
        if ((hasText && idx === 1) || (!hasText && idx === 0)) onReport();
      },
    );
    return;
  }
  const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
  if (hasText) buttons.push({ text: 'Copy', onPress: onCopy });
  buttons.push({ text: 'Report', style: 'destructive', onPress: onReport });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('Message', undefined, buttons);
}

export function MessageBubble({
  message,
  threadId,
  mine,
  onOpenVideo,
  onReportOther,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const isDeleted = !!message.deletedAt;
  const isPending = !!message.pending;

  async function handleDelete() {
    if (!message.id || message.id.startsWith('local:')) return;
    setDeleting(true);
    try {
      await softDeleteOwnMessage(threadId, message.id);
    } catch (err) {
      console.warn('[chat] soft-delete failed', err);
      Alert.alert('Could not delete', 'Try again in a moment.');
    } finally {
      setDeleting(false);
    }
  }

  function handleLongPress() {
    if (isDeleted || isPending) return;
    if (mine) {
      const hasText = !!message.text || !!message.videoCaption;
      showOwnActions({
        hasText,
        onCopy: () => copyText(message.text ?? message.videoCaption ?? ''),
        onDelete: () => {
          Alert.alert('Delete message?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: handleDelete },
          ]);
        },
      });
    } else {
      const hasText = !!message.text || !!message.videoCaption;
      showOtherActions({
        hasText,
        onCopy: () => copyText(message.text ?? message.videoCaption ?? ''),
        onReport: () => onReportOther?.(message.authorId),
      });
    }
  }

  const rowStyle = [styles.row, mine ? styles.rowMine : styles.rowTheirs];

  if (isDeleted) {
    return (
      <View style={rowStyle}>
        <View style={[styles.bubble, styles.deletedBubble]}>
          <Text style={styles.deletedText}>Message deleted</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'image') {
    const uri = message.imageURL ?? message.localPreviewUri;
    return (
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={rowStyle}
      >
        <View style={[styles.imageBubble, mine ? styles.mineCard : styles.theirsCard]}>
          {uri ? (
            <Image source={{ uri }} style={styles.imageAttachment} resizeMode="cover" />
          ) : null}
          {isPending ? (
            <View style={styles.imageOverlay}>
              <ActivityIndicator color="#fff" />
              {typeof message.progress === 'number' ? (
                <Text style={styles.imageProgress}>
                  {Math.round((message.progress ?? 0) * 100)}%
                </Text>
              ) : null}
            </View>
          ) : null}
          {message.text ? (
            <Text style={[styles.caption, mine ? styles.mineText : styles.theirsText]}>
              {message.text}
            </Text>
          ) : null}
          {deleting ? <ActivityIndicator color={colors.accent} /> : null}
        </View>
      </Pressable>
    );
  }

  if (message.type === 'video_card') {
    return (
      <Pressable
        onPress={onOpenVideo}
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={rowStyle}
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
            {message.videoCaption ? (
              <Text style={styles.videoCardCaption} numberOfLines={2}>
                {message.videoCaption}
              </Text>
            ) : null}
            {isPending ? <Text style={styles.pendingHint}>Sending…</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  }

  // text
  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={350}
      style={rowStyle}
    >
      <View
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          isPending && styles.pendingBubble,
        ]}
      >
        <Text style={[styles.text, mine ? styles.mineText : styles.theirsText]}>
          {message.text}
        </Text>
        {message.failed ? (
          <Text style={styles.failedHint}>Failed to send</Text>
        ) : isPending ? (
          <Text style={styles.pendingHint}>Sending…</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  pendingBubble: { opacity: 0.6 },
  deletedBubble: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  deletedText: {
    color: colors.textDim,
    fontStyle: 'italic',
    fontSize: 13,
  },
  text: { fontSize: 14 },
  mineText: { color: colors.bg },
  theirsText: { color: colors.text },
  pendingHint: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  failedHint: {
    fontSize: 10,
    color: colors.danger,
    marginTop: 2,
  },
  imageBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imageAttachment: { width: 240, height: 240 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 4,
  },
  imageProgress: { color: '#fff', fontSize: 12 },
  caption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  videoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '78%',
    backgroundColor: colors.surface,
  },
  mineCard: { borderColor: colors.accent, borderWidth: 1 },
  theirsCard: {},
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
  videoCardCaption: { color: colors.textMuted, fontSize: 12 },
});
