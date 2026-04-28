import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  blockUser,
  reportContent,
  type ReportReason,
  type ReportTarget,
} from '@/lib/firestore';
import { colors } from '@/lib/theme';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'violence', label: 'Violence or graphic content' },
  { id: 'other', label: 'Something else' },
];

export function ReportSheet({
  target,
  blockableUid,
  visible,
  onClose,
  onBlocked,
}: {
  target: ReportTarget;
  blockableUid?: string | null;
  visible: boolean;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'report' | 'block' | null>(null);

  function reset() {
    setReason(null);
    setNote('');
  }

  async function submitReport() {
    if (!reason) return;
    setBusy('report');
    try {
      await reportContent(target, reason, note);
      Alert.alert('Thanks', 'We received your report and will review it within 24 hours.');
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not submit', err?.message ?? 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  async function handleBlock() {
    if (!blockableUid) return;
    setBusy('block');
    try {
      await blockUser(blockableUid);
      Alert.alert('Blocked', "You won't see content from this user again.");
      onBlocked?.();
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not block', err?.message ?? 'Try again later.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Report</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Why are you reporting this?</Text>
        <View style={styles.reasons}>
          {REASONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setReason(r.id)}
              style={({ pressed }) => [
                styles.reasonRow,
                reason === r.id && styles.reasonSelected,
                pressed && styles.reasonPressed,
              ]}
            >
              <Text style={[styles.reasonText, reason === r.id && styles.reasonTextSelected]}>
                {r.label}
              </Text>
              {reason === r.id && <Ionicons name="checkmark" size={18} color={colors.bg} />}
            </Pressable>
          ))}
        </View>

        {reason === 'other' && (
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Tell us what's wrong"
            placeholderTextColor={colors.textFaint}
            style={styles.note}
            multiline
            editable={busy !== 'report'}
          />
        )}

        <Pressable
          onPress={submitReport}
          disabled={!reason || busy !== null}
          style={({ pressed }) => [
            styles.submit,
            (!reason || busy !== null) && styles.submitDisabled,
            pressed && styles.submitPressed,
          ]}
        >
          {busy === 'report' ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.submitText}>Submit report</Text>
          )}
        </Pressable>

        {blockableUid && (
          <Pressable
            onPress={handleBlock}
            disabled={busy !== null}
            style={({ pressed }) => [styles.block, pressed && styles.blockPressed]}
          >
            {busy === 'block' ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.blockText}>Block this user</Text>
            )}
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderAlt,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  reasons: { paddingHorizontal: 12 },
  reasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: 6,
  },
  reasonPressed: { opacity: 0.85 },
  reasonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  reasonText: { color: colors.text, fontSize: 14 },
  reasonTextSelected: { color: colors.bg, fontWeight: '600' },
  note: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submit: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitPressed: { backgroundColor: colors.accentDim },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
  block: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  blockPressed: { opacity: 0.7 },
  blockText: { color: colors.danger, fontSize: 14, fontWeight: '500' },
});
