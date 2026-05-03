import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UPLOAD_PHASE_LABELS, type UploadPhase } from '@/lib/uploadProgress';
import { colors } from '@/lib/theme';

type Props = {
  phase: UploadPhase;
  /** 0–1. */
  percent: number;
  /** Show a "Cancel" link that calls the supplied handler. */
  onCancel?: () => void;
};

/**
 * Renders a single horizontal progress bar with a phase label + percentage.
 * Designed for the upload screen's "uploading" state — replaces the
 * indeterminate spinner that shipped with the W0 upload form.
 */
export function UploadProgressBar({ phase, percent, onCancel }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, percent)) * 100);
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{UPLOAD_PHASE_LABELS[phase]}</Text>
        <Text style={styles.percent}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      {onCancel ? (
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn}>
          <Ionicons name="close" size={14} color={colors.textMuted} />
          <Text style={styles.cancelText}>Cancel upload</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  percent: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  cancelText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
});
