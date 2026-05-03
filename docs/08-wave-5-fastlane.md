# Wave 5 — Fastlane + Store Submission *(deferred)*

> Master design: `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
> Owner: backend-ops-engineer agent (release engineering)
> Target: 1–2 sessions

## ⛔ PAUSE GATE — Roman input required

Do not start this wave until Roman provides:

1. **Apple Developer account email + Team ID** (paid, $99/yr).
2. **App Store Connect API key** — `.p8` file, key ID, issuer ID. Steps to
   generate are documented in
   https://docs.fastlane.tools/app-store-connect-api/.
3. **Android upload keystore** — either Roman generates one (`keytool
   -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048
   -validity 9125 -alias upload`) or grants permission for Wave 5 to
   generate it. **Critical: this keystore must be backed up off-machine
   immediately. Losing it means the app can never be updated on Play.**
4. **Google Play Console service account JSON** — created in Play Console
   → Settings → API access → Service accounts → Create new. Download the
   JSON. The service account needs `Release manager` permission.
5. **Store listing copy**:
   - App name (max 30 chars)
   - Subtitle / short description (max 30 chars iOS, 80 chars Android)
   - Full description (max 4000 chars)
   - Keywords (iOS: comma-separated, max 100 chars total)
   - Primary category + secondary category
   - Age rating questionnaire answers (Apple's 11 questions, IARC for
     Google)
   - Support URL, privacy policy URL, marketing URL (optional)
   - Contact email
6. **Demo account credentials** for Apple/Google review (a real Firebase
   account they can sign into to actually use the app during review).

The wave does not start until all 6 are in hand.

## Objective

Reproducible store-submission pipeline. App live on TestFlight + Play
Internal Testing within hours of any commit to `main`. Production
submission ready when Roman flips a flag.

## Acceptance criteria

### iOS — fastlane

- [ ] `fastlane init` complete in `mobile/ios/`.
- [ ] Match-style codesigning set up (App Store Connect API key, no
      manual provisioning profiles).
- [ ] Lane `beta` — builds, signs, ships to TestFlight Internal Group.
- [ ] Lane `release` — builds, signs, ships to TestFlight External Group
      → submits for App Store review.
- [ ] `fastlane snapshot` script — drives the app through 5 routes
      (feed, search, map, profile, upload-success) on iPhone 15 Pro Max
      simulator, captures 5 PNGs.
- [ ] `frameit` overlays the device frame and a marketing tagline.

### Android — fastlane

- [ ] `fastlane init` complete in `mobile/android/`.
- [ ] Upload keystore configured (`mobile/android/keystore.properties`,
      gitignored).
- [ ] Lane `beta` — builds AAB, signs, uploads to Play Internal Testing.
- [ ] Lane `release` — promotes Internal → Production with rollout %.
- [ ] `fastlane screengrab` — same 5 routes via Espresso, captures
      across phone + 7" tablet + 10" tablet sizes.
- [ ] Same `frameit` device frames.

### Demo seed data

- [ ] Separate Firebase project `roamerz-b0056-demo` (Roman creates).
- [ ] Seed script `scripts/seed-demo.mjs` populates 3 fake users, 15
      videos, 5 places. Run before each screenshot pass so screenshots
      always show the same content.
- [ ] Demo project Firestore rules mirror production but allow the
      screenshot service account to write seed data.

### CI hook (optional)

- [ ] GitHub Action `.github/workflows/beta.yml` runs `fastlane beta`
      for both platforms on push to `main` if commit message contains
      `[beta]`. Off by default — opt-in per commit.

## Files to touch

**New**
- `mobile/ios/fastlane/Fastfile`
- `mobile/ios/fastlane/Appfile`
- `mobile/ios/fastlane/Snapfile`
- `mobile/ios/fastlane/SnapshotHelper.swift`
- `mobile/android/fastlane/Fastfile`
- `mobile/android/fastlane/Appfile`
- `mobile/android/fastlane/Screengrabfile`
- `mobile/android/app/src/androidTest/java/com/roamrez/flytok/SnapshotTest.java`
- `scripts/seed-demo.mjs`
- `metadata/` (iOS) and `play_listings/` (Android) — store listing copy
  in deliver/supply format.
- `.github/workflows/beta.yml` (if CI hook is enabled).

**Modified**
- `mobile/app.json` — add `expo.ios.appleTeamId`, ASC bundle id
  alignment.
- `.gitignore` — add `keystore.properties`, `*.p8`, `*.json` for Play
  service accounts.
- `docs/log.md` — milestone entry.

## Screenshot strategy

- 5 screens × 3 device sizes (iPhone 6.7", iPhone 6.5", iPad 12.9") for iOS.
- 5 screens × 3 sizes (phone, 7" tablet, 10" tablet) for Android.
- All against the demo Firebase project.
- `frameit` adds device frames and a one-line marketing tagline per
  screen ("Find your next adventure", etc.).
- Output uploaded to ASC + Play via `deliver` and `supply` lanes.

## Submission process

1. Run `fastlane beta` for both platforms — TestFlight Internal + Play
   Internal Testing live within an hour.
2. Roman tests on real devices.
3. Run `fastlane release` — TestFlight External + Play closed track.
4. Apple review: 24–48h. Google review: 1–7 days first time, then
   minutes for updates.
5. Production rollout: gradual 1% → 10% → 50% → 100% over a week.

## Risk register

| Risk | Mitigation |
|---|---|
| Lost upload keystore | Back up to 1Password or a dedicated USB stick offline. **Do not lose it.** |
| App rejected by Apple for "minimum functionality" | Demo content + clear value prop in description. Travel-discovery + DM justifies "social" categorisation. |
| Google flags hashtag content as inappropriate | Pre-curate the seed hashtags. Avoid #adult / #drug / etc. |
| Privacy policy missing | Wave 5 starts only after Roman provides URL. We can host the policy at flytok.vercel.app/privacy if needed. |
| ASC API key expires | Rotate every 6 months. Document in README. |

## Definition of done

- TestFlight build live on Roman's iPhone via TestFlight app.
- Play Internal Testing build installable on the device
  `0010934AE002636` via the Internal Testing opt-in link.
- Both lanes runnable from Roman's machine with one command.
- 5 screenshots per platform, framed, uploaded to ASC + Play.
- Listing copy live (not yet submitted for production).

## Hand-off

- Append milestone paragraph to `docs/log.md`.
- Mark Wave 5 `[x]` in `prompt.md`.
- Schedule the production submission as a follow-up after Roman's smoke
  test of the beta builds.
