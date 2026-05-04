import { GoogleSignin } from '@react-native-google-signin/google-signin';

// iOS client from firebase/GoogleService-Info.plist (CLIENT_ID).
// On iOS the SDK also auto-reads from the plist, so this is belt-and-suspenders.
const IOS_CLIENT_ID =
  '320506157076-ldlrk0pjf7teqh3rs4ktnm8ca1fr6kam.apps.googleusercontent.com';

// Web Client ID auto-created by Firebase when Google sign-in is enabled.
// Pulled from firebase/google-services.json -> client.oauth_client[client_type: 3].
// Required on Android; the SDK auto-reads it on iOS but we pass it for parity.
const WEB_CLIENT_ID =
  '320506157076-vhtgtin9peg3gi1rrjj79s2k261jkdjj.apps.googleusercontent.com';

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
