# Profile redesign — design spec

**Date:** 2026-05-04
**Status:** Approved
**Owner:** Roman

## Goal

Make the Profile screen feel modern and professional, and fix the long-standing
bug where the top-bar handle showed the user's display name (e.g. `@Joe Doe`)
instead of an actual `@username`.

Two intertwined concerns are addressed in one change because the layout work
exposes the handle bug and vice versa:

1. **Layout** — full-bleed cover image, avatar overlapping the bottom edge of
   the cover, identity + stats + action buttons stacked below.
2. **Identity model** — username (the `@handle`) and display name (the
   human-readable name) are stored, edited, and rendered as **separate** fields.

## Non-goals

- Verified badges, link-in-bio, multi-link list.
- Cover-image upload UI changes (already lives in `CustomizeThemeSheet`).
- Migrating @handles inside existing DM threads, captions, or comments.
- Rate-limiting username changes (will likely add later, not in this change).

## 1. Layout

Top → bottom:

```
┌─────────────────────────────────────┐
│ ┌──────────┐                ┌─────┐ │  ← top bar overlay,
│ │@joe_doe  │                │  ☰  │ │    sits inside top safe-area
│ └──────────┘                └─────┘ │    inset
│                                     │
│        cover image / gradient       │  ← cover band, edge-to-edge,
│                                     │    height 200dp (220 on tablets)
│                                     │
│              ╭────╮                 │
└──────────────│ AV │─────────────────┘
               ╰────╯                    ← avatar, 96dp, overlaps cover by 50%

              Joe Doe                    ← display name, 18dp/700
       Travel & food vlogger             ← bio, 13dp dim, max 2 lines

  ┌──────┬──────┬──────────┬──────────┐
  │ 12   │ 34   │   56     │   78     │  ← stats card (rounded, subtle border)
  │Posts │Saved │Following │Followers │
  └──────┴──────┴──────────┴──────────┘

  ┌────────────────┐  ┌─────────────┐
  │ ✎ Edit profile │  │ 🎨 Customize │   ← action row, both flex:1, h:40, r:12
  └────────────────┘  └─────────────┘

  ─────────── tabs (Mine / Saved) ────────────
                  video grid
```

### Cover band

- **Height:** 200dp on phones, 220dp on tablets (`useWindowDimensions().width >= 600`).
- **Extends to top of screen** behind the status bar. To allow this, the
  outer `<SafeAreaView edges={['top']}>` in `profile.tsx` is replaced with a
  plain `<View style={{ flex: 1 }}>` — top inset is consumed *inside* the
  top-bar overlay (`top: insets.top + 8`) instead. Status bar style flips to
  `light-content` while the profile screen is focused (`useFocusEffect`).
- **Background source:**
  - If `themed.headerBackgroundImageURL` → `<ImageBackground>` with `cover`
    resize, plus a bottom-fading scrim (`linear-gradient(rgba(0,0,0,0)` →
    `rgba(0,0,0,0.45))`) so text on the cover stays legible.
  - Else → `<LinearGradient>` from `themed.headerBackgroundColor` (top, 100%
    opacity) to a 60% mix of the same color over `colors.bg` (bottom). This is
    the new fallback (replaces the current solid block).

### Top bar overlay

- Lives **inside** the cover band, positioned absolutely at
  `{ top: insets.top + 8, left: 16, right: 16 }`.
- **Left** — `@username` rendered inside a translucent dark pill:
  - bg `rgba(0,0,0,0.35)`, padding `6×12`, radius `999`, font 14/600, color
    white.
  - Falls back to `@user_xxxxxx` (uid prefix) for any user whose `username`
    is still null. This handles legacy accounts that opened the app before
    `ensureUsername()` shipped or whose first auto-generation request raced.
    The fallback never persists — the next foreground tick re-tries
    `ensureUsername()`.
- **Right** — burger button:
  - 36×36, `borderRadius: 18` (full circle), background = `themed.accentColor`,
    icon white, hit slop 10.
  - Replaces the current bare `<Ionicons name="menu">`.

### Avatar

- 96dp circle, 3px ring in `colors.bg` (so it cleanly cuts through the cover).
- Centered horizontally; `marginTop: -48` to overlap the cover by 50%.
- Pencil edit badge stays — moved to bottom-right, sized down to 24dp to keep
  the avatar uncluttered.

### Identity block

- Centered, padding `16` horizontal.
- `Joe Doe` — 18/700, `colors.text`.
- Bio — 13/regular, `colors.textDim`, max 2 lines, ellipsis. Hidden if empty.

### Stats card

- One container (`backgroundColor: colors.surface`, border, radius 12), 16dp
  horizontal margin, 12dp internal vertical padding.
- 4 stats, equal flex. Tap on Following / Followers opens the existing
  `FollowListSheet`.

### Action row

- 16dp horizontal margin, gap 10.
- Both buttons `flex: 1`, height 40, radius 12 (was 8 — slightly rounder).
- "Edit profile" — surface bg, border (unchanged).
- "Customize" — `themed.accentColor` bg (unchanged behavior).

### Tabs + grid

- Unchanged. The existing `TabButton` row + `<VideoGrid>` follows after the
  action row with a 12dp top margin.

## 2. Username + display name

### Schema

`users/{uid}` doc:

| Field              | Type                  | Notes                                    |
|--------------------|-----------------------|------------------------------------------|
| `displayName`      | `string \| null`      | unchanged                                |
| `displayNameLower` | `string \| null`      | unchanged                                |
| `username`         | `string \| null`      | existed; now always populated            |
| `usernameLower`    | `string \| null`      | **new** — case-insensitive copy          |
| `bio`              | `string \| null`      | unchanged                                |
| `photoURL`         | `string \| null`      | unchanged                                |

New collection:

- **`usernames/{usernameLower}`** — reservation doc. Body: `{ uid: string }`.
  Existence ⇒ that handle is taken. This is the uniqueness primitive.

### Username rules

Validated client-side, enforced server-side:

- Length 3–24
- Must start with `[a-z]`
- Allowed chars: `[a-z0-9._]`
- No consecutive dots (`..` rejected)
- Cannot end with `.`
- Reserved (case-insensitive) blocked: `admin`, `support`, `flytok`, `root`,
  `me`, `you`, `null`, `undefined`, `system`, `staff`

Regex (full match): `^[a-z](?!.*\.\.)[a-z0-9._]{1,22}[a-z0-9_]$`

(For length 3+ with a non-`.` final char; the inner class allows `.` but the
last character class excludes it.)

### Auto-generate on first open

When the user is signed in and the Firestore user doc has no `username`:

1. Build a candidate from `displayName`:
   - lowercase, replace runs of non-`[a-z0-9._]` with `.`
   - strip leading non-letter chars
   - clamp to 24 chars
2. If the candidate is empty or fails the rules, use `user`.
3. Append a 4-char uid suffix: `${base}_${uid.slice(0, 4)}`.
4. Run the `claimUsername` transaction (see below). On contention, retry with a
   new random 4-char suffix up to 3 times before giving up.
5. Silent — no UI, no toast.

### `claimUsername(newUsername)` transaction

Pseudo-Firestore transaction:

```
runTransaction:
  read users/{uid}        → currentUsernameLower
  if newLower === currentUsernameLower: return  (no-op)
  read usernames/{newLower}
    if exists and exists.uid !== uid: throw 'username_taken'
  write usernames/{newLower} = { uid }
  if currentUsernameLower:
    delete usernames/{currentUsernameLower}
  write users/{uid} merge { username: new, usernameLower: newLower }
```

The transaction guarantees atomic uniqueness even under concurrent claims.

### EditProfileSheet — UI changes

Add a **Username** field above the Name field:

- Label: `USERNAME` (matches existing label style).
- Input: prefix `@` rendered inside the input, `autoCapitalize="none"`,
  `autoCorrect={false}`, lowercase-forced via `onChangeText`.
- Live validation: red helper text under the field with the failing rule.
  Save button disabled while invalid OR while a server taken-check is in
  flight.
- Server check on blur (debounced 400ms): peek `usernames/{lower}` — if it
  exists and `uid !== me.uid`, show "taken".
- Save flow:
  1. Validate locally; if invalid, abort.
  2. If `username` changed → run `claimUsername`. On `username_taken` show
     inline error.
  3. If `displayName` or `bio` changed → existing `updateProfile` path.
- Hide auto-correct/auto-capitalize for the username input.

### Top-bar handle source

- `app/(tabs)/profile.tsx:196` (the buggy line) → use `username` (now always
  populated). No fallback to `displayName`. If absent for legacy reasons, fall
  back to `user_${uid.slice(0,6)}`.
- `app/user/[uid].tsx` — the `Stack` title and any header label that currently
  derive from `useUserLabel` should continue to use `useUserLabel` (it already
  prefers `username`), no change needed beyond the visual layout work.

### Firestore security rules (`firebase/firestore.rules`)

```
match /usernames/{name} {
  allow read: if true;
  allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid
                && name.matches('^[a-z][a-z0-9._]{2,23}$')
                && !name.matches('.*\\.\\..*')
                && !name.matches('.*\\.$');
  allow delete: if request.auth != null
                && resource.data.uid == request.auth.uid;
  allow update: if false;  // delete-and-recreate, never update
}
```

Existing `users/{uid}` rule already allows the owner to update their own doc.

## 3. Files touched

| File                                               | Change                                                         |
|----------------------------------------------------|----------------------------------------------------------------|
| `mobile/lib/username.ts` **(new)**                 | Rules, regex, `validateUsername`, `slugify`, reserved list     |
| `mobile/lib/firestore.ts`                          | `usernamesCol()`, `claimUsername()`, `ensureUsername()`, `updateProfile` accepts `username` |
| `mobile/lib/useUserLabel.ts`                       | No change (already prefers `username`)                         |
| `mobile/app/_layout.tsx`                           | Call `ensureUsername()` once per app launch per uid (in-memory `Set<uid>` guard) after auth ready |
| `mobile/app/(tabs)/profile.tsx`                    | Header section rewrite; fix top-bar handle source              |
| `mobile/app/user/[uid].tsx`                        | Same header redesign (read-only variant)                       |
| `mobile/components/EditProfileSheet.tsx`           | Add Username field with validation + server taken-check        |
| `firebase/firestore.rules`                         | Add `usernames/{name}` ruleset                                 |

## 4. Risks & mitigations

- **Auto-generated username collision storm** (e.g. many "joe" displayName
  users): the uid-suffix step makes collisions vanishingly rare, plus the 3-try
  retry catches the rest.
- **Status-bar flicker**: setting `light-content` on focus and reverting on
  blur is the standard pattern; use `useFocusEffect` to scope it.
- **Cover image perf**: existing `<ImageBackground>` already loads from URL;
  no change to load behavior. The new gradient fallback uses
  `expo-linear-gradient` which is already a dependency (used in the existing
  feed item gradient).
- **Old user docs without `usernameLower`**: `claimUsername` writes both the
  reservation doc AND the user-doc fields in one transaction, so any user who
  edits or auto-generates becomes consistent. No batch migration required.

## 5. Acceptance checks

- [ ] Profile cover extends to the very top of the screen, behind the status
      bar. Top bar pill + circular burger sit at the top safe-area inset.
- [ ] Burger is a circle, accent-colored. Pressed → opens settings sheet.
- [ ] Avatar overlaps the cover band by exactly half its height.
- [ ] Stats card and the two action buttons sit below the cover, on the
      regular page background.
- [ ] Editing display name from "Joe" to "Joe Doe" does **not** change the
      `@handle` shown in the top bar.
- [ ] Edit Profile shows a Username field; entering an invalid handle shows
      the failing rule; entering a taken handle shows "taken"; saving a valid
      handle updates both the user doc and the reservation doc.
- [ ] A brand-new user (no `username`) opening Profile writes a derived
      `username` to Firestore within ~1s; the top bar shows it.
- [ ] Two devices simultaneously claiming the same handle → exactly one
      succeeds, the other gets `username_taken`.
