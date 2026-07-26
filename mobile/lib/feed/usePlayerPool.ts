import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
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

/**
 * How long the active clip may sit without firing `sourceLoad` (metadata
 * ready) before we treat it as unplayable. A reachable source loads its
 * metadata within a couple of seconds even on slow networks — a dead /
 * 0-byte / still-transcoding URL never fires it and would otherwise leave the
 * user on a permanently blank card. 10s is comfortably past the happy path.
 */
const LOAD_TIMEOUT_MS = 10000;

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
  /** True once the player has emitted `sourceLoad` for the current `uri`.
   *  iOS `replaceAsync` resolves *successfully* with an empty player when a
   *  newer load supersedes it mid-flight (cancellation path in
   *  VideoSourceLoader.swift), so the promise resolution is not a reliable
   *  "loaded" signal — we need the actual native event. Used to detect
   *  cancelled loads and re-issue them. */
  loaded: boolean;
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
export function usePlayerPool(
  items: FeedPoolItem[],
  activeIndex: number,
  /**
   * Called with the video id of a slot whose player reports a hard load
   * error (404 / corrupt / unplayable source). The feed uses this to drop
   * the item so users never sit on a blank or broken card.
   */
  onItemError?: (videoId: string) => void,
  /** Whether the screen that owns the pool is currently focused. */
  enabled = true,
): PlayerPool {
  // Three independent players. They live for the lifetime of the host
  // component; the hook releases them automatically on unmount.
  const playerA = useVideoPlayer(null, configure);
  const playerB = useVideoPlayer(null, configure);
  const playerC = useVideoPlayer(null, configure);

  // Stable slot bookkeeping. We never recreate the player objects — only
  // change which index each one currently represents.
  const slotsRef = useRef<Slot[]>([
    { player: playerA, videoId: null, uri: null, loaded: false },
    { player: playerB, videoId: null, uri: null, loaded: false },
    { player: playerC, videoId: null, uri: null, loaded: false },
  ]);

  // The rotation effect captures `activeIndex` at run time, but `replaceAsync`
  // resolutions can fire long after the user has scrolled to a different card.
  // We read this ref inside the resolution callback to decide whether the
  // late-resolving slot should auto-play.
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // `onItemError` is read inside the once-wired statusChange listener, so keep
  // the latest callback in a ref to avoid a stale closure.
  const onItemErrorRef = useRef(onItemError);
  useEffect(() => {
    onItemErrorRef.current = onItemError;
  }, [onItemError]);

  // Wire `sourceLoad` and `statusChange` listeners once per slot. `sourceLoad`
  // is the only reliable signal that AVPlayer / ExoPlayer actually has the
  // asset's metadata loaded — both replaceAsync's promise (cancellation
  // resolves with no item) and `status === 'readyToPlay'` (only set after
  // buffer fills) are unsuitable for our gating.
  useEffect(() => {
    const subs: { remove: () => void }[] = [];
    for (const slot of slotsRef.current) {
      const onSourceLoad = () => {
        slot.loaded = true;
      };
      const onStatusChange = (e: { status: string; error?: { message?: string } }) => {
        if (e.status === 'error') {
          if (__DEV__) {
            console.warn('[playerPool] error on slot', {
              uri: slot.uri,
              videoId: slot.videoId,
              message: e.error?.message,
            });
          }
          // Hard load failure — tell the feed to drop this clip so the user
          // doesn't stare at a blank/broken card.
          const failedId = slot.videoId;
          if (failedId) onItemErrorRef.current?.(failedId);
        }
        if (e.status === 'idle') {
          // Item was cleared (replace(null) on Android, or cancellation).
          slot.loaded = false;
        }
      };
      subs.push(slot.player.addListener('sourceLoad', onSourceLoad));
      subs.push(slot.player.addListener('statusChange', onStatusChange));
    }
    return () => {
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          // already torn down
        }
      }
    };
  }, []);

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
    const slots = slotsRef.current;
    return () => {
      for (const slot of slots) {
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

    // Apply: drop sources on evicted slots (Android-only, see below), and
    // ALWAYS clear bookkeeping on eviction. The Agent QA traced the dominant
    // black-card bug to leaving stale `videoId`/`uri` on iOS evictions: when
    // the user scrolled back to a card the slot "remembered", the rotation
    // logic below hit the no-op branch (videoId match) and never reissued the
    // load — even though AVPlayer had long since released the asset.
    for (const slot of slots) {
      if (!assignedSlots.has(slot) && slot.videoId !== null) {
        try {
          slot.player.pause();
        } catch {
          // player may be in an error state — ignore, replace will reset
        }
        // On Android, `replace(null)` releases the underlying MediaSource and
        // stops the LoadControl buffer pump — without this, evicted slots
        // silently continue downloading until the heap is exhausted (the OOM
        // fixed in docs/03-crash-fix-oom.md). On iOS, calling replace(null)
        // here introduced races with subsequent replace/play calls — AVPlayer
        // manages its own buffers, so we leave the item in place and just
        // reissue replaceAsync on next reuse.
        if (Platform.OS === 'android') {
          try {
            slot.player.replace(null, true);
          } catch {
            // already released or transitioning — next rotation will retry
          }
        }
        slot.videoId = null;
        slot.uri = null;
        slot.loaded = false;
      }
    }
    for (const { slot, item } of desiredAssignments) {
      // Replace when:
      //  - slot is bound to a different video (rotation), or
      //  - same video but the URI changed (e.g. cached path resolved), or
      //  - same video + uri but the previous load never completed (e.g. it
      //    was cancelled by a superseding rotation — replaceAsync resolves
      //    with an empty player in that case so we *must* re-issue).
      const needsReplace =
        slot.videoId !== item.id || slot.uri !== item.uri || !slot.loaded;
      if (needsReplace) {
        slot.videoId = item.id;
        slot.uri = item.uri;
        slot.loaded = false;
        const targetUri = item.uri;
        if (Platform.OS === 'ios') {
          // Async load keeps AVPlayer's asset prep off the main thread —
          // sync `replace()` was leaving a window where `play()` fired
          // before AVPlayer had any item, so most cards stayed black.
          slot.player
            .replaceAsync(targetUri)
            .then(() => {
              // expo-video's iOS replaceAsync resolves the JS promise *before*
              // the main-queue `replaceCurrentItem` actually runs, so a brief
              // "loaded === false but the item is about to attach" window is
              // expected. The cancellation case (the dominant black-card
              // failure mode) ALSO resolves successfully — but with no item
              // attached, so `sourceLoad` will never fire. We can't tell the
              // two apart synchronously, so we wait long enough for the happy
              // path to set loaded=true, then retry if it didn't.
              if (slot.uri !== targetUri) return; // superseded — newer rotation owns it
              setTimeout(() => {
                if (slot.uri !== targetUri || slot.loaded) return;
                slot.player.replaceAsync(targetUri).catch(() => {});
              }, 600);
            })
            .catch(() => {
              // genuine load error — statusChange listener already logged it
            });
        } else {
          try {
            slot.player.replace(targetUri, true);
          } catch {
            // expo-video occasionally throws if the player is mid-transition;
            // the next effect run will retry.
          }
        }
      }
    }

    // Single source of truth for play/pause: the slot bound to the current
    // active index plays, every other slot pauses. Previously this was split
    // between FeedItem's effect and the rotation branches above, which meant
    // cards became 'active' before AVPlayer had loaded an item and `play()`
    // was a no-op. The replaceAsync `.then` above also can't reliably trigger
    // play because the native item may still be mid-load when the promise
    // resolves; calling play here on every effect run lets a not-yet-ready
    // player pick up automatically once `sourceLoad` flips loaded=true and
    // the next rotation hits this code path. The `currently playing` AVPlayer
    // handles redundant `play()` calls cheaply.
    for (const { index, slot } of desiredAssignments) {
      try {
        if (enabled && index === activeIndex) slot.player.play();
        else slot.player.pause();
      } catch {
        // ignore — released/transitioning player
      }
    }

    // Build a lookup for getPlayerForIndex(). Skip the state update if the
    // mapping is identical to avoid an extra render.
    const next = new Map<number, VideoPlayer>(
      desiredAssignments.map(({ index, slot }) => [index, slot.player]),
    );
    setIndexToPlayer((prev) => (mapsEqual(prev, next) ? prev : next));
  }, [items, activeIndex, enabled]);

  // Watchdog for the ACTIVE clip: if its player never fires `sourceLoad`
  // (metadata ready) within LOAD_TIMEOUT_MS and hasn't errored either, the
  // source is effectively dead (0-byte / still-transcoding / unreachable).
  // Drop it so the user isn't stuck on a blank card. `slot.loaded` is a
  // mutable field, so we re-check it at fire time rather than depending on it.
  useEffect(() => {
    if (!enabled) return;
    const player = indexToPlayer.get(activeIndex);
    if (!player) return;
    const slot = slotsRef.current.find((s) => s.player === player);
    if (!slot || !slot.videoId || slot.loaded) return;
    const watchedId = slot.videoId;
    const timer = setTimeout(() => {
      if (slot.videoId === watchedId && !slot.loaded) {
        onItemErrorRef.current?.(watchedId);
      }
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, enabled, indexToPlayer]);

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
  // Buffer tuning is per-platform. The Android caps below were the OOM fix
  // (docs/03-crash-fix-oom.md): ExoPlayer defaults to 20 s of forward buffer
  // with no byte cap, which on HD video pins 30–80 MB of Java heap per active
  // player and blew the 256 MB heap target. Capping forward buffer to 4 s and
  // total bytes to 8 MB keeps three players under ~24 MB combined.
  //
  // On iOS, `maxBufferBytes` / `prioritizeTimeOverSizeThreshold` are
  // Android-only fields, and the Android-tuned `preferredForwardBufferDuration:
  // 4` overrode the iOS auto-default (`0`) — AVPlayer waits for that buffer to
  // fill before starting playback, which combined with `waitsToMinimizeStalling`
  // (default true) made most cards stall on a black frame. Leaving the iOS
  // buffer at auto lets AVPlayer pick a sensible target per network.
  try {
    if (Platform.OS === 'ios') {
      p.bufferOptions = {
        preferredForwardBufferDuration: 0,
        waitsToMinimizeStalling: false,
      };
    } else {
      p.bufferOptions = {
        preferredForwardBufferDuration: 4,
        minBufferForPlayback: 1,
        maxBufferBytes: 8 * 1024 * 1024,
        prioritizeTimeOverSizeThreshold: false,
      };
    }
  } catch {
    // Older expo-video without bufferOptions — defaults will apply.
  }
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
