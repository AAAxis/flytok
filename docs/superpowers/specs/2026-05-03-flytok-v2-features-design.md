# Flytok v2 — Feature Set Design (5-wave plan)

**Date**: 2026-05-03
**Author**: Roman + Claude (brainstorm session)
**Status**: Approved, ready for implementation
**Target completion**: 5 sessions (~5 days assuming one wave per session)

---

## Background

Flytok shipped a working MVP in sessions 1–2 (auth, feed, upload, DMs, profile,
basic map). User feedback after device testing on a Nothing Phone (3a Pro,
6.3" Android 16) surfaced six gaps:

1. **No search anywhere** — users can't find creators, hashtags, or places.
2. **Layout breaks on big Android screens** — feed overlay sits high above the
   tab bar because of hardcoded paddings tuned for the iOS notch.
3. **Map is blank on Android** — no Google Maps API key wired into the manifest.
   Even if it weren't, the design is bare-bones (single markers, no clusters,
   no place card).
4. **Upload is bare** — no trim, no music, no upload-progress feedback, no
   post-upload confirmation.
5. **DM picker shows every user in the database** with no avatars, no follow
   filter, and a console error.
6. **Sheets feel cheap** — every sheet uses raw RN `<Modal>` with no animated
   backdrop, no swipe-to-dismiss, no snap points.
7. **No profile customization** — every profile looks identical.

This design covers all of the above plus a final wave for fastlane / store
submission.

## Goals

1. Production-grade UX for every existing surface (sheets, layouts, maps).
2. Discovery: search and trending places.
3. Personalisation: profile theming visible to other users.
4. Upload v2 with trim, music, progress, success.
5. Repeatable store-submission pipeline (fastlane, automated screenshots).

## Non-goals

- **Spotify/Apple Music sync.** Not legally feasible for indie UGC apps.
- **Original-sound extraction** (TikTok-style "use this sound"). Future wave.
- **Friend invites / phone book sync.** Out of scope for v2.
- **Web app parity.** The Vite admin in `src/` stays as-is; mobile is the focus.

## High-level architecture

No new top-level systems. All work fits the existing stack:

- **Mobile**: Expo Router screens + Firebase JS SDK (`@react-native-firebase/*`).
- **Cloud Functions**: 1 new function (`onVideoCreatePlaceCounter`) and 1
  scheduled function (`rebuildTrendingPlaces`) added to the existing
  `firebase/functions/` codebase.
- **Firestore**: 3 new fields on `users` (`theme`, `preferred_searches`,
  `discoverable`), 1 new field on `videos` (`audioSource`/`audioTrackId`/
  `audioUserPath`), 2 new collections (`places`, `tracks`, `trending_places`).
- **Storage**: 3 new path patterns (`users/{uid}/profile/background.jpg`,
  `audio_library/{trackId}.mp3`, `audio_user/{uid}/{ts}.mp3`).
- **Native**: 2 new dependencies (`@gorhom/bottom-sheet`,
  `react-native-video-trim`), 1 new config plugin
  (`withGoogleMapsApiKey.js`).

## Wave structure

### WAVE 1 — Foundation & quick fixes
*Goal: every sheet looks pro, big-screen Android lays out correctly,
DMs stop showing strangers, map can render once key is wired.*

- Migrate all 8 sheets to `@gorhom/bottom-sheet` behind one `<AppBottomSheet>`
  wrapper.
- Android big-screen layout audit — replace every hardcoded
  `paddingBottom`/`top` with `useSafeAreaInsets` values.
- DM picker rewrite: default = users you follow (with avatars), search box
  finds anyone with `discoverable === true`. Add `discoverable: true` default
  to `ensureUserDoc`. Investigate console error.
- Wire `GOOGLE_MAPS_API_KEY` from `.env` via a new
  `mobile/plugins/withGoogleMapsApiKey.js` config plugin.

Spec: `docs/04-wave-1-foundation.md`.

### WAVE 2 — Map redesign + Profile customization

- Map: clustering, refreshed marker design, sliding place card on tap, Apple
  Maps on iOS / Google Maps on Android (key already wired in W1).
- Profile theme model on `users/{uid}.theme` (preset, bg color OR image,
  accent color, avatar style + seed).
- Customize sheet (built on the W1 bottom-sheet primitive). DiceBear-rendered
  avatar previews using uid as seed.
- Theme applied on profile screens — both `/(tabs)/profile.tsx` (own) and
  `/user/[uid].tsx` (visiting). Falls back to default if unset.

Spec: `docs/05-wave-2-map-profile.md`.

### WAVE 3 — Search + Trending places

- New `mobile/app/search.tsx` opened from a search-icon overlay top-left of
  the home feed. Five categories: Users / Videos / Hashtags / Places /
  Trending Places.
- Empty state: popular hashtag chips + "Your Prefers" (per-user saved
  hashtags on `users/{uid}.preferred_searches: string[]`).
- Cloud Function: `onVideoCreate` counter on `places/{slugify(label)}`.
- Scheduled Function: `rebuildTrendingPlaces` (every 6h) writes top-N to
  `trending_places/snapshot`.

Spec: `docs/06-wave-3-search.md`.

### WAVE 4 — Upload v2

- `react-native-video-trim` for optional native trim step.
- Music picker sheet: "Library" tab (curated CC0 tracks seeded by us) +
  "From device" tab (user upload via `expo-document-picker`).
- New video doc fields: `audioSource`, `audioTrackId?`, `audioUserPath?`.
- Real upload progress bar from `putFile().on('state_changed')`.
- Post-upload success screen with "Watch your post" / "Keep exploring"
  CTAs.
- ToS update covering user-uploaded audio.

(Note: DM global handle search ships in W1 — not W4 — because the
underlying `searchUsersByHandle` is built in W1 to fix the DM picker.)

Spec: `docs/07-wave-4-upload-v2.md`.

### WAVE 5 — Fastlane + Store submission *(deferred)*

PAUSE GATE — needs from Roman: Apple Developer account, ASC API key,
Android upload keystore (or permission to generate), Play Console service
account JSON, and store listing copy.

- `fastlane init` for ios/ + android/. Lanes: `beta` (TestFlight + Internal
  Testing) and `release` (production).
- `fastlane snapshot` (XCUITest) + `screengrab` (Espresso) screenshot
  automation against a `roamerz-b0056-demo` Firebase project.
- `frameit` for device frames + marketing copy overlays.
- Submit to TestFlight + Play Internal first; promote to production after
  smoke test.

Spec: `docs/08-wave-5-fastlane.md`.

## Data model changes (cumulative across waves)

```
users/{uid} (existing — additive):
  + discoverable: boolean              # W1, defaults true on ensureUserDoc
  + theme: {                           # W2
      preset?: 'ocean' | 'sunset' | 'forest' | 'purple' | 'rose' | 'dark' | 'custom'
      backgroundColor: string          # hex
      backgroundImageURL?: string      # if set, overrides backgroundColor
      backgroundImagePath?: string     # storage path for cleanup
      accentColor: string              # hex
      avatarStyle: 'default' | 'adventurer' | 'robot' | 'emoji' | 'portrait' | 'pixel'
      avatarSeed?: string              # default = uid
    }
  + preferred_searches: string[]       # W3, max 20 items

videos/{vid} (existing — additive):
  + audioSource?: 'library' | 'user_upload' | 'original'   # W4
  + audioTrackId?: string                                  # W4, when 'library'
  + audioUserPath?: string                                 # W4, when 'user_upload'

places/{slugify(label)} (NEW — W3, written by Cloud Function only):
  label: string
  bbox: GeoPoint[2]                    # rough centre derived from videos
  videoCount: number
  lastVideoAt: Timestamp

trending_places/snapshot (NEW — W3, written by scheduled fn):
  generatedAt: Timestamp
  topPlaces: { slug: string, label: string, count: number }[]   # max 20

tracks/{trackId} (NEW — W4, seeded by us, read-only to clients):
  title: string
  artist: string
  durationSec: number
  storagePath: string                  # audio_library/{trackId}.mp3
  license: 'cc0' | 'cc-by'             # we only seed CC0
  attributionURL?: string
```

## Storage layout (cumulative)

```
videos/{vid}.mp4                       # existing
chat/{threadId}/{messageId}.jpg        # existing (W2 of session 2)
users/{uid}/profile/background.jpg     # NEW W2 — max 5 MB, image/* only
audio_library/{trackId}.mp3            # NEW W4 — read-only to clients, we seed
audio_user/{uid}/{timestamp}.mp3       # NEW W4 — owner-write, max 15 MB
```

## Firestore rules (incremental, by wave)

- W1: extend `users/{uid}` write rule to allow self-write of `discoverable`.
- W2: extend `users/{uid}` write rule to allow self-write of `theme.*`.
- W3: extend `users/{uid}` write rule to allow self-write of
  `preferred_searches`. New `places` and `trending_places` collections —
  read by all signed-in users, write only via service account (Functions).
- W4: extend `videos/{vid}` create rule to allow `audioSource`,
  `audioTrackId`, `audioUserPath`. New `tracks` collection — read-only to
  signed-in users, no client writes.

## Storage rules (incremental, by wave)

- W2: `users/{uid}/profile/background.jpg` — owner write, public read,
  5 MB cap, `request.resource.contentType.matches('image/.*')`.
- W4: `audio_library/{trackId}.mp3` — public read, no client write.
  `audio_user/{uid}/{ts}.mp3` — owner write only, public read,
  15 MB cap, `audio/*` content type.

## Cloud Functions (W3 only)

```
firebase/functions/src/places.ts (NEW)
  onVideoCreatePlaceCounter   — Firestore v2 trigger on videos/{vid} create.
                                Slugifies location.label, upserts
                                places/{slug} with videoCount++ & bbox.
  rebuildTrendingPlaces       — Scheduled (every 360 minutes). Reads
                                places where lastVideoAt > now-7d, sorts
                                by videoCount desc, writes top 20 to
                                trending_places/snapshot.
```

Both functions ride the existing `firebase deploy --only functions`
pipeline established in session 2 (DM push function).

## Native dependencies & config plugins

- `@gorhom/bottom-sheet` (W1) — pure JS install, no prebuild needed.
- `react-native-map-clustering` (W2) — pure JS wrapper around
  `react-native-maps`, no prebuild needed.
- `react-native-video-trim` (W4) — needs Expo config plugin (ships one).
  Triggers prebuild.
- `expo-document-picker` (W4) — already in Expo, no install.
- New plugin `mobile/plugins/withGoogleMapsApiKey.js` (W1) — reads
  `GOOGLE_MAPS_API_KEY` from `process.env` at prebuild, injects
  `<meta-data android:name="com.google.android.geo.API_KEY">` into
  `AndroidManifest.xml`. **Never commits the key.**

## Risk register

| Risk | Mitigation |
|---|---|
| `react-native-video-trim`'s mux helper doesn't replace audio cleanly | Fallback: use `ffmpeg-kit-react-native` *only* for the audio-mux step. Adds ~30 MB to APK but is reliable. Decide in W4. |
| DiceBear API outage breaks new-user avatars | Cache the rendered SVG to local FS on first load; fallback to Ionicons person glyph. |
| Trending places function over-runs free quota on busy days | Schedule cap at 6h. Aggregator only counts 1 write per video. Should fit free tier through ~10K videos/month. |
| Bottom-sheet migration breaks keyboard handling on the comment composer | Test composer first; gorhom has dedicated `useBottomSheetInternal` for keyboard interplay. Keep old Modal as fallback for that one sheet if blocking. |
| Google Maps key gets leaked because Expo bakes it into the JS bundle | Plugin injects into native manifest only — never imported in JS. Restrict the key to the package + SHA-1 in Cloud Console. |
| Big Android screens still look off after insets fix | Visual diff on the connected `0010934AE002636` device after every screen change. |

## Definition of done (per wave, every wave)

- [ ] Code merged to `main` (one logical commit per wave).
- [ ] App rebuilt and running on `0010934AE002636` without regressions.
- [ ] Manual smoke test: golden path + at least one edge case.
- [ ] `firestore.rules` / `storage.rules` updated and re-deployed via the
      service-account scripts if collections/fields were added.
- [ ] One paragraph appended to `docs/log.md` describing what shipped.
- [ ] If the wave introduced new env vars, document them in
      `mobile/.env.example` (without values).

## Hand-off after each wave

Append a status paragraph to `docs/log.md`. Update the wave checklist in
`prompt.md` (mark this wave `[x]` done). Do not start the next wave in the
same session.

## Open questions (resolved)

| Question | Answer |
|---|---|
| Music sourcing scope? | B — curated library + user upload from device. |
| Google Maps API key? | Provided by Roman, wired via `.env` + config plugin. |
| Search categories? | Users / Videos / Hashtags / Places / Trending Places. No emails. |
| User search by email? | No — handle/displayName only. |
| Trending places aggregation? | Cloud Function (proper aggregator, not client-side bin). |
| Firebase Functions deploy via MCP? | Not possible. Manual `firebase deploy --only functions` from Roman's terminal. |
| DM picker scope? | C — follows + global handle search of `discoverable: true` users. |
| Avatars approach? | DiceBear (uid as default seed). |
| Background image storage? | Firebase Storage, 5 MB cap, image-manipulator resize. |
| Theme visibility? | Per-user, applied on profile screen — visible to anyone viewing that profile. |
| Bottom sheet library? | `@gorhom/bottom-sheet` (recommended). All 8 sheets migrated together. |
| Video trim library? | `react-native-video-trim`. Optional skip. |
| Fastlane stage? | Production submission with full listings (deferred until Roman provides creds). |
| Screenshot strategy? | Automated via `fastlane snapshot` + `screengrab` against demo Firebase project. |

## Out of scope for this design

- Stories / ephemeral content.
- Live streaming.
- Original-sound extraction (TikTok-style sound pages).
- Multi-language i18n (English only for v2).
- Web app changes (admin in `src/` is unchanged).
