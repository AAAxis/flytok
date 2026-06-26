import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getMyTrips, type Trip } from '@/lib/firestore';
import {
  createCampaign,
  creditWallet,
  formatCents,
  getWalletCents,
} from '@/lib/campaigns';
import {
  PAYWALL_RESULT,
  newTopupCreditCents,
  presentTopupPaywall,
  topupTransactionIds,
} from '@/lib/purchases';
import { colors } from '@/lib/theme';
import { ROUTES_CREATE_ENABLED } from '@/lib/features';

const BUDGET_PRESETS = [500, 1000, 2500, 5000]; // cents
const DURATIONS = [3, 7, 14, 30]; // days

/**
 * Create a trip-promotion campaign: pick a trip, set a budget + duration
 * (daily spend = budget ÷ days), funded from the wallet. The paywall opens
 * when the wallet can't cover the budget.
 */
export default function NewCampaign() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = auth().currentUser?.uid ?? null;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [walletCents, setWalletCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tripId, setTripId] = useState<string | null>(null);
  const [budgetCents, setBudgetCents] = useState(1000);
  const [durationDays, setDurationDays] = useState(7);
  const [launching, setLaunching] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);

  /**
   * Present the RevenueCat-hosted paywall (configured in the dashboard) and
   * credit the wallet for any purchase made inside it. Returns the resulting
   * wallet balance so callers (e.g. launch) can decide whether to continue.
   */
  const openPaywall = useCallback(async (): Promise<number> => {
    if (!uid) return walletCents;
    setPaywallBusy(true);
    try {
      const before = await topupTransactionIds();
      const result = await presentTopupPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        // TEMP: credit client-side; production should credit via the RevenueCat
        // webhook → Cloud Function (see memory: campaigns-revenuecat).
        const credit = await newTopupCreditCents(before);
        const next = credit > 0 ? await creditWallet(uid, credit) : await getWalletCents(uid);
        setWalletCents(next);
        return next;
      }
      return walletCents;
    } catch (err: any) {
      Alert.alert('Top-up failed', err?.message ?? 'Try again.');
      return walletCents;
    } finally {
      setPaywallBusy(false);
    }
  }, [uid, walletCents]);

  const reload = useCallback(async () => {
    if (!uid) return;
    const [t, w] = await Promise.all([getMyTrips(uid), getWalletCents(uid)]);
    setTrips(t);
    setWalletCents(w);
    setTripId((cur) => cur ?? (t.length ? t[0].id : null));
  }, [uid]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const trip = trips.find((t) => t.id === tripId) ?? null;
  const dailyCents = Math.round(budgetCents / durationDays);
  const enough = walletCents >= budgetCents;

  async function launch() {
    if (!trip) {
      Alert.alert('Pick a trip', 'Choose which trip to promote.');
      return;
    }
    // Top up first if the wallet can't cover the budget; bail if still short
    // after the paywall (user cancelled or didn't add enough).
    let balance = walletCents;
    if (balance < budgetCents) {
      balance = await openPaywall();
      if (balance < budgetCents) return;
    }
    setLaunching(true);
    try {
      await createCampaign({
        tripId: trip.id,
        tripName: trip.name || 'Trip',
        budgetCents,
        durationDays,
      });
      Alert.alert('Campaign launched', `${trip.name || 'Your trip'} will be promoted in the feed.`);
      router.back();
    } catch (err: any) {
      if (err?.message === 'insufficient_funds') await openPaywall();
      else Alert.alert('Could not launch', err?.message ?? 'Try again.');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>New campaign</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet */}
          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              <Text style={styles.walletValue}>{formatCents(walletCents)}</Text>
            </View>
            <Pressable
              onPress={openPaywall}
              disabled={paywallBusy}
              style={[styles.addFunds, paywallBusy && styles.launchDim]}
            >
              {paywallBusy ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <>
                  <Ionicons name="add" size={16} color={colors.bg} />
                  <Text style={styles.addFundsText}>Add funds</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Trip picker */}
          <Text style={styles.sectionTitle}>Promote which trip?</Text>
          {trips.length === 0 ? (
            ROUTES_CREATE_ENABLED ? (
              <Pressable onPress={() => router.push('/create-trip' as never)} style={styles.emptyTrip}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.emptyTripText}>No trips yet — create one first</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyTrip}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textDim} />
                <Text style={styles.emptyTripText}>Trip routes are not available right now.</Text>
              </View>
            )
          ) : (
            trips.map((t) => {
              const sel = t.id === tripId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTripId(t.id)}
                  style={[styles.tripRow, sel && styles.tripRowSel]}
                >
                  <Ionicons
                    name={sel ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={sel ? colors.accent : colors.textDim}
                  />
                  <Text style={styles.tripName} numberOfLines={1}>
                    {t.name || 'Untitled trip'}
                  </Text>
                  <Text style={styles.tripStops}>{t.stops?.length ?? 0} stops</Text>
                </Pressable>
              );
            })
          )}

          {/* Budget */}
          <Text style={styles.sectionTitle}>Budget</Text>
          <View style={styles.chipRow}>
            {BUDGET_PRESETS.map((c) => (
              <Chip key={c} label={formatCents(c)} active={budgetCents === c} onPress={() => setBudgetCents(c)} />
            ))}
          </View>

          {/* Duration */}
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((d) => (
              <Chip key={d} label={`${d} days`} active={durationDays === d} onPress={() => setDurationDays(d)} />
            ))}
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <SummaryRow label="Budget" value={formatCents(budgetCents)} />
            <SummaryRow label="Duration" value={`${durationDays} days`} />
            <SummaryRow label="Daily spend" value={`${formatCents(dailyCents)} / day`} highlight />
          </View>
        </ScrollView>
      )}

      {/* Launch */}
      {!loading ? (
        <View style={[styles.launchBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={launch} disabled={launching || !trip} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient
              colors={['#38bdf8', '#0ea5e9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.launchBtn, (launching || !trip) && styles.launchDim]}
            >
              {launching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.launchText}>
                  {enough ? 'Launch campaign' : `Add funds & launch — ${formatCents(budgetCents)}`}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHi]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  content: { paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  walletLabel: { color: colors.textDim, fontSize: 12 },
  walletValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  addFunds: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
  },
  addFundsText: { color: colors.bg, fontWeight: '700', fontSize: 13 },

  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptyTrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTripText: { color: colors.textMuted, fontSize: 13 },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tripRowSel: { borderColor: colors.accent },
  tripName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  tripStops: { color: colors.textDim, fontSize: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: colors.bg },

  summary: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  summaryValueHi: { color: colors.accent, fontWeight: '800' },

  launchBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  launchBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  launchDim: { opacity: 0.5 },
  launchText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.85 },
});
