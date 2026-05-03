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

## 2026-05-03 — Wave 1 (foundation & quick fixes)

Spec: `docs/04-wave-1-foundation.md`. All acceptance criteria implemented;
on-device verification still pending — the connected Android target
`0010934AE002636` was not attached during this session (`adb devices`
returned empty), so Roman needs to run a clean build and exercise the
golden path before marking the wave fully shipped.

### Bottom-sheet primitive

Installed `@gorhom/bottom-sheet@^5.2.13` plus its required peer
`react-native-reanimated@~4.1.1` (Reanimated v4 ships its babel plugin
via `react-native-worklets/plugin`, auto-applied by `babel-preset-expo`
SDK 54). Wrapped the root tree in `GestureHandlerRootView` +
`BottomSheetModalProvider` in `mobile/app/_layout.tsx` so any sheet can
render through the modal portal.

New shared wrapper at `mobile/components/ui/AppBottomSheet.tsx` —
controlled `visible`/`onClose` API to keep migrations mechanical, brand
colors baked in, optional `title` header, optional dynamic sizing,
keyboard-aware (`keyboardBehavior: 'interactive'` +
`android_keyboardInputMode: 'adjustResize'`), pan-down-to-close, animated
backdrop. Reused by all 8 sheets:

- `CommentsSheet`, `SettingsSheet`, `EditProfileSheet`,
  `EditCaptionSheet`, `FollowListSheet`, `ReportSheet`,
  `ShareToChatSheet`, `AiAssistantSheet`.

`BottomSheetTextInput` swapped in for any composer/search/note input that
needs the sheet to follow the keyboard. `BottomSheetFlatList` /
`BottomSheetScrollView` / `BottomSheetView` used per content type so the
sheet's pan gesture cooperates with inner scroll.

### DM picker

`mobile/lib/users.ts` is new — exports `searchUsersByHandle(query, opts)`
(prefix range on `displayNameLower` filtered by `discoverable === true`)
and `getFollowedUserProfiles(opts)` (resolves the caller's
`/users/{me}/following/*` ids to user docs). Both reused by W3 search +
W4 DM expansion.

Inbox `NewChatSheet` (formerly `NewChatModal`) now lives inside
`AppBottomSheet`. Default state shows the people you follow with avatars
(or person-glyph fallback). Search box (≥2 chars, 250 ms debounce) flips
to global discoverable-handle search. Loading + empty states distinct
per mode. Old picker that listed every user in the database is gone.

### `ensureUserDoc` + `displayNameLower`

`mobile/lib/firestore.ts:ensureUserDoc` now reads first then writes:
maintains `displayNameLower` (lowercase trim of `displayName`) on every
sign-in, defaults `discoverable: true` only when the field is absent so
later opt-outs aren't clobbered. `updateProfile` mirrors
`displayNameLower` whenever `displayName` is touched.

A composite index on `(displayNameLower asc, discoverable asc)` is
declared at the new `firestore.indexes.json`. `searchUsersByHandle` will
fail loudly the first time it runs — Firebase prints a one-click create
URL in the error; alternatively run
`firebase deploy --only firestore:indexes` from an interactive shell.

### Firestore rules

`firestore.rules` already permits self-write of any field on `/users/{uid}`
via `isSelf(uid) || isAdmin()`, so no rule change was strictly required
for `discoverable` / `displayNameLower`. Added a header comment
documenting the new self-writable fields and re-deployed the ruleset
(`fa5cb462-2456-40fa-bf4a-961b47e8b238`) via the service-account script
just to keep the Cloud-side ruleset history in sync with the documented
policy.

### Inset audit

Replaced overlay/contentContainer hardcoded paddings with safe-area
insets:

- `components/FeedItem.tsx` — overlay `paddingBottom` now
  `Math.max(96, insets.bottom + 64)`, so the actions column clears the
  Android edge-to-edge gesture area without losing the iOS notch
  treatment.
- `app/(tabs)/profile.tsx` — `ScrollView` content padding now
  `insets.bottom + 60`.
- `app/(tabs)/inbox.tsx` — `FlatList` content padding now
  `insets.bottom + 60` so the last thread row clears the tab bar.
- `app/user/[uid].tsx` — same `insets.bottom + 60` treatment for the
  visiting-profile screen.

The migrated bottom sheets pick up insets internally through
`BottomSheetModalProvider`, so `paddingBottom` hardcodes inside the old
sheet styles are gone.

### Inbox console error defenses

Hardened the inbox thread filter + label resolver against malformed
thread docs (missing `participants` array, undefined other-uid).
`Array.isArray(t.participants)` skips corrupted writes; the label
collector filters undefined/empty uids before calling `getUserLabel`.
The previous `usersCol().limit(100).get()` on every modal open is gone
— that scan was also where the picker's "showed strangers" bug came
from.

### Google Maps API key

New `mobile/plugins/withGoogleMapsApiKey.js` config plugin — reads
`GOOGLE_MAPS_API_KEY` from `process.env` at prebuild time, injects
`<meta-data android:name="com.google.android.geo.API_KEY">` into the
Android manifest, throws a clear error if the env var is missing
(per global rule against silent defaults). Registered in `app.json`.

The previous hardcoded key (under `android.config.googleMaps.apiKey` in
`app.json`) was deleted; the value moved to `mobile/.env` (git-ignored
via the root `.gitignore`'s `.env` rule). `mobile/.env.example`
documents the variable with no value.

Verified the plugin via `npx expo prebuild --platform android
--no-install`: env loaded, prebuild succeeded, the resulting
`AndroidManifest.xml` contains the expected `<meta-data>` entry
alongside the existing `largeHeap="true"` flag.

### Verification

- `npx tsc --noEmit` — no new errors. Four pre-existing errors remain
  (`app/v/[id].tsx:23`, `lib/firestore.ts:98`, `lib/geocode.ts:18`,
  `lib/videoCache.ts:8`), all unrelated to W1 scope and carried over
  from session 2.
- Prebuild succeeded; manifest contains the injected Maps API key.
- Firestore rules redeployed, ruleset
  `fa5cb462-2456-40fa-bf4a-961b47e8b238` is live.
- **Pending**: device golden path on `0010934AE002636` — sheets, DM
  picker (follows + handle search), Map renders Google tiles. Roman to
  re-attach the device, run `npx expo run:android`, and confirm.

### Manual follow-ups for Roman (W1)

1. Plug in `0010934AE002636` and run `npx expo run:android` to validate
   the golden path. Open every sheet (comments, settings, edit profile,
   edit caption, follow list, report, share-to-chat, AI assistant,
   new-chat), confirm pan-down-to-close + keyboard handling, and check
   Google tiles render on the Map tab.
2. Two-account DM picker smoke test: account A follows B; open inbox →
   "+" → see only B; type 2+ chars in search and confirm a third
   discoverable user appears.
3. The composite index for the search query is declared in
   `firestore.indexes.json` but not pushed by `.deploy-firestore-rules.mjs`.
   Either run `firebase deploy --only firestore:indexes` from an
   interactive shell or follow the one-click create URL Firebase prints
   on the first failed search.
