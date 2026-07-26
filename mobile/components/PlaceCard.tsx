'use no memo';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';
import type { VideoDoc } from '@/lib/firestore';
import { countryFromLocation } from '@/lib/location-country';

export function placeSlug(label: string): string {
  return encodeURIComponent(label.trim().toLowerCase());
}

type Props = {
  visible: boolean;
  onClose: () => void;
  placeName: string | null;
  videos: VideoDoc[];
};

export function PlaceCard({ visible, onClose, placeName, videos }: Props) {
  const router = useRouter();
  const top = useMemo(() => videos.slice(0, 3), [videos]);

  function openPlaceFeed(startId?: string) {
    if (!placeName) return;
    const country = countryFromLocation(videos[0]?.location) ?? placeName;
    const slug = placeSlug(country);
    const params = new URLSearchParams({ label: country, scope: 'country' });
    if (startId) params.set('start', startId);
    onClose();
    // expo-router uses dynamic segments; pass label via query so the screen
    // can filter without a separate Firestore lookup of place metadata.
    router.push(`/place/${slug}?${params.toString()}` as never);
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['45%']}
      // gorhom v4's content-pan gesture swallows taps on the inner Pressables
      // (header / thumbnails), so disable it — drag-to-dismiss still works via
      // the handle and the backdrop.
      enableContentPanningGesture={false}
    >
      {/*
       * Gate the inner content on `visible` so the up-to-3 `useVideoPlayer`
       * instances in PlaceThumbnail don't run silently while the sheet is
       * dismissed. The same OOM pattern bit the feed previously.
       */}
      {visible ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={18} color={colors.bg} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {placeName ?? 'Place'}
              </Text>
              <Text style={styles.subtitle}>
                {videos.length} {videos.length === 1 ? 'video' : 'videos'}
              </Text>
            </View>
          </View>

          <View style={styles.thumbRow}>
            {top.length === 0 ? (
              <View style={styles.emptyThumbs}>
                <Text style={styles.emptyText}>No videos yet</Text>
              </View>
            ) : (
              top.map((v) => (
                <PlaceThumbnail
                  key={v.id}
                  video={v}
                  onPress={() => openPlaceFeed(v.id)}
                />
              ))
            )}
          </View>

          <Pressable
            onPress={() => openPlaceFeed()}
            disabled={videos.length === 0}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              videos.length === 0 && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.ctaText}>Open feed</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.bg} />
          </Pressable>
        </View>
      ) : null}
    </AppBottomSheet>
  );
}

function PlaceThumbnail({
  video,
  onPress,
}: {
  video: VideoDoc;
  onPress: () => void;
}) {
  const player = useVideoPlayer(video.downloadURL, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return (
    <Pressable onPress={onPress} style={styles.thumb}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
      />
      {video.caption ? (
        <View style={styles.thumbOverlay}>
          <Text numberOfLines={1} style={styles.thumbCaption}>
            {video.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerPressed: { opacity: 0.6 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    height: 140,
  },
  thumb: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  thumbCaption: { color: colors.text, fontSize: 11 },
  emptyThumbs: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textDim, fontSize: 13 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
});
