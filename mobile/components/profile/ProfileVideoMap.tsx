/* eslint-disable react-compiler/react-compiler */
'use no memo';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import type { VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';

// Warm gold for the active pin so it reads as "selected" against the blue
// resting pins, matching the design reference.
const PIN_SELECTED = '#fbbf24';

type Props = {
  videos: VideoDoc[];
  loading: boolean;
  onPressVideo: (video: VideoDoc) => void;
};

/**
 * In-profile clustered map of the user's own posts.
 *
 * Three branches:
 *   - loading → spinner overlay
 *   - no posts at all → "No posts yet" empty state
 *   - posts exist but none have location → "No location on your posts yet"
 *   - otherwise → ClusteredMapView fitted to the marker bounds
 *
 * Tapping a pin selects it (gold) and floats a place card over the map; the
 * card opens the post. Tapping empty map or the card's close button dismisses.
 */
export function ProfileVideoMap({ videos, loading, onPressVideo }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tapping a pin's preview card text opens the place marketing / promo page.
  function openMarketing(video: VideoDoc) {
    const name = video.location?.label?.trim() || video.caption?.trim() || 'Place';
    const slug = encodeURIComponent(name.toLowerCase());
    router.push(`/promo/${slug}?label=${encodeURIComponent(name)}` as never);
  }

  const located = useMemo(
    () =>
      videos.filter(
        (v) => v.location?.latitude != null && v.location?.longitude != null,
      ),
    [videos],
  );

  const selected = useMemo(
    () => (selectedId ? located.find((v) => v.id === selectedId) ?? null : null),
    [located, selectedId],
  );

  const initialRegion = useMemo<Region | null>(() => {
    if (located.length === 0) return null;
    if (located.length === 1) {
      const v = located[0];
      return {
        latitude: v.location!.latitude,
        longitude: v.location!.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const v of located) {
      const lat = v.location!.latitude;
      const lng = v.location!.longitude;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    const latDelta = Math.max(0.02, (maxLat - minLat) * 1.4);
    const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.4);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [located]);

  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        icon="cloud-upload-outline"
        title="No posts yet"
        body="Your posts will appear here once you upload."
      />
    );
  }

  if (located.length === 0) {
    return (
      <EmptyState
        icon="location-outline"
        title="No location on your posts yet"
        body="Add a location when you upload to see it on this map."
      />
    );
  }

  return (
    <View style={styles.mapWrap}>
      <ClusteredMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        userInterfaceStyle="dark"
        initialRegion={initialRegion ?? undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        clusterColor={colors.accent}
        clusterTextColor={colors.bg}
        radius={Platform.OS === 'ios' ? 40 : 60}
        animationEnabled={Platform.OS === 'ios'}
        spiralEnabled={false}
        // Tapping empty map dismisses the active place card. A marker tap also
        // fires this on some platforms — ignore it so the card stays open.
        onPress={(e) => {
          if (e.nativeEvent?.action === 'marker-press') return;
          setSelectedId(null);
        }}
        onMapReady={() => {
          setMapReady(true);
          // Fit to the bounding box of the user's markers. The wrapper forwards
          // the underlying MapView ref, so `fitToCoordinates` is available.
          if (located.length > 1 && mapRef.current?.fitToCoordinates) {
            const coords = located.map((v) => ({
              latitude: v.location!.latitude,
              longitude: v.location!.longitude,
            }));
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
              animated: false,
            });
          }
        }}
      >
        {located.map((v) => {
          const isSelected = v.id === selectedId;
          return (
            <Marker
              // Encode selection into the key so the custom view re-renders
              // (markers don't track view changes after first paint).
              key={`${v.id}:${isSelected ? 'sel' : 'def'}`}
              coordinate={{
                latitude: v.location!.latitude,
                longitude: v.location!.longitude,
              }}
              onPress={() => setSelectedId(v.id)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={isSelected ? 999 : 1}
              accessibilityLabel={v.location?.label || v.caption || 'My video'}
            >
              <PlaceMarker selected={isSelected} />
            </Marker>
          );
        })}
      </ClusteredMapView>

      {selected ? (
        <VideoPlaceCard
          key={selected.id}
          video={selected}
          onPress={() => onPressVideo(selected)}
          onOpenMarketing={() => openMarketing(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {!mapReady ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </View>
  );
}

function PlaceMarker({ selected }: { selected: boolean }) {
  const color = selected ? PIN_SELECTED : colors.accent;
  const head = selected ? 38 : 30;
  return (
    <View style={markerStyles.wrap}>
      <View
        style={[
          markerStyles.head,
          { width: head, height: head, borderRadius: head / 2, backgroundColor: color },
        ]}
      >
        <Ionicons name="videocam" size={selected ? 16 : 13} color={colors.bg} />
      </View>
      <View
        style={[
          markerStyles.tip,
          { borderTopColor: color },
          selected && markerStyles.tipSelected,
        ]}
      />
    </View>
  );
}

/**
 * Floating card anchored over the map bottom (matches the design reference).
 * The thumbnail player only mounts while the card is visible, so we never run
 * an idle `useVideoPlayer` in the background.
 */
function VideoPlaceCard({
  video,
  onPress,
  onOpenMarketing,
  onClose,
}: {
  video: VideoDoc;
  onPress: () => void;
  onOpenMarketing: () => void;
  onClose: () => void;
}) {
  const player = useVideoPlayer(video.downloadURL, (p) => {
    p.muted = true;
    p.loop = false;
  });
  const title = video.location?.label || video.caption || 'My video';
  const description = video.caption?.trim() || '';
  const hasLabel = !!video.location?.label;

  return (
    <View style={styles.cardWrap} pointerEvents="box-none">
      <View style={styles.card}>
        {/* Thumbnail opens the post; the text opens the marketing page. */}
        <Pressable style={styles.thumb} onPress={onPress} accessibilityLabel="Open post">
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsVideoFrameAnalysis={false}
          />
          <View style={styles.thumbPlay}>
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]}
          onPress={onOpenMarketing}
          accessibilityLabel={`${title}, open marketing page`}
        >
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
          {hasLabel ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-sharp" size={13} color={colors.accent} />
              <Text style={styles.addr} numberOfLines={1}>
                {video.location!.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.marketingHint}>
            <Ionicons name="megaphone-outline" size={11} color={colors.accent} />
            <Text style={styles.marketingHintText}>View marketing page</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.close}
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const MAP_HEIGHT = 420;

const styles = StyleSheet.create({
  mapWrap: {
    height: MAP_HEIGHT,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  center: {
    height: MAP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  cardPressed: { opacity: 0.9 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumbPlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  marketingHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  marketingHintText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  addr: { color: colors.textDim, fontSize: 11, flex: 1 },
  close: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  empty: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyBody: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

const markerStyles = StyleSheet.create({
  // Teardrop pin = round head sitting above a downward triangle tip. The tip
  // points at the exact coordinate (marker anchor y=1).
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
      android: {},
    }),
  },
  head: {
    borderColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -3,
  },
  tipSelected: {
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
  },
});
