import { GoogleSignin } from '@react-native-google-signin/google-signin';

// iOS client from firebase/GoogleService-Info.plist (CLIENT_ID).
// On iOS the SDK also auto-reads from the plist, so this is belt-and-suspenders.
const IOS_CLIENT_ID =
  '320506157076-ldlrk0pjf7teqh3rs4ktnm8ca1fr6kam.apps.googleusercontent.com';

// Android needs a Web Client ID (auto-created by Firebase when Google sign-in
// is enabled). Paste it here once you grab it from Firebase Console →
// Project settings → General → Your apps → Web client. Until then, Android
// Google sign-in will fail; iOS still works.
const WEB_CLIENT_ID = '';

let configured = false;
export function ensureGoogleConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}
