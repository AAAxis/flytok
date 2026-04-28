import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { setUserProperty } from '@/lib/analytics';
import { colors } from '@/lib/theme';

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

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
    <AuthProvider>
      <Gate />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
