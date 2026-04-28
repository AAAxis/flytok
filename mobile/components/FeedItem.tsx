import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { Alert, Dimensions, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { commentsCol, deleteOwnVideo, follow, followingCol, likesCol, savesCol, toggleLike, toggleSave, unfollow, type VideoDoc } from '@/lib/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useCachedVideoUri } from '@/lib/videoCache';
import { CommentsSheet } from '@/components/CommentsSheet';
import { ShareToChatSheet } from '@/components/ShareToChatSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { EditCaptionSheet } from '@/components/EditCaptionSheet';
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
  const [showEdit, setShowEdit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);

  const cachedUri = useCachedVideoUri(item.downloadURL);
  const player = useVideoPlayer(cachedUri ?? item.downloadURL, (p) => {
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

  useEffect(() => {
    if (!me) return;
    return likesCol(item.id)
      .doc(me.uid)
      .onSnapshot(
        (snap) => setLiked(snap.exists),
        () => setLiked(false),
      );
  }, [me, item.id]);

  async function handleSave() {
    if (!me) return;
    await toggleSave(item.id);
  }

  async function handleLike() {
    if (!me) return;
    // optimistic
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await toggleLike(item.id);
    } catch {
      // revert on failure
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }

  async function toggleFollow() {
    if (!me || me.uid === item.ownerId) return;
    if (following) await unfollow(item.ownerId);
    else await follow(item.ownerId);
  }

  const { isAdmin } = useAuth();
  const isOwner = me?.uid === item.ownerId;
  const canManage = isOwner || isAdmin;

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
          <Pressable onPress={handleLike} style={styles.actionButton} hitSlop={8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={32}
              color={liked ? '#ff3b5c' : colors.text}
            />
            <Text style={styles.actionLabel}>{likeCount}</Text>
          </Pressable>
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
            onPress={async () => {
              const link = `https://flytok.vercel.app/v/${item.id}`;
              const message = item.caption ? `${item.caption}\n\n${link}` : link;
              try {
                await Share.share({ message, url: link });
              } catch {
                // user cancelled
              }
            }}
            onLongPress={() => setShowShare(true)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="paper-plane-outline" size={28} color={colors.text} />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (canManage) {
                Alert.alert('Post', undefined, [
                  { text: 'Edit caption', onPress: () => setShowEdit(true) },
                  {
                    text: 'Delete post',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Delete this post?',
                        'This permanently removes the video. This cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await deleteOwnVideo(item);
                                onBlocked?.(item.ownerId); // re-use to remove from feed
                              } catch (err: any) {
                                Alert.alert(
                                  'Could not delete',
                                  err?.message ?? 'Try again later.',
                                );
                              }
                            },
                          },
                        ],
                      );
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                setShowReport(true);
              }
            }}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={28} color={colors.text} />
          </Pressable>
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
      <EditCaptionSheet
        visible={showEdit}
        videoId={item.id}
        initialCaption={item.caption ?? ''}
        onClose={() => setShowEdit(false)}
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
