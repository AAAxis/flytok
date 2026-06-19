import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { updateTripStops, type Trip, type TripStop } from '@/lib/firestore';
import { colors } from '@/lib/theme';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';

// Warm gold for route points — matches the selected-pin gold on the profile
// map so a "route" reads as the gold thread through its stops.
const GOLD = '#fbbf24';
const GOLD_LINE = 'rgba(251,191,36,0.9)';
const MAP_HEIGHT = 340;

/**
 * Inline map of one trip's stops, rendered expanded under its route row.
 *
 * Stops are gold numbered points joined by a gold polyline. Tapping a point
 * enlarges it and floats a description card (photo + text) over the map,
 * mirroring the place card on the profile map. Tapping empty map dismisses it.
 */
export function TripRouteMap({ trip }: { trip: Trip }) {
  const [selected, setSelected] = useState<number | null>(null);
  // Local editable copy so description edits show instantly and survive while
  // the screen is mounted; persisted to Firestore on save.
  const [stops, setStops] = useState<TripStop[]>(trip.stops ?? []);
  const canEdit = (auth().currentUser?.uid ?? null) != null;

  useEffect(() => {
    setStops(trip.stops ?? []);
    setSelected(null);
    // DIAGNOSTIC: log persisted image URLs so we can see what's actually stored.
    console.log(
      '[trip] open',
      trip.id,
      (trip.stops ?? []).map((s, i) => `#${i + 1}:${s.imageUrl ?? 'NULL'}`),
    );
  }, [trip.id, trip.stops]);

  async function saveStop(index: number, patch: Partial<TripStop>) {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const next = stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setStops(next); // optimistic
    await updateTripStops(uid, trip.id, next);
  }

  // Custom-view markers can paint blank on iOS if tracking is off from the
  // first frame. Track briefly on mount, then freeze to keep the map cheap.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 800);
    return () => clearTimeout(t);
  }, [trip.id]);

  const initialRegion = useMemo<Region | null>(() => {
    if (stops.length === 0) return null;
    if (stops.length === 1) {
      return {
        latitude: stops[0].latitude,
        longitude: stops[0].longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const s of stops) {
      if (s.latitude < minLat) minLat = s.latitude;
      if (s.latitude > maxLat) maxLat = s.latitude;
      if (s.longitude < minLng) minLng = s.longitude;
      if (s.longitude > maxLng) maxLng = s.longitude;
    }
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.5),
    };
  }, [stops]);

  const mapRef = useRef<MapView>(null);

  function fitStops() {
    if (stops.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(stops, {
        edgePadding: { top: 50, right: 40, bottom: 120, left: 40 },
        animated: false,
      });
    }
  }

  if (stops.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="map-outline" size={22} color={colors.textMuted} />
        <Text style={styles.emptyText}>This trip has no stops yet.</Text>
      </View>
    );
  }

  const active = selected != null ? stops[selected] ?? null : null;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        userInterfaceStyle="dark"
        initialRegion={initialRegion ?? undefined}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={fitStops}
        // A marker tap also fires the map's onPress on some platforms; ignore
        // that case so it doesn't immediately clear the stop we just selected.
        onPress={(e) => {
          if (e.nativeEvent.action === 'marker-press') return;
          setSelected(null);
        }}
      >
        {stops.length > 1 ? (
          <Polyline coordinates={stops} strokeColor={GOLD_LINE} strokeWidth={3} />
        ) : null}
        {stops.map((s, i) => {
          const isSelected = i === selected;
          return (
            <Marker
              // Encode selection into the key so the custom view repaints
              // (markers don't track view changes after first paint).
              key={`${i}:${isSelected ? 'sel' : 'def'}`}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={isSelected ? 999 : 1}
              tracksViewChanges={tracking}
              onPress={() => setSelected(i)}
              accessibilityLabel={`Stop ${i + 1}`}
            >
              <StopPin index={i + 1} selected={isSelected} />
            </Marker>
          );
        })}
      </MapView>

      {active ? (
        <StopCard
          // Remount on stop change so edit state resets per stop.
          key={selected}
          index={selected! + 1}
          total={stops.length}
          stop={active}
          editable={canEdit}
          onSave={(patch) => saveStop(selected!, patch)}
        />
      ) : null}
    </View>
  );
}

function StopPin({ index, selected }: { index: number; selected: boolean }) {
  const size = selected ? 36 : 28;
  return (
    <View style={pinStyles.wrap}>
      <View style={[pinStyles.head, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[pinStyles.num, selected && pinStyles.numSelected]}>{index}</Text>
      </View>
      <View style={[pinStyles.tip, selected && pinStyles.tipSelected]} />
    </View>
  );
}

function StopCard({
  index,
  total,
  stop,
  editable,
  onSave,
}: {
  index: number;
  total: number;
  stop: TripStop;
  editable: boolean;
  onSave: (patch: Partial<TripStop>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const description = stop.description?.trim() || 'No description for this stop.';

  return (
    <>
      <View style={[styles.cardWrap, styles.cardWrapBottom]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.thumb}>
            {stop.imageUrl ? (
              <Image
                source={{ uri: stop.imageUrl }}
                style={StyleSheet.absoluteFill}
                onError={(e) =>
                  console.log('[trip] stop image failed', stop.imageUrl, e.nativeEvent?.error)
                }
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.thumbEmpty]}>
                <Ionicons name="location-sharp" size={22} color={GOLD} />
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Stop {index} of {total}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={3}>
              {description}
            </Text>
          </View>

          {editable ? (
            <Pressable
              onPress={() => setEditing(true)}
              hitSlop={10}
              style={styles.close}
              accessibilityLabel="Edit this stop"
            >
              <Ionicons name="pencil" size={15} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {editing ? (
        <StopEditor
          index={index}
          stop={stop}
          onSave={onSave}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Bottom-sheet editor for a stop. Slides up from the bottom and rises above
 * the keyboard, so the inputs stay reachable. Picked photos are downscaled and
 * compressed before upload — full-res camera shots are multi-MB and slow.
 */
function StopEditor({
  index,
  stop,
  onSave,
  onClose,
}: {
  index: number;
  stop: TripStop;
  onSave: (patch: Partial<TripStop>) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(stop.description ?? '');
  const [draftImage, setDraftImage] = useState<string | null>(stop.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickImage() {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      // Downscale to 1080px wide + JPEG 0.6 so uploads are small and fast.
      const shrunk = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      const path = `trip_images/${uid}/${Date.now()}.jpg`;
      const ref = storage().ref(path);
      await ref.putFile(shrunk.uri, { contentType: 'image/jpeg' });
      setDraftImage(await ref.getDownloadURL());
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try a different image.');
    } finally {
      setUploading(false);
    }
  }

  async function commit() {
    setSaving(true);
    try {
      await onSave({ description: draft.trim(), imageUrl: draftImage });
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Edit stop {index}</Text>

            <View style={styles.sheetRow}>
              <Pressable style={styles.sheetThumb} onPress={pickImage} disabled={uploading}>
                {draftImage ? (
                  <Image source={{ uri: draftImage }} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.thumbEmpty]}>
                    <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.sheetThumbOverlay}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={14} color="#fff" />
                      <Text style={styles.sheetThumbText}>
                        {draftImage ? 'Change' : 'Add'}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Describe this stop…"
                placeholderTextColor={colors.textFaint}
                style={styles.sheetInput}
                multiline
                autoFocus
                maxLength={300}
              />
            </View>

            <View style={styles.editRow}>
              <Pressable onPress={onClose} hitSlop={6} style={styles.editBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={commit}
                disabled={saving || uploading}
                hitSlop={6}
                style={[styles.editBtn, styles.saveBtn, (saving || uploading) && styles.saveBtnDim]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Sits flush under the route row — square top, rounded bottom corners.
  wrap: {
    height: MAP_HEIGHT,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    marginTop: -1,
  },
  empty: {
    backgroundColor: '#103a5e',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: -1,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },

  cardWrap: { position: 'absolute', left: 10, right: 10 },
  cardWrapBottom: { bottom: 10 },
  cardWrapTop: { top: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbOverlay: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMainPressed: { opacity: 0.6 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  marketingHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  marketingHintText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  input: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 52,
    textAlignVertical: 'top',
    marginTop: 2,
  },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  editBtn: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: GOLD },
  saveBtnDim: { opacity: 0.6 },
  saveText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  close: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },

  // Bottom-sheet editor — slides up from the screen bottom, above the keyboard.
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderAlt,
    alignSelf: 'center',
    marginBottom: 2,
  },
  sheetTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sheetRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  sheetThumb: {
    width: 104,
    height: 132,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  sheetThumbOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetThumbText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sheetInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 132,
    textAlignVertical: 'top',
  },
});

const pinStyles = StyleSheet.create({
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
    backgroundColor: GOLD,
    borderColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  num: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  numSelected: { fontSize: 15 },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: GOLD,
    marginTop: -3,
  },
  tipSelected: { borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 12 },
});
