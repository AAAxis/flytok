import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

export type MapCategory = {
  tag: string;
  count: number;
  label?: string;
  tone?: 'default' | 'saved';
};

const ALL_KEY = '__all__';

type Row =
  | { kind: 'all'; total: number }
  | { kind: 'tag'; tag: string; count: number; label?: string; tone?: 'default' | 'saved' };

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: MapCategory[];
  /** `null` means no filter / show all videos. */
  selected: string | null;
  onSelect: (tag: string | null) => void;
};

export function MapCategoriesSheet({
  visible,
  onClose,
  categories,
  selected,
  onSelect,
}: Props) {
  const data = useMemo<Row[]>(() => {
    const total = categories.reduce((acc, c) => acc + c.count, 0);
    return [
      { kind: 'all', total },
      ...categories.map((c) => ({ kind: 'tag' as const, ...c })),
    ];
  }, [categories]);

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['65%']}
      title="Categories"
    >
      <BottomSheetFlatList
        data={data}
        keyExtractor={(item) => (item.kind === 'all' ? ALL_KEY : item.tag)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={20} color={colors.textDim} />
            <Text style={styles.emptyText}>
              No hashtags yet — uploads with #tags will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected =
            item.kind === 'all' ? selected === null : selected === item.tag;
          const label =
            item.kind === 'all' ? 'All categories' : (item.label ?? `#${item.tag}`);
          const count = item.kind === 'all' ? item.total : item.count;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.kind === 'all' ? null : item.tag);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                item.kind === 'tag' && item.tone === 'saved' && styles.rowSaved,
                isSelected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.rowLabelWrap}>
                {item.kind === 'tag' && item.tone === 'saved' ? (
                  <Ionicons name="bookmark" size={17} color="#f8d66d" />
                ) : null}
                <Text
                  style={[
                    styles.rowLabel,
                    item.kind === 'tag' && item.tone === 'saved' && styles.rowLabelSaved,
                    isSelected && styles.rowLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                <Text style={styles.rowCount}>{count}</Text>
              </View>
              {isSelected ? (
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  rowSaved: {
    borderColor: 'rgba(248,214,109,0.7)',
    backgroundColor: '#382f18',
  },
  rowLabelSaved: { color: '#f8d66d', fontWeight: '700' },
  rowPressed: { opacity: 0.85 },
  rowLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '500' },
  rowLabelSelected: { color: colors.accent, fontWeight: '600' },
  rowCount: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  sep: { height: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
