/* eslint-disable react-compiler/react-compiler */
'use no memo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import {
  formatDuration,
  loadTracks,
  uploadUserAudio,
  type AudioSelection,
  type Track,
} from '@/lib/audio';
import type { UploadPhase } from '@/lib/uploadProgress';
import { colors } from '@/lib/theme';

type Tab = 'library' | 'device';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Current selection — used to render the checkmark and tab default. */
  selected?: AudioSelection;
  /** Confirm a new selection. The sheet stays open until the user taps Done. */
  onSelect: (selection: AudioSelection) => void;
};

/**
 * Two-tab audio picker. Library tab streams curated tracks from `tracks/*`
 * with tap-to-preview / long-press-to-pick. Device tab triggers
 * `expo-document-picker` (audio/*) and uploads to
 * `audio_user/{uid}/{ts}.{ext}` with byte-progress feedback.
 *
 * The sheet is built on the W1 `<AppBottomSheet>` primitive.
 */
export function MusicPickerSheet({ visible, onClose, selected, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Live-reset preview state when the sheet closes so reopening starts clean.
  useEffect(() => {
    if (!visible) {
      stopPreview();
      setUploadPhase('idle');
      setUploadPct(0);
    }
  }, [visible]);

  // Load tracks lazily on first open. Cache for the rest of the session.
  useEffect(() => {
    if (!visible || tracks !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    loadTracks()
      .then((rows) => {
        if (!cancelled) setTracks(rows);
      })
      .catch((err) => {
        if (!cancelled) Alert.alert('Could not load music', err?.message ?? 'Try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, tracks, loading]);

  // Tear down the audio player when the component unmounts.
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.remove?.();
      } catch {
        // best-effort
      }
      playerRef.current = null;
    };
  }, []);

  function stopPreview() {
    try {
      playerRef.current?.pause?.();
      playerRef.current?.remove?.();
    } catch {
      // ignored — happens if player was never created
    }
    playerRef.current = null;
    setPreviewing(null);
  }

  function togglePreview(track: Track) {
    if (!track.downloadURL) {
      Alert.alert('Track unavailable', 'This track has no playable file yet.');
      return;
    }
    if (previewing === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    try {
      const player = createAudioPlayer({ uri: track.downloadURL });
      player.loop = true;
      player.play();
      playerRef.current = player;
      setPreviewing(track.id);
    } catch (err: any) {
      Alert.alert('Preview failed', err?.message ?? 'Could not play this track.');
    }
  }

  function pickLibraryTrack(track: Track) {
    stopPreview();
    onSelect({ source: 'library', track });
  }

  async function pickFromDevice() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const ext = (asset.name?.split('.').pop() ?? '').toLowerCase();
      stopPreview();
      setUploadPhase('audio');
      setUploadPct(0);
      const result = await uploadUserAudio(asset.uri, {
        contentType: asset.mimeType,
        sizeBytes: asset.size,
        ext,
        onProgress: ({ percent }) => {
          setUploadPct(percent);
        },
      });
      setUploadPhase('idle');
      setUploadPct(0);
      onSelect({
        source: 'user_upload',
        storagePath: result.storagePath,
        downloadURL: result.downloadURL,
        title: asset.name ?? 'My audio',
      });
    } catch (err: any) {
      setUploadPhase('idle');
      setUploadPct(0);
      Alert.alert('Audio upload failed', err?.message ?? 'Try a different file.');
    }
  }

  function clearSelection() {
    stopPreview();
    onSelect({ source: 'original' });
  }

  const renderTrack = useCallback(
    ({ item }: { item: Track }) => {
      const isPreviewing = previewing === item.id;
      const isSelected = selected?.source === 'library' && selected.track.id === item.id;
      return (
        <Pressable
          onPress={() => togglePreview(item)}
          onLongPress={() => pickLibraryTrack(item)}
          delayLongPress={250}
          style={({ pressed }) => [styles.trackRow, pressed && styles.rowPressed]}
        >
          <View style={[styles.thumb, isSelected && styles.thumbSelected]}>
            <Ionicons
              name={isPreviewing ? 'pause' : 'musical-notes'}
              size={18}
              color={isSelected ? colors.bg : colors.text}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackMeta} numberOfLines={1}>
              {item.artist} · {formatDuration(item.durationSec)}
              {item.category ? ` · ${item.category}` : ''}
            </Text>
          </View>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
          ) : (
            <Pressable onPress={() => pickLibraryTrack(item)} hitSlop={8} style={styles.useBtn}>
              <Text style={styles.useBtnText}>Use</Text>
            </Pressable>
          )}
        </Pressable>
      );
    },
    [previewing, selected],
  );

  const headerHelper = useMemo(() => {
    if (tab === 'library') return 'Tap to preview · long-press or tap Use to pick.';
    return 'Pick any audio file from your device. Max 15 MB.';
  }, [tab]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} snapPoints={['85%']}>
      <BottomSheetView style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Music</Text>
            <Text style={styles.helper}>{headerHelper}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          <TabPill label="Library" active={tab === 'library'} onPress={() => setTab('library')} />
          <TabPill label="From device" active={tab === 'device'} onPress={() => setTab('device')} />
        </View>

        {selected?.source !== 'original' ? (
          <View style={styles.selectedBar}>
            <Ionicons name="musical-note" size={14} color={colors.accent} />
            <Text style={styles.selectedText} numberOfLines={1}>
              {selected?.source === 'library'
                ? `${selected.track.title} · ${selected.track.artist}`
                : selected?.source === 'user_upload'
                  ? selected.title
                  : ''}
            </Text>
            <Pressable onPress={clearSelection} hitSlop={8}>
              <Text style={styles.clearText}>Remove</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'library' ? (
          loading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.placeholderText}>Loading tracks…</Text>
            </View>
          ) : !tracks?.length ? (
            <View style={styles.placeholder}>
              <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
              <Text style={styles.placeholderText}>
                No tracks yet. Run scripts/seed-tracks.mjs to seed the library.
              </Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={tracks}
              keyExtractor={(t) => t.id}
              renderItem={renderTrack}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
            />
          )
        ) : (
          <View style={styles.deviceTab}>
            <Pressable
              onPress={pickFromDevice}
              disabled={uploadPhase !== 'idle'}
              style={({ pressed }) => [
                styles.devicePickBtn,
                uploadPhase !== 'idle' && styles.disabled,
                pressed && styles.rowPressed,
              ]}
            >
              {uploadPhase === 'audio' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={24} color={colors.text} />
              )}
              <Text style={styles.devicePickText}>
                {uploadPhase === 'audio' ? 'Uploading…' : 'Choose audio file'}
              </Text>
              <Text style={styles.deviceSubtext}>mp3 · m4a · wav · ≤ 15 MB</Text>
            </Pressable>
            {uploadPhase === 'audio' ? (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(uploadPct * 100)}%` }]}
                  />
                </View>
                <Text style={styles.progressPct}>{Math.round(uploadPct * 100)}%</Text>
              </View>
            ) : null}
            {selected?.source === 'user_upload' ? (
              <Text style={styles.deviceConfirm}>
                Picked: {selected.title}
              </Text>
            ) : null}
          </View>
        )}

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.donePressed]}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </BottomSheetView>
    </AppBottomSheet>
  );
}

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        active && styles.tabPillActive,
        pressed && !active && styles.rowPressed,
      ]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  helper: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  tabPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.bg },
  selectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  selectedText: { color: colors.text, fontSize: 13, flex: 1 },
  clearText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  list: { paddingTop: 12, paddingBottom: 40 },
  sep: { height: 8 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  rowPressed: { opacity: 0.85 },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbSelected: { backgroundColor: colors.accent },
  trackTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  trackMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  useBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
  },
  useBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  placeholder: { alignItems: 'center', gap: 8, padding: 32 },
  placeholderText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  deviceTab: { paddingTop: 16, gap: 16 },
  devicePickBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  devicePickText: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 4 },
  deviceSubtext: { color: colors.textMuted, fontSize: 11 },
  deviceConfirm: { color: colors.accent, fontSize: 13, fontWeight: '500' },
  disabled: { opacity: 0.5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  progressPct: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  donePressed: { backgroundColor: colors.accentDim },
  doneText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
});
