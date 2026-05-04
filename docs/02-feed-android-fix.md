# Task 2 — Feed: fix Android header alignment

## Symptom

User report (verbatim): *"Feed: Fix alignment. user that uploaded video is too high, i assume it was designed for iphone screens only, but on android it does not shows correctly."*

The uploader's name/avatar overlay on top of each feed item is positioned too high on Android — clipped under the status bar / camera notch area. Designed against iOS notch dimensions; not adapted for Android `edgeToEdge` (which is enabled — see `mobile/app.json`: `"edgeToEdgeEnabled": true`).

## Code locations

- `mobile/components/FeedItem.tsx` — the feed card. Uploader handle (`@displayName`) and follow button live inside the absolute-positioned overlay over the video.
- `mobile/app/(tabs)/index.tsx` — the parent FlatList. Renders `<FeedItem>` full-screen (`height = useWindowDimensions().height` minus tab bar).
- `mobile/app/_layout.tsx` — root Stack, no SafeAreaProvider wrapping. (Verify — install `react-native-safe-area-context` provider if missing at root.)
- `mobile/app/(tabs)/_layout.tsx` — bottom tab bar config; check `tabBarStyle` height.

## Root cause

The overlay's vertical offset is hardcoded for iPhone X-style notch (44 px top inset). On Android, especially edge-to-edge, the actual top inset is the status bar (24-30 px) + camera punch-hole (varies per device). When the value is `top: 50` with no inset awareness, the uploader chip sits *behind* the status bar / clock.

## Fix plan

1. Wrap the screen content (or the overlay itself) in `SafeAreaView` from `react-native-safe-area-context` with `edges={['top']}`, OR consume `useSafeAreaInsets()` and use `insets.top + small_gap` as the offset.
2. Ensure `<SafeAreaProvider>` wraps the root in `app/_layout.tsx`. If the existing layout already imports `SafeAreaView` from the lib, just confirm the provider is present (see `react-native-safe-area-context` docs).
3. The overlay should render *inside* the safe area on Android but *over* the video everywhere — so the play surface still goes edge-to-edge. Pattern:
   ```tsx
   const insets = useSafeAreaInsets();
   <View style={[styles.overlayHeader, { top: insets.top + 8 }]}>
     {/* avatar + @displayName + follow */}
   </View>
   ```
4. Visually verify on the connected Android device (`0010934AE002636`). The header should clear the status bar and any camera cutout. Do **not** ship without an on-device check — emulator does not reproduce notch geometry.
5. Re-test on iOS conceptually (no physical iPhone available now) — `useSafeAreaInsets()` returns the right value on both platforms, so the unified fix should not regress iOS. If you have access to an iOS simulator, confirm.

## Acceptance

- On Android `0010934AE002636`, the uploader name+avatar+follow chip visible in full, not clipped, with at least 8 px below the status bar.
- Feed video still fills the screen edge-to-edge below the chip.
- No layout shift between cards (consistent inset across the FlatList).
- Tab bar at the bottom unchanged.

## Out of scope

Don't touch fonts, colors, sizes, or animations. This is a positioning fix only. Anything else needs its own task.

## Dispatch hint

Small task. Single agent (`kotlin-android-architect` knows Android quirks; `frontend-developer` is also fine). Should land in one commit.
