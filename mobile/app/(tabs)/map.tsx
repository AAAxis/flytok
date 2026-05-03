import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import { videosCol, type VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';
import { PlaceCard } from '@/components/PlaceCard';

const FALLBACK = { latitude: 37.7749, longitude: -122.4194 };

type Place = {
  key: string;        // lower-cased label, used as the cluster grouping key
  label: string;      // display label (first-seen casing)
  latitude: number;   // representative lat (first video at this place)
  longitude: number;
  videos: VideoDoc[];
};

export default function MapScreen() {
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          return;
        } catch {
          // fall through
        }
      }
      setCenter(FALLBACK);
    })();
  }, []);

  useEffect(() => {
    videosCol()
      .limit(500)
      .get()
      .then((snap) => {
        setVideos(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
            .filter((v) => v.location?.latitude != null && v.location?.longitude != null),
        );
      })
      .catch(() => setVideos([]));
  }, []);

  // Group videos by place label so each marker represents a place (not a
  // single video). Clustering then groups nearby places into a count bubble.
  const places = useMemo<Place[]>(() => {
    const map = new Map<string, Place>();
    for (const v of videos) {
      if (!v.location?.latitude || !v.location?.longitude) continue;
      const label = (v.location.label ?? v.caption ?? 'Untitled place').trim() || 'Untitled place';
      const key = label.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.videos.push(v);
      } else {
        map.set(key, {
          key,
          label,
          latitude: v.location.latitude,
          longitude: v.location.longitude,
          videos: [v],
        });
      }
    }
    return Array.from(map.values());
  }, [videos]);

  const selected = useMemo(
    () => (selectedKey ? places.find((p) => p.key === selectedKey) ?? null : null),
    [places, selectedKey],
  );

  if (!center) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const initialRegion: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <View style={styles.flex}>
      <ClusteredMapView
        style={styles.flex}
        // iOS uses Apple Maps (no provider). Android forces Google Maps —
        // the API key is injected at prebuild via withGoogleMapsApiKey.js.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        initialRegion={initialRegion}
        clusterColor={colors.accent}
        clusterTextColor={colors.bg}
        radius={44}
        animationEnabled={Platform.OS === 'ios'}
        spiralEnabled={false}
      >
        {places.map((p) => (
          <Marker
            key={p.key}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            onPress={() => {
              setSelectedKey(p.key);
              setSheetOpen(true);
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PlaceMarker place={p} />
          </Marker>
        ))}
      </ClusteredMapView>

      {videos.length === 0 && (
        <View style={styles.emptyBadge}>
          <Text style={styles.emptyText}>No tagged videos yet</Text>
        </View>
      )}

      <PlaceCard
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placeName={selected?.label ?? null}
        videos={selected?.videos ?? []}
      />
    </View>
  );
}

function PlaceMarker({ place }: { place: Place }) {
  return (
    <View style={markerStyles.outer}>
      <View style={markerStyles.inner}>
        <View style={markerStyles.bubble}>
          <Text style={markerStyles.count}>{place.videos.length}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  emptyText: { color: colors.textMuted, fontSize: 12 },
});

const markerStyles = StyleSheet.create({
  outer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // Drop shadow — cross-platform compromise (RN's shadow* on iOS, elevation
    // on Android via the inner View).
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
  inner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { color: colors.bg, fontWeight: '800', fontSize: 13 },
});
