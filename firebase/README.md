# Firebase

Single Firebase project (`roamerz-b0056`) backs both apps.

| App | SDK | Auth file |
| --- | --- | --- |
| Web admin panel | `firebase` (JS) | `src/lib/firebase.js` |
| Mobile (Expo) | `@react-native-firebase/*` | wired via plugins in `mobile/app.json` |

| Field | Value |
| --- | --- |
| Project ID | `roamerz-b0056` |
| Project number | `320506157076` |
| Bundle ID (iOS + Android) | `com.roamrez.flytok` |
| Storage bucket | `roamerz-b0056.firebasestorage.app` |

## Native configs (this folder)

- `GoogleService-Info.plist` — iOS, referenced from `mobile/app.json` → `ios.googleServicesFile`
- `google-services.json` — Android, referenced from `mobile/app.json` → `android.googleServicesFile`

These contain restricted client API keys, not server secrets. They ship inside the app binary and are protected by Firebase Security Rules + bundle ID / SHA verification. Safe to commit in a private repo.

## App identities

- **Mobile (Roamerz)** — user-facing TikTok-for-travel: video feed, upload/capture, follows, DMs, itineraries, map.
- **Web admin panel** — operator console: user management, video moderation, reports, analytics. **Not** a public surface.

## Schema

Firestore collections (mapped from the original Base44 entities):

```
users/{uid}
videos/{videoId}
videos/{videoId}/comments/{commentId}
likes/{uid}_{videoId}
saves/{uid}_{videoId}
follows/{followerId}_{followingId}
userPreferences/{uid}
itineraries/{itineraryId}
itineraries/{itineraryId}/edits/{editId}
conversations/{conversationId}
conversations/{conversationId}/messages/{messageId}
```

Composite-key documents (`{uid}_{videoId}`) for likes/saves/follows give O(1) existence checks without queries. Counters (`likeCount`, `commentCount`, etc.) are denormalized onto the parent and maintained by Cloud Function triggers.

## Admin gating

Admin role is granted via a custom claim:

```js
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```

The web app reads this claim from the ID token and restricts access. Firestore Security Rules also check `request.auth.token.role == 'admin'` for write-heavy admin operations.
