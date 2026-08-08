import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Marker, type Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import auth from '@react-native-firebase/auth';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBlockedIds, savesCol, videosCol, type VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';
import { PlaceCard } from '@/components/PlaceCard';
import { MapCategoriesSheet, type MapCategory } from '@/components/MapCategoriesSheet';
import { OpenStreetMapTiles, androidOpenMapType } from '@/components/OpenStreetMapTiles';
import { AndroidOpenMap, AndroidOpenMarker } from '@/components/AndroidOpenMap';

const FALLBACK = { latitude: 37.7749, longitude: -122.4194 };
const LOCATION_TIMEOUT_MS = 6000;
const MAP_READY_TIMEOUT_MS = 8000;
const SAVED_CATEGORY = '__saved__';
const PRIMARY_CATEGORIES = [
  'Hiking',
  'Beaches',
  'Nightlife',
  'Clubs',
  'Surfing',
  'Shopping',
  'Gems',
  'Camping',
  'Culture',
  'Markets',
  'Food',
  'Rivers',
  'Ski',
  'Lakes',
] as const;

type Place = {
  // Composite key: lowercased label + 3-decimal lat/lng so two videos with
  // the same caption in different cities don't collapse into one marker.
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  videos: VideoDoc[];
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

type LocationState =
  | { kind: 'pending' }
  | { kind: 'granted'; coords: { latitude: number; longitude: number } }
  | { kind: 'denied' }
  | { kind: 'fallback' };

export default function MapScreen() {
  const me = auth().currentUser;
  const { latitude, longitude, videoId } = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    videoId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [locState, setLocState] = useState<LocationState>({ kind: 'pending' });
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => new Set());
  const [mapReady, setMapReady] = useState(false);
  const [mapTimedOut, setMapTimedOut] = useState(false);
  // Bumped to force-remount the map widget when the user retries.
  const [mapKey, setMapKey] = useState(0);
  const mapRef = useRef<any>(null);
  const handledTargetRef = useRef<string | null>(null);

  // Resolve location (or fall back) without ever blocking the UI forever.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocState({ kind: 'denied' });
          return;
        }
        // Fast path: last known fix typically returns instantly.
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setLocState({
            kind: 'granted',
            coords: { latitude: last.coords.latitude, longitude: last.coords.longitude },
          });
          return;
        }
        // Slow path with a hard timeout — cold GPS can hang for 30s+ otherwise.
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('location-timeout')), LOCATION_TIMEOUT_MS),
          ),
        ]);
        if (!cancelled) {
          setLocState({
            kind: 'granted',
            coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          });
        }
      } catch (err) {
        console.warn('[map] location resolve failed:', err);
        if (!cancelled) setLocState({ kind: 'fallback' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadVideos = useCallback(async () => {
    setLoadState({ kind: 'loading' });
    try {
      const [snap, blockedIds] = await Promise.all([
        videosCol().limit(500).get(),
        getBlockedIds(),
      ]);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VideoDoc, 'id'>) }))
        .filter(
          (v) =>
            !blockedIds.has(v.ownerId) &&
            v.location?.latitude != null &&
            v.location?.longitude != null,
        );
      setVideos(list);
      setLoadState({ kind: 'ready' });
    } catch (err: any) {
      console.warn('[map] videos query failed:', err);
      setVideos([]);
      setLoadState({
        kind: 'error',
        message: err?.message ?? 'Could not load places. Tap to retry.',
      });
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    if (!me) {
      setSavedVideoIds(new Set());
      return;
    }
    return savesCol(me.uid).onSnapshot(
      (snap) => setSavedVideoIds(new Set(snap.docs.map((doc) => doc.id))),
      () => setSavedVideoIds(new Set()),
    );
  }, [me]);

  // Aggregate hashtags across visible videos so the categories sheet only
  // ever surfaces tags that actually exist on the map.
  const categories = useMemo<MapCategory[]>(() => {
    const counts = new Map<string, number>();
    for (const v of videos) {
      const tags = (v.hashtags ?? []).filter((t): t is string => typeof t === 'string' && t.length > 0);
      const seen = new Set<string>();
      for (const tag of tags) {
        const norm = tag.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        counts.set(norm, (counts.get(norm) ?? 0) + 1);
      }
    }
    const primaryKeys = new Set(PRIMARY_CATEGORIES.map((label) => label.toLowerCase()));
    const primary: MapCategory[] = PRIMARY_CATEGORIES.map((label) => ({
      tag: label.toLowerCase(),
      label,
      count: counts.get(label.toLowerCase()) ?? 0,
    }));
    const additional = Array.from(counts.entries())
      .filter(([tag]) => !primaryKeys.has(tag))
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return [
      {
        tag: SAVED_CATEGORY,
        label: 'Saved Videos',
        count: videos.filter((video) => savedVideoIds.has(video.id)).length,
        tone: 'saved' as const,
      },
      ...primary,
      ...additional,
    ];
  }, [savedVideoIds, videos]);

  // Drop the active filter if its tag is no longer on the map (e.g. after
  // an upload or a fresh query) so the user isn't stuck staring at zero pins.
  useEffect(() => {
    if (!selectedCategory) return;
    if (!categories.some((c) => c.tag === selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory]);

  const filteredVideos = useMemo(() => {
    if (!selectedCategory) return videos;
    if (selectedCategory === SAVED_CATEGORY) {
      return videos.filter((video) => savedVideoIds.has(video.id));
    }
    return videos.filter((v) =>
      (v.hashtags ?? []).some(
        (t) => typeof t === 'string' && t.toLowerCase() === selectedCategory,
      ),
    );
  }, [savedVideoIds, videos, selectedCategory]);

  // Group by lowercased label + ~110m geohash so duplicate captions in
  // different places stay separate.
  const places = useMemo<Place[]>(() => {
    const map = new Map<string, Place>();
    for (const v of filteredVideos) {
      if (!v.location?.latitude || !v.location?.longitude) continue;
      const label = (v.location.label ?? v.caption ?? 'Untitled place').trim() || 'Untitled place';
      const latBucket = v.location.latitude.toFixed(3);
      const lngBucket = v.location.longitude.toFixed(3);
      const key = `${label.toLowerCase()}|${latBucket}|${lngBucket}`;
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
  }, [filteredVideos]);

  const selected = useMemo(
    () => (selectedKey ? places.find((p) => p.key === selectedKey) ?? null : null),
    [places, selectedKey],
  );

  // Feed/profile map buttons deep-link into this persistent tab. Once both
  // the map and its markers are ready, focus the exact pin and open its card.
  useEffect(() => {
    if (!mapReady || places.length === 0) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const targetToken = `${videoId ?? ''}|${lat}|${lng}`;
    if (handledTargetRef.current === targetToken) return;
    const place =
      places.find((candidate) => candidate.videos.some((video) => video.id === videoId)) ??
      places.reduce<Place | null>((best, candidate) => {
        if (!best) return candidate;
        const bestDistance = Math.hypot(best.latitude - lat, best.longitude - lng);
        const nextDistance = Math.hypot(candidate.latitude - lat, candidate.longitude - lng);
        return nextDistance < bestDistance ? candidate : best;
      }, null);
    if (!place) return;
    handledTargetRef.current = targetToken;
    setSelectedKey(place.key);
    setSheetOpen(true);
    mapRef.current?.animateToRegion?.(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      450,
    );
  }, [latitude, longitude, mapReady, places, videoId]);

  // Detect Maps SDK auth failure / blank-canvas state. If `onMapReady` never
  // fires within MAP_READY_TIMEOUT_MS, surface a banner so users aren't
  // staring at an unexplained blank screen.
  const center =
    locState.kind === 'granted'
      ? locState.coords
      : locState.kind === 'pending'
        ? null
        : FALLBACK;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!center || mapReady || mapTimedOut) return;
    timerRef.current = setTimeout(() => setMapTimedOut(true), MAP_READY_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [center, mapReady, mapTimedOut, mapKey]);

  function retryMap() {
    setMapReady(false);
    setMapTimedOut(false);
    setMapKey((k) => k + 1);
  }

  const recenterOnUser = useCallback(async () => {
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (locState.kind === 'granted') coords = locState.coords;
      else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocState({ kind: 'denied' });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocState({ kind: 'granted', coords });
      }
      if (!coords || !mapRef.current) return;
      // The clustering wrapper forwards `animateToRegion` to the underlying
      // MapView. Use a tighter delta than the initial region for a "zoom in
      // on me" feel that matches the screenshot reference.
      mapRef.current.animateToRegion(
        { ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        450,
      );
    } catch (err) {
      console.warn('[map] recenter failed:', err);
    }
  }, [locState]);

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

  const topInset = insets.top + 12;

  return (
    <View style={styles.flex}>
      {Platform.OS === 'android' ? (
        <AndroidOpenMap
          key={mapKey}
          ref={mapRef}
          style={styles.flex}
          initialRegion={initialRegion}
          onMapReady={() => setMapReady(true)}
        >
          {places.map((p) => (
            <AndroidOpenMarker
              key={p.key}
              id={p.key}
              label={String(p.videos.length)}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              anchor="center"
              onPress={() => {
                setSelectedKey(p.key);
                setSheetOpen(true);
              }}
            >
              <PlaceMarker place={p} />
            </AndroidOpenMarker>
          ))}
        </AndroidOpenMap>
      ) : (
        <ClusteredMapView
          key={mapKey}
          ref={mapRef}
          style={styles.flex}
          mapType={androidOpenMapType}
          showsUserLocation={locState.kind === 'granted'}
          showsMyLocationButton={false}
          showsCompass={false}
          userInterfaceStyle="dark"
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={initialRegion}
          clusterColor={colors.accent}
          clusterTextColor={colors.bg}
          radius={40}
          animationEnabled
          spiralEnabled={false}
          onMapReady={() => setMapReady(true)}
        >
          <OpenStreetMapTiles />
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
              accessibilityLabel={`${p.label}, ${p.videos.length} ${p.videos.length === 1 ? 'video' : 'videos'}`}
            >
              <PlaceMarker place={p} />
            </Marker>
          ))}
        </ClusteredMapView>
      )}

      {/* Floating top controls — filter (left) and recenter (right). Sit on
          top of the map and visually mirror the screenshot reference. */}
      <View style={[styles.topControls, { top: topInset }]} pointerEvents="box-none">
        <Pressable
          onPress={() => setCategoriesOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityLabel="Filter by category"
          hitSlop={6}
        >
          <Ionicons name="options-outline" size={20} color="#fff" />
          {selectedCategory ? <View style={styles.fabDot} /> : null}
        </Pressable>

        {selectedCategory ? (
          <Pressable
            onPress={() => setCategoriesOpen(true)}
            style={({ pressed }) => [styles.activeChip, pressed && styles.fabPressed]}
            accessibilityLabel={`Active category #${selectedCategory}, tap to change`}
          >
            <Text style={styles.activeChipText} numberOfLines={1}>
              {categories.find((category) => category.tag === selectedCategory)?.label ?? `#${selectedCategory}`}
            </Text>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              hitSlop={8}
              accessibilityLabel="Clear category filter"
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={recenterOnUser}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityLabel="Recenter on my location"
          hitSlop={6}
        >
          <Ionicons name="navigate" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Top-of-map status banners. Stacked so they never overlap. */}
      {mapTimedOut && !mapReady ? (
        <Banner
          tone="error"
          icon="alert-circle"
          message="Map couldn't load. Check your connection and tap to retry."
          onPress={retryMap}
          topInset={topInset + 64}
        />
      ) : null}

      {locState.kind === 'denied' && (!mapTimedOut || mapReady) ? (
        <Banner
          tone="info"
          icon="location-outline"
          message="Showing default area — enable location for nearby places."
          topInset={topInset + 64}
        />
      ) : null}

      {loadState.kind === 'error' && mapReady ? (
        <Banner
          tone="error"
          icon="cloud-offline"
          message={loadState.message}
          onPress={loadVideos}
          topInset={topInset + 64}
        />
      ) : null}

      {loadState.kind === 'ready' && mapReady && places.length === 0 ? (
        <View style={[styles.emptyBadge, { top: topInset + 64 }]}>
          <Text style={styles.emptyText}>
            {selectedCategory
              ? `No videos tagged #${selectedCategory} yet`
              : 'No tagged videos yet'}
          </Text>
        </View>
      ) : null}

      <PlaceCard
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placeName={selected?.label ?? null}
        videos={selected?.videos ?? []}
      />

      <MapCategoriesSheet
        visible={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
    </View>
  );
}

function Banner({
  tone,
  icon,
  message,
  onPress,
  topInset,
}: {
  tone: 'error' | 'info';
  icon: React.ComponentProps<typeof Ionicons>['name'];
  message: string;
  onPress?: () => void;
  topInset: number;
}) {
  const isError = tone === 'error';
  const Wrapper: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.banner,
        { top: topInset },
        isError ? styles.bannerError : styles.bannerInfo,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isError ? '#fff' : colors.text}
        style={styles.bannerIcon}
      />
      <Text style={[styles.bannerText, isError && styles.bannerTextError]} numberOfLines={2}>
        {message}
      </Text>
    </Wrapper>
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

const FAB_SIZE = 44;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabPressed: { opacity: 0.85 },
  fabDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderColor: colors.accentDim,
    borderWidth: 1.5,
  },
  activeChip: {
    height: FAB_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accent,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  activeChipText: { color: '#fff', fontWeight: '700', fontSize: 13, maxWidth: 140 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  bannerError: { backgroundColor: '#dc2626' },
  bannerInfo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerIcon: { marginRight: 4 },
  bannerText: { color: colors.text, fontSize: 13, flex: 1 },
  bannerTextError: { color: '#fff', fontWeight: '600' },
  emptyBadge: {
    position: 'absolute',
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
