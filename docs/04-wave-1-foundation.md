# Wave 1 — Foundation & Quick Fixes

> Master design: `docs/superpowers/specs/2026-05-03-flytok-v2-features-design.md`
> Owner: one frontend-developer agent (single coherent commit)
> Target: 1 session

## Objective

Make every existing screen feel professional on Android big-screen devices,
swap every sheet to a real bottom-sheet primitive, fix the DM picker showing
strangers, and unblock the map by wiring the Google Maps API key.

## Acceptance criteria

- [ ] All 8 sheets in `mobile/components/` use `@gorhom/bottom-sheet` via a
      shared `<AppBottomSheet>` wrapper.
- [ ] No hardcoded `paddingBottom: \d{2,}` / `top: \d{2,}` remain in mobile
      layout code (`grep -rn` clean except for the trim-handle and
      progress-thumb micro-positioning).
- [ ] DM `NewChatModal` shows users you follow by default, with avatars from
      `photoURL`. Search box (>=2 chars) hits a new `searchUsersByHandle()`
      that filters `users.where('discoverable','==',true)`.
- [ ] `ensureUserDoc` writes `discoverable: true` on first login.
- [ ] `mobile/plugins/withGoogleMapsApiKey.js` injects
      `GOOGLE_MAPS_API_KEY` from `process.env` into `AndroidManifest.xml`
      at prebuild. `.env.example` documents the var (no value). Existing
      `app.json` `plugins` array references the new plugin.
- [ ] Map renders Google tiles on Android device after a clean prebuild.
- [ ] Console error in inbox is identified and fixed (likely a missing
      `key` prop or unsafe optional access on `displayName`).
- [ ] Firestore rule updated: `users/{uid}` write rule allows self-write of
      `discoverable`. Re-deployed via the service-account script.
- [ ] Device test on `0010934AE002636` passes golden path.

## Files to touch

**New**
- `mobile/components/ui/AppBottomSheet.tsx` — wrapper around
  `@gorhom/bottom-sheet` with our brand colors, snap-points API, keyboard
  handling.
- `mobile/lib/users.ts` — `searchUsersByHandle(query, limit)`. Used here
  (W1) and reused by W3 search screen and W4 DM global search.
- `mobile/plugins/withGoogleMapsApiKey.js` — config plugin.
- `mobile/.env.example` — `GOOGLE_MAPS_API_KEY=` placeholder (no value).

**Modified**
- All 8 sheets to use `<AppBottomSheet>`:
  - `mobile/components/CommentsSheet.tsx`
  - `mobile/components/SettingsSheet.tsx`
  - `mobile/components/EditProfileSheet.tsx`
  - `mobile/components/EditCaptionSheet.tsx`
  - `mobile/components/FollowListSheet.tsx`
  - `mobile/components/ReportSheet.tsx`
  - `mobile/components/ShareToChatSheet.tsx`
  - `mobile/components/AiAssistantSheet.tsx`
- `mobile/app/(tabs)/inbox.tsx` — `NewChatModal` rewrite (use
  `<AppBottomSheet>`, follows-by-default, search box, avatars).
- `mobile/app/(tabs)/_layout.tsx` — replace tabbar bottom-padding hardcodes
  with `insets.bottom`.
- `mobile/components/FeedItem.tsx` — replace `paddingBottom: 96` overlay
  hardcode with `insets.bottom + 96` clamp logic. Also audit avatar/
  caption/actions positioning against insets.
- `mobile/app/(tabs)/profile.tsx` — `paddingBottom: 60` becomes
  `insets.bottom + 60`. Same on the followlist sheet.
- `mobile/lib/firestore.ts` — `ensureUserDoc()` writes `discoverable: true`
  on first creation. (Existing accounts default to true via Firestore rule
  treating `undefined === true` for backwards compat — implement in the
  rule, not in client.)
- `firestore.rules` — extend `users/{uid}` write rule to permit
  `discoverable` self-write. Re-deploy via `node .deploy-firestore-rules.mjs roamerz-b0056 firestore.rules`.
- `mobile/app.json` — register the new config plugin.
- `mobile/package.json` — add `@gorhom/bottom-sheet`.

## Inbox console error — investigation

Before refactoring, run `adb logcat | grep -i "inbox\|warn\|error"` while
opening the inbox tab. The most likely culprits (in order):

1. `<NewChatModal>` `users` map omits `key` for items with null uid (rare).
2. `getUserLabel(uid)` throws when called with `undefined` — happens if a
   thread doc has only one participant. Defend with optional chaining.
3. `photoURL` access on a user doc that doesn't have it — render fallback.

## `searchUsersByHandle` design

```ts
// mobile/lib/users.ts
export async function searchUsersByHandle(
  query: string,
  opts: { limit?: number; excludeUid?: string } = {},
): Promise<UserDoc[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  // Firestore doesn't do full-text. Use prefix match on a denormalised
  // `displayNameLower` field. ensureUserDoc writes that field on every
  // displayName update.
  const snap = await usersCol()
    .where('displayNameLower', '>=', q)
    .where('displayNameLower', '<', q + '')
    .where('discoverable', '==', true)
    .limit(opts.limit ?? 25)
    .get();
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as any) }))
    .filter((u) => u.uid !== opts.excludeUid);
}
```

This means `ensureUserDoc` and any displayName-update path must also write
`displayNameLower`. The W1 commit must include that backfill in `firestore.ts`.

A composite index is needed on `(displayNameLower asc, discoverable asc)`.
Add to `firestore.indexes.json` and document the URL Firebase prints on
first failure for one-click create.

## `withGoogleMapsApiKey` plugin sketch

```js
// mobile/plugins/withGoogleMapsApiKey.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withGoogleMapsApiKey(config) {
  return withAndroidManifest(config, (config) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      throw new Error(
        'GOOGLE_MAPS_API_KEY is not set. Map will not render on Android.',
      );
    }
    const application =
      config.modResults.manifest.application?.[0];
    if (!application) throw new Error('No <application> in manifest.');
    application['meta-data'] = application['meta-data'] || [];
    const existing = application['meta-data'].find(
      (m) => m.$['android:name'] === 'com.google.android.geo.API_KEY',
    );
    if (existing) existing.$['android:value'] = key;
    else
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': key,
        },
      });
    return config;
  });
};
```

Fail-loud per global rules.

## Definition of done

Per the master spec's per-wave DoD plus:

- Manual two-account smoke test of DM picker (one user follows the other,
  open inbox, see only that user, type 2 chars in search and find a third
  discoverable user).
- Manual test of every migrated sheet (open, swipe down to dismiss, open
  again, type in any text input).
- Map screen on Android device renders Google tiles (does not need to be
  redesigned yet).

## Hand-off

- Append paragraph to `docs/log.md` titled `2026-05-?? — Wave 1`.
- Mark Wave 1 `[x]` in `prompt.md`.
- If `firestore.indexes.json` was changed, note it in the log so the
  composite index can be created from the failure URL on first query.
