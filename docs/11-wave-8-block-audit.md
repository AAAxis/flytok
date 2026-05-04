# Wave 8 — Block / restrict full audit

> Master design: `docs/superpowers/specs/2026-05-04-pre-launch-fixes-design.md`
> Owner: one frontend-developer agent (single coherent commit)
> Target: 1 session

## Objective

Verify every read path in the app honours the user's block list, fix
any gap discovered, and add a Block / Report entry point on the
visiting-user profile screen so reporting/blocking isn't only
reachable from the feed-item ellipsis.

## Pre-flight (use the Firebase MCP)

Before changing code, audit the live Firestore state:

1. Inspect `firestore.rules` for the `users/{uid}/blocked/{otherUid}`
   match block. Confirm `read, write: if isSelf(uid)` is in place.
2. Use `mcp__firebase__firestore_list_documents` against
   `/users/{your-test-uid}/blocked` to confirm the block subcollection
   resolves at all (it will be empty for a fresh test account).
3. Manually create one block document via the in-app feed Block flow
   while watching the Firestore MCP, then re-list `/users/{me}/blocked`
   — confirm the doc appears with `createdAt` set.
4. Re-load each surface listed below and confirm the blocked user's
   content is gone. Document any surface that still leaks blocked
   content; that's the audit fix list for this wave.

## Surfaces to audit

For each surface, the contract is: **a blocked user's content must not
appear, and a blocked user's profile must not be reachable in a way
that lets the blocker DM/follow/comment.**

| # | Surface | File | Currently honoured? |
|---|---|---|---|
| 1 | Trending feed | `mobile/app/(tabs)/index.tsx` | YES — `getBlockedIds` filter at line 102. |
| 2 | Following feed | `mobile/app/(tabs)/index.tsx` | YES — line 87. |
| 3 | Map clusters | `mobile/app/(tabs)/map.tsx` | YES — line 113. |
| 4 | Inbox threads | `mobile/app/(tabs)/inbox.tsx` (moved to `mobile/app/inbox.tsx` after Wave 6) | YES — `filteredThreads` at line 59. |
| 5 | New-chat picker (follows + global handle search) | `mobile/lib/users.ts` | **AUDIT** — confirm `searchUsersByHandle()` filters out blocked uids. If not, add the filter. |
| 6 | Search → Users tab | `mobile/components/search/ResultsTabs.tsx` | **AUDIT** — confirm. |
| 7 | Search → Videos / Hashtags / Places tabs | same | **AUDIT** — videos owned by blocked users must not surface. |
| 8 | Trending places (Wave 3) | place card / `(tabs)/map.tsx` `PlaceCard` | **AUDIT** — confirm the per-place video list filters by blocked. |
| 9 | User profile (`/user/{uid}`) — when the visited uid is blocked | `mobile/app/user/[uid].tsx` | **GAP** — currently still shows the profile even if the visitor blocked them. Add a banner "You blocked this user" with an "Unblock" button. |
| 10 | Comments on a video the blocked user wrote on | `mobile/components/CommentsSheet.tsx` | **AUDIT** — comments by blocked authors should not render. |
| 11 | Following / followers list | `mobile/components/FollowListSheet.tsx` | **AUDIT** — confirm. |
| 12 | DM thread itself (existing chats) | `mobile/app/chat/[threadId].tsx` | **AUDIT** — confirm the message bubbles from a blocked counterparty are not shown, and the composer is disabled. |
| 13 | New comment / new DM message — blocked user's content | inline | **AUDIT** — should not be deliverable in real-time updates either. |

## Acceptance criteria

- [ ] Every "AUDIT" row above is closed: either confirmed already
      filtered (note in `docs/log.md`) or fixed in this wave with a
      pointer to the diff.
- [ ] Every "GAP" row has a fix shipped.
- [ ] Visiting `/user/{uid}` exposes a `Block / Report` button next to
      the existing `Follow` and `Message` buttons (or in an overflow
      menu — pick whichever fits the existing layout best). Tapping
      it opens the existing `<ReportSheet>` with `target = { kind:
      'user', userId: uid }` and `blockableUid = uid`. After block,
      navigate back and refresh the feed.
- [ ] Currently-blocked counterparties show a one-line banner
      ("You blocked @handle") on `/user/{uid}` with an "Unblock"
      action that calls `unblockUser(uid)` and refreshes the screen.
- [ ] DM screen (`chat/[threadId].tsx`) — if the counterparty is in
      the blocker's blocked set, render an "Unblock to send messages"
      banner over the composer; the composer is disabled.
- [ ] No regression in feed/map performance — `getBlockedIds()` is
      still called once per load (not per render).
- [ ] Firestore rules unchanged (no new rule needed; the existing
      `isSelf(uid)` rule on `users/{uid}/blocked/{otherUid}` covers
      everything).
- [ ] Device test on `0010934AE002636`: golden path = block a user
      from the feed ellipsis, then walk through every surface
      above and confirm the blocked content is gone.

## Files likely touched

**New**
- `mobile/lib/blockSet.ts` — small in-memory cache of the current
  user's blocked set with a `useBlockedSet()` hook and an `invalidate()`
  to call after `blockUser()` / `unblockUser()`. Backs the visiting-
  user profile and the chat banner so we don't repeatedly hit
  Firestore.

**Modified**
- `mobile/app/user/[uid].tsx` — add the Block / Report button (overflow
  menu in the top-right is the cleanest fit; reuse the existing icon
  button shape) and the `you blocked this user` banner.
- `mobile/app/chat/[threadId].tsx` — gate the composer on the blocked
  set; render the banner.
- `mobile/lib/users.ts` (`searchUsersByHandle`) — filter blocked uids
  out of the result list. Source of truth: a passed-in
  `Set<string>` so we don't refetch per query (call site passes
  `useBlockedSet().set`).
- `mobile/components/search/ResultsTabs.tsx` — pass the blocked set
  down or filter inline; whichever the existing query layer makes
  natural.
- `mobile/components/search/TrendingPlaces.tsx` (and the Wave 3 place
  card) — filter videos by `!blockedIds.has(v.ownerId)`.
- `mobile/components/CommentsSheet.tsx` — filter blocked authors out
  of the live snapshot.
- `mobile/components/FollowListSheet.tsx` — filter blocked uids.

## Build sequence

1. Sweep with the Firebase MCP first (see *Pre-flight*). Take notes —
   the audit is more important than the code in this wave.
2. Implement `useBlockedSet()` (live `onSnapshot` on
   `blockedCol(me.uid)`) so the rest of the work uses the same
   reactive source instead of re-running `getBlockedIds()` everywhere.
3. Walk down the surfaces table in order, applying filters inline
   wherever a gap exists. Each individual fix is small (≤10 LOC)
   so they can land in one commit.
4. Add the `/user/{uid}` Block button + banner.
5. Add the chat composer gate + banner.
6. Manual device verification per the *Acceptance criteria*.

## Validation

- `npx tsc --noEmit` clean on touched files.
- Block a test account from the feed → walk every surface → confirm
  zero leaks.
- Unblock the same account → content reappears on every surface.
- Confirm the live `useBlockedSet()` hook reflects updates without a
  manual refresh (open `/user/{uid}` in one device, block from the
  feed in the same session, see the banner appear).

## Out of scope

- Server-side block enforcement (would need Cloud Functions to write
  a `blockedBy` array on every interaction; this is post-launch work).
- Restricting visibility to non-followers ("private accounts") — that
  is its own feature, not part of the audit.
- Reporting workflow improvements (response SLAs, admin tooling).
