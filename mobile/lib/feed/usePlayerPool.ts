import { useEffect, useMemo, useRef, useState } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

/**
 * Player pool for the vertical feed.
 *
 * The TikTok-style feed only has one playing card at a time, but pre-warming
 * the next/previous card avoids a stall when the user swipes. Three players is
 * the sweet spot:
 *
 *   slots = [active - 1, active, active + 1]
 *
 * Every other card in the FlatList shows a static poster instead of mounting a
 * heavy ExoPlayer / MediaCodec / decode-buffer chain. This caps native memory
 * regardless of feed length and was the fix for the OOM crash documented in
 * `docs/03-crash-fix-oom.md`.
 *
 * Implementation note: `useVideoPlayer` must be called unconditionally so we
 * call it `POOL_SIZE` times at the top level. The hook auto-releases each
 * player when the host component unmounts.
 */

export const POOL_SIZE = 3 as const;

export type FeedPoolItem = {
  /** Stable id (e.g. Firestore doc id) used to skip no-op replaces. */
  id: string;
  /** Source URL the player should load (cached file:// or remote https://). */
  uri: string;
};

type Slot = {
  player: VideoPlayer;
  /** Track which video this slot is currently bound to so we can skip
   *  redundant `replace()` calls (each replace tears down + rebuilds the
   *  decoder). */
  videoId: string | null;
  /** URI currently loaded into the player. Tracked separately from videoId
   *  so we can swap from a remote URL to the cached file:// path once the
   *  cache lookup resolves, without churning when the same id reappears. */
  uri: string | null;
};

export type PlayerPool = {
  /** Returns the player assigned to absolute index `i`, or null if `i` is
   *  outside the [active-1, active+1] window. */
  getPlayerForIndex: (i: number) => VideoPlayer | null;
};

/**
 * Hook that owns three persistent `VideoPlayer` instances and rotates which
 * feed item each one is bound to as the active index changes.
 */
export function usePlayerPool(items: FeedPoolItem[], activeIndex: number): PlayerPool {
  // Three independent players. They live for the lifetime of the host
  // component; the hook releases them automatically on unmount.
  const playerA = useVideoPlayer(null, configure);
  const playerB = useVideoPlayer(null, configure);
  const playerC = useVideoPlayer(null, configure);

  // Stable slot bookkeeping. We never recreate the player objects — only
  // change which index each one currently represents.
  const slotsRef = useRef<Slot[]>([
    { player: playerA, videoId: null, uri: null },
    { player: playerB, videoId: null, uri: null },
    { player: playerC, videoId: null, uri: null },
  ]);

  // Lookup updated by the rotation effect below; FeedItem reads from it via
  // `getPlayerForIndex`. We keep this in state (not just a ref) so consumers
  // re-render with the freshly-bound player after rotation.
  const [indexToPlayer, setIndexToPlayer] = useState<Map<number, VideoPlayer>>(
    () => new Map(),
  );

  // Belt-and-suspenders cleanup: pause every slot when the feed unmounts so
  // no slot keeps decoding while `useVideoPlayer`'s auto-release runs. The
  // hook handles `release()` for us — we just guarantee playback stops first.
  useEffect(() => {
    return () => {
      for (const slot of slotsRef.current) {
        try {
          slot.player.pause();
        } catch {
          // already released or in error state — nothing to do
        }
      }
    };
  }, []);

  // Rebind slots whenever the active window shifts or the underlying list
  // changes (e.g. tab switch, refresh).
  useEffect(() => {
    const slots = slotsRef.current;
    const desiredIndices = windowIndices(activeIndex, items.length);

    // Map each absolute index → existing slot if any (so we keep playback
    // state on the active card and on a card that just rotated in from
    // adjacent).
    const slotByVideoId = new Map<string, Slot>();
    for (const slot of slots) {
      if (slot.videoId) slotByVideoId.set(slot.videoId, slot);
    }

    // Decide which slot serves which desired index. We do two passes:
    //   1) reuse slots whose current videoId matches a desired item;
    //   2) for desired items not yet assigned, pull a free slot.
    const assignedSlots = new Set<Slot>();
    const desiredAssignments: { index: number; slot: Slot; item: FeedPoolItem }[] = [];

    for (const i of desiredIndices) {
      const item = items[i];
      if (!item) continue;
      const reuse = slotByVideoId.get(item.id);
      if (reuse && !assignedSlots.has(reuse)) {
        assignedSlots.add(reuse);
        desiredAssignments.push({ index: i, slot: reuse, item });
      }
    }
    for (const i of desiredIndices) {
      const item = items[i];
      if (!item) continue;
      if (desiredAssignments.some((a) => a.index === i)) continue;
      const free = slots.find((s) => !assignedSlots.has(s));
      if (!free) break;
      assignedSlots.add(free);
      desiredAssignments.push({ index: i, slot: free, item });
    }

    // Apply: replace source on slots whose binding changes, pause anything
    // we're evicting so it doesn't keep decoding offscreen.
    for (const slot of slots) {
      if (!assignedSlots.has(slot) && slot.videoId !== null) {
        try {
          slot.player.pause();
        } catch {
          // player may be in an error state — ignore, replace will reset
        }
        slot.videoId = null;
        slot.uri = null;
      }
    }
    for (const { slot, item } of desiredAssignments) {
      // Replace when:
      //  - slot is bound to a different video (rotation), or
      //  - same video but the URI changed (e.g. cached path resolved).
      if (slot.videoId !== item.id || slot.uri !== item.uri) {
        try {
          // `disableWarning=true` silences the iOS sync-load deprecation
          // notice; we need synchronous replace here so the next render
          // sees the player ready for the active card.
          slot.player.replace(item.uri, true);
        } catch {
          // expo-video occasionally throws if the player is mid-transition;
          // the next effect run will retry.
        }
        slot.videoId = item.id;
        slot.uri = item.uri;
      }
    }

    // Build a lookup for getPlayerForIndex(). Skip the state update if the
    // mapping is identical to avoid an extra render.
    const next = new Map<number, VideoPlayer>(
      desiredAssignments.map(({ index, slot }) => [index, slot.player]),
    );
    setIndexToPlayer((prev) => (mapsEqual(prev, next) ? prev : next));
  }, [items, activeIndex]);

  return useMemo<PlayerPool>(
    () => ({
      getPlayerForIndex: (i: number) => indexToPlayer.get(i) ?? null,
    }),
    [indexToPlayer],
  );
}

function mapsEqual(
  a: Map<number, VideoPlayer>,
  b: Map<number, VideoPlayer>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function configure(p: VideoPlayer) {
  p.loop = true;
  p.muted = false;
}

/** Returns [active-1, active, active+1] clamped to valid indices. */
function windowIndices(active: number, total: number): number[] {
  const out: number[] = [];
  for (let offset = -1; offset <= 1; offset += 1) {
    const i = active + offset;
    if (i >= 0 && i < total) out.push(i);
  }
  return out;
}
