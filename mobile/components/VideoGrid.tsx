import { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { VideoDoc } from '@/lib/firestore';
import { colors } from '@/lib/theme';

const { width } = Dimensions.get('window');
const COL_GAP = 2;
const COLS = 3;
const TILE_W = Math.floor((width - COL_GAP * (COLS - 1)) / COLS);
const TILE_H = Math.floor(TILE_W * 1.4);

export function VideoGrid({
  videos,
  emptyLabel,
  onPress,
  onLongPress,
}: {
  videos: VideoDoc[];
  emptyLabel: string;
  onPress?: (video: VideoDoc) => void;
  onLongPress?: (video: VideoDoc) => void;
}) {
  if (videos.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="videocam-outline" size={32} color={colors.textFaint} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {videos.map((v) => (
        <GridTile
          key={v.id}
          video={v}
          onPress={() => onPress?.(v)}
          onLongPress={onLongPress ? () => onLongPress(v) : undefined}
        />
      ))}
    </View>
  );
}

function GridTile({
  video,
  onPress,
  onLongPress,
}: {
  video: VideoDoc;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const label = video.location?.label || video.caption || 'Video';
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
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.tile}>
      <VideoView
        player={player}
        style={styles.tileVideo}
        contentFit="cover"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
      />
      <View style={styles.tileOverlay}>
        <Text numberOfLines={2} style={styles.tileCaption}>
          {label}
        </Text>
        {video.location?.label ? (
          <View style={styles.tileMeta}>
            <Ionicons name="location" size={10} color={colors.textDim} />
            <Text numberOfLines={1} style={styles.tileMetaText}>
              {video.location.label}
            </Text>
          </View>
        ) : null}
      </View>
      {video.downloadURL ? (
        <View style={styles.playBadge}>
          <Ionicons name="videocam" size={12} color={colors.bg} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
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
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  tileMetaText: { color: colors.textDim, fontSize: 10, flex: 1 },
  playBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { color: colors.textDim, fontSize: 13 },
});
