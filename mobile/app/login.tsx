import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { colors } from '@/lib/theme';
import { ensureGoogleConfigured } from '@/lib/google-signin';
import { track } from '@/lib/analytics';

type Provider = 'email' | 'google' | 'apple';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);

  async function handleEmail() {
    setError(null);
    setBusy('email');
    try {
      if (mode === 'signin') await login(email.trim(), password);
      else await signup(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? (mode === 'signin' ? 'Sign in failed' : 'Sign up failed'));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy('google');
    try {
      ensureGoogleConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = (result as any)?.data?.idToken ?? (result as any)?.idToken;
      if (!idToken) throw new Error('Google sign-in did not return an ID token');
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const cred = await auth().signInWithCredential(credential);
      track.login('google');
      if (cred.additionalUserInfo?.isNewUser) track.signup('google');
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED' && err?.code !== '-5') {
        setError(err?.message ?? 'Google sign-in failed');
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleApple() {
    setError(null);
    setBusy('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple sign-in did not return an identity token');
      const fbCredential = auth.AppleAuthProvider.credential(
        credential.identityToken,
        // expo-apple-authentication does not return a nonce; firebase accepts undefined here
        undefined as unknown as string,
      );
      const cred = await auth().signInWithCredential(fbCredential);
      track.login('apple');
      if (cred.additionalUserInfo?.isNewUser) track.signup('apple');
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setError(err?.message ?? 'Apple sign-in failed');
      }
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.logoRow}>
            <Text style={styles.logoFly}>Roam</Text>
            <Text style={styles.logoTok}>rez</Text>
          </View>
          <Text style={styles.tagline}>Travel videos for the curious.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholderTextColor={colors.textFaint}
              editable={!anyBusy}
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              placeholderTextColor={colors.textFaint}
              editable={!anyBusy}
              style={styles.input}
            />

            <Pressable
              onPress={handleEmail}
              disabled={anyBusy || !email || !password}
              style={({ pressed }) => [
                styles.primaryButton,
                (anyBusy || !email || !password) && styles.buttonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              {busy === 'email' ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setError(null);
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              }}
              hitSlop={8}
              style={styles.modeToggle}
            >
              <Text style={styles.modeToggleText}>
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={handleGoogle}
              disabled={anyBusy}
              style={({ pressed }) => [
                styles.socialButton,
                anyBusy && styles.buttonDisabled,
                pressed && styles.socialButtonPressed,
              ]}
            >
              {busy === 'google' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              )}
            </Pressable>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={8}
                style={styles.appleButton}
                onPress={handleApple}
              />
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/terms' as never)}>
              Terms
            </Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy' as never)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'baseline', alignSelf: 'center' },
  logoFly: { fontSize: 40, fontWeight: '800', color: colors.text },
  logoTok: { fontSize: 40, fontWeight: '800', color: colors.accent },
  tagline: { color: colors.textDim, fontSize: 12, alignSelf: 'center', marginTop: 4, marginBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  primaryButtonPressed: { backgroundColor: colors.accentDim },
  primaryButtonText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderAlt },
  dividerLabel: { color: colors.textDim, fontSize: 11 },
  socialButton: {
    backgroundColor: colors.bg,
    borderColor: colors.borderAlt,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginBottom: 12,
  },
  socialButtonPressed: { backgroundColor: colors.surfaceAlt },
  socialButtonText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  appleButton: { width: '100%', height: 44 },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
  modeToggle: { alignSelf: 'center', marginTop: 12 },
  modeToggleText: { color: colors.accent, fontSize: 13 },
  legal: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 16 },
  legalLink: { color: colors.accent },
});
