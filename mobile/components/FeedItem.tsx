import { useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { Alert, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, type VideoPlayer } from 'expo-video';
import { commentsCol, deleteOwnVideo, follow, followingCol, likesCol, savesCol, toggleLike, toggleSave, unfollow, type VideoDoc } from '@/lib/firestore';
import { useUserLabel, useUserProfile } from '@/lib/useUserLabel';
import { useAuth } from '@/lib/AuthContext';
import { getPlaceVideoCount } from '@/lib/search/queries';
import { placeSlug } from '@/components/PlaceCard';
import { CommentsSheet } from '@/components/CommentsSheet';
import { ShareToChatSheet } from '@/components/ShareToChatSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { EditCaptionSheet } from '@/components/EditCaptionSheet';
import { colors } from '@/lib/theme';
import { ROUTES_DISPLAY_ENABLED } from '@/lib/features';

const { width } = Dimensions.get('window');

export function FeedItem({
  item,
  active,
  height,
  player,
  onBlocked,
  onReported,
}: {
  item: VideoDoc;
  active: boolean;
  height: number;
  /**
   * Player provided by the parent feed's `usePlayerPool`. Null when this item
   * is outside the active ±1 window — in that case we render a static poster
   * to avoid mounting a heavy ExoPlayer per card (was the OOM root cause).
   */
  player: VideoPlayer | null;
  /**
   * Called after the user blocks an author. The feed filters subsequent
   * posts from that uid in-memory and advances to the next post.
   */
  onBlocked?: (uid: string) => void;
  /**
   * Called after the user successfully submits a report on this post — the
   * feed advances past the reported post so the user sees fresh content.
   */
  onReported?: (videoId: string) => void;
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
  const [likeCount, setLikeCount] = useState(Math.max(0, item.likeCount ?? 0));
  const [routeCount, setRouteCount] = useState(0);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const trackWidthRef = useRef(0);
  const wasPlayingRef = useRef(false);

  function seekToFraction(fraction: number) {
    if (!player) return;
    const f = Math.min(1, Math.max(0, fraction));
    const dur = player.duration ?? 0;
    if (dur > 0) {
      player.currentTime = dur * f;
      setProgress(f);
    }
  }

  // Note: play/pause for active vs inactive cards is owned by `usePlayerPool`'s
  // rotation effect — we used to also call play()/pause() here from a
  // [active, player] effect, but that raced with iOS `replaceAsync` (the JS
  // promise resolves before AVPlayer's main-queue item-replace runs, so play()
  // was firing on an empty player and the card stayed black). FeedItem now
  // only handles user-initiated play/pause from tap/long-press / scrub.

  // Lightweight playback timeline — polls 4×/sec while the slide is active.
  // Pauses while the user is scrubbing so the polled value doesn't fight the
  // dragged thumb.
  useEffect(() => {
    if (!active || !player) return;
    const id = setInterval(() => {
      if (scrubbing) return;
      try {
        const dur = player.duration ?? 0;
        const cur = player.currentTime ?? 0;
        if (dur > 0) setProgress(Math.min(1, Math.max(0, cur / dur)));
      } catch {
        // player may not be ready yet — ignore
      }
    }, 250);
    return () => clearInterval(id);
  }, [active, player, scrubbing]);

  // Per-card Firestore listeners. We gate every subscription on `active` so
  // off-screen cards don't each hold open four onSnapshot streams. With a 50
  // -item feed that was 200 long-lived listeners → ~50–100 KB heap each in
  // OkHttp/HTTP2 buffers + Firestore SDK state, which contributed to the OOM
  // alongside the ExoPlayer LoadControl pumps. Listeners attach within a few
  // hundred ms of the card becoming active, which is fine for counters and
  // toggles users only see on the foreground card.
  useEffect(() => {
    if (!active) return;
    return commentsCol(item.id).onSnapshot(
      (snap) => setCommentCount(snap.size),
      () => setCommentCount(0),
    );
  }, [active, item.id]);

  useEffect(() => {
    if (!active) return;
    if (!me || me.uid === item.ownerId) return;
    return followingCol(me.uid)
      .doc(item.ownerId)
      .onSnapshot(
        (snap) => setFollowing(snap.exists()),
        () => setFollowing(false),
      );
  }, [active, me, item.ownerId]);

  useEffect(() => {
    if (!active) return;
    if (!me) return;
    return savesCol(me.uid)
      .doc(item.id)
      .onSnapshot(
        (snap) => setSaved(!!snap.data()),
        () => setSaved(false),
      );
  }, [active, me, item.id]);

  useEffect(() => {
    if (!active) return;
    if (!me) return;
    return likesCol(item.id)
      .doc(me.uid)
      .onSnapshot(
        (snap) => setLiked(!!snap.data()),
        () => setLiked(false),
      );
  }, [active, me, item.id]);

  // Resolve the "routes" count (videos recorded at this place) once the card
  // is active. Best-effort — falls back to 0 (row hidden) on any failure.
  useEffect(() => {
    if (!ROUTES_DISPLAY_ENABLED) {
      setRouteCount(0);
      return;
    }
    if (!active) return;
    const label = item.location?.label;
    if (!label) {
      setRouteCount(0);
      return;
    }
    let cancelled = false;
    getPlaceVideoCount(label)
      .then((n) => {
        if (!cancelled) setRouteCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, item.location?.label]);

  async function handleSave() {
    console.log('[save] tapped', { videoId: item.id, signedIn: !!me, saved });
    if (!me) {
      Alert.alert('Sign in required', 'Sign in to save videos.');
      return;
    }
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const result = await toggleSave(item.id);
      console.log('[save] toggle result', result);
    } catch (err: any) {
      console.warn('[save] failed', err);
      setSaved(!next);
      Alert.alert('Could not save', err?.message ?? 'Try again later.');
    }
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
  const ownerLabel = useUserLabel(item.ownerId);
  const ownerProfile = useUserProfile(item.ownerId);
  const router = useRouter();
  function openOwnerProfile() {
    console.log('[author-tap]', { ownerId: item.ownerId, isOwner });
    router.push(`/user/${item.ownerId}` as never);
  }
  function openPlace() {
    const label = item.location?.label;
    if (!label) return;
    router.push(`/place/${placeSlug(label)}?label=${encodeURIComponent(label)}` as never);
  }

  return (
    <View style={[styles.item, { height }]}>
      <Pressable
        onPress={() => {
          if (!player) return;
          // Single tap toggles play/pause.
          if (player.playing) player.pause();
          else player.play();
        }}
        onLongPress={() => {
          if (!player) return;
          // Press-and-hold pauses while held, resumes on release.
          player.pause();
          setHolding(true);
        }}
        onPressOut={() => {
          if (!holding) return;
          setHolding(false);
          if (active && player) player.play();
        }}
        delayLongPress={220}
        style={styles.fill}
      >
        {player ? (
          <VideoView
            player={player}
            style={[styles.video, { height }]}
            contentFit="cover"
            nativeControls={false}
            allowsVideoFrameAnalysis={false}
          />
        ) : (
          // Out of the active ±1 window: render a black placeholder. We
          // intentionally avoid spawning a thumbnail player here — that was
          // the OOM root cause. The card swaps in a real player as soon as
          // the user scrolls within range.
          <View style={[styles.video, styles.posterFallback, { height }]} />
        )}
      </Pressable>
      {holding && (
        <View style={styles.holdIndicator} pointerEvents="none">
          <Ionicons name="pause" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      )}

      <View
        style={styles.progressHitArea}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        onStartShouldSetResponder={() => !!player}
        onMoveShouldSetResponder={() => !!player}
        onResponderGrant={(e) => {
          if (!player) return;
          wasPlayingRef.current = !!player.playing;
          player.pause();
          setScrubbing(true);
          if (trackWidthRef.current > 0) {
            seekToFraction(e.nativeEvent.locationX / trackWidthRef.current);
          }
        }}
        onResponderMove={(e) => {
          if (!player) return;
          if (trackWidthRef.current > 0) {
            seekToFraction(e.nativeEvent.locationX / trackWidthRef.current);
          }
        }}
        onResponderRelease={() => {
          setScrubbing(false);
          if (active && player && wasPlayingRef.current) player.play();
        }}
        onResponderTerminate={() => {
          setScrubbing(false);
          if (active && player && wasPlayingRef.current) player.play();
        }}
      >
        <View style={[styles.progressTrack, scrubbing && styles.progressTrackActive]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          {scrubbing && (
            <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
          )}
        </View>
      </View>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bottomLeft}>
          <View style={styles.authorRow}>
            <Pressable onPress={openOwnerProfile} hitSlop={6} style={styles.authorTap}>
              <Text style={styles.author}>{ownerLabel}</Text>
            </Pressable>
          </View>
          {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
          {routeCount > 0 ? (
            <View style={styles.metaRow}>
              <Ionicons name="git-branch" size={13} color="#fff" style={styles.metaIcon} />
              <Text style={styles.metaText}>
                {routeCount} {routeCount === 1 ? 'Route' : 'Routes'}
              </Text>
            </View>
          ) : null}
          {item.location?.label ? (
            <Pressable onPress={openPlace} hitSlop={4} style={styles.metaRow}>
              <Ionicons name="location" size={13} color="#fff" style={styles.metaIcon} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.location.label}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.musicRow}>
            <Ionicons name="musical-notes" size={13} color="#fff" />
            <Text style={styles.musicText} numberOfLines={1}>
              {item.audioTitle
                ? `${item.audioTitle}${item.audioArtist ? ` · ${item.audioArtist}` : ''}`
                : `Original audio · ${ownerLabel}`}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={openOwnerProfile} style={styles.railAvatarWrap} hitSlop={6}>
            {ownerProfile?.photoURL ? (
              <Image source={{ uri: ownerProfile.photoURL }} style={styles.railAvatar} />
            ) : (
              <View style={[styles.railAvatar, styles.railAvatarFallback]}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
            )}
            {!isOwner && !following && (
              <Pressable onPress={toggleFollow} style={styles.railFollowBadge} hitSlop={8}>
                <Ionicons name="add" size={14} color="#fff" />
              </Pressable>
            )}
          </Pressable>

          <Pressable onPress={handleLike} style={styles.actionButton} hitSlop={8}>
            <Ionicons
              name="heart"
              size={38}
              color={liked ? '#ff3b5c' : '#fff'}
              style={styles.actionIcon}
            />
            <Text style={styles.actionLabel}>{Math.max(0, likeCount)}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowComments(true)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="chatbubble" size={34} color="#fff" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>{commentCount}</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons
              name="bookmark"
              size={34}
              color={saved ? colors.accent : '#fff'}
              style={styles.actionIcon}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowShare(true)}
            style={styles.actionButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-redo" size={34} color="#fff" style={styles.actionIcon} />
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
                Alert.alert('Post', undefined, [
                  {
                    text: 'Report',
                    style: 'destructive',
                    onPress: () => setShowReport(true),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }
            }}
            style={styles.actionButton}
            hitSlop={8}
            accessibilityLabel={canManage ? 'More post options' : 'Report this video'}
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={28} color="#fff" style={styles.actionIcon} />
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
        onReported={() => onReported?.(item.id)}
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
  item: { width, backgroundColor: '#000' },
  fill: { ...StyleSheet.absoluteFillObject },
  video: { width },
  posterFallback: { backgroundColor: '#000' },
  holdIndicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    justifyContent: 'flex-end',
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressTrackActive: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bottomLeft: { flex: 1, gap: 6, marginRight: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  metaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  musicText: {
    color: '#fff',
    fontSize: 12,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  actions: { gap: 22, alignItems: 'center' },
  railAvatarWrap: { alignItems: 'center', marginBottom: 6 },
  railAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#fff',
  },
  railAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railFollowBadge: {
    position: 'absolute',
    bottom: -9,
    left: 13,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  actionButton: { alignItems: 'center', gap: 5 },
  actionIcon: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
});
