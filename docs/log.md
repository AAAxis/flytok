# Flytok dev log

## 2026-05-02 — session 1

- Launched on Android device `0010934AE002636` via `expo run:android`. Build clean, Google Sign-In wired (after registering project keystore SHA-1 with Firebase).
- Replaced wide-open Firestore DEV rules with locked-down per-collection rules; deployed via direct Firebase Rules REST API (service-account-auth, see `.deploy-firestore-rules.mjs`).
- Wired Firebase MCP (`@gannonh/firebase-mcp`) at project-local scope using the same service account.
- Captured OOM crash evidence — feed leaks ExoPlayer instances. Root cause + fix plan in `docs/03-crash-fix-oom.md`.
- Prepared `prompt.md` and `docs/01..03-*.md` to drive next session's work (DM refactor, feed alignment fix, OOM fix).

## 2026-05-02 — session 2 (next)

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
