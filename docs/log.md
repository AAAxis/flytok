# Flytok dev log

## 2026-05-02 — session 1

- Launched on Android device `0010934AE002636` via `expo run:android`. Build clean, Google Sign-In wired (after registering project keystore SHA-1 with Firebase).
- Replaced wide-open Firestore DEV rules with locked-down per-collection rules; deployed via direct Firebase Rules REST API (service-account-auth, see `.deploy-firestore-rules.mjs`).
- Wired Firebase MCP (`@gannonh/firebase-mcp`) at project-local scope using the same service account.
- Captured OOM crash evidence — feed leaks ExoPlayer instances. Root cause + fix plan in `docs/03-crash-fix-oom.md`.
- Prepared `prompt.md` and `docs/01..03-*.md` to drive next session's work (DM refactor, feed alignment fix, OOM fix).

## 2026-05-02 — session 2

### DMs (Task 1)

- Carved the messaging code out of `mobile/lib/firestore.ts` into a dedicated
  `mobile/lib/messaging/` module: `schema.ts` (types), `threads.ts`,
  `messages.ts`, `unread.ts`, `push.ts`, `background.ts`, plus four hooks
  (`useThreadList`, `useThread`, `useMessages`, `useUnreadBadge`). Public
  surface flows through `mobile/lib/messaging/index.ts`. `firestore.ts` now
  re-exports the legacy names for back-compat.
- New thread fields: `lastMessageType`, `lastMessageAuthorId`, `lastReadAt`
  (per-uid map), `participantCount`. Dropped `participantEmails` from new
  writes. New message fields: `imageURL`, `imageStoragePath`, `localId`,
  soft-delete (`deletedAt`/`deletedBy`).
- UI: `mobile/components/messaging/{ThreadRow, MessageBubble, Composer,
  AttachmentPicker}` — bubbles handle text/image/video_card/deleted, support
  long-press copy/delete (mine) or copy/report (theirs). Composer covers
  text + image attach with progress.
- Inbox refactored to consume hooks only — `ThreadRow`, unread dot, blocked
  user filtering, tab-bar badge via `useUnreadBadge`.
- `useMessages` does optimistic send: pending entries dedupe against the
  server snapshot via `localId`. Image sends show a progress overlay during
  Storage upload.
- Push: `registerFcmTokenForUser` runs after `ensureUserDoc`, refreshes via
  `onTokenRefresh`, removes the token on sign-out. Foreground/background
  notification taps deep-link to `/chat/{threadId}`. `setupBackgroundMessageHandler`
  registered at module load in `app/_layout.tsx`.
- Cloud Function: `firebase/functions/src/index.ts` (`onMessageCreated` v2
  Firestore trigger) sends FCM multicast and prunes UNREGISTERED tokens.
  `npm install && npx tsc --noEmit` clean. Deploy is manual — needs
  `firebase login` (see `firebase/functions/README.md`).
- Storage: added `storage.rules` (chat `8 MB` image cap, owner-only writes)
  and `.deploy-storage-rules.mjs` mirroring the Firestore deploy. The
  service-account auth fails on the Storage Rules release endpoint
  (PERMISSION_DENIED) — the script logs the failure clearly and exits 1; user
  needs to run `firebase deploy --only storage` from an interactive shell.
- Firestore rules: relaxed `threads/{tid}/messages/{mid}` `update` to allow
  the author to set ONLY `deletedAt`/`deletedBy`. Re-deployed; ruleset
  `ac9212d3-8721-4721-b905-22e39df57ddd` is live.
- `expo-image-manipulator` added (`~14.0.7`) for client-side resize/compress
  before upload (max 1600px long side, JPEG @0.8).
- `mobile/` typecheck: messaging code clean. The five remaining errors
  (`app/v/[id].tsx`, `components/FollowListSheet.tsx`, `lib/firestore.ts:98`,
  `lib/geocode.ts`, `lib/videoCache.ts`) all pre-existed before this session.

### Feed (Tasks 2 + 3)

Shipped two feed fixes. (1) Top tabs and AI button on the trending feed now
read `useSafeAreaInsets()` instead of a hardcoded `top: 56`, so the chip row
clears the Android status bar / camera cutout under edge-to-edge mode without
regressing iOS (expo-router's ExpoRoot already mounts SafeAreaProvider).
(2) Hoisted `useVideoPlayer` out of `FeedItem` and into a 3-slot pool
(`mobile/lib/feed/usePlayerPool.ts`) keyed by `[active-1, active, active+1]`;
`FeedItem` now takes `player: VideoPlayer | null` as a prop and renders a
black placeholder when out of window. FlatList tightened to
`windowSize={3}` + `removeClippedSubviews` + `maxToRenderPerBatch={2}` +
`initialNumToRender={1}`. Same wiring applied to the user-posts/saved feed
at `mobile/app/posts/[uid].tsx`. Caps native ExoPlayer/MediaCodec memory at
3 instances regardless of feed length, fixing the 256 MB OOM crash.

### Verification

- `npx expo run:android` clean rebuild + install on `0010934AE002636`.
- App boots; no entries in `adb logcat -b crash`; no `FATAL EXCEPTION` /
  `OutOfMemoryError` in the main log.
- 30 simulated swipes through the feed: native heap held at ~120 MB
  (was the OOM growth path), TOTAL PSS held at ~290 MB. Player pool is
  reusing slots — memory plateaus instead of climbing toward the 256 MB
  ExoPlayer ceiling.

### OOM round 2 — buffers + listeners + largeHeap

The session-1 player pool capped how many ExoPlayer instances exist at
once, but it did not cap how much data each one buffers. ExoPlayer's
default `LoadControl` keeps pumping ~20 s of forward video into Java
heap with no byte cap; on HD content that's 30–80 MB per player, so
three players easily blew the 256 MB Java heap target the next time a
fresh build was tested. The crash now landed in
`ExoPlayerImplInternal.shouldContinueLoading` (heap-full while the
LoadControl tries to allocate more buffer), with downstream FATALs in
OkHttp, Firestore, and Crashlytics threads — all symptoms of a full
heap rather than separate bugs. Confirmed via the AndroidRuntime
`target footprint 268435456 bytes` (256 MB) ceiling.

Three concrete fixes shipped:

1. **Buffer caps in `usePlayerPool.ts`** — set `bufferOptions` on each
   pooled player: 4 s forward, 1 s playback threshold, 8 MB byte cap,
   size-over-time priority. Pool ceiling now ~24 MB across the three
   slots regardless of bitrate.
2. **Free source on slot eviction** — when a slot rotates out of the
   `[active-1, active+1]` window we now call `replace(null, true)` so
   ExoPlayer drops the MediaSource and stops the LoadControl pump.
   Previously we only `pause()`-d, so evicted slots silently kept
   downloading.
3. **Per-card listener gating in `FeedItem.tsx`** — the four
   `onSnapshot` listeners (comments / following / saves / likes) now
   only register on the active card. With `pagingEnabled` FlatList that
   alone removed ~12+ HTTP/2 streams from the steady-state.

Defense-in-depth: **`android:largeHeap="true"`** via a new
`mobile/plugins/withAndroidLargeHeap.js` config plugin. The device
default `dalvik.vm.heapgrowthlimit` was 256 MB; with `largeHeap` the
app now gets `dalvik.vm.heapsize=512 MB`. This is the standard prod
flag for video feed apps, applied on top of the leak fixes — not as
a substitute.

### Verification (2026-05-02 evening, device `0010934AE002636`)

Cold `./gradlew clean && expo run:android` after `expo prebuild` to
regenerate the manifest with `largeHeap`. App boots, three ExoPlayer
instances logged (`AndroidXMedia3/1.8.0`), feed loads, video plays.

90 simulated swipes (60 at 1 s cadence + 30 at 0.5 s cadence):

- PID held at 30766 throughout — no crash, no restart.
- `adb logcat -d -b crash` empty.
- `adb logcat -d | grep -iE "FATAL EXCEPTION|OutOfMemoryError"` empty.
- `dumpsys meminfo` Java Heap: 54 MB pre-scroll → **31 MB** post-scroll
  (GC reclaimed buffers as expected). Well under the 256 MB ceiling
  that previously OOM-ed, and well under the new 512 MB largeHeap cap.
- Native Heap stable at 144–191 MB; Graphics steady at 191 MB (decoder
  buffers reused across pool rotations); TOTAL PSS 550–601 MB.

Memory is going *down* during scroll, not up — the steady-state is
bounded by the pool size and the 8 MB-per-slot buffer cap.

### Manual follow-ups for Roman

1. `firebase deploy --only storage` — service-account auth couldn't release
   the new Storage rules (see `storage.rules` + the failure log from
   `.deploy-storage-rules.mjs`).
2. `cd firebase/functions && npm run build && npm run deploy` — DM push
   delivery function needs interactive `firebase login` to ship.
3. Two-account smoke test of DMs (text + image + soft-delete + push) on
   `0010934AE002636` once the function is live.
