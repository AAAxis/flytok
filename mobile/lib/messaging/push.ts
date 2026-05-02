import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { ensureNotificationPermission } from '@/lib/notifications';

let tokenRefreshUnsub: (() => void) | null = null;
let lastRegisteredToken: string | null = null;

function userDoc(uid: string) {
  return firestore().collection('users').doc(uid);
}

async function writeToken(uid: string, token: string): Promise<void> {
  if (lastRegisteredToken === token) return;
  await userDoc(uid).set(
    {
      fcmTokens: firestore.FieldValue.arrayUnion(token),
      fcmTokensUpdatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  lastRegisteredToken = token;
}

/**
 * Registers this device's FCM token against the signed-in user. Idempotent:
 * safe to call from `AuthProvider` after every sign-in, and from foreground
 * resume. Subscribes to `onTokenRefresh` once per process so we keep the
 * token up to date when Firebase rotates it.
 */
export async function registerFcmTokenForUser(): Promise<void> {
  const me = auth().currentUser;
  if (!me) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  try {
    const token = await messaging().getToken();
    if (token) await writeToken(me.uid, token);
  } catch (err) {
    console.warn('[push] getToken failed', err);
  }

  if (!tokenRefreshUnsub) {
    tokenRefreshUnsub = messaging().onTokenRefresh(async (token: string) => {
      const u = auth().currentUser;
      if (!u || !token) return;
      try {
        await writeToken(u.uid, token);
      } catch (err) {
        console.warn('[push] onTokenRefresh write failed', err);
      }
    });
  }
}

/**
 * Removes this device's token from the user doc and stops the refresh
 * subscription. Called on sign-out so notifications don't follow a logged-out
 * user on a shared device.
 */
export async function unregisterCurrentDeviceToken(): Promise<void> {
  const me = auth().currentUser;
  try {
    const token = await messaging().getToken();
    if (me && token) {
      await userDoc(me.uid).set(
        {
          fcmTokens: firestore.FieldValue.arrayRemove(token),
          fcmTokensUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    // Free the local token so the next user gets a fresh one.
    await messaging().deleteToken();
  } catch (err) {
    console.warn('[push] unregister failed', err);
  } finally {
    lastRegisteredToken = null;
    tokenRefreshUnsub?.();
    tokenRefreshUnsub = null;
  }
}
