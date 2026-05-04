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

## 2026-05-03 — Wave 2 (map redesign + profile customization)

Spec: `docs/05-wave-2-map-profile.md`. Built and installed on
`0010934AE002636` via `npx expo run:android` (PID 3857, no FATAL /
OutOfMemoryError in `adb logcat`). The connected Nothing Phone 3a Pro
ran a clean incremental build — no native config changed this wave, so
no prebuild was needed.

### Map

`mobile/app/(tabs)/map.tsx` rewritten on top of
`react-native-map-clustering@^4.0.0` (pure-JS wrapper around
`react-native-maps`). iOS uses Apple Maps (no `provider` prop); Android
forces `PROVIDER_GOOGLE` (the W1-injected
`com.google.android.geo.API_KEY` meta-data is what unlocks tiles). The
component had to be renamed `Map` → `MapScreen` because the new
`new Map<string, Place>()` aggregation shadowed the global Map
constructor and TS flagged it as a missing construct signature.

Videos are now grouped by lowercase `location.label` so each marker
represents a *place* (not a single video), with a 44×44 rounded bubble
showing the per-place video count and a drop shadow. SuperCluster radius
44 px, count bubble color `colors.accent`, count text `colors.bg`. The
spec wanted a video-poster thumbnail inside each bubble — that requires
a `thumbnailURL` on every video doc which we don't capture at upload
yet, so the bubble shows the count only for now (deferred to W4 once
the upload pipeline can write a poster).

Tapping a marker opens a new `<PlaceCard>` bottom sheet
(`mobile/components/PlaceCard.tsx`) built on the W1
`<AppBottomSheet>` primitive: place label + count, top 3 video tiles
(rendered via `expo-video` muted/non-looping `useVideoPlayer`), and a
brand-color "Open feed" CTA. Tapping a tile or the CTA routes to a new
place-scoped feed at `mobile/app/place/[slug].tsx`. The slug is just
`encodeURIComponent(label.toLowerCase())` — the original-case `label`
travels via query param so the screen header reads naturally. The
place-feed reuses the same player-pool infra as `posts/[uid].tsx` (3
slots, 8 MB buffer cap, eviction on rotate-out) and filters videos
client-side until the W3 places aggregator lands on the backend.

### Profile theme model

New `mobile/lib/theme/userTheme.ts` defines `UserTheme`
(`preset | backgroundColor | backgroundImageURL | backgroundImagePath |
accentColor | avatarStyle | avatarSeed`), a `defaultTheme` fallback,
6 presets (ocean / sunset / forest / purple / rose / dark), 12-color
background and accent palettes, an `applyTheme()` helper that returns
the styles each profile screen needs, and a `useUserTheme(uid)`
real-time subscription. `saveUserTheme()` does an atomic merge under
`theme.*` on the user doc. Background-image flow:
`expo-image-manipulator` resize to 1600 px long side @ JPEG 0.85 →
upload to fixed `users/{uid}/profile/background.jpg` →
`getDownloadURL()` → set `theme.backgroundImageURL` +
`theme.backgroundImagePath` + `preset: 'custom'`. Old image is deleted
from Storage when a new one replaces it.

`mobile/lib/avatars.ts` exposes `dicebearURL(style, seed, size)` and
the 6 supported `AvatarStyle` values mapped to DiceBear endpoints
(adventurer / bottts / fun-emoji / avataaars / pixel-art).
`avatarStyle === 'default'` returns `null` — caller falls back to the
uploaded `photoURL` (or the person glyph).

### Customize sheet

`mobile/components/CustomizeThemeSheet.tsx` mirrors the screenshot:
preset row → background-color grid → background image upload (with
preview, replace, remove) → accent-color grid → avatar style grid (6
DiceBear previews seeded by uid). Built on `<AppBottomSheet>` at 90%
snap with `BottomSheetScrollView`. Every interaction writes through
`saveUserTheme` so the live `useUserTheme` subscription instantly
reflects the change in the profile header behind the sheet.

### Theme application

Both `mobile/app/(tabs)/profile.tsx` (own profile) and
`mobile/app/user/[uid].tsx` (visiting profile) now wrap the header in
a new `ThemedHeader` helper: `<ImageBackground>` + scrim when
`backgroundImageURL` is set, plain colored `<View>` otherwise. Avatar
gets a 2 px border in the user's accent color. The own-profile header
gained an actions row with **Edit profile** and a brand-accented
**Customize** button (opens the new sheet). The visiting-profile
**Follow** button background uses the visited user's accent color so
themes propagate to anyone who opens `/user/[uid]`. Theme is **not**
applied to feed / inbox / map / search — confirmed by leaving those
screens untouched.

### DiceBear caching note (heads-up for W4)

`<Image source={{ uri: dicebearURL(...) }}>` hits DiceBear once per
unique style+seed and React Native's image cache holds it for the
process lifetime; that's fine for the customize grid (6 fetches per
session, no-op afterward). W4's music picker plans to render remote
thumbnails too — if avatars start to feel slow on first paint we
should switch to `expo-image` for shared on-disk cache, but for now
the bare `<Image>` is enough.

### Rules

`firestore.rules` adds a comment under `users/{uid}` documenting the
new self-writable `theme.*` map — the existing `isSelf(uid)` write
rule already covers it, so behavior is unchanged. **Did not redeploy**
the ruleset (current ruleset
`fa5cb462-2456-40fa-bf4a-961b47e8b238` from W1 is still correct).

`storage.rules` gains a new `users/{uid}/profile/{file=**}` rule:
owner-only writes, public reads, 5 MB cap, `image/*` content type,
`delete` only by owner. The service-account release call still hits
`PERMISSION_DENIED` on the Storage Rules release endpoint (same
limitation logged in session 2). Ruleset `0c88402d-2b30-443a-8b1e-76c721f93abc`
was created server-side but not released.

### Verification

- `npx tsc --noEmit` — only the four pre-existing errors remain
  (`app/v/[id].tsx:23`, `lib/firestore.ts:98`, `lib/geocode.ts:18`,
  `lib/videoCache.ts:8`). Wave 2 code typechecks clean.
- `npx expo run:android` rebuild + install on `0010934AE002636`. App
  boots; PID 3857 stable; no `FATAL EXCEPTION` / `OutOfMemoryError` in
  `adb logcat`.
- **Pending (manual)**: two-account device test — A picks an Ocean
  preset + uploads a bg image + Robot avatar; B logs in, opens
  `/user/{A.uid}`, sees A's theme. iOS Apple Maps tiles check (no
  Google attribution) — needs an iOS sim/device.

### Manual follow-ups for Roman (W2)

1. `firebase deploy --only storage` — service-account auth still can't
   release Storage rules. Until that runs, the new
   `users/{uid}/profile/*` rule isn't live, and the customize sheet's
   image upload will be denied by the existing default-deny.
2. Two-account theme test on `0010934AE002636` (or one device + one
   simulator). Confirm visiting-profile pulls A's theme, including the
   bg image, accent-colored Follow button, and DiceBear avatar.
3. iOS Apple Maps smoke check (Mac sim or any iOS device) — verify the
   map tab renders Apple tiles (no Google attribution) and clusters
   still work without the `PROVIDER_GOOGLE` prop.

## 2026-05-03 — Wave 3 (search + trending places)

Spec: `docs/06-wave-3-search.md`. All acceptance criteria implemented;
on-device verification still pending — the connected Android target
`0010934AE002636` was not attached during this session (`adb devices`
returned empty). Cloud Function deploy is also a Roman-only step
(`firebase deploy --only functions` needs interactive `firebase login`).

### Search screen + components

`mobile/app/search.tsx` is a top-level route opened from the new
search-icon overlay top-left of the trending feed (mirroring the AI
sparkle button on the right). The screen flips between two modes off the
debounced input:

- **Empty (`q.length < 2`)** — `<PopularChips>` row of curated
  hashtags (Nightlife / Trips / Camps / Hotels / Club / Restaurant /
  Beach), `<PrefersSection>` (per-user `users/{uid}.preferred_searches`
  with add/remove + tap-to-fill), and `<TrendingPlaces>` (single-doc
  read of `trending_places/snapshot`).
- **Querying (`q.length >= 2`)** — `<ResultsTabs>` with tabs
  `All / Users / Videos / Hashtags / Places`. The four queries fire in
  parallel via `Promise.all`; the tab body renders whichever finished.
  Tapping a row routes to `/user/[uid]`,
  `/posts/[ownerUid]?start=…`, the new `/tag/[tag]`, or the existing
  `/place/[slug]` from W2.

The popular chips use solid vivid backgrounds rather than gradients
because `expo-linear-gradient` isn't currently in the bundle and the
spec's bigger goal (visual differentiation between categories) reads
fine without it. Keeping the JS-only dep set unchanged kept the build
risk to zero on a session where I can't smoke-test on device.

### Tag feed

`mobile/app/tag/[tag].tsx` is a hashtag-filtered video feed —
`videos.where('hashtags', 'array-contains', tag)`, lower-cased the
same way `extractHashtags` writes them. Same player-pool wiring as the
trending feed and `posts/[uid].tsx`: 3 slots, 8 MB buffer cap,
eviction-via-`replace(null, true)` on rotate-out, `windowSize=3`. No
new memory profile to worry about.

### Search query layer

`mobile/lib/search/queries.ts` exports `searchVideos`,
`searchHashtags`, `searchPlaces`, `getTrendingPlaces`,
`getPopularHashtags`, plus the `preferred_searches` helpers
(`getPreferredSearches`, `addPreferredSearch`, `removePreferredSearch`,
`setPreferredSearches`, `normaliseSearchTerm`) and
`MAX_PREFERRED_SEARCHES = 20` / `MAX_PREFERRED_LENGTH = 32`. The pure
`captionTokens` function moved into `mobile/lib/search/tokens.ts` to
break a cycle between `firestore.ts` and the search-queries module —
both consume it without the cycle.

`uploadVideo` and `updateOwnVideoCaption` now write
`captionTokens: string[]` (lowercased, 3+ chars, deduped, capped at
30 entries). `searchVideos` does an `array-contains` lookup against
that field — the closest thing Firestore offers to full-text search
without paying for a third-party index.

### Cloud Functions

`firebase/functions/src/places.ts` (NEW) ships two functions and the
`slugify` helper:

- `onVideoCreatePlaceCounter` — Firestore v2 trigger on `videos/{vid}`
  create. Slugifies `location.label` (NFKD-normalised, ASCII-only,
  80-char cap), then runs a transaction that upserts `places/{slug}`
  with `videoCount: increment(1)`, `lastVideoAt: serverTimestamp`,
  `label`, `label_lower`, and a running bbox of (lat, lng) GeoPoints.
  Stamped `firstVideoAt` on initial create. Skips silently if the
  video has no `location.label`.
- `rebuildTrendingPlaces` — `onSchedule('every 360 minutes')`. Reads
  places with `lastVideoAt >= now - 7d` (falls back to a plain
  `orderBy('lastVideoAt')` if the composite index isn't present),
  sorts by `videoCount` desc, writes the top 20 to
  `trending_places/snapshot`. Idempotent — safe to re-run any time.

`firebase/functions/src/index.ts` re-exports both. `npm run build`
clean.

### Firestore rules

`firestore.rules` adds:

- `match /places/{slug}` — read by any signed-in user, write
  `false` (only the service-account-running Cloud Function bypasses
  rules and writes here).
- `match /trending_places/{docId}` — same shape.
- `users/{uid}` rule extended with `preferredSearchesValid()` helper:
  `preferred_searches`, when present, must be a list ≤ 20 items.
  Per-element 32-char cap is enforced client-side via
  `normaliseSearchTerm` (rules language can't iterate a list of
  strings cleanly).

Deployed via `.deploy-firestore-rules.mjs roamerz-b0056 firestore.rules`
with `GOOGLE_APPLICATION_CREDENTIALS` set to the service account.
Ruleset `7edaf9d6-a427-4ce9-8209-529f906021f6` is live.

### Verification

- `npx tsc --noEmit` (mobile) — only the four pre-existing errors
  remain (`app/v/[id].tsx:23`, `lib/firestore.ts:99`, `lib/geocode.ts:18`,
  `lib/videoCache.ts:8`), all carried over from session 2 and unrelated
  to W3 scope. Wave 3 code typechecks clean.
- `cd firebase/functions && npm run build` — clean.
- Firestore rules deployed (ruleset
  `7edaf9d6-a427-4ce9-8209-529f906021f6`).
- **Pending**: device golden path on `0010934AE002636` — search overlay
  on the home feed, autofocus + debounce, all 5 tabs render, tag/place
  feeds open, popular chips fill the input, "Your Prefers" round-trips
  add/remove, trending places renders after the function runs.

### Manual follow-ups for Roman (W3)

1. Plug in `0010934AE002636` and run `npx expo run:android`. Hit the
   new search button (top-left of the trending feed), confirm autofocus
   + 300 ms debounce, type "berlin" (or whatever your seed data has),
   confirm at least one user / video / hashtag / place lights up. Tap
   each to confirm routing into `/user/[uid]`, `/posts/…`, `/tag/…`,
   `/place/…`.
2. `cd firebase/functions && npm run deploy` — needs interactive
   `firebase login`. Ships `onVideoCreatePlaceCounter` and
   `rebuildTrendingPlaces` alongside the existing `onMessageCreated`.
3. After the deploy, kick `rebuildTrendingPlaces` once manually
   (`firebase functions:shell` then `rebuildTrendingPlaces()`) so
   the `trending_places/snapshot` doc exists before the search screen
   reads it. Without that one-off run, the empty state's "Trending
   places" section silently renders nothing.
4. Optional: declare a composite index on `places(lastVideoAt asc,
   videoCount desc)` if `rebuildTrendingPlaces` logs the indexed-query
   fallback. Add to `firestore.indexes.json` and
   `firebase deploy --only firestore:indexes`. The fallback is fine for
   v1 traffic — only revisit if the function logs warnings at scale.

## 2026-05-03 — Wave 4 (upload v2)

Spec: `docs/07-wave-4-upload-v2.md`. Code shipped on 2026-05-03; on-device
verification still pending — the connected Android target
`0010934AE002636` was not attached during this session (`adb devices`
returned empty), and W4 is the first wave that requires a native
rebuild (new Turbo/native module from `react-native-video-trim`).

### Trim step

`react-native-video-trim@^8.0.0` installed via `npx expo install`. No
custom Expo config plugin needed — the package auto-links via
`@react-native-community/cli` on both iOS and Android, and works on the
old architecture (`newArchEnabled: false`) through its `OldArch.ts`
shim. The `mobile/components/upload/TrimButton.tsx` component validates
the source file with `isValidFile()`, calls `showEditor()` with a
60 000 ms ceiling that matches the existing `videoMaxDuration` on the
camera path, and listens via
`new NativeEventEmitter(NativeModules.VideoTrim)` for the
`'VideoTrim'` event (the lib's old-arch contract). On
`onFinishTrimming` the trimmed file path replaces the upload form's
`uri` state; cancel / error events restore the original picker uri
without touching state.

### Music picker

`mobile/components/upload/MusicPickerSheet.tsx` is built on the W1
`<AppBottomSheet>` primitive at an 85% snap. Two pills toggle between
**Library** (curated `tracks/*` docs streamed via the new
`mobile/lib/audio.ts:loadTracks` helper) and **From device**
(`expo-document-picker` `audio/*` → `uploadUserAudio` →
`audio_user/{uid}/{ts}.{ext}`). Library rows tap-to-preview through
`createAudioPlayer` (`expo-audio@~1.1.x`, looped + pre-resolved
download URL) and long-press / Use button to commit. The picker
closes via the Done button so the user can audition multiple tracks
without re-opening. The selected `AudioSelection` flows back through
the sheet's `onSelect` to the upload screen and is persisted on the
video doc as `audioSource` + `audioTrackId | audioUserPath`.

### No client-side audio mux (deferred)

The spec called for muxing the chosen audio onto the trimmed video at
upload time, with `react-native-video-trim`'s mux helper as the first
attempt and `ffmpeg-kit-react-native` as the fallback. Both options
turned out to be unviable today:

- `react-native-video-trim`'s headless `merge()` runs FFmpeg's
  **concat filter** (sequential merge of multiple clips) per its iOS
  `VideoTrim.swift:1424` comment ("Concatenates multiple local video
  files using FFmpeg's concat filter"). It is not a stream-replacement
  mux and cannot swap a video's audio track.
- `ffmpeg-kit-react-native@6.0.2` (last published 2023-09-18) is
  marked deprecated on npm: "Package no longer supported. Contact
  Support…". Adding it would lock us to an unmaintained binary +
  ~30 MB APK growth.

Instead, W4 ships only the metadata side of the contract: the video
doc records `audioSource: 'library' | 'user_upload' | 'original'`
plus `audioTrackId` or `audioUserPath` so a future wave can do the
mux server-side (Cloud Function on the existing `videos/{vid}`
trigger) or render the chosen audio as a playback overlay in the
feed. Original audio remains in the uploaded file regardless. This is
documented at the top of `mobile/lib/audio.ts` so the trade-off
isn't a surprise to the next reader.

### Upload progress + cancel

`uploadVideo()` in `mobile/lib/firestore.ts` now accepts
`audio?: AudioSelection`, `onProgress?: UploadProgressCallback`, and
`taskRef?: { current: FirebaseStorageTypes.Task | null }`. The
`putFile` task subscribes to `state_changed` and forwards
`bytesTransferred / totalBytes` as `{ phase: 'upload', percent }`; the
`taskRef` lets the screen call `task.cancel()` from the progress
bar's Cancel link. `mobile/components/upload/UploadProgressBar.tsx`
renders a brand-accent fill with the phase label
(`UPLOAD_PHASE_LABELS` in `mobile/lib/uploadProgress.ts`) and tabular
percentage. Storage's `storage/cancelled` error is caught in the
upload screen and surfaced as a non-modal "Upload cancelled" alert.

### Success screen

`mobile/app/upload/success.tsx` renders after `router.replace` from
the upload screen with `videoId` as a search param. It loads the
freshly-written `videos/{videoId}` doc, mounts `expo-video` muted +
non-looping with auto-play disabled so the first frame acts as a
poster, and renders the caption over the bottom of the frame. Two
CTAs: **Watch your post** routes to `/posts/[uid]?start={videoId}&source=mine`,
**Keep exploring** routes to `/(tabs)`. Reaching the screen via
`replace` (not `push`) so the device back button doesn't return to a
half-cleared upload form.

### ToS

`mobile/app/legal/terms.tsx` gained an "Audio you upload" section
covering the spec's takedown contract: user is responsible for the
audio they upload, must hold the necessary licenses, and takedowns go
to `support@flytok.com`. The footer's "Last updated" bumped to
May 2026 to match.

### Rules + storage paths

`firestore.rules` adds a comment block on `videos/{vid}` documenting
the new optional audio fields and a new `tracks/{trackId}` block
(read-only to clients, writes blocked — only the seed script bypasses
via service-account creds). `storage.rules` gains
`audio_library/{file=**}` (public read, no client write) and
`audio_user/{uid}/{file=**}` (owner-only writes, public read,
15 MB cap, `audio/*` content type, owner-delete for cleanup of
orphaned uploads). Production rule deploy is a Roman-only step this
session — the harness blocked the `.deploy-firestore-rules.mjs`
production write because the user request didn't explicitly authorize
deploying rules to prod.

### Track seeding

`scripts/seed-tracks.mjs` is a one-off Node script that uses
`firebase-admin` (service account auth, mirroring `seed-feed.js`)
to download a curated list of CC0 Pixabay Music tracks, upload each
to `audio_library/{trackId}.mp3` in Storage, and write a
`tracks/{trackId}` doc with title / artist / duration / category /
license / attribution. Re-running is idempotent (Storage uploads
overwrite, Firestore writes use `merge: true`). The default `TRACKS`
array is a starter set — Roman should curate real Pixabay Music URLs
before running it.

### Verification

- `npx tsc --noEmit` (mobile) — only the four pre-existing errors
  remain (`app/v/[id].tsx:23`, `lib/firestore.ts:101`,
  `lib/geocode.ts:18`, `lib/videoCache.ts:8`), all carried over from
  W1 and unrelated to W4 scope. Wave 4 code typechecks clean.
- **Pending**: device golden path on `0010934AE002636` — a native
  rebuild is required for `react-native-video-trim` (Turbo/native
  module). Roman to plug in the device, run
  `npx expo prebuild --platform android` (NOT `--clean`) followed by
  `npx expo run:android`. Then exercise: pick / record video → tap
  Trim, complete the trim, confirm trimmed clip becomes the preview;
  open the music picker, preview a library track, long-press to pick,
  confirm Selected pill renders; switch to From device, pick an mp3,
  confirm upload progress fills and the picker confirms; back on
  step 2, tap Post, watch the progress bar advance through 'upload'
  → 'finalize', land on the success screen, tap Watch your post.

### Manual follow-ups for Roman (W4)

1. **Native rebuild.** `npx expo prebuild --platform android` (NOT
   `--clean`), then `npx expo run:android`. Without this the
   `VideoTrim` native module won't be linked and `TrimButton` will
   warn "VideoTrim native module missing" on first tap.
2. **Production rule deploy.** From an interactive shell:
   `GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/roamerz-b0056-firebase-adminsdk-fbsvc-9f5ef21bd1.json
   node .deploy-firestore-rules.mjs roamerz-b0056 firestore.rules`.
   Until that runs, `tracks/*` reads still succeed (no rule denies
   them — the addition is read-only), but the doc-level shape is
   undocumented at the rules layer.
3. **Storage rule release.** Same blocker as W2 — service-account
   auth fails on the Storage Rules release endpoint. Run
   `firebase deploy --only storage` from an interactive shell so the
   new `audio_library/*` and `audio_user/{uid}/*` rules go live.
   Without this, the device-tab audio upload will hit default-deny.
4. **Seed the music library.** `node scripts/seed-tracks.mjs`. The
   default `TRACKS` array is a starter set — review the URLs (Pixabay
   CDN paths sometimes shift) and replace with curated picks before
   running. Without seeded tracks the picker's Library tab renders
   the empty-state hint.
5. Two-account smoke test of the upload pipeline once the rebuild +
   deploys are live (golden path: trim + library track → success
   screen; edge cases: device-audio upload, original audio with no
   selection, mid-upload cancel).

## 2026-05-04 — Wave 6 (saved tab + profile map + DMs entry)

Spec: `docs/09-wave-6-saved-tab-profile-map.md`. Master design:
`docs/superpowers/specs/2026-05-04-pre-launch-fixes-design.md`. Built and
installed on `0010934AE002636` via `ANDROID_SERIAL=… npx expo run:android`
(BUILD SUCCESSFUL, dev client launched, PID 24177 stable; `adb logcat -b
crash` empty, no `FATAL EXCEPTION` / `OutOfMemoryError` in the main log).
No native config changed this wave so no prebuild.

### Tab restructure

Bottom tab bar is now `Feed | Map | + | Saved | Profile`. The Inbox tab
is gone — its file moved from `mobile/app/(tabs)/inbox.tsx` to
`mobile/app/inbox.tsx` so it is a top-level stack screen. Deep-link
routing from FCM (`/chat/{threadId}`) is unaffected; the chat screen
file did not move. The `useUnreadBadge` hook is no longer consumed in
`(tabs)/_layout.tsx` — the tab badge is gone with the tab.

### Saved tab

`mobile/app/(tabs)/saved.tsx` is a new top-level tab. It subscribes to
`savesCol(me.uid).onSnapshot` (same pattern the profile screen used
before this wave) and resolves the saved video ids to `VideoDoc[]` via
`getVideosByIds`. Renders `<VideoGrid>` with the empty-state copy
"Nothing saved yet". Pull-to-refresh re-runs an ordered query; tapping a
tile pushes `/posts/{me.uid}?start={vid}&source=saved` (unchanged URL
contract). Safe-area insets respected on top + bottom.

### Profile top bar

The profile top bar moved from a 2-cell `[handle][burger]` layout to a
3-cell `[burger][@handle (centered)][DM icon]` layout. The handle pill
now sits in the centered cell (a flex-1 container with
`alignItems: 'center'`), so it visually centers regardless of the icon
button widths on either side.

The DM icon is a chatbubble inside the same rounded-button shape as the
existing burger menu, themed via `themed.accentColor`. Tapping it
pushes `/inbox` (the now-top-level stack screen). When
`useUnreadBadge() > 0`, an 8 px red dot (`#ef4444`) renders on the
top-right of the icon — no number, just a binary indicator. The hook
moved from `(tabs)/_layout.tsx` (where it drove the dropped tab badge)
to here.

The profile *Saved* stat card column is gone — the stats card now reads
`Posts | Following | Followers`. The local `saved` state, the
`savesCol` snapshot listener, the `getSavedVideoIds` /
`getVideosByIds` calls in `load()`, and the one-shot `diagnoseSaves`
diagnostic Alert all moved out (saves are now the Saved tab's
concern). `lib/profileCache.ts` lost its `saved: VideoDoc[]` field to
match.

### Profile sub-tabs (Posts | Map)

The bookmark sub-tab is gone — sub-tabs are now `Posts | Map` (icons
`grid-outline` and `map-outline`). Tab type union was renamed
`'mine' | 'saved'` → `'mine' | 'map'`.

`mobile/components/profile/ProfileVideoMap.tsx` is a new pure-viewer
clustered map of the user's own posts. Built on the same
`react-native-map-clustering` + `DARK_MAP_STYLE` + `userInterfaceStyle:
'dark'` stack as the global Map tab, but with no user-location dot, no
recenter FAB, no category filter — that stuff is the global map's job.
On Android it forces `PROVIDER_GOOGLE`; on iOS it lets Apple Maps take
over.

Three render branches:

- `loading` → centered `ActivityIndicator`.
- `videos.length === 0` → "No posts yet" empty state with the
  `cloud-upload-outline` icon.
- `videos.length > 0` but no `location.latitude` on any → "No location
  on your posts yet" empty state with `location-outline`.
- otherwise → `ClusteredMapView` fitted to the marker bounds.

The initial region is computed from the bounding box of the user's
located videos with a 1.4× padding factor; on `onMapReady`, the map
calls `fitToCoordinates` with a 60 px edgePadding for a precise fit
that respects the cluster radius. If only one marker exists,
`fitToCoordinates` is skipped and the initialRegion uses a 0.05 delta.
A spinner overlay covers the map until `onMapReady` fires so we don't
flash the empty grey canvas while Google's tiles load. Markers are
small accent-colored bubbles with a videocam glyph (a poster
thumbnail would need a `thumbnailURL` field on every video doc which
the upload pipeline still doesn't capture — see W2 log). Tapping a
marker pushes `/posts/{me.uid}?start={vid}&source=mine`.

### Verification

- `npx tsc --noEmit` (mobile) — clean.
- `npx expo run:android` clean incremental build (`BUILD SUCCESSFUL in
  4s`, `Task :app:assembleDebug UP-TO-DATE`). Installed APK + opened
  dev client on `0010934AE002636`. App boots, `ReactNativeJS: Running
  "main" with {"rootTag":11}` reached, no FATAL / OOM / JS-side errors
  in `adb logcat --pid=…`.
- **Pending** (manual): two-account on-device smoke test —
  Saved tab grid + empty state, profile DM icon → inbox stack, profile
  Posts/Map sub-tabs, both Map empty states (zero videos / videos with
  no location), unread dot lights up when a friend sends a message.

### Manual follow-ups for Roman (W6)

1. Two-account device smoke test of the new flows on
   `0010934AE002636`. Confirm:
   - Bottom tab bar reads `Feed | Map | + | Saved | Profile`. No
     Inbox tab.
   - Saved tab shows the user's saved videos (or the empty state).
     Save a video from the feed, switch to Saved, see it appear live.
   - Profile top-right is now a chatbubble. Tapping it pushes
     `/inbox`. Send yourself a message from another account, see the
     red dot light up.
   - Profile sub-tabs are `Posts | Map`. Map shows clustered markers
     for posts that have a location. Tap a marker to navigate into
     the user's feed at that video.
2. Confirm cold-start FCM tap still lands on `/chat/{threadId}` (no
   change expected — `app/chat/[threadId].tsx` did not move).

## 2026-05-04 — Wave 7 (pre-auth onboarding + share-to-chat unification)

Spec: `docs/10-wave-7-onboarding-share.md`. Master design:
`docs/superpowers/specs/2026-05-04-pre-launch-fixes-design.md`. Built and
installed on `0010934AE002636` via `ANDROID_SERIAL=… npx expo run:android`
(BUILD SUCCESSFUL in 11s, dev client launched, PID 24894 stable; `adb
logcat -b crash` empty, no `FATAL EXCEPTION` / `OutOfMemoryError` /
unhandled-exception lines on `--pid=24894`). AsyncStorage autolinked
through Expo modules — no native config change beyond the new module
linkage, no `expo prebuild` run.

### Onboarding (2-screen pre-auth carousel)

`@react-native-async-storage/async-storage@^2.0.0` is the new dep. We
wrap it in `mobile/lib/onboarding.ts` (`getHasSeenOnboarding` /
`setHasSeenOnboarding`) so the auth gate doesn't import AsyncStorage
directly and so we can swap storage backends later without touching
callers. The persisted key is `flytok.hasSeenOnboarding.v1` — bumping
the suffix is how we'll force a re-walkthrough if onboarding ever
ships a different message.

`mobile/app/onboarding.tsx` is a top-level Stack route (`SafeAreaView`
+ horizontal `FlatList pagingEnabled`) with two `OnboardingSlide`
cells. Paginator is two pill-style dots above the action bar (the
active one widens + flips to `colors.accent`). Action bar is
`Skip` (left, ghost) + primary pill `Continue` / `Get started` (right,
last-page sensitive). Both Skip and Get started call
`setHasSeenOnboarding(true)` then `router.replace('/login')`. Continue
calls `scrollToIndex({ index: index + 1 })`. Viewability threshold is
60% so the dot transitions cleanly mid-swipe.

Hero illustrations are inline JSX (concentric accent halos + a 120 dp
center pill in `colors.accent` + three `colors.surface` satellite
chips around the perimeter). Slide 1: `compass / videocam / airplane`
satellites + a `location` glyph centered. Slide 2: `heart /
paper-plane / bookmark` satellites + `chatbubbles` centered. The slide
component (`mobile/components/onboarding/OnboardingSlide.tsx`) takes
the hero as a `ReactNode` slot — the spec asked for SVG/PNG assets but
`react-native-svg` isn't in the bundle and shipping placeholder PNGs
that get replaced before submission would just be dead weight. Roman
swaps each `<DiscoverHero />` / `<ShareHero />` for the final art at
the same prop site when commissioned.

Copy is the spec's placeholder verbatim (Apple-rejection-blocking
content, not final): "Discover places worth flying for" + "Browse
short, punchy travel videos pinned to real-world places. Tap any
video to see its location on the map." then "Share moments. Chat with
creators." + "Save the spots you love, message the people who shot
the videos, and post your own clips when you're on the road." Roman
to tighten before the resubmit.

### Auth gate hydration (`mobile/app/_layout.tsx::Gate`)

The gate now hydrates `hasSeenOnboarding` from AsyncStorage on mount
into a `seen: boolean | null` state. Spinner stays up while
`seen === null` so the cold-start render never flashes `/login` for
first-launch users (would have been a one-frame regression). A second
effect re-hydrates the flag whenever `user` becomes null, so logging
out from `SettingsSheet` properly bounces the user back through
onboarding instead of hitting the now-stale cached value.

Routing decisions, in order:
- `!user && !seen && !onOnboarding` → `/onboarding`
- `!user && seen && !onLogin && !onOnboarding` → `/login`
- `user && (onLogin || onOnboarding)` → `/`

`AuthContext.logout` now calls `setHasSeenOnboarding(false)` after
`auth().signOut()`. Account deletion (`deleteAccount` in firestore)
goes through `auth().onAuthStateChanged` → `user = null` → the
re-hydrate effect — but the flag stays at its last persisted value
unless the user took the explicit `Sign out` row. That's intentional:
a forced session expiry shouldn't restart onboarding, only an
intentional logout should.

### Share-to-chat unification

`mobile/components/ShareToChatSheet.tsx` is now the only entry point
for the in-feed Share button. The list header inside the
`BottomSheetFlatList` is a single `<View>` that holds two rows in
fixed order:

1. **Share externally** — `paper-plane-outline` icon, "Copy link,
   send via other apps" subtitle. `onPress` calls
   `Share.share({ message, url })` with the payload built by the new
   `defaultExternalShare(video)` helper (the same template the
   `FeedItem`'s tap-Share flow used to compose inline:
   `https://flytok.vercel.app/v/${video.id}` + caption prefix). The
   sheet now owns the URL template, so swapping it out (different
   domain, deep link scheme, etc.) is a one-file change.
2. **Send to creator** — unchanged. Hidden when the viewer is the
   video owner.

Below the header rows, the existing thread list is unchanged. The
sheet exposes a new `externalShare?: { message: string; url: string }`
prop for callers that need to override the template (e.g. shared
posts from search later).

`mobile/components/FeedItem.tsx` lost the inline `Share.share` call
*and* the `onLongPress` hidden gesture on the Share button. The button
is now a single `Pressable` with `onPress={() => setShowShare(true)}`
— one behaviour, no easter-egg. The `Share` import was removed from
the file (the sheet owns it now).

### Verification

- `npx tsc --noEmit` clean (0 errors, 0 warnings).
- `npx expo run:android` clean build, debug APK installed and dev
  client opened on `0010934AE002636` via `flytok://expo-development-client`.
  `ReactNativeJS: Running "main" with {"rootTag":11}` reached, Legacy
  Architecture deprecation warning is the only RN log line, no
  `FATAL` / `OutOfMemoryError` / unhandled-exception lines under
  `--pid=24894`. PID stable after the dev client opened.
- **Pending** (manual, mirrors the W6 pattern): full cold-start
  walkthrough of the new flows on the device. The dev install is
  currently logged in (W6 install), so the gate routes straight to
  `/(tabs)`. To verify the carousel itself, Roman needs to
  `Sign out` from `SettingsSheet` → next launch shows
  `/onboarding` (the new logout flag reset kicks in).

### Manual follow-ups for Roman (W7)

1. Two-screen onboarding device walkthrough on `0010934AE002636`:
   - Sign out from Settings.
   - Kill + reopen app → onboarding screen 1 visible (compass /
     videocam / airplane satellites; "Discover places worth flying
     for" copy; paginator dot 1 active; Skip + Continue buttons).
   - Tap **Continue** → screen 2 (chatbubbles + heart / paper-plane
     / bookmark satellites; "Share moments. Chat with creators."
     copy; paginator dot 2 active; Skip + Get started buttons).
   - Tap **Get started** → routes to `/login`.
   - Sign back in → lands on `/(tabs)`. Kill + reopen → still
     `/(tabs)` (no onboarding loop on subsequent launches).
   - Sign out again → kill + reopen → onboarding screens again
     (the flag reset is working).
   - Edge case: on screen 1, tap **Skip** → routes straight to
     `/login` and persists the flag (next launch bypasses onboarding
     until the next logout).
2. Share-button unification on any feed video:
   - Tap (no long-press) the Share button → `ShareToChatSheet`
     opens.
   - Header shows two rows in order: **Share externally** then
     **Send to creator** (the second one hidden if you're the
     owner). Below them, the thread list.
   - Tap **Share externally** → native iOS / Android share sheet
     appears with `https://flytok.vercel.app/v/{id}` (caption
     prefixed if present). Cancelling leaves the sheet open;
     completing dismisses it.
   - Long-pressing the Share button is now a no-op (no hidden
     gesture).
3. Final onboarding artwork: replace each `<DiscoverHero />` /
   `<ShareHero />` JSX with the commissioned PNG / SVG (the
   `OnboardingSlide hero` slot accepts any ReactNode, so the asset
   can be `<Image source={…} />` or a `react-native-svg` tree once
   that lib is added). Tighten the placeholder copy at the same
   time — it's the wording Apple will see otherwise.
