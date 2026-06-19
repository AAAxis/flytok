import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
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
  const [showPassword, setShowPassword] = useState(false);
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
  const emailValid = !!email.trim();
  const canContinue = showPassword ? emailValid && !!password : emailValid;
  const primaryDisabled = anyBusy || !canContinue;
  const verb = mode === 'signin' ? 'Sign in' : 'Sign up';

  function handlePrimary() {
    // Match the design: only email is shown first; reveal password on first tap.
    if (!showPassword) {
      setError(null);
      setShowPassword(true);
      return;
    }
    handleEmail();
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Black (top) → grey (bottom) background gradient, matching the design. */}
      <LinearGradient
        colors={['#000000', '#161619', '#3a3a40']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Image
            source={require('@/assets/images/logo-bird.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            editable={!anyBusy}
            style={styles.input}
          />

          {/* Password — revealed after the first tap, mirroring the design's email-only start */}
          {showPassword && (
            <>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                editable={!anyBusy}
                onSubmitEditing={handleEmail}
                style={styles.input}
              />
            </>
          )}

          {/* Sign in (gradient) */}
          <Pressable
            onPress={handlePrimary}
            disabled={primaryDisabled}
            style={({ pressed }) => [styles.primaryWrap, pressed && styles.pressed, primaryDisabled && styles.disabled]}
          >
            <LinearGradient
              // Matches the Figma button: bright pale-blue → medium sky-blue, left to right.
              colors={['#8ed7fa', '#48b0ef', '#2f9fe6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              {busy === 'email' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{verb}</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* OR divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <Pressable
            onPress={handleGoogle}
            disabled={anyBusy}
            style={({ pressed }) => [styles.socialButton, anyBusy && styles.disabled, pressed && styles.socialPressed]}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <GoogleMark />
                <Text style={styles.socialButtonText}>{verb} with Google</Text>
              </>
            )}
          </Pressable>

          {/* Apple */}
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={handleApple}
              disabled={anyBusy}
              style={({ pressed }) => [styles.socialButton, anyBusy && styles.disabled, pressed && styles.socialPressed]}
            >
              {busy === 'apple' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <AppleMark />
                  <Text style={styles.socialButtonText}>{verb} with Apple</Text>
                </>
              )}
            </Pressable>
          )}

          {/* Toggle sign in / sign up */}
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

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Legal */}
          <Text style={styles.legal}>
            By continuing, you agree to the{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/terms' as never)}>
              Terms of use
            </Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy' as never)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Official multicolour Google "G" — transparent vector, no chip. */
function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </Svg>
  );
}

/** Apple's monochrome white glyph — transparent vector. */
function AppleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M16.365 1.43c0 1.14-.42 2.22-1.18 3.04-.84.9-2.2 1.6-3.36 1.5-.14-1.1.43-2.26 1.16-3.03.83-.88 2.27-1.54 3.38-1.51zM20.5 17.1c-.6 1.38-.89 1.99-1.66 3.21-1.08 1.7-2.6 3.82-4.48 3.84-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.93-4.4-3.63C-1.3 16.4-1.6 10.86.83 7.92 1.95 6.55 3.7 5.68 5.3 5.68c1.66 0 2.7 1.09 4.07 1.09 1.33 0 2.14-1.09 4.06-1.09 1.45 0 2.99.79 4.08 2.15-3.59 1.96-3 7.08.99 9.27z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Pure black so the kingfisher logo (black-backed PNG) blends seamlessly.
  safe: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logo: { width: 96, height: 96, alignSelf: 'center', marginBottom: 40 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  primaryWrap: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  primaryButton: { height: 50, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderAlt },
  dividerLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  socialButton: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  socialPressed: { backgroundColor: colors.surfaceAlt },
  socialButtonText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  modeToggle: { alignSelf: 'center', marginTop: 8 },
  modeToggleText: { color: colors.accent, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, marginTop: 14, textAlign: 'center' },
  legal: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 24, lineHeight: 16 },
  legalLink: { color: colors.textMuted, textDecorationLine: 'underline' },
});
