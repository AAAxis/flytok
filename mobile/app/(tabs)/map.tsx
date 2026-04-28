import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { videosCol, type VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';

const FALLBACK = { latitude: 37.7749, longitude: -122.4194 };

export default function Map() {
  const router = useRouter();
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [videos, setVideos] = useState<VideoDoc[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
      .limit(200)
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

  if (!center) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <MapView
        style={styles.flex}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {videos.map((v) =>
          v.location ? (
            <Marker
              key={v.id}
              coordinate={{
                latitude: v.location.latitude,
                longitude: v.location.longitude,
              }}
              title={v.location.label ?? v.caption ?? 'Video'}
              description={v.ownerEmail ?? undefined}
              onCalloutPress={() => router.push('/')}
            />
          ) : null,
        )}
      </MapView>
      {videos.length === 0 && (
        <View style={styles.emptyBadge}>
          <Text style={styles.emptyText}>No tagged videos yet</Text>
        </View>
      )}
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
