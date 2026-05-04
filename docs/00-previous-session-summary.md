# Previous-session summary (2026-05-02 evening)

What the prior Claude session shipped. Read this before starting new work.

## Shipped

1. **Launched Flytok on Android device `0010934AE002636` (A015, Android 16, SDK 36).**
   - First gradle build: 3 m 19 s. Warm rebuilds: ~6 s.
   - APK signed by project keystore at `mobile/android/app/debug.keystore`.
   - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

2. **Fixed Google Sign-In on Android.**
   - `mobile/lib/google-signin.ts` — populated `WEB_CLIENT_ID` (was empty; old TODO).
   - User registered the project keystore SHA-1 in Firebase Console → Android app config.
   - New `google-services.json` saved to `firebase/google-services.json` and copied into `mobile/android/app/` via `expo prebuild`.

3. **Replaced DEV-mode Firestore rules with locked-down production rules.**
   - `firestore.rules` rewritten from `allow read,write: if auth != null` to per-collection rules.
   - Deployed via direct REST call to Firebase Rules API (firebase CLI was blocked by Service Usage permissions on the service account).
   - Live ruleset name: `projects/roamerz-b0056/rulesets/a863370c-507b-4217-832b-c272fac3277a`.
   - Deploy script: `.deploy-firestore-rules.mjs` — uses `GOOGLE_APPLICATION_CREDENTIALS`, no firebase login needed.

4. **Wired Firebase MCP at project-local scope.**
   - Server: `@gannonh/firebase-mcp` (community).
   - Auth: same service account JSON (`roamerz-b0056-firebase-adminsdk-fbsvc-9f5ef21bd1.json`).
   - Stored in `~/.claude.json` under this project. Should appear in `claude mcp list` from session start.

5. **Captured crash evidence (`docs/crash-evidence.log`).**
   - User reported "App: Crashes after a few seconds of proper working".
   - `adb logcat -b crash` shows repeated `java.lang.OutOfMemoryError` at the 256 MB heap limit, originating in `androidx.media3.exoplayer.PlaybackInfo` and `MediaCodec.getInputBuffer`.
   - Hypothesis: `useVideoPlayer` instances in `FeedItem.tsx` are not released on unmount → leak per scrolled card → OOM. See `docs/03-crash-fix-oom.md`.

## Not shipped (deferred to next session, in priority order)

1. **DMs refactor + features.** See `docs/01-dm-implementation.md`.
2. **Feed Android header alignment.** See `docs/02-feed-android-fix.md`.
3. **OOM crash fix.** See `docs/03-crash-fix-oom.md`.
4. **MemPalace install for this project.** Run `mempalace:init` skill, then `mempalace:mine` on the repo.
5. **`@react-native-firebase` v22 modular-API migration.** Currently many deprecation warnings (`orderBy`, `where`, etc. on namespaced API). Not blocking. Plan after Step 4 is done.

## Open security findings still unresolved

| # | Issue | Status |
|---|---|---|
| 1 | DEV-mode Firestore rules | ✅ Fixed and deployed. |
| 2 | Google Maps API key in `mobile/app.json` | ⚠️ Still needs Android-package + SHA-1 restriction in Google Cloud Console. |
| 3 | Web Firebase config keys committed (`src/lib/firebase.js`) | ✅ Acceptable now that Firestore rules are tight (Firebase recommends shipping these in client). |
| 4 | FCM permission requested but token never registered to user doc | ⚠️ Will be fixed as part of DM push delivery (see `docs/01-dm-implementation.md`). |
| 5 | No email-verification gate on signup | ⚠️ Low priority. Defer. |
| 6 | No Cloud Functions for counter triggers | ⚠️ Counters maintained client-side under transactions — works but client-tamperable. Acceptable for now. |
| 7 | `participantEmails` map stores raw emails on thread doc | ⚠️ Will be removed during DM refactor — user labels resolve via `users/{uid}.displayName`. |

## Quick tooling cheat-sheet

```bash
# Rebuild + reinstall on the Android device
cd mobile && npx expo run:android

# Re-deploy Firestore rules after editing firestore.rules
GOOGLE_APPLICATION_CREDENTIALS=/Users/romanpochtman/Developer/flytok/roamerz-b0056-firebase-adminsdk-fbsvc-9f5ef21bd1.json \
  node /Users/romanpochtman/Developer/flytok/.deploy-firestore-rules.mjs roamerz-b0056 firestore.rules

# Tail device logs
adb logcat -d -b crash | tail -200             # crash buffer
adb logcat | grep ReactNativeJS                # JS console.log

# Check live MCP status
claude mcp list
```
