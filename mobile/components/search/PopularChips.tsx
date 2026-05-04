import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import { getPopularHashtags } from '@/lib/search/queries';

/**
 * Trending hashtags pulled live from the most recent uploads via
 * `getPopularHashtags()`. There is no hardcoded fallback list — every chip
 * here corresponds to a hashtag a user actually attached to a video.
 *
 * Chip colors are derived deterministically from the tag string so the same
 * tag always renders the same color across renders / users, without us
 * having to track a curated list.
 */
const CHIP_PALETTE = [
  '#a855f7', // violet
  '#06b6d4', // cyan
  '#16a34a', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#ef4444', // red
  '#0ea5e9', // sky
  '#f97316', // orange
  '#14b8a6', // teal
  '#8b5cf6', // purple
];

function colorFor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return CHIP_PALETTE[hash % CHIP_PALETTE.length];
}

type Props = {
  onPick: (tag: string) => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; tags: { tag: string; count: number }[] }
  | { kind: 'error' };

export function PopularChips({ onPick }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await getPopularHashtags({ limit: 12 });
        if (!cancelled) setState({ kind: 'ready', tags });
      } catch (err) {
        console.warn('[popular-chips] load failed', err);
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Trending</Text>
        <Text style={styles.subtitle}>Live from recent uploads</Text>
      </View>
      {state.kind === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : state.kind === 'error' ? (
        <Text style={styles.placeholder}>Couldn't load trending right now.</Text>
      ) : state.tags.length === 0 ? (
        <Text style={styles.placeholder}>
          No trending hashtags yet — be the first by adding #tags to a new upload.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {state.tags.map((chip) => (
            <Pressable
              key={chip.tag}
              onPress={() => onPick(`#${chip.tag}`)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colorFor(chip.tag) },
                pressed && styles.chipPressed,
              ]}
              accessibilityLabel={`Search hashtag ${chip.tag}, used in ${chip.count} videos`}
            >
              <Text style={styles.chipText}>#{chip.tag}</Text>
              <Text style={styles.chipCount}>{chip.count}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: { color: colors.textDim, fontSize: 11 },
  row: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  loadingRow: { paddingHorizontal: 16, paddingVertical: 10 },
  placeholder: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  chipPressed: { opacity: 0.85 },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
