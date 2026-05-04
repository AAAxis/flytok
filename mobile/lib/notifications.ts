import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getMessaging,
  hasPermission,
  requestPermission,
} from '@react-native-firebase/messaging';

function isGranted(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

/**
 * Requests notification permission once if the OS hasn't already recorded
 * an answer. Returns true if currently authorized.
 *
 * iOS: prompts only when status is NOT_DETERMINED.
 * Android 13+ (API 33+): prompts via POST_NOTIFICATIONS the first time.
 * Older Android: notifications are allowed by default.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const messaging = getMessaging(getApp());
      const current = await hasPermission(messaging);
      if (current === AuthorizationStatus.NOT_DETERMINED) {
        const result = await requestPermission(messaging);
        return isGranted(result);
      }
      return isGranted(current);
    }

    if (Platform.OS === 'android') {
      if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }
  } catch {
    // best-effort; treat unknown failures as not-granted
  }
  return false;
}
