import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import type { VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';

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
 * Pure viewer — no recenter, no category filter, no user-location dot.
 * That stuff lives on the global Map tab.
 */
export function ProfileVideoMap({ videos, loading, onPressVideo }: Props) {
  const located = useMemo(
    () =>
      videos.filter(
        (v) => v.location?.latitude != null && v.location?.longitude != null,
      ),
    [videos],
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
        {located.map((v) => (
          <Marker
            key={v.id}
            coordinate={{
              latitude: v.location!.latitude,
              longitude: v.location!.longitude,
            }}
            onPress={() => onPressVideo(v)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={v.location?.label || v.caption || 'My video'}
          >
            <VideoMarker />
          </Marker>
        ))}
      </ClusteredMapView>
      {!mapReady ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </View>
  );
}

function VideoMarker() {
  return (
    <View style={markerStyles.outer}>
      <View style={markerStyles.bubble}>
        <Ionicons name="videocam" size={14} color={colors.bg} />
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
  outer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {},
    }),
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#fff',
    borderWidth: 2,
    elevation: 4,
  },
});
