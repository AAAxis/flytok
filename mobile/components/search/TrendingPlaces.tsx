import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { getTrendingPlaces, type TrendingPlace } from '@/lib/search/queries';

/**
 * Reads `trending_places/snapshot` (single-doc, written by the
 * `rebuildTrendingPlaces` scheduled fn). Effectively free.
 */
export function TrendingPlaces() {
  const router = useRouter();
  const [items, setItems] = useState<TrendingPlace[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTrendingPlaces()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) return null; // loading — keep the rest of empty state quiet
  if (items.length === 0) return null;

  function openPlace(place: TrendingPlace) {
    const params = new URLSearchParams({ label: place.label });
    router.push(`/place/${encodeURIComponent(place.slug)}?${params.toString()}` as never);
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Ionicons name="trending-up" size={16} color={colors.accent} />
        <Text style={styles.title}>Trending places</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((place) => (
          <Pressable
            key={place.slug}
            onPress={() => openPlace(place)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={18} color={colors.bg} />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {place.label}
            </Text>
            <Text style={styles.count}>
              {place.count} {place.count === 1 ? 'video' : 'videos'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  row: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  count: { color: colors.textDim, fontSize: 12 },
});
