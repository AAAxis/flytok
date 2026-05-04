# App Store Connect — Reply (Roamerz)

Hi App Review team,

**1. Screen recording**: Attached `roamerz-review-flow.mp4`, recorded on a physical iPhone. Covers launch, sign-up/sign-in (email, Apple, Google), account deletion, feed browsing, video upload, map view, report/block, DMs, and all permission prompts.

**2. Purpose**: Roamerz is a short-form travel-video app. Travelers post location-tagged vertical videos; viewers discover them via a Trending feed and a Map view. Audience: travelers (18+) and travel creators.

**3. Reviewer access**:
- Email: `[demo@roamerz.app]`
- Password: `[REVIEWER_PASSWORD]`
- Sign in with Apple and Google also available on the login screen.

Flow: Sign in → Trending feed → Map tab → Upload tab → tap ⋯ on any video to Report/Block → Profile → Settings → Delete account.

**4. External services**: Firebase (Auth, Firestore, Storage, Messaging, Crashlytics), Sign in with Apple, Google Sign-In, Google Maps SDK. No payments, no ad networks, no third-party AI in this build.

**5. Regions**: Functions identically in all regions. English only. No region-specific content or features.

**6. Regulated industry**: No — general-audience travel UGC.

**UGC moderation**: Report (reviewed within 24h), Block (instant), Account deletion in Settings (deletes Firestore doc + Auth user).

Thanks,
Roamerz team

---

**Before pasting**: (1) record on real device with the rebuilt "Roamerz" branding, (2) create demo account + seed a few videos, (3) fill in `[brackets]`.
