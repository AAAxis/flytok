import messaging from '@react-native-firebase/messaging';

/**
 * Registers the FCM background message handler. Must be called once at JS
 * boot — the OS calls this even when the app is killed, and Firebase requires
 * the handler to be set before any data-only message is delivered.
 *
 * The handler itself is intentionally near-empty: the Cloud Function payload
 * carries `notification` so the OS shows a banner automatically. We just
 * acknowledge the message so Firebase doesn't redeliver it.
 */
export function setupBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async () => {
    // Nothing to do — the system tray notification is rendered by Firebase
    // because the message includes a `notification` block.
  });
}
