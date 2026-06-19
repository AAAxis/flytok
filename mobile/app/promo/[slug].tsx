/* eslint-disable react-compiler/react-compiler */
'use no memo';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { filterPlayable, getBlockedIds, videosCol, type VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';

/**
 * Business-owner marketing dashboard for a place. Opened from the map's
 * PlaceCard (its details header or image banners). The place identity is
 * populated from the place's videos; the CRM-style sections (leads,
 * reservations, campaigns, contact email) are a UI shell pending a backend.
 */
export default function PromoScreen() {
  const { slug, label } = useLocalSearchParams<{ slug: string; label?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const placeLabel = label ?? (slug ? decodeURIComponent(slug) : '');
  const matchKey = placeLabel.trim().toLowerCase();

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchKey) return [] as VideoDoc[];
    try {
      const [snap, blockedIds] = await Promise.all([
        videosCol().limit(500).get(),
        getBlockedIds(),
      ]);
      return filterPlayable(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
          .filter(
            (v) =>
              v.location?.label?.trim().toLowerCase() === matchKey &&
              !blockedIds.has(v.ownerId),
          ),
      );
    } catch (err) {
      console.warn('[promo] load failed:', err);
      return [];
    }
  }, [matchKey]);

  useEffect(() => {
    load()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, [load]);

  const hero = videos[0];
  const description = hero?.caption?.trim() || 'A place worth visiting.';
  // No "watched" metric yet — use the post count at this place as a stand-in.
  const watched = videos.length;

  // Thumbnail from the first video's first frame (muted, paused).
  const player = useVideoPlayer(null, (p) => {
    p.muted = true;
    p.loop = false;
  });
  useEffect(() => {
    if (!hero?.downloadURL) return;
    try {
      player.replace(hero.downloadURL);
    } catch {
      // decorative — ignore
    }
  }, [hero?.downloadURL, player]);

  function soon(feature: string) {
    Alert.alert(feature, 'This is coming soon.');
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar — back + watch stat */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{watched.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Watched my location</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Place identity card */}
          <View style={styles.placeCard}>
            <View style={styles.placeThumb}>
              {hero ? (
                <VideoView
                  player={player}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  nativeControls={false}
                  allowsVideoFrameAnalysis={false}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.thumbEmpty]}>
                  <Ionicons name="business" size={22} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName} numberOfLines={1}>
                {placeLabel || 'Place'}
              </Text>
              <Text style={styles.placeDesc} numberOfLines={2}>
                {description}
              </Text>
              <View style={styles.addrRow}>
                <Ionicons name="location-sharp" size={12} color={colors.accent} />
                <Text style={styles.addr} numberOfLines={1}>
                  {placeLabel || '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Leads management */}
          <LinearGradient
            colors={['#2e6fb0', '#1c4f86']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.leadsPanel}
          >
            <Text style={styles.leadsTitle}>Leads management</Text>
            <LeadRow label="Past reservations" onPress={() => soon('Past reservations')} />
            <LeadRow label="History" onPress={() => soon('History')} />
            <LeadRow label="History reports" onPress={() => soon('History reports')} last />
            <Pressable onPress={() => soon('Leads')} hitSlop={6} style={styles.seeMore}>
              <Text style={styles.seeMoreText}>See more</Text>
            </Pressable>
          </LinearGradient>

          {/* Reports + Messages */}
          <View style={styles.dualRow}>
            <TileButton icon="bar-chart" label="Reports" onPress={() => router.push('/campaign/reports' as never)} />
            <TileButton icon="mail" label="Messages" onPress={() => router.push('/inbox' as never)} />
          </View>

          {/* Create campaign */}
          <Pressable
            onPress={() => router.push('/campaign/new' as never)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <LinearGradient
              colors={['#38bdf8', '#0ea5e9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.campaignBtn}
            >
              <Ionicons name="megaphone" size={16} color="#fff" />
              <Text style={styles.campaignText}>Create a new campaign</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function LeadRow({
  label,
  onPress,
  last,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.leadRow, last && styles.leadRowLast]}>
      <Text style={styles.leadLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );
}

function TileButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  statCol: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 1 },

  content: { paddingHorizontal: 16, paddingTop: 6, gap: 14 },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
  },
  placeThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  placeInfo: { flex: 1, gap: 3 },
  placeName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  placeDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addr: { color: colors.textDim, fontSize: 11, flex: 1 },
  cardEdit: { alignSelf: 'flex-start', padding: 2 },

  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  email: { color: colors.textMuted, fontSize: 13, flex: 1 },

  leadsPanel: { borderRadius: 16, padding: 16, gap: 2 },
  leadsTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leadRowLast: { borderBottomWidth: 0 },
  leadLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  seeMore: { alignSelf: 'flex-end', marginTop: 8 },
  seeMoreText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },

  dualRow: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    height: 70,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.accentDim,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  wideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.accentDim,
    borderWidth: 1,
  },
  wideBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  campaignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  campaignText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
