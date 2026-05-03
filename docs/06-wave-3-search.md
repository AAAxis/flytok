# Wave 3 — Search + Trending Places

> Master design: `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
> Owner: one frontend-developer agent + Cloud Function additions
> Target: 1 session
> **Depends on**: Wave 1 (`searchUsersByHandle`, `displayNameLower`,
> `<AppBottomSheet>`).

## Objective

Ship a real search experience: users, videos, hashtags, places, trending
places. Add a Cloud Function aggregator so the trending list scales past
the catalog of the day.

## Acceptance criteria

### Search screen

- [ ] New route at `mobile/app/search.tsx`. Opened from a search-icon
      overlay positioned top-left of the home feed (mirror to the existing
      AI sparkle button on the right).
- [ ] Top bar: back arrow + search input (autofocus on mount, debounce
      300 ms).
- [ ] Empty state (no query): popular hashtag chips + "Your Prefers"
      section with add/remove. Same chip data as the web demo
      (#Nightlife / #Trips / #Camps / #Hotels / #Club / #Restaurant /
      #Beach), gradients matching the screenshot.
- [ ] Results state (>=2 chars): tabs `All / Users / Videos / Hashtags /
      Places`. `All` shows highlights from each (like the web demo).
- [ ] Tapping a user → routes to `/user/[uid]`.
- [ ] Tapping a video → routes to `/posts/[ownerUid]?start={videoId}&source=search`.
- [ ] Tapping a hashtag → opens `mobile/app/tag/[tag].tsx`, a feed
      filtered by `videos.where('hashtags', 'array-contains', tag)`.
      Re-uses `<FeedItem>` and the player pool from
      `mobile/lib/feed/usePlayerPool.ts`.
- [ ] Tapping a place → opens the place feed from W2.
- [ ] "Trending places" section appears when no query — reads
      `trending_places/snapshot` directly (one doc, fast).

### Cloud Functions

- [ ] `firebase/functions/src/places.ts` exports two functions:
      - `onVideoCreatePlaceCounter` — Firestore v2 trigger on
        `videos/{vid}` create. Computes `slug = slugify(location.label)`.
        Upserts `places/{slug}` with `videoCount: FieldValue.increment(1)`,
        `lastVideoAt: serverTimestamp`, `bbox: [min(lat,minLat), min(lng,minLng)]`
        and `[max(...), max(...)]` arithmetic on existing values.
      - `rebuildTrendingPlaces` — `onSchedule('every 360 minutes')`.
        Reads `places where lastVideoAt > now - 7d`, sorts by `videoCount`
        desc, writes top 20 to `trending_places/snapshot`.
- [ ] `firebase/functions/src/index.ts` re-exports both.
- [ ] `npm run build` and `tsc --noEmit` clean.
- [ ] Firestore rule for `places/*` and `trending_places/*`: read by any
      signed-in user, write only via service account.
- [ ] Firestore rule for `users/{uid}.preferred_searches`: self-write,
      max 20 items, each item ≤ 32 chars.

### `Your Prefers`

- [ ] Per-user array on `users/{uid}.preferred_searches: string[]`.
- [ ] Add: append + dedupe.
- [ ] Remove: filter.
- [ ] Tap a chip: sets the search input.
- [ ] Empty state: "No preferences yet. Add some!" matching web demo copy.

## Files to touch

**New**
- `mobile/app/search.tsx` — the screen.
- `mobile/components/search/PopularChips.tsx`.
- `mobile/components/search/PrefersSection.tsx`.
- `mobile/components/search/ResultsTabs.tsx`.
- `mobile/components/search/TrendingPlaces.tsx`.
- `mobile/lib/search/queries.ts` — `searchVideos`, `searchHashtags`,
  `searchPlaces`. Re-use `searchUsersByHandle` from W1.
- `firebase/functions/src/places.ts` — both functions + `slugify` helper.
- `mobile/app/tag/[tag].tsx` (or place inline filter on existing route).

**Modified**
- `mobile/app/(tabs)/index.tsx` — add the search-icon overlay.
- `firebase/functions/src/index.ts` — re-export new fns.
- `firestore.rules` — places, trending_places, preferred_searches.
- `mobile/lib/firestore.ts` — `setPreferredSearches`,
  `getPreferredSearches` helpers.

## `slugify` for places

Conservative ASCII-only:

```ts
function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
```

Trade-off: "Berlin, Germany" and "Berlin" become different slugs. Acceptable
for v1; we revisit deduping in v3 with a normalised place-id from the
geocoder if it becomes annoying.

## Search query patterns (cost & rule notes)

- Users: prefix match on `displayNameLower` (W1 already shipped this).
- Videos: full-text search on captions isn't free in Firestore. v1 uses
  `array-contains` over a denormalised `captionTokens: string[]` field,
  written by client at upload time (lowercase, deduped, ≥3 chars). Add to
  `uploadVideo` in `firestore.ts`.
- Hashtags: `videos.where('hashtags', 'array-contains', tag)` (already
  works).
- Places: `places.where('label_lower', '>=', q).where('label_lower', '<', q+)`.
  `label_lower` is written by the Cloud Function at upsert time.
- Trending places: single-document read at `trending_places/snapshot`.
  ~free.

## Definition of done

- Per the master spec's DoD.
- Manual: search "berlin" finds the seeded test data (a user, a video, a
  hashtag, a place). Trending places renders after the function runs
  once on a write or after manual invocation.
- Cloud Functions deploy: Roman runs
  `cd firebase/functions && npm run deploy` after the wave's commit lands.
  Function is idempotent — safe to re-deploy.

## Hand-off

- Append paragraph to `docs/log.md`.
- Mark Wave 3 `[x]` in `prompt.md`.
- Note one-off action for Roman: deploy functions, then trigger
  `rebuildTrendingPlaces` once manually (`firebase functions:shell`) so
  the snapshot doc exists before the search screen reads it.
