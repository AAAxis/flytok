import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import { colors } from '@/lib/theme';
import { DARK_MAP_STYLE } from '@/lib/mapStyle';
import { ROUTES_CREATE_ENABLED } from '@/lib/features';
import { OpenStreetMapTiles, androidOpenMapType } from '@/components/OpenStreetMapTiles';
import { AndroidOpenMap, AndroidOpenMarker, AndroidOpenPolyline } from '@/components/AndroidOpenMap';

const INITIAL_REGION = {
  latitude: 31.5,
  longitude: 34.8,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

type Stop = { latitude: number; longitude: number; description: string; imageUrl?: string };
type Step = 'name' | 'map';

/**
 * Trip builder wizard.
 *   Step 0 ('name') — enter the shared trip title (saved as the trip name).
 *   Step 1 ('map')  — tap the map to drop stops, each with its own description.
 * Back always returns to the previous step (map → name → leave screen).
 */
export default function CreateTrip() {
  const me = auth().currentUser;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const current = stops[selected];

  useEffect(() => {
    if (!ROUTES_CREATE_ENABLED) router.replace('/(tabs)/profile' as never);
  }, [router]);

  async function pickStopImage() {
    if (!me) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const idx = selected;
    setUploadingImg(true);
    try {
      const path = `trip_images/${me.uid}/${Date.now()}.jpg`;
      const ref = storage().ref(path);
      await ref.putFile(res.assets[0].uri, { contentType: 'image/jpeg' });
      const url = await ref.getDownloadURL();
      setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, imageUrl: url } : s)));
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try a different image.');
    } finally {
      setUploadingImg(false);
    }
  }

  function removeStopImage() {
    setStops((prev) => prev.map((s, i) => (i === selected ? { ...s, imageUrl: undefined } : s)));
  }

  function addStop(coord: LatLng) {
    setStops((prev) => {
      const next = [...prev, { latitude: coord.latitude, longitude: coord.longitude, description: '' }];
      setSelected(next.length - 1);
      return next;
    });
  }

  function setCurrentDescription(text: string) {
    setStops((prev) => prev.map((s, i) => (i === selected ? { ...s, description: text } : s)));
  }

  function removeCurrent() {
    setStops((prev) => prev.filter((_, i) => i !== selected));
    setSelected((i) => Math.max(0, i - 1));
  }

  async function save() {
    if (!me) return;
    if (stops.length < 1) {
      Alert.alert('Add stops', 'Tap the map to add at least one stop.');
      return;
    }
    setSaving(true);
    try {
      await firestore()
        .collection('users')
        .doc(me.uid)
        .collection('trips')
        .add({
          name: name.trim(),
          stops: stops.map((s) => ({
            latitude: s.latitude,
            longitude: s.longitude,
            description: s.description.trim(),
            imageUrl: s.imageUrl ?? null,
          })),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      router.back();
    } catch (err: any) {
      Alert.alert('Could not save trip', err?.message ?? 'Try again later.');
    } finally {
      setSaving(false);
    }
  }

  // ---- Step 0: name the trip ---------------------------------------------
  if (step === 'name') {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.topBar, { paddingTop: insets.top + 8, position: 'relative' }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtnPlain}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.stepTitle}>New trip</Text>
          <View style={styles.iconBtnPlain} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.nameWrap}
        >
          <View style={styles.nameIcon}>
            <Ionicons name="map" size={28} color={colors.accent} />
          </View>
          <Text style={styles.nameHeading}>Name your trip</Text>
          <Text style={styles.nameSub}>You&apos;ll add stops on the map in the next step.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Dolomites loop"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.nameInput]}
            autoFocus
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && setStep('map')}
          />
          <Pressable
            onPress={() => name.trim() && setStep('map')}
            disabled={!name.trim()}
            style={[styles.saveBtn, styles.nameContinue, !name.trim() && styles.saveBtnDim]}
          >
            <Text style={styles.saveText}>Continue</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ---- Step 1: drop stops on the map -------------------------------------
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {Platform.OS === 'android' ? (
        <AndroidOpenMap
          style={StyleSheet.absoluteFill}
          initialRegion={INITIAL_REGION}
          onPress={(e: any) => {
            const lngLat = e?.nativeEvent?.lngLat;
            if (!lngLat) return;
            addStop({ longitude: lngLat[0], latitude: lngLat[1] });
          }}
        >
          <AndroidOpenPolyline
            id="create-trip"
            coordinates={stops}
            strokeColor={colors.accent}
            strokeWidth={3}
          />
          {stops.map((s, i) => (
            <AndroidOpenMarker
              key={`${s.latitude}-${s.longitude}-${i}`}
              id={`stop-${i}`}
              coordinate={s}
              anchor="center"
              onPress={() => setSelected(i)}
            >
              <View style={[styles.pin, i === selected && styles.pinSelected]}>
                <Text style={styles.pinText}>{i + 1}</Text>
              </View>
            </AndroidOpenMarker>
          ))}
        </AndroidOpenMap>
      ) : (
        <MapView
          style={StyleSheet.absoluteFill}
          mapType={androidOpenMapType}
          customMapStyle={DARK_MAP_STYLE}
          userInterfaceStyle="dark"
          initialRegion={INITIAL_REGION}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={(e) => addStop(e.nativeEvent.coordinate)}
        >
          <OpenStreetMapTiles />
          {stops.length > 1 ? (
            <Polyline coordinates={stops} strokeColor={colors.accent} strokeWidth={3} />
          ) : null}
          {stops.map((s, i) => (
            <Marker
              key={`${s.latitude}-${s.longitude}-${i}`}
              coordinate={s}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => setSelected(i)}
            >
              <View style={[styles.pin, i === selected && styles.pinSelected]}>
                <Text style={styles.pinText}>{i + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Top bar — back returns to the name step */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => setStep('name')} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.hintPill} pointerEvents="none">
          <Ionicons name="pricetag" size={12} color={colors.accent} />
          <Text style={styles.hintText} numberOfLines={1}>{name}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      {/* Bottom editor */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomWrap}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.grabber} />

          {stops.length === 0 ? (
            <Text style={styles.emptyHint}>Tap anywhere on the map to drop your first stop.</Text>
          ) : (
            <>
              <View style={styles.stepRow}>
                <Pressable
                  onPress={() => setSelected((i) => Math.max(0, i - 1))}
                  disabled={selected === 0}
                  hitSlop={8}
                  style={[styles.stepBtn, selected === 0 && styles.stepBtnDisabled]}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                  <Text style={styles.stepBtnText}>Back</Text>
                </Pressable>
                <Text style={styles.stepCount}>
                  Stop {selected + 1} of {stops.length}
                </Text>
                <Pressable
                  onPress={() => setSelected((i) => Math.min(stops.length - 1, i + 1))}
                  disabled={selected >= stops.length - 1}
                  hitSlop={8}
                  style={[styles.stepBtn, selected >= stops.length - 1 && styles.stepBtnDisabled]}
                >
                  <Text style={styles.stepBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </Pressable>
              </View>

              {/* ChatGPT-style composer: + attach inside the description box */}
              <View style={styles.composer}>
                {current?.imageUrl ? (
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: current.imageUrl }} style={styles.thumb} />
                    <Pressable onPress={removeStopImage} hitSlop={6} style={styles.thumbX}>
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
                <TextInput
                  value={current?.description ?? ''}
                  onChangeText={setCurrentDescription}
                  placeholder={`Describe stop ${selected + 1}…`}
                  placeholderTextColor={colors.textFaint}
                  style={styles.composerInput}
                  multiline
                  maxLength={300}
                />
                <View style={styles.composerBar}>
                  <Pressable onPress={pickStopImage} disabled={uploadingImg} style={styles.plusBtn} hitSlop={6}>
                    {uploadingImg ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Ionicons name="add" size={20} color={colors.text} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={removeCurrent} hitSlop={6} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.removeText}>Remove this stop</Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={save}
            disabled={saving || stops.length === 0}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || pressed || stops.length === 0) && styles.saveBtnDim,
            ]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save trip</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlain: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 40, height: 40 },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Name step
  nameWrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 10 },
  nameIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nameHeading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  nameSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  nameInput: { width: '100%', textAlign: 'center', fontSize: 16, paddingVertical: 14 },
  nameContinue: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 12 },

  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#fff',
    borderWidth: 2,
  },
  pinSelected: { backgroundColor: colors.accent, transform: [{ scale: 1.2 }] },
  pinText: { color: colors.bg, fontSize: 12, fontWeight: '800' },

  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderAlt,
    alignSelf: 'center',
    marginBottom: 2,
  },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  descInput: { minHeight: 60, textAlignVertical: 'top' },
  emptyHint: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stepBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 4 },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  stepCount: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  composer: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  composerInput: {
    color: colors.text,
    fontSize: 14,
    minHeight: 44,
    textAlignVertical: 'top',
    paddingHorizontal: 4,
  },
  composerBar: { flexDirection: 'row', alignItems: 'center' },
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: { alignSelf: 'flex-start', position: 'relative' },
  thumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  saveBtnDim: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
