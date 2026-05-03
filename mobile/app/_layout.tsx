import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { setUserProperty } from '@/lib/analytics';
import { setupBackgroundMessageHandler } from '@/lib/messaging';
import { colors } from '@/lib/theme';

// Must be registered before any RemoteMessage can arrive.
setupBackgroundMessageHandler();

function useTrackingPrompt() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let cancelled = false;

    async function ask() {
      try {
        const current = await getTrackingPermissionsAsync();
        if (cancelled) return;
        let status = current.status;
        if (status === 'undetermined') {
          const result = await requestTrackingPermissionsAsync();
          status = result.status;
        }
        setUserProperty('att_status', status);
      } catch {
        // ATT prompt is best-effort; ignore failures
      }
    }

    // iOS only shows the prompt while the app is active. Wait until the app
    // is foregrounded before asking, in case the screen mounts during launch.
    if (AppState.currentState === 'active') {
      ask();
      return () => {
        cancelled = true;
      };
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        ask();
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

function Spinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function useChatPushHandlers() {
  const router = useRouter();

  useEffect(() => {
    function handleNotification(rm: FirebaseMessagingTypes.RemoteMessage | null) {
      const threadId = rm?.data?.threadId;
      if (typeof threadId === 'string' && threadId.length > 0) {
        router.push(`/chat/${threadId}`);
      }
    }

    // Cold-start tap: a notification opened the app from quit state.
    messaging()
      .getInitialNotification()
      .then(handleNotification)
      .catch(() => {});

    // Background -> foreground tap.
    const onOpened = messaging().onNotificationOpenedApp(handleNotification);

    // Foreground arrival — Firebase doesn't display a banner automatically on
    // Android, but for chat we already render the active thread so doing
    // nothing is fine. Hook in case we want a toast later.
    const onMessage = messaging().onMessage(() => {});

    return () => {
      onOpened();
      onMessage();
    };
  }, [router]);
}

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useChatPushHandlers();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    if (!user && !onLogin) router.replace('/login');
    else if (user && onLogin) router.replace('/');
  }, [user, loading, segments, router]);

  if (loading) return <Spinner />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}

export default function RootLayout() {
  useTrackingPrompt();
  return (
    <GestureHandlerRootView style={styles.root}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <Gate />
          <StatusBar style="light" />
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
