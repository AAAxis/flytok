import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import type { ThreadDoc } from '@/lib/messaging';
import { threadUnreadIndicator } from '@/lib/messaging';

type Props = {
  thread: ThreadDoc;
  myUid: string;
  otherLabel: string;
  otherPhotoURL?: string | null;
  onPress: () => void;
};

function formatRelative(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'now';
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'now';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  const date = new Date(ms);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function previewLine(thread: ThreadDoc): string {
  if (!thread.lastMessage) return 'No messages yet';
  if (thread.lastMessageType === 'image') return thread.lastMessage || 'Sent a photo';
  if (thread.lastMessageType === 'video_card') return 'Shared a video';
  return thread.lastMessage;
}

export function ThreadRow({
  thread,
  myUid,
  otherLabel,
  otherPhotoURL,
  onPress,
}: Props) {
  const unread = threadUnreadIndicator(thread, myUid) === 1;
  const preview = previewLine(thread);
  const ts = thread.lastMessageAt?.toMillis?.() ?? 0;
  const relative = formatRelative(ts);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${otherLabel}${unread ? ', unread' : ''}`}
    >
      <View style={styles.avatar}>
        {otherPhotoURL ? (
          <Image source={{ uri: otherPhotoURL }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={20} color={colors.text} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            numberOfLines={1}
            style={[styles.name, unread && styles.nameUnread]}
          >
            {otherLabel}
          </Text>
          {relative ? <Text style={styles.time}>{relative}</Text> : null}
        </View>
        <View style={styles.bottomLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              unread ? styles.previewUnread : styles.previewRead,
            ]}
          >
            {preview}
          </Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: colors.surface },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 44, height: 44 },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  nameUnread: { fontWeight: '700' },
  time: { color: colors.textDim, fontSize: 11 },
  preview: { fontSize: 12, flex: 1 },
  previewRead: { color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: '600' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
