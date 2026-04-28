import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { commentsCol, follow, followingCol, savesCol, toggleSave, unfollow, type VideoDoc } from '@/lib/firestore';
import { CommentsSheet } from '@/components/CommentsSheet';
import { ShareToChatSheet } from '@/components/ShareToChatSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { colors } from '@/lib/theme';

const { width, height } = Dimensions.get('window');

export function FeedItem({
  item,
  active,
  onBlocked,
}: {
  item: VideoDoc;
  active: boolean;
  onBlocked?: (uid: string) => void;
}) {
  const me = auth().currentUser;
  const [commentCount, setCommentCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [saved, setSaved] = useState(false);

  const player = useVideoPlayer(item.downloadURL, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    return commentsCol(item.id).onSnapshot(
      (snap) => setCommentCount(snap.size),
      () => setCommentCount(0),
    );
  }, [item.id]);

  useEffect(() => {
    if (!me || me.uid === item.ownerId) return;
    return followingCol(me.uid)
      .doc(item.ownerId)
      .onSnapshot(
        (snap) => setFollowing(snap.exists),
        () => setFollowing(false),
      );
  }, [me, item.ownerId]);

  useEffect(() => {
    if (!me) return;
    return savesCol(me.uid)
      .doc(item.id)
      .onSnapshot(
        (snap) => setSaved(snap.exists),
        () => setSaved(false),
      );
  }, [me, item.id]);

  async function handleSave() {
    if (!me) return;
    await toggleSave(item.id);
  }

  async function toggleFollow() {
    if (!me || me.uid === item.ownerId) return;
    if (following) await unfollow(item.ownerId);
    else await follow(item.ownerId);
  }

  const isOwner = me?.uid === item.ownerId;

  return (
    <View style={styles.item}>
      <Pressable onPress={() => (player.playing ? player.pause() : player.play())} style={styles.fill}>
        <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
      </Pressable>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bottomLeft}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>
              {item.ownerEmail ?? item.ownerId.slice(0, 8)}
            </Text>
            {!isOwner && (
              <Pressable
                onPress={toggleFollow}
                hitSlop={6}
                style={[styles.followPill, following && styles.followingPill]}
              >
                <Text style={[styles.followText, following && styles.followingText]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}
          </View>
          {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setShowComments(true)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="chatbubble-outline" size={28} color={colors.text} />
            <Text style={styles.actionLabel}>{commentCount}</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={28}
              color={saved ? colors.accent : colors.text}
            />
            <Text style={styles.actionLabel}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowShare(true)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="paper-plane-outline" size={28} color={colors.text} />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          {!isOwner && (
            <Pressable
              onPress={() => setShowReport(true)}
              style={styles.actionButton}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={28} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      <CommentsSheet
        videoId={item.id}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />
      <ShareToChatSheet
        video={item}
        visible={showShare}
        onClose={() => setShowShare(false)}
      />
      <ReportSheet
        target={{ kind: 'video', videoId: item.id, ownerId: item.ownerId }}
        blockableUid={isOwner ? null : item.ownerId}
        visible={showReport}
        onClose={() => setShowReport(false)}
        onBlocked={() => onBlocked?.(item.ownerId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { width, height, backgroundColor: '#000' },
  fill: { ...StyleSheet.absoluteFillObject },
  video: { width, height },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 96,
    paddingHorizontal: 16,
  },
  bottomLeft: { flex: 1, gap: 6, marginRight: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { color: colors.text, fontSize: 14, fontWeight: '700' },
  followPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  followingPill: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
  followText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
  followingText: { color: colors.text },
  caption: { color: colors.text, fontSize: 13, opacity: 0.95 },
  actions: { gap: 18, alignItems: 'center' },
  actionButton: { alignItems: 'center', gap: 4 },
  actionLabel: { color: colors.text, fontSize: 11, fontWeight: '600' },
});
