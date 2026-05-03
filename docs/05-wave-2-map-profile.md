# Wave 2 — Map Redesign + Profile Customization

> Master design: `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
> Owner: one frontend-developer agent
> Target: 1 session
> **Depends on**: Wave 1 shipped (`<AppBottomSheet>`, Maps key wired,
> `discoverable` field).

## Objective

Make the map look like a real product (clusters + place card), and let
users theme their profile with a per-account `theme` document that anyone
visiting that profile sees.

## Acceptance criteria

### Map

- [ ] iOS uses Apple Maps (no `provider` prop). Android forces
      `PROVIDER_GOOGLE`.
- [ ] Markers cluster via `react-native-map-clustering`. Cluster count
      bubbles styled with brand colors.
- [ ] Marker design: rounded thumbnail bubble (video poster) with subtle
      drop shadow, ~44×44 pt.
- [ ] Tapping a marker opens a `<PlaceCard>` bottom sheet (built on
      `<AppBottomSheet>`) with:
      - Place name (`location.label`)
      - Video count for the place
      - Top 3 video thumbnails (tap → open feed scoped to that place)
      - "Open feed" CTA → routes to a place-feed screen (re-uses the
        existing `posts/[uid]` pattern with a place filter).
- [ ] Map performance: ≤ 30 ms per render at 1000 markers (verified via
      `react-devtools` Profiler in dev build).

### Profile customization

- [ ] `users/{uid}.theme` doc shape matches the master spec.
- [ ] `<CustomizeThemeSheet>` mirrors the screenshot: preset row → bg color
      grid → bg image upload → accent color grid → avatar style grid.
- [ ] DiceBear avatar previews render in the grid using the user's uid as
      the seed.
- [ ] Background image flow: pick → resize via `expo-image-manipulator`
      (max 1600px long side, JPEG @0.85) → upload to
      `users/{uid}/profile/background.jpg` → set
      `theme.backgroundImageURL`/`theme.backgroundImagePath` on user doc.
- [ ] Old background image is deleted from Storage when a new one is
      uploaded (`storage.deleteObject(oldPath)` if exists).
- [ ] Theme applies on:
      - `mobile/app/(tabs)/profile.tsx` (own profile)
      - `mobile/app/user/[uid].tsx` (visiting profile)
      - Both header backgrounds, avatar borders, and primary buttons.
- [ ] Theme does **not** apply to feed / inbox / map / search.
- [ ] Storage rule for `users/{uid}/profile/*` is owner-write, public read,
      5 MB cap, image/* contentType.
- [ ] Firestore rule allows self-write of `users/{uid}.theme.*`.

## Files to touch

**New**
- `mobile/components/PlaceCard.tsx` — bottom-sheet card content for a place.
- `mobile/components/CustomizeThemeSheet.tsx` — the customize UI.
- `mobile/lib/theme/userTheme.ts` — `useUserTheme(uid)` hook,
  `applyTheme(theme)` style helpers, `defaultTheme` fallback.
- `mobile/lib/avatars.ts` — `dicebearURL(style, seed)` helper, list of
  the 6 supported styles.
- `mobile/app/place/[slug].tsx` (optional, if we open a dedicated
  place-feed screen — could also re-use existing posts route with a
  filter).

**Modified**
- `mobile/app/(tabs)/map.tsx` — wrap `<MapView>` in
  `react-native-map-clustering`'s `<MapView>`, replace marker design,
  hook up `<PlaceCard>`.
- `mobile/app/(tabs)/profile.tsx` — read theme, apply to header.
  Add "Customize" button that opens `<CustomizeThemeSheet>`.
- `mobile/app/user/[uid].tsx` — same theme application.
- `firestore.rules` — `theme.*` self-write.
- `storage.rules` — `users/{uid}/profile/*` rules.
- `mobile/package.json` — add `react-native-map-clustering`.

## Theme application sketch

```ts
// mobile/lib/theme/userTheme.ts
export function applyTheme(theme: UserTheme | null) {
  const t = theme ?? defaultTheme;
  return {
    headerBackground: t.backgroundImageURL
      ? { backgroundImage: t.backgroundImageURL }
      : { backgroundColor: t.backgroundColor },
    accentButton: { backgroundColor: t.accentColor, color: '#fff' },
    avatarBorder: { borderColor: t.accentColor, borderWidth: 2 },
  };
}

export function dicebearURL(style: AvatarStyle, seed: string) {
  if (style === 'default') return null;   // use uploaded photoURL
  return `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`;
}
```

The DiceBear URL is just an `<Image source={{ uri }}>`. Cache it via
`expo-image` if perf is an issue.

## Migration / rollout notes

- No backfill needed — `theme` undefined → `defaultTheme` via the hook.
- DiceBear is hit only when `avatarStyle !== 'default'` — existing users
  with photos see no extra network calls.

## Definition of done

Per the master spec's DoD plus:

- Two-account device test: A sets a custom theme + image bg + Robot avatar,
  B logs in, B opens A's profile via `/user/[A.uid]`, sees A's theme.
- Map test on Android: clusters split correctly, place card opens, "Open
  feed" routes to the place-scoped feed.
- Map test on iOS simulator: Apple Maps tiles render (no Google attribution
  visible).

## Hand-off

- Append paragraph to `docs/log.md`.
- Mark Wave 2 `[x]` in `prompt.md`.
- Note any DiceBear caching quirks for W4 to be aware of (the music picker
  also uses remote thumbnails).
