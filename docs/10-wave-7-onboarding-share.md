# Wave 7 — Pre-auth onboarding + share-to-chat unification

> Master design: `docs/superpowers/specs/2026-05-04-pre-launch-fixes-design.md`
> Owner: one frontend-developer agent (single coherent commit)
> Target: 1 session

## Objective

Address the Apple rejection by adding a 2-screen onboarding carousel
that runs before login on first launch and after every logout. Make
the in-feed Share button open a single sheet that lets the user pick
between "Share externally" (native share sheet) and any of their DM
threads, removing the long-press hidden gesture.

## Acceptance criteria

### Onboarding (2 screens)

- [ ] First-launch users see two onboarding screens before the login
      screen.
- [ ] Each screen is full-bleed, dark theme, with a hero image / SVG,
      a one-line title, a one-paragraph subtitle, and a paginator
      (two dots).
- [ ] Bottom-right primary button on screen 1: `Continue` → screen 2.
      On screen 2: `Get started` → routes to `/login`.
- [ ] Bottom-left ghost button: `Skip` (visible on both screens) →
      routes to `/login`.
- [ ] After the user reaches `/login` for the first time (whether by
      `Skip` or by `Get started`), persist
      `hasSeenOnboarding = true` to `AsyncStorage`.
- [ ] After a successful logout (`AuthContext.logout`), reset
      `hasSeenOnboarding` to `false` so the next sign-in shows the
      onboarding again.
- [ ] On cold start, the auth gate routes:
      - `loading` → spinner;
      - `!user && !hasSeenOnboarding` → `/onboarding`;
      - `!user && hasSeenOnboarding` → `/login`;
      - `user` → `/(tabs)`.
- [ ] Animation between the two screens is a horizontal slide
      (`react-native-pager-view` or a simple `Animated.FlatList`
      `pagingEnabled` — the lighter option). No swipe-to-dismiss past
      the last page.
- [ ] Copy (placeholder content — final copy reviewed by Roman before
      submission):
      - **Screen 1 — "Discover places worth flying for"** —
        "Browse short, punchy travel videos pinned to real-world
        places. Tap any video to see its location on the map."
      - **Screen 2 — "Share moments. Chat with creators."** —
        "Save the spots you love, message the people who shot the
        videos, and post your own clips when you're on the road."

### Share button (in-app + external)

- [ ] Tapping the Share button on a feed video opens the
      `ShareToChatSheet` directly (no long-press gesture).
- [ ] The first row inside `ShareToChatSheet` is **"Share externally"**
      with a `paper-plane-outline` icon. Tapping it triggers the
      existing `Share.share({ message, url })` flow with the same copy
      as today and closes the sheet.
- [ ] Below that row, the existing "Send to creator" row is unchanged.
- [ ] Below that, the existing thread list is unchanged.
- [ ] Long-press is removed from the Share button — single behaviour
      for the entire Share affordance.
- [ ] Device test: tap Share on any feed item, see the sheet,
      tap "Share externally" → native share sheet appears with the
      flytok.vercel.app URL prefilled.

## Files to touch

**New**
- `mobile/app/onboarding.tsx` — full-screen Stack route, two pages,
  Skip / Continue / Get started. Persists the flag.
- `mobile/lib/onboarding.ts` — typed wrappers around `AsyncStorage`:
  `getHasSeenOnboarding()`, `setHasSeenOnboarding(bool)`.
- `mobile/components/onboarding/OnboardingSlide.tsx` — single page
  layout (image + title + subtitle), reused twice.
- Two SVG / PNG assets in `mobile/assets/onboarding/` (use
  AppIcons-style placeholder graphics; final art is a non-code
  follow-up before submission).

**Modified**
- `mobile/app/_layout.tsx` — `Gate` reads `hasSeenOnboarding` (via
  a one-shot effect on mount that hydrates a state value), and routes
  accordingly. Until the flag is hydrated we keep the spinner up.
- `mobile/lib/AuthContext.tsx` — `logout` calls
  `setHasSeenOnboarding(false)` after `auth().signOut()`.
- `mobile/components/ShareToChatSheet.tsx` — add a `Share externally`
  list-header row above `Send to creator` that calls `Share.share`
  with `message`, `url` (compose via the same template as the current
  FeedItem `onPress`).
- `mobile/components/FeedItem.tsx` — Share button: drop `onLongPress`,
  change `onPress` from inline `Share.share` to `setShowShare(true)`.
  Compute the share `message` / `url` inside `ShareToChatSheet` so
  this component stops owning the URL template.
- `mobile/package.json` — add
  `"@react-native-async-storage/async-storage": "^2.0.0"` (Expo SDK 54
  compatible).

## Build sequence

1. Add the AsyncStorage dep, run `npm install` (no native rebuild
   needed — `@react-native-async-storage/async-storage` autolinks via
   Expo modules in SDK 54). If the build complains, document the need
   for `npx expo prebuild --platform android` (the global rule against
   `--clean` still applies).
2. Implement `lib/onboarding.ts`:
   ```ts
   import AsyncStorage from '@react-native-async-storage/async-storage';
   const KEY = 'flytok.hasSeenOnboarding.v1';
   export async function getHasSeenOnboarding() {
     try { return (await AsyncStorage.getItem(KEY)) === '1'; }
     catch { return false; }
   }
   export async function setHasSeenOnboarding(v: boolean) {
     try { await AsyncStorage.setItem(KEY, v ? '1' : '0'); }
     catch { /* best-effort */ }
   }
   ```
3. Build `OnboardingSlide` (props: `title`, `subtitle`, `image`).
4. Build `app/onboarding.tsx` — a `FlatList horizontal pagingEnabled`
   with two `OnboardingSlide` cells, paginator dots, and the Skip /
   Continue / Get started buttons. After `Get started` or `Skip`
   call `setHasSeenOnboarding(true)` then `router.replace('/login')`.
5. Hook the `Gate` in `app/_layout.tsx`:
   ```tsx
   const [seen, setSeen] = useState<boolean | null>(null);
   useEffect(() => { getHasSeenOnboarding().then(setSeen); }, []);
   if (loading || seen === null) return <Spinner />;
   const onLogin = segments[0] === 'login';
   const onOnboarding = segments[0] === 'onboarding';
   if (!user && !seen && !onOnboarding) router.replace('/onboarding');
   else if (!user && seen && !onLogin && !onOnboarding) router.replace('/login');
   else if (user && (onLogin || onOnboarding)) router.replace('/');
   ```
6. Update `AuthContext.logout`:
   ```ts
   logout: async () => {
     await auth().signOut();
     await setHasSeenOnboarding(false);
   }
   ```
7. Patch `ShareToChatSheet`: add a list-header row above the existing
   `Send to creator` block. Accept the share template from the caller
   via a new prop `externalShare?: { message: string; url: string }`,
   defaulting to a template built from `video.caption` and
   `https://flytok.vercel.app/v/${video.id}`. The header row calls
   `Share.share({ message, url })`.
8. Patch `FeedItem`: drop `onLongPress`, change `onPress` to
   `setShowShare(true)`. Remove the inline `Share.share` block.

## Validation

- `npx tsc --noEmit` clean on touched files.
- Cold-start install on `0010934AE002636`:
  - Onboarding screens 1 → 2 → login.
  - Skip on screen 1 also goes to login.
  - After login, kill app, reopen — lands on tabs (no onboarding).
  - Logout from settings → next launch shows onboarding again.
- Tap Share on any feed video → sheet opens with three sections in
  order: `Share externally`, `Send to creator`, thread list. Tapping
  `Share externally` opens the native share sheet with the flytok URL.

## Out of scope

- Final onboarding artwork (Roman to commission / generate before
  store submission — placeholder graphics are good enough for the
  build).
- Adding analytics events for the onboarding funnel (post-launch).
- Onboarding for users who *upgrade* the app rather than first-install
  (out of scope; the `v1` key in the AsyncStorage flag means we can
  add a v2 onboarding later by bumping the key).
