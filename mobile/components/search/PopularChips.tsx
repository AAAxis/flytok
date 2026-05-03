import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

/**
 * Curated popular hashtags (mirrored from the web demo at `flytok-main/`).
 * Each chip uses a vivid solid background so the empty-state row reads as a
 * row of category buttons rather than a flat tag list. The web demo uses
 * gradients; we'd add `expo-linear-gradient` to match exactly, but that's
 * not currently in the mobile bundle so a single accent color is the
 * conservative pick.
 */
export type PopularChip = { tag: string; color: string };

export const POPULAR_CHIPS: PopularChip[] = [
  { tag: 'Nightlife', color: '#a855f7' },
  { tag: 'Trips', color: '#06b6d4' },
  { tag: 'Camps', color: '#16a34a' },
  { tag: 'Hotels', color: '#f59e0b' },
  { tag: 'Club', color: '#ec4899' },
  { tag: 'Restaurant', color: '#ef4444' },
  { tag: 'Beach', color: '#0ea5e9' },
];

type Props = {
  onPick: (tag: string) => void;
};

export function PopularChips({ onPick }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Popular</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {POPULAR_CHIPS.map((chip) => (
          <Pressable
            key={chip.tag}
            onPress={() => onPick(chip.tag)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: chip.color },
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.chipText}>#{chip.tag}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  row: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  chipPressed: { opacity: 0.85 },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
