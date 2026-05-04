# Wave 6 — Saved tab + profile map + DMs entry

> Master design: `docs/superpowers/specs/2026-05-04-pre-launch-fixes-design.md`
> Owner: one frontend-developer agent (single coherent commit)
> Target: 1 session

## Objective

Restructure the bottom tab bar and the profile screen so the user's
saved posts are one tap away, the profile *Saved* sub-tab is replaced
with a map of the user's own posts, and the DMs entry point lives on
the profile top-right (not in the bottom bar).

## Acceptance criteria

- [ ] Bottom tab bar position 4 is **Saved** (`bookmark` icon), not
      Inbox/Messages. Tab key: `saved`. Title: `Saved`.
- [ ] `mobile/app/(tabs)/saved.tsx` exists and renders the user's saved
      videos using the existing `<VideoGrid>` (loader, refresh control,
      empty state copy: "Nothing saved yet"). Tapping a tile pushes
      `/posts/{me.uid}?start={vid}&source=saved`.
- [ ] `mobile/app/(tabs)/inbox.tsx` is moved to `mobile/app/inbox.tsx`
      and registered as a stack screen (no longer a tab). Deep links
      from FCM (`/chat/{threadId}`) still work — no path change there.
- [ ] Profile screen sub-tabs are reduced to a single grid view (the
      user's own videos). The bookmark sub-tab is gone — *Saved* is now
      a top-level tab. The grid icon is replaced by an icon row of
      **Posts | Map** where Map shows a clustered map of the user's own
      videos.
- [ ] Profile *Map* sub-tab:
      - If the user has zero videos: empty placeholder with copy
        "No posts yet" and the `cloud-upload-outline` icon.
      - If the user has videos but none have a location: empty
        placeholder with copy "No location on your posts yet" and the
        `location-outline` icon.
      - Otherwise: a `<ClusteredMapView>` (from `react-native-map-
        clustering`) with markers for each located video. Reuses
        `DARK_MAP_STYLE`, `colors.accent`, dark `userInterfaceStyle`.
        Tapping a marker pushes `/posts/{me.uid}?start={vid}&source=mine`.
        Initial region is fitted to the marker bounds (use
        `mapRef.current.fitToCoordinates(coords, { edgePadding: ...,
        animated: false })` after `onMapReady`). Loading state is an
        `ActivityIndicator` overlay; no flicker on tab switch.
- [ ] Profile top bar layout is:
      - **Left:** burger menu (existing `setShowSettings(true)`).
      - **Center:** `@handle` pill (existing pill style, but
        `position: 'absolute'` centered with `transform:
        [{ translateX: -50% }]` *or* using a 3-cell flex row).
      - **Right:** DMs icon (`chatbubble` Ionicon) inside the same
        rounded button shape as the existing burger. Tapping pushes
        `/inbox`. Renders an unread dot when `useUnreadBadge() > 0`.
- [ ] `useUnreadBadge` is no longer consumed in `(tabs)/_layout.tsx`.
      It is consumed in the profile top bar's DM icon to show an unread
      indicator (red dot, no number).
- [ ] No regression in deep-link routing from FCM taps: tapping a chat
      notification from quit / background still lands on
      `/chat/{threadId}`.
- [ ] Device test on `0010934AE002636` passes the golden path.

## Files to touch

**New**
- `mobile/app/(tabs)/saved.tsx` — Saved-posts tab. Wraps `<VideoGrid>`,
  consumes `savesCol(me.uid).onSnapshot` (re-uses the existing live
  saves listener pattern from `profile.tsx`). Pull-to-refresh; safe-area
  bottom padding.
- `mobile/components/profile/ProfileVideoMap.tsx` — clustered map of the
  user's own videos with the two empty-state branches and the loading
  overlay.

**Moved**
- `mobile/app/(tabs)/inbox.tsx` → `mobile/app/inbox.tsx`. Update
  imports inside the file only if relative paths change (they don't —
  all imports are aliased via `@/...`).

**Modified**
- `mobile/app/(tabs)/_layout.tsx` — remove the Inbox `<Tabs.Screen>`,
  add a Saved `<Tabs.Screen>` (icon: `bookmark`). Drop the
  `useUnreadBadge`/`tabBarBadge` wiring from this file.
- `mobile/app/(tabs)/profile.tsx` — top-bar reshuffle (burger left,
  handle pill center, DM button right with unread dot); replace the
  `Tab` union from `'mine' | 'saved'` with `'mine' | 'map'`; render
  `<VideoGrid>` for `mine`; render `<ProfileVideoMap>` for `map`. Drop
  the `Saved` Stat from the stats card (we keep `Posts | Following |
  Followers`). The local `saved` state and `savesCol` listener are no
  longer needed here; remove them (the saves listener moves into the
  new `(tabs)/saved.tsx`).
- `mobile/app/user/[uid].tsx` — top-bar reshuffle is **not** part of
  this wave; the visiting-user profile keeps its current shape.

## Build sequence

1. Create `(tabs)/saved.tsx` — copy the saved-tab body from
   `profile.tsx` (the `<VideoGrid>` block + the saves snapshot
   listener + the `getVideosByIds` resolution). Header is a simple
   sticky title row.
2. Move `inbox.tsx` out of `(tabs)/` to `app/inbox.tsx`. Verify deep
   linking still works (cold-start FCM tap, background tap).
3. Update `(tabs)/_layout.tsx`:
   - Drop the `<Tabs.Screen name="inbox">` registration.
   - Add `<Tabs.Screen name="saved">` between `upload` and `profile`.
   - Drop `import { useUnreadBadge } from '@/lib/messaging'` and the
     `tabBarBadge` prop.
4. Build `<ProfileVideoMap>`:
   - Props: `videos: VideoDoc[]`, `loading: boolean`,
     `onPressVideo(video)`.
   - Filter videos by `v.location?.latitude != null && v.location?.
     longitude != null`.
   - Three render branches: loading spinner / two empty states / map.
   - Map is `<ClusteredMapView provider={Platform.OS === 'android' ?
     PROVIDER_GOOGLE : undefined} customMapStyle={DARK_MAP_STYLE} />`,
     no user-location dot, no recenter FAB, no category filter — that
     stuff is the global map's job. This map is purely a viewer.
   - Initial region: bound to all markers via `fitToCoordinates`
     after `onMapReady`. If only one marker, fall back to a 0.05 delta
     centered on it.
5. Refactor `profile.tsx`:
   - Re-order the top-bar children to `[burger][handle][dmButton]`
     using a 3-cell flex row (`justifyContent: 'space-between'` is
     already there — we need a center cell, so swap to
     `flexDirection: 'row'; alignItems: 'center'` with the handle pill
     wrapped in a flex-1 centered container).
   - Add the DM button: `<Pressable onPress={() => router.push(
     '/inbox')} ...>` with an `Ionicons name="chatbubble"` and a tiny
     unread dot (red 8×8 view) when `useUnreadBadge() > 0`.
   - Replace the `Tab` union; render `<ProfileVideoMap>` for `'map'`.
   - Drop the `saved` state, the saves listener, the `getSavedVideoIds`
     /`getVideosByIds` calls in `load()`, the *Saved* stat, and the
     `Saved` empty-state branch.

## Validation

- `npx tsc --noEmit` clean for the modified files (legacy errors
  outside this wave's scope are tolerated as before).
- Run on `0010934AE002636`:
  - Bottom tab bar shows `Feed | Map | + | Saved | Profile`. Inbox
    tab is gone.
  - Tap **Saved** → grid of saved videos (or "Nothing saved yet").
  - Tap **Profile** → header shows burger ⟶ `@handle` (centered) ⟶
    DM icon. Tapping the DM icon opens the inbox stack.
  - Sub-tab toggle on profile is **Posts | Map**. Map shows
    clustered markers for the user's own videos with locations.
  - With zero videos: "No posts yet" placeholder.
  - With videos but no locations: "No location on your posts yet"
    placeholder.

## Out of scope

- Visiting-user profile redesign (DM icon there is already on the
  Message action button — no change needed).
- Adding location to videos that don't already have one — that's the
  upload pipeline's job.
- Native code or Maps SDK changes.
