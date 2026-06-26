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
  const player = useVideoPlayer(video.downloadURL, (p) => {
    p.muted = true;
    p.loop = false;
  });

  // Hide tiles whose source 404s / is corrupt — otherwise they render as a
  // black square with a broken-play glyph in the middle of the grid.
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
      {video.caption ? (
        <View style={styles.tileOverlay}>
          <Text numberOfLines={1} style={styles.tileCaption}>
            {video.caption}
          </Text>
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
  },
  tileVideo: { ...StyleSheet.absoluteFillObject },
  tileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tileCaption: { color: colors.text, fontSize: 11 },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { color: colors.textDim, fontSize: 13 },
});
