import { useEffect, useMemo, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors } from '@/lib/theme';
import { ROUTES_CREATE_ENABLED } from '@/lib/features';
import { getMyVideos, type VideoDoc } from '@/lib/firestore';

const MAX_STOPS = 10;

const { width } = Dimensions.get('window');
const COL_GAP = 2;
const COLS = 3;
const TILE_W = Math.floor((width - COL_GAP * (COLS - 1)) / COLS);
const TILE_H = Math.floor(TILE_W * 1.4);

type Step = 'name' | 'videos';

function stopLabel(v: VideoDoc): string {
  return (v.caption || v.location?.label || 'Untitled stop').trim() || 'Untitled stop';
}

/**
 * Trip builder wizard.
 *   Step 0 ('name')   — enter the trip title (saved as the trip name).
 *   Step 1 ('videos') — pick up to MAX_STOPS of your own geotagged videos;
 *                       tap order = stop number, with explicit reorder arrows.
 * The route's stops inherit each video's location and caption.
 */
export default function CreateTrip() {
  const me = auth().currentUser;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ROUTES_CREATE_ENABLED) router.replace('/(tabs)/profile' as never);
  }, [router]);

  useEffect(() => {
    if (!me) return;
    getMyVideos(me.uid)
      .then((list) =>
        setVideos(
          list.filter((v) => v.location?.latitude != null && v.location?.longitude != null),
        ),
      )
      .catch((err) => {
        console.warn('[create-trip] getMyVideos failed:', err);
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, [me]);

  const selectedVideos = useMemo(
    () =>
      selectedIds
        .map((id) => videos.find((v) => v.id === id))
        .filter((v): v is VideoDoc => Boolean(v)),
    [selectedIds, videos],
  );

  function toggle(video: VideoDoc) {
    setSelectedIds((prev) => {
      if (prev.includes(video.id)) return prev.filter((id) => id !== video.id);
      if (prev.length >= MAX_STOPS) {
        Alert.alert('Limit reached', `A route can have up to ${MAX_STOPS} videos.`);
        return prev;
      }
      return [...prev, video.id];
    });
  }

  function move(index: number, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    if (!me) return;
    if (selectedVideos.length === 0) {
      Alert.alert('Pick videos', 'Select at least one video for your route.');
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
          stops: selectedVideos.map((v) => ({
            latitude: v.location!.latitude,
            longitude: v.location!.longitude,
            description: stopLabel(v),
            imageUrl: null,
            videoId: v.id,
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
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
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
          <Text style={styles.nameSub}>
            Next you&apos;ll pick up to {MAX_STOPS} of your videos as stops.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Japan"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.nameInput]}
            autoFocus
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && setStep('videos')}
          />
          <Pressable
            onPress={() => name.trim() && setStep('videos')}
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

  // ---- Step 1: pick and order videos -------------------------------------
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => setStep('name')} hitSlop={8} style={styles.iconBtnPlain}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.stepTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.iconBtnPlain} />
      </View>

      <Text style={styles.pickHint}>
        Tap videos in the order of your route · {selectedIds.length}/{MAX_STOPS}
      </Text>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="videocam-outline" size={32} color={colors.textFaint} />
          <Text style={styles.emptyText}>
            No videos with a location yet. Upload a video and tag where it was taken first.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {videos.map((v) => (
            <PickTile
              key={v.id}
              video={v}
              order={selectedIds.indexOf(v.id)}
              onPress={() => toggle(v)}
            />
          ))}
        </ScrollView>
      )}

      {/* Bottom panel: ordered stop list + save */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + 14 }]}>
        {selectedVideos.length > 0 ? (
          <ScrollView style={styles.orderList} bounces={false}>
            {selectedVideos.map((v, i) => (
              <View key={v.id} style={styles.orderRow}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.orderLabel} numberOfLines={1}>
                  {stopLabel(v)}
                </Text>
                <Pressable
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={6}
                  style={[styles.orderBtn, i === 0 && styles.orderBtnDisabled]}
                  accessibilityLabel={`Move stop ${i + 1} up`}
                >
                  <Ionicons name="chevron-up" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => move(i, 1)}
                  disabled={i === selectedVideos.length - 1}
                  hitSlop={6}
                  style={[
                    styles.orderBtn,
                    i === selectedVideos.length - 1 && styles.orderBtnDisabled,
                  ]}
                  accessibilityLabel={`Move stop ${i + 1} down`}
                >
                  <Ionicons name="chevron-down" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => toggle(v)}
                  hitSlop={6}
                  style={styles.orderBtn}
                  accessibilityLabel={`Remove ${stopLabel(v)}`}
                >
                  <Ionicons name="close" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <Pressable
          onPress={save}
          disabled={saving || selectedVideos.length === 0}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || pressed || selectedVideos.length === 0) && styles.saveBtnDim,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>
              Save route{selectedVideos.length > 0 ? ` (${selectedVideos.length} stops)` : ''}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function PickTile({
  video,
  order,
  onPress,
}: {
  video: VideoDoc;
  /** Index in the selection (0-based), or -1 when not selected. */
  order: number;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const selected = order >= 0;
  const player = useVideoPlayer(video.downloadURL, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) setFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  if (failed) return null;

  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <VideoView
        player={player}
        style={styles.tileVideo}
        contentFit="cover"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
      />
      {selected ? <View style={styles.tileSelectedOverlay} /> : null}
      <View style={styles.tileOverlay}>
        <Text numberOfLines={2} style={styles.tileCaption}>
          {stopLabel(video)}
        </Text>
      </View>
      <View style={[styles.selectBadge, selected && styles.selectBadgeOn]}>
        {selected ? <Text style={styles.selectBadgeText}>{order + 1}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  iconBtnPlain: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  pickHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { color: colors.textDim, fontSize: 13, textAlign: 'center' },

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
  nameInput: { width: '100%', textAlign: 'center', fontSize: 16, paddingVertical: 14 },
  nameContinue: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 12 },

  // Video grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
    paddingBottom: 12,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileVideo: { ...StyleSheet.absoluteFillObject },
  tileSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(56,189,248,0.25)',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tileCaption: { color: colors.text, fontSize: 11, fontWeight: '600' },
  selectBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeOn: { backgroundColor: colors.accent },
  selectBadgeText: { color: colors.bg, fontSize: 12, fontWeight: '800' },

  // Bottom panel
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  orderList: { maxHeight: 200 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  orderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: { color: colors.bg, fontSize: 11, fontWeight: '800' },
  orderLabel: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  orderBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnDisabled: { opacity: 0.3 },
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
