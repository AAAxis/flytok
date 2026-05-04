import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { searchUsersByHandle } from '@/lib/users';
import {
  searchVideos,
  searchHashtags,
  searchPlaces,
} from '@/lib/search/queries';
import { useBlockedSet } from '@/lib/blockSet';
import { PopularChips } from '@/components/search/PopularChips';
import { PrefersSection } from '@/components/search/PrefersSection';
import { TrendingPlaces } from '@/components/search/TrendingPlaces';
import {
  ResultsTabs,
  type SearchTab,
  type SearchResults,
} from '@/components/search/ResultsTabs';

const DEBOUNCE_MS = 300;
const MIN_QUERY_CHARS = 2;

const EMPTY_RESULTS: SearchResults = {
  users: [],
  videos: [],
  hashtags: [],
  places: [],
};

/**
 * Top-level search screen. Two modes:
 *   - empty (q.length < 2): popular chips + your prefers + trending places
 *   - results (q.length >= 2): tabbed results across users / videos / hashtags / places
 *
 * Each query type is dispatched in parallel; rendering doesn't block on the
 * slowest one.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { set: blockedSet } = useBlockedSet();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);

  // Autofocus on mount; the Stack header is hidden so this is the first
  // interactive element.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  // Debounce the input so each keystroke doesn't fire 4 Firestore reads.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const runSearch = useCallback(
    async (q: string, blocked: Set<string>) => {
      if (q.length < MIN_QUERY_CHARS) {
        setResults(EMPTY_RESULTS);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [users, videos, hashtags, places] = await Promise.all([
          searchUsersByHandle(q, { limit: 20, blockedUids: blocked }),
          searchVideos(q, { limit: 20 }),
          searchHashtags(q, { limit: 10 }),
          searchPlaces(q, { limit: 10 }),
        ]);
        // searchVideos / searchHashtags don't know about block lists, so drop
        // any video owned by a blocked user here. Hashtags + places are
        // shared aggregates (not user-attributed) so they don't leak content
        // by name alone.
        const filteredVideos = videos.filter((v) => !blocked.has(v.ownerId));
        setResults({ users, videos: filteredVideos, hashtags, places });
      } catch (err) {
        console.warn('[search] dispatch failed:', err);
        setResults(EMPTY_RESULTS);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    runSearch(debounced.toLowerCase(), blockedSet);
  }, [debounced, blockedSet, runSearch]);

  const isQuerying = debounced.length >= MIN_QUERY_CHARS;

  function pickTerm(term: string) {
    setQuery(term);
    setTab('all');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textDim} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search users, videos, hashtags…"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={colors.textDim} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isQuerying ? (
        <ResultsTabs
          query={debounced}
          loading={loading}
          tab={tab}
          onTabChange={setTab}
          results={results}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.empty, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PopularChips onPick={pickTerm} />
          <PrefersSection onPickTerm={pickTerm} />
          <TrendingPlaces />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  empty: { paddingTop: 16 },
});
