import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { ROUTES_CREATE_ENABLED } from '@/lib/features';
import { TripRouteMap } from '@/components/profile/TripRouteMap';
import type { Trip, TripStop } from '@/lib/firestore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(ts?: { toDate?: () => Date }): string {
  const d = ts?.toDate?.();
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const flagIsoCache = new Map<string, string | null>();
const flagCoordKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

function TripFlag({ stop }: { stop?: TripStop }) {
  const key = stop ? flagCoordKey(stop.latitude, stop.longitude) : null;
  const [iso, setIso] = useState<string | null>(() => (key ? flagIsoCache.get(key) ?? null : null));

  useEffect(() => {
    if (!stop || !key) return;
    if (flagIsoCache.has(key)) {
      setIso(flagIsoCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude: stop.latitude, longitude: stop.longitude })
      .then((res) => {
        const code = res?.[0]?.isoCountryCode?.toLowerCase() ?? null;
        flagIsoCache.set(key, code);
        if (!cancelled) setIso(code);
      })
      .catch(() => {
        flagIsoCache.set(key, null);
      });
    return () => {
      cancelled = true;
    };
  }, [stop, key]);

  if (iso) {
    return <Image source={{ uri: `https://flagcdn.com/w40/${iso}.png` }} style={styles.routeFlag} />;
  }
  return <Ionicons name="map" size={18} color="#fff" />;
}

export function ProfileRoutesList({
  trips,
  ownerUid,
  canCreate,
  onCreate,
  onDelete,
  emptyLabel = 'No routes yet.',
}: {
  trips: Trip[];
  ownerUid: string;
  canCreate: boolean;
  onCreate?: () => void;
  /** Owner-only: shows a trash button on each route card when provided. */
  onDelete?: (trip: Trip) => void;
  emptyLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Creating routes is free — the CTA shows on your own profile whenever the
  // feature is switched on, with no premium/paywall branch.
  const showCta = ROUTES_CREATE_ENABLED && canCreate;

  return (
    <View style={styles.routesWrap}>
      {trips.length === 0 ? (
        <View style={styles.routesEmpty}>
          <Ionicons name="trail-sign-outline" size={30} color={colors.textFaint} />
          <Text style={styles.routesEmptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        trips.map((t) => {
          const stopCount = t.stops?.length ?? 0;
          const open = openId === t.id;
          return (
            <View key={t.id}>
              <Pressable
                onPress={() => setOpenId(open ? null : t.id)}
                style={({ pressed }) => pressed && styles.actionPressed}
              >
                <LinearGradient
                  colors={['#1c5fa0', '#2e8fd0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.routeCard, open && styles.routeCardOpen]}
                >
                  <TripFlag stop={t.stops?.[0]} />
                  <View style={styles.routeText}>
                    <Text style={styles.routeLabel} numberOfLines={1}>
                      {t.name || 'Untitled trip'}
                    </Text>
                    <Text style={styles.routeSub} numberOfLines={1}>
                      {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                      {t.createdAt ? ` · ${formatDate(t.createdAt)}` : ''}
                    </Text>
                  </View>
                  {onDelete ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          'Delete route?',
                          `“${t.name || 'Untitled trip'}” will be removed permanently.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => onDelete(t) },
                          ],
                        )
                      }
                      hitSlop={8}
                      accessibilityLabel={`Delete ${t.name || 'Untitled trip'}`}
                    >
                      <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.85)" />
                    </Pressable>
                  ) : null}
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="rgba(255,255,255,0.9)"
                  />
                </LinearGradient>
              </Pressable>
              {open ? <TripRouteMap trip={t} ownerUid={ownerUid} /> : null}
            </View>
          );
        })
      )}

      {showCta ? (
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [pressed && styles.actionPressed]}
        >
          <LinearGradient
            colors={['#38bdf8', '#0ea5e9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtn}
          >
            <Ionicons name="location" size={16} color="#fff" />
            <Text style={styles.createBtnText}>Create trip route from your videos</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  routesWrap: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  routesEmpty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  routesEmptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 13,
    paddingLeft: 17,
    paddingRight: 25,
  },
  routeCardOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  routeFlag: { width: 26, height: 18, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  routeText: { flex: 1 },
  routeLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  routeSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    minHeight: 50,
    marginTop: 8,
    paddingHorizontal: 14,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actionPressed: { opacity: 0.85 },
});
