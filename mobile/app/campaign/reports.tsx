import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMyCampaigns, formatCents, type Campaign } from '@/lib/campaigns';
import { colors } from '@/lib/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ts?: { toDate?: () => Date }): string {
  const d = ts?.toDate?.();
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Campaign reports — the user's campaigns with budget / spend / status. */
export default function CampaignReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = auth().currentUser?.uid ?? null;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    setCampaigns(await getMyCampaigns(uid));
  }, [uid]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Reports</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : campaigns.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bar-chart-outline" size={30} color={colors.textMuted} />
          <Text style={styles.emptyText}>No campaigns yet.</Text>
          <Pressable onPress={() => router.push('/campaign/new' as never)} style={styles.cta}>
            <Text style={styles.ctaText}>Create a campaign</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {campaigns.map((c) => {
            const pct = c.budgetCents > 0 ? Math.min(1, c.spentCents / c.budgetCents) : 0;
            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {c.tripName}
                  </Text>
                  <View style={[styles.badge, c.status === 'active' ? styles.badgeActive : styles.badgeDone]}>
                    <Text style={styles.badgeText}>{c.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {formatCents(c.dailyCents)}/day · {c.durationDays} days · {fmtDate(c.startAt)}–{fmtDate(c.endAt)}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.spend}>
                  {formatCents(c.spentCents)} spent of {formatCents(c.budgetCents)}
                </Text>
              </View>
            );
          })}
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  cta: { backgroundColor: colors.accent, paddingHorizontal: 18, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.bg, fontWeight: '700', fontSize: 14 },

  content: { paddingHorizontal: 16, paddingTop: 6, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeActive: { backgroundColor: 'rgba(56,189,248,0.18)' },
  badgeDone: { backgroundColor: colors.surfaceAlt },
  badgeText: { color: colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  spend: { color: colors.textDim, fontSize: 12 },
});
