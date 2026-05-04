# Flytok / Roamrez — Pre-launch fixes (master design)

> Drafted 2026-05-04 to address 6 fixes the founder flagged before
> resubmitting to Google Play (and re-attempting the Apple submission
> after rejection on first try).
>
> Sub-specs: `docs/09-wave-6-saved-tab-profile-map.md`,
> `docs/10-wave-7-onboarding-share.md`,
> `docs/11-wave-8-block-audit.md`. Each ships in one session as a
> single coherent commit on `main`.
>
> Total scope: ~3 sessions before the store submission wave (now Wave 9).

---

## What changes (founder brief, verbatim summary)

1. **Saved posts to tab bar** — replace the Inbox/Messages tab with Saved
   Posts in position 4 of the bottom tab bar.
2. **Profile tab → map of own posts** — replace the in-profile *Saved*
   sub-tab (the bookmark icon) with a map view that plots only the user's
   own videos. Empty placeholders for "no posts yet" and "no location on
   the posts". Loading states and UI must feel professional.
3. **DMs entry on profile** — move the DMs entry (currently the inbox
   tab, removed in #1) to the top-right of the Profile screen, where the
   handle pill currently sits. Move the `@username` to the top center
   (between the burger menu and the new DMs icon).
4. **Onboarding (2 screens)** — Apple rejected the first iOS submission
   for missing onboarding context. Add a 2-screen onboarding carousel
   that shows on first launch and after every logout, before the login
   screen.
5. **Block / restrict audit** — verify end-to-end (with the Firebase MCP)
   that block actually filters: trending feed, following feed, map,
   inbox, user profile, place card, search results. Add a *Block* /
   *Report* entry point on the visited user profile screen (currently
   only reachable from the feed-item ellipsis).
6. **Share video — in-app option** — the Share button currently does
   `Share.share` on tap and opens `ShareToChatSheet` only on long-press.
   Make tap open a unified sheet with both an in-app thread list AND a
   "Share externally" row at the top.

---

## Wave 6 — Saved tab + profile map + DMs entry (1 session)

Cover items 1, 2, 3.

**Risk register**

- The profile screen is busy already (cover, avatar, top bar,
  stats card, two action buttons, two-tab strip). Re-shuffling the
  top bar without breaking the existing cover-overlap math is the
  highest risk. Mitigation: use the existing `topBarOverlay` layout
  primitives, just re-order children.
- `react-native-map-clustering` is already in the bundle (used by
  `(tabs)/map.tsx`). Reusing it for a small in-profile map is fine —
  no native rebuild needed.
- The Inbox screen file has to live somewhere. Move it from
  `mobile/app/(tabs)/inbox.tsx` to `mobile/app/inbox.tsx` so the DM
  icon on the profile can `router.push('/inbox')`.
- The `useUnreadBadge` hook is currently consumed by `(tabs)/_layout.tsx`
  for the tab badge. After removing the inbox tab, render the unread dot
  next to the Profile DM icon instead.

See `docs/09-wave-6-saved-tab-profile-map.md` for the per-task spec.

---

## Wave 7 — Onboarding + share-to-chat unification (1 session)

Cover items 4, 6.

**Risk register**

- AsyncStorage is not yet a dependency; we add
  `@react-native-async-storage/async-storage` for the
  `hasSeenOnboarding` flag. (No native rebuild needed — Expo SDK 54
  ships the prebuilt module via `expo-modules-autolinking`. Confirm at
  build time.)
- The auth gate (`mobile/app/_layout.tsx::Gate`) currently routes
  `!user` → `/login` on every render. Add an onboarding step in front
  of `/login` so the gate routes `!user && !hasSeenOnboarding` →
  `/onboarding` first.
- `ShareToChatSheet` already exists and works. We extend it with a
  "Share externally" header row that calls `Share.share` with the
  existing copy. The change to `FeedItem` is just to drop the long-
  press behaviour and have the tap open the sheet.

See `docs/10-wave-7-onboarding-share.md` for the per-task spec.

---

## Wave 8 — Block / restrict full audit (1 session)

Cover item 5.

**Risk register**

- We need to confirm with the Firebase MCP that the
  `users/{uid}/blocked/{otherUid}` collection exists, has the right
  rules, and is being honoured. The rule is already in
  `firestore.rules` (`isSelf(uid)` for read+write).
- Block enforcement is purely client-side filter today (`getBlockedIds`
  returns a Set, callers `.filter`). That's acceptable for a v1
  ship — Firestore rules can't read the blocker's own subcollection
  during another user's read without a function — but we should
  document the gap for the post-launch backlog.
- Add a *Block / Report* button on the visiting-user profile
  (`mobile/app/user/[uid].tsx`) that opens the existing `ReportSheet`
  with `target = { kind: 'user', userId: uid }` and `blockableUid =
  uid`. Currently the only entry point is the `FeedItem` ellipsis.
- After block, the visiting profile must navigate back and refresh
  the feed (already implemented via `onBlocked` in `FeedItem`; mirror
  on the user profile).

See `docs/11-wave-8-block-audit.md` for the per-task spec.

---

## Wave 9 — Fastlane + Store submission (deferred — was Wave 5)

Renumbered. Same content as `docs/08-wave-5-fastlane.md`. Pause gate
unchanged: still needs Apple Dev account, ASC API key, Android upload
keystore, Play Console service account, store listing copy.

---

## Cross-cutting QA checklist (every wave)

- [ ] Manual smoke test on `0010934AE002636` (golden path + 1 edge case).
- [ ] `firestore.rules` re-deployed if collections/fields touched.
- [ ] `mobile/` typecheck clean for the touched files (best-effort —
      legacy errors documented in earlier session logs are still
      tolerated).
- [ ] Single coherent commit per wave; log entry appended to
      `docs/log.md`.
- [ ] `prompt.md` updated at end of session (mark wave `[x]`, add any
      follow-ups discovered).
