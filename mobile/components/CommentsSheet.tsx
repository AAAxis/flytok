import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import {
  commentsCol,
  COMMENT_MAX_LENGTH,
  getCachedUserLabel,
  getCommentsLikedByMe,
  getUserLabel,
  postComment,
  setCommentRating,
  toggleCommentLike,
  type CommentDoc,
} from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useBlockedSet } from '@/lib/blockSet';
import { colors } from '@/lib/theme';

/** Gold used for filled stars — matches the website Share section. */
const STAR_COLOR = '#facc15';

type ReplyTarget = {
  /** Top-level comment id the reply will be attached to. */
  rootId: string;
  /** Display label of whoever is being replied to (the tapped row's author). */
  authorLabel: string;
};

type FlatRow = { comment: CommentDoc; depth: 0 | 1 };

export function CommentsSheet({
  videoId,
  visible,
  onClose,
}: {
  videoId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const { set: blockedSet } = useBlockedSet();

  useEffect(() => {
    if (!visible) {
      // Drop any in-progress reply so the next open starts clean.
      setReplyTo(null);
      return;
    }
    const unsub = commentsCol(videoId)
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snap) => {
          setComments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommentDoc, 'id'>) })),
          );
        },
        () => setComments([]),
      );
    return unsub;
  }, [videoId, visible]);

  // Hydrate liked state for everything currently visible. Re-runs on every
  // snapshot so freshly-posted comments still get their initial liked flag.
  const visibleComments = useMemo(
    () => comments.filter((c) => !blockedSet.has(c.authorId)),
    [comments, blockedSet],
  );
  useEffect(() => {
    if (!visible || visibleComments.length === 0) return;
    let cancelled = false;
    getCommentsLikedByMe(
      videoId,
      visibleComments.map((c) => c.id),
    ).then((set) => {
      if (!cancelled) setLikedSet(set);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, visibleComments, videoId]);

  // Build a single-level threaded view: root comments interleaved with their
  // replies. Replies are sorted by their own createdAt so the conversation
  // reads top-to-bottom under each parent.
  const rows = useMemo<FlatRow[]>(() => {
    const roots: CommentDoc[] = [];
    const byParent = new Map<string, CommentDoc[]>();
    for (const c of visibleComments) {
      if (c.parentId) {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      } else {
        roots.push(c);
      }
    }
    const out: FlatRow[] = [];
    for (const root of roots) {
      out.push({ comment: root, depth: 0 });
      const replies = byParent.get(root.id);
      if (replies) {
        for (const r of replies) out.push({ comment: r, depth: 1 });
      }
    }
    return out;
  }, [visibleComments]);

  const handleLikeToggle = useCallback(
    async (commentId: string) => {
      // Optimistic flip — revert if the transaction throws.
      const wasLiked = likedSet.has(commentId);
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(commentId);
        else next.add(commentId);
        return next;
      });
      // Nudge the local likeCount too so the UI doesn't wait for the snapshot
      // round-trip. The snapshot will overwrite this with the canonical value.
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likeCount: Math.max(
                  0,
                  (c.likeCount ?? 0) + (wasLiked ? -1 : 1),
                ),
              }
            : c,
        ),
      );
      try {
        await toggleCommentLike(videoId, commentId);
      } catch (err: any) {
        setLikedSet((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(commentId);
          else next.delete(commentId);
          return next;
        });
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likeCount: Math.max(
                    0,
                    (c.likeCount ?? 0) + (wasLiked ? 1 : -1),
                  ),
                }
              : c,
          ),
        );
        Alert.alert('Could not update like', err?.message ?? 'Please try again.');
      }
    },
    [likedSet, videoId],
  );

  const handleRate = useCallback(
    async (commentId: string, rating: number) => {
      // Optimistic write — restore the previous value if the write throws.
      let prevRating = 0;
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          prevRating = c.rating ?? 0;
          return { ...c, rating };
        }),
      );
      try {
        await setCommentRating(videoId, commentId, rating);
      } catch (err: any) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, rating: prevRating } : c)),
        );
        Alert.alert('Could not save rating', err?.message ?? 'Please try again.');
      }
    },
    [videoId],
  );

  const handleReply = useCallback((target: ReplyTarget) => {
    setReplyTo(target);
  }, []);

  const handleClearReply = useCallback(() => setReplyTo(null), []);

  // Footer renders a memoised `Composer` whose text state is local. That
  // keeps `CommentsSheet` from re-rendering on every keystroke, which is what
  // was causing gorhom v4 to remount the footer and drop the keyboard. The
  // callback's only dependencies (`videoId`, `replyTo`, `insets.bottom`) all
  // change rarely.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <Composer
          videoId={videoId}
          replyTo={replyTo}
          onClearReply={handleClearReply}
          insetsBottom={insets.bottom}
        />
      </BottomSheetFooter>
    ),
    [videoId, replyTo, handleClearReply, insets.bottom],
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['70%', '92%']}
      title="Comments"
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      enableContentPanningGesture={false}
      footerComponent={renderFooter}
    >
      <BottomSheetFlatList
        data={rows}
        keyExtractor={(row) => row.comment.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <CommentRow
            comment={item.comment}
            depth={item.depth}
            liked={likedSet.has(item.comment.id)}
            onLikeToggle={handleLikeToggle}
            onReply={handleReply}
            onRate={handleRate}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Be the first to comment</Text>
        }
      />
    </AppBottomSheet>
  );
}

type ComposerProps = {
  videoId: string;
  replyTo: ReplyTarget | null;
  onClearReply: () => void;
  insetsBottom: number;
};

/**
 * Composer owns its own `text`/`sending` state so typing doesn't bubble a
 * re-render up to `CommentsSheet`. That stability is what keeps the gorhom
 * footer instance mounted across keystrokes — without it the input loses
 * focus and the keyboard collapses on every character.
 *
 * Bottom padding interpolates with the keyboard the same way the chat
 * thread's `KeyboardStickyView` does (`closed: -insets.bottom, opened: 0`):
 * we sit `insets.bottom` above the home indicator when the keyboard is
 * down, and snap flush against the keyboard top when it's up. Without this
 * gorhom's `BottomSheetFooter` would leave a permanent `insets.bottom` gap
 * between the input and the keyboard.
 */
const Composer = memo(function Composer({
  videoId,
  replyTo,
  onClearReply,
  insetsBottom,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { progress } = useReanimatedKeyboardAnimation();

  const animatedComposer = useAnimatedStyle(() => ({
    paddingBottom: 8 + insetsBottom * (1 - progress.value),
  }));

  const placeholder = replyTo ? `Reply to ${replyTo.authorLabel}…` : 'Add a comment…';

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    const parentId = replyTo?.rootId ?? null;
    try {
      await postComment(videoId, trimmed, parentId);
      // Reply context cleared on success so the next message goes top-level.
      if (parentId) onClearReply();
    } catch (err: any) {
      // Restore the draft so the user can retry without retyping.
      setText(trimmed);
      Alert.alert('Could not post comment', err?.message ?? 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [text, sending, replyTo, videoId, onClearReply]);

  return (
    <Animated.View style={[styles.composer, animatedComposer]}>
      {replyTo ? (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>
            Replying to <Text style={styles.replyBannerAuthor}>{replyTo.authorLabel}</Text>
          </Text>
          <Pressable onPress={onClearReply} hitSlop={8} accessibilityLabel="Cancel reply">
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <BottomSheetTextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          editable={!sending}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          accessibilityLabel={replyTo ? 'Reply text' : 'Comment text'}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => [
            styles.send,
            (!text.trim() || sending) && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
          accessibilityLabel={replyTo ? 'Post reply' : 'Post comment'}
        >
          {sending ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
});

type CommentRowProps = {
  comment: CommentDoc;
  depth: 0 | 1;
  liked: boolean;
  onLikeToggle: (commentId: string) => void;
  onReply: (target: ReplyTarget) => void;
  onRate: (commentId: string, rating: number) => void;
};

/**
 * Tappable 5-star row, styled to match the website Share box (gold stars).
 * Tapping the current rating again clears it back to 0.
 */
function StarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.starRow} accessibilityRole="adjustable" accessibilityLabel={`Rating ${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <Pressable
            key={star}
            onPress={() => onChange(star === rating ? 0 : star)}
            hitSlop={6}
            style={styles.starTap}
            accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={16}
              color={filled ? STAR_COLOR : colors.textFaint}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function CommentRow({ comment, depth, liked, onLikeToggle, onReply, onRate }: CommentRowProps) {
  const initial = getCachedUserLabel(comment.authorId) ?? `User ${comment.authorId.slice(0, 6)}`;
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    getUserLabel(comment.authorId).then((l) => {
      if (!cancelled) setLabel(l);
    });
    return () => {
      cancelled = true;
    };
  }, [comment.authorId]);

  // Replies always attach to the top-level parent. For root comments that's
  // the comment itself; for replies it's their `parentId`.
  const rootId = comment.parentId ?? comment.id;
  const handleReplyTap = () => onReply({ rootId, authorLabel: label });
  const handleLikeTap = () => onLikeToggle(comment.id);
  const handleRate = (next: number) => onRate(comment.id, next);

  return (
    <View style={[styles.commentRow, depth === 1 && styles.commentRowReply]}>
      <View style={styles.commentBody}>
        <Text style={styles.author}>{label}</Text>
        <Text style={styles.text}>{comment.text}</Text>
        <StarRating rating={comment.rating ?? 0} onChange={handleRate} />
        <Pressable onPress={handleReplyTap} hitSlop={6} accessibilityLabel="Reply to comment">
          <Text style={styles.replyAction}>Reply</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={handleLikeTap}
        hitSlop={8}
        style={styles.likeColumn}
        accessibilityLabel={liked ? 'Unlike comment' : 'Like comment'}
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={18}
          color={liked ? colors.accent : colors.textMuted}
        />
        {(comment.likeCount ?? 0) > 0 ? (
          <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
            {comment.likeCount}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom padding leaves room for the footer composer so the last comment
  // isn't hidden under the input.
  listContent: { padding: 16, gap: 12, paddingBottom: 120 },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentRowReply: {
    paddingLeft: 28,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  author: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  text: { color: colors.text, fontSize: 14 },
  replyAction: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  starTap: { padding: 1 },
  likeColumn: {
    alignItems: 'center',
    minWidth: 24,
    paddingTop: 2,
  },
  likeCount: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  likeCountActive: { color: colors.accent },
  empty: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 24 },
  // Mirrors `mobile/components/messaging/Composer.tsx`: hairline top border,
  // `padding: 8` row, surface-tinted rounded input. Bottom padding is the
  // only animated piece — see `useReanimatedKeyboardAnimation` above.
  composer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyBannerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  replyBannerAuthor: { color: colors.text, fontWeight: '600' },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    maxHeight: 120,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: colors.accentDim },
  sendDisabled: { opacity: 0.4 },
});
