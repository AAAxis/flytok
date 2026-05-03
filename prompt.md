# Flytok / Roamrez — Master Brief (v2 features)

> Paste this into Claude Code at the start of a new session, or just say
> *"read prompt.md and execute the next wave"*. This brief assumes
> sessions 1 + 2 already shipped (auth, feed, upload, DMs, profile, OOM
> fix, Android edge-to-edge fix). Background in
> `docs/00-previous-session-summary.md` and `docs/log.md`.

---

## Project

- **Repo**: `/Users/romanpochtman/Developer/flytok`
- **Mobile app**: `mobile/` — Expo (SDK 54, RN 0.81), TypeScript,
  expo-router
- **Web admin**: `src/` — Vite + React 18 + Radix + shadcn (out of scope
  for v2 work)
- **Web reference**: `flytok-main/` — base44 demo of the product (NOT
  Firebase). Use as visual/UX reference only; mobile data layer is
  Firebase.
- **Firebase project**: `roamerz-b0056` (project number `320506157076`)
- **Bundle id (iOS + Android)**: `com.roamrez.flytok`
- **Service account**: `roamerz-b0056-firebase-adminsdk-fbsvc-9f5ef21bd1.json`
  at repo root (git-ignored)
- **Firebase MCP**: pre-configured at `local` scope in `~/.claude.json`
  for this project — `firebase` server should appear in `claude mcp list`
  immediately. Note: MCP cannot deploy Cloud Functions — use
  `firebase deploy --only functions` from a logged-in shell.
- **Connected Android device**: `0010934AE002636` (model `A015`,
  Nothing Phone 3a Pro, Android 16, SDK 36)

## Operating principles

- Read `~/.claude/CLAUDE.md` first — global hard rules (no hardcoded
  secrets, no `expo prebuild --clean`, no `.env` commits, etc.).
- Never run `expo prebuild --clean`. Use
  `npx expo prebuild --platform android` only when native config
  changes (e.g. after wiring `withGoogleMapsApiKey`).
- Firestore rules in `firestore.rules` are authoritative — re-deploy
  via `node .deploy-firestore-rules.mjs roamerz-b0056 firestore.rules`
  with `GOOGLE_APPLICATION_CREDENTIALS` set to the service account.
- All work happens on `main` (no PR flow) — commit logically per wave
  (one coherent commit at the end of each wave).

## V2 design (master spec)

The full v2 design is at:
**`docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`**

It covers 5 waves, data model changes, risk register, and per-wave
specs. Read it before starting any wave.

## Wave checklist

Each wave is one session. Mark `[x]` after completion. Each wave ends
with: device test on `0010934AE002636`, single commit to `main`, log
entry in `docs/log.md`.

- [x] **Wave 1 — Foundation & quick fixes** — `docs/04-wave-1-foundation.md`
      Sheet migration to `@gorhom/bottom-sheet`, Android big-screen
      layout audit, DM picker fix (follows + global handle search),
      Google Maps API key wiring. *(Code shipped 2026-05-03 — device
      golden path on `0010934AE002636` still pending Roman's re-attach;
      see `docs/log.md` Wave 1 section for follow-ups.)*

- [x] **Wave 2 — Map redesign + Profile customization** — `docs/05-wave-2-map-profile.md`
      Marker clustering, place card, Apple Maps iOS / Google Maps
      Android, profile theme model + customize sheet + visible to
      visiting users.

- [x] **Wave 3 — Search + Trending places** — `docs/06-wave-3-search.md`
      Search screen (users / videos / hashtags / places / trending),
      popular hashtag chips, "Your Prefers", Cloud Function place
      aggregator + scheduled trending rebuild. *(Code shipped 2026-05-03 —
      device golden path on `0010934AE002636` still pending Roman's
      re-attach + a one-off Cloud Function deploy; see `docs/log.md`
      Wave 3 section for follow-ups.)*

- [ ] **Wave 4 — Upload v2** — `docs/07-wave-4-upload-v2.md`
      Optional native trim, music picker (curated library + device
      upload), real upload progress, post-upload success screen.

- [ ] **Wave 5 — Fastlane + Store submission** *(deferred)* —
      `docs/08-wave-5-fastlane.md`
      ⛔ PAUSE GATE — needs Apple Developer account, ASC API key,
      Android upload keystore, Play Console service account, store
      listing copy. See spec for full list.

## How to start a session

1. Read `~/.claude/CLAUDE.md` (global rules).
2. Read this file (`prompt.md`) to find the next unchecked wave.
3. Read the wave spec doc in full (e.g. `docs/04-wave-1-foundation.md`).
4. Read the master design at
   `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
   to understand the wave's place in the bigger plan.
5. Read `docs/log.md` for context on what shipped before.
6. **Pre-flight checks** (parallel where possible):
   - `claude mcp list` → confirm `firebase: ✓ Connected`
   - `adb devices` → confirm `0010934AE002636` is attached
   - For W1: confirm `GOOGLE_MAPS_API_KEY` is set in `mobile/.env`
   - For W3 onwards: confirm previous wave's commit is on `main` and
     no regressions (smoke test the changes from the previous wave).
7. Execute the wave's acceptance criteria.
8. Verify on device. Single commit. Log entry. Mark wave `[x]` in this
   file.
9. **Stop.** Do not start the next wave in the same session.

## Definition of done (per wave, every wave)

- [ ] Code merged to `main` (single coherent commit).
- [ ] App rebuilt and running on `0010934AE002636` without regressions.
- [ ] Manual smoke test executed (golden path + at least one edge case).
- [ ] `firestore.rules` / `storage.rules` updated and re-deployed if new
      collections/fields introduced.
- [ ] Paragraph appended to `docs/log.md`.
- [ ] Wave checked off above.

## Reference index

| File | Purpose |
|---|---|
| `prompt.md` | This file. Master brief + wave checklist. |
| `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md` | V2 master design (the spec). |
| `docs/04-wave-1-foundation.md` | Wave 1 spec. |
| `docs/05-wave-2-map-profile.md` | Wave 2 spec. |
| `docs/06-wave-3-search.md` | Wave 3 spec. |
| `docs/07-wave-4-upload-v2.md` | Wave 4 spec. |
| `docs/08-wave-5-fastlane.md` | Wave 5 spec. |
| `docs/00-previous-session-summary.md` | Sessions 0–1 context. |
| `docs/log.md` | Append-only dev log. |
| `docs/01-dm-implementation.md` | DM refactor spec from session 2 (already shipped). |
| `docs/02-feed-android-fix.md` | Feed alignment spec from session 2 (already shipped). |
| `docs/03-crash-fix-oom.md` | OOM fix spec from session 2 (already shipped). |
| `docs/crash-evidence.log` | Raw `adb logcat -b crash` capture. |
| `firestore.rules` | Live production rules. |
| `.deploy-firestore-rules.mjs` | Service-account-auth rules deploy script. |
