import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import {
  addPreferredSearch,
  getPreferredSearches,
  removePreferredSearch,
  MAX_PREFERRED_LENGTH,
  MAX_PREFERRED_SEARCHES,
} from '@/lib/search/queries';

type Props = {
  onPickTerm: (term: string) => void;
};

/**
 * Per-user "Your Prefers" — a list of saved search terms (hashtags or
 * keywords) the user wants to revisit. Stored as `users/{uid}.preferred_searches`.
 * The Firestore rule caps at 20 entries × 32 chars; we mirror those caps
 * client-side so the UI never sends a doomed write.
 */
export function PrefersSection({ onPickTerm }: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPreferredSearches()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    const value = draft.trim();
    if (value.length === 0) {
      setAdding(false);
      return;
    }
    if (value.length > MAX_PREFERRED_LENGTH) {
      Alert.alert('Too long', `Keep it under ${MAX_PREFERRED_LENGTH} characters.`);
      return;
    }
    if (items.length >= MAX_PREFERRED_SEARCHES) {
      Alert.alert('Limit reached', `You can save up to ${MAX_PREFERRED_SEARCHES} preferences.`);
      return;
    }
    setBusy(true);
    try {
      const next = await addPreferredSearch(value);
      setItems(next);
      setDraft('');
      setAdding(false);
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(term: string) {
    setBusy(true);
    try {
      const next = await removePreferredSearch(term);
      setItems(next);
    } catch (err: any) {
      Alert.alert('Could not remove', err?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Your Prefers</Text>
        {!adding ? (
          <Pressable onPress={() => setAdding(true)} hitSlop={8} style={styles.addBtn}>
            <Ionicons name="add" size={16} color={colors.bg} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      {adding ? (
        <View style={styles.composeRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. surf"
            placeholderTextColor={colors.textDim}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={MAX_PREFERRED_LENGTH}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            editable={!busy}
          />
          <Pressable
            onPress={handleAdd}
            disabled={busy || draft.trim().length === 0}
            style={({ pressed }) => [
              styles.saveBtn,
              (busy || draft.trim().length === 0) && styles.saveBtnDisabled,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setAdding(false);
              setDraft('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {loading ? null : items.length === 0 && !adding ? (
        <Text style={styles.empty}>No preferences yet. Add some!</Text>
      ) : (
        <View style={styles.chipRow}>
          {items.map((term) => (
            <View key={term} style={styles.chip}>
              <Pressable
                onPress={() => onPickTerm(term)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.chipBody,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleRemove(term)}
                hitSlop={6}
                disabled={busy}
              >
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addBtnText: { color: colors.bg, fontWeight: '700', fontSize: 12 },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  chipBody: { flexShrink: 1 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  chipPressed: { opacity: 0.7 },
  empty: { color: colors.textDim, fontSize: 13 },
});
