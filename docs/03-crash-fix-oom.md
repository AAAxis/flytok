# Task 3 — Crash: OOM after a few seconds in feed

## Symptom

User report (verbatim): *"App: Crashes after few seconds of proper working."*

Reproducer: launch app → log in → scroll the feed for ~10–20 cards → process dies. Captured during the previous session — see `docs/crash-evidence.log`.

## Evidence (already captured)

From `adb logcat -b crash`:

```
FATAL EXCEPTION: ExoPlayer:Playback
  java.lang.OutOfMemoryError: Failed to allocate a 64 byte allocation with
  1425056 free bytes and 1391KB until OOM, target footprint 268435456,
  growth limit 268435456; giving up on allocation because <1% of heap free
  after GC.
    at android.media.MediaCodec.getBuffer(Native Method)
    at android.media.MediaCodec.getInputBuffer(MediaCodec.java:4854)
    at androidx.media3.exoplayer.mediacodec.AsynchronousMediaCodecAdapter.getInputBuffer
    at androidx.media3.exoplayer.mediacodec.MediaCodecRenderer.feedInputBuffer
    at androidx.media3.exoplayer.video.MediaCodecVideoRenderer.render
    at androidx.media3.exoplayer.RendererHolder.render
    at androidx.media3.exoplayer.ExoPlayerImplInternal.doSomeWork
```

Heap target = 268435456 bytes = **256 MB**. The default Android heap on this device. The crash is a real OOM, not a NullPointerException dressed up as one.

Cascade after the first OOM: many follow-up `FATAL EXCEPTION` lines from `OkHttp TaskRunner`, `grpc-okhttp-0`, `mqt_native_modules`, `GoogleApiHandler` — all just secondary symptoms of running on a corrupted heap.

## Root cause

`mobile/components/FeedItem.tsx` line ~56:

```tsx
const player = useVideoPlayer(cachedUri ?? item.downloadURL, (p) => {
  p.loop = true;
  p.muted = false;
});
```

This hook is called per FeedItem. The parent `FlatList` in `app/(tabs)/index.tsx` mounts a FeedItem per visible card and keeps mounted cards near the viewport (default `windowSize=21`). expo-video's `useVideoPlayer` allocates an ExoPlayer + MediaCodec + decode buffers — a heavy native object — and there is no explicit cleanup. As you scroll, more players accumulate and FlatList does not aggressively unmount them. After ~256 MB of player state, the next codec buffer allocation fails.

Confirmed by the stack: every FATAL is in `androidx.media3.exoplayer.*` (the native back-end of expo-video).

## Fix plan

Two layers — both required for a durable fix.

### 1. Player pool / virtualization

Only the active card and its ±1 neighbours should hold a real player. Everything else renders a static thumbnail (first-frame poster) until it becomes adjacent to the active index.

Implementation: lift player ownership out of FeedItem. Manage a tiny pool (3 players) at the feed level, indexed by `[active-1, active, active+1]`. Each FeedItem receives a player or null via prop. When prop is null, render a poster `<Image>` instead of `<VideoView>`.

Pool semantics:
```ts
type PoolEntry = { player: VideoPlayer; videoId: string | null };
// 3 entries, repurposed as the active index moves.
// On index change: rotate, set new sources via player.replace(uri).
// Never call useVideoPlayer in FeedItem. Use the player passed by the parent.
```

This is the standard pattern for TikTok-style feeds in RN. Caps memory regardless of feed length.

### 2. Explicit cleanup

Even with the pool, ensure each player is `release()`'d on unmount or when the feed unmounts entirely:

```tsx
useEffect(() => {
  return () => {
    pool.current.forEach(({ player }) => {
      try { player.release(); } catch {}
    });
  };
}, []);
```

Also call `release()` on the outgoing entry when rotating (otherwise the pool itself becomes a leak).

### 3. FlatList tuning (cheap and helps)

In `app/(tabs)/index.tsx` set:
- `windowSize={3}` (default 21 — way too high for full-screen video)
- `removeClippedSubviews={true}`
- `maxToRenderPerBatch={2}`
- `initialNumToRender={1}`

These reduce React's mount footprint independently of the player pool.

## Verification

1. Rebuild and run on `0010934AE002636`.
2. Scroll the feed for at least 60 seconds (or 50 cards). No crash.
3. Profile with `adb shell dumpsys meminfo com.roamrez.flytok` while scrolling — the `Native Heap` and `Graphics` lines should plateau, not climb.
4. Re-pull `adb logcat -b crash` — expect an empty result for `OutOfMemoryError` after this run.

## Acceptance

- 5-minute scroll session in the feed without a crash.
- `dumpsys meminfo` plateaus rather than climbs unbounded.
- Existing functionality (like / save / comment / share / mute / scrub) still works on the active card.

## Dispatch hint

This is a careful refactor — pair the implementation with a `qa-security-reviewer` review at the end (memory leaks have a way of looking fixed but not being). One implementation agent, one review agent.
