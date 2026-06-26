import { useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  BIO_MAX,
  claimUsername,
  deleteAccount,
  updateProfile,
  uploadProfilePhoto,
  usernamesCol,
  usersCol,
} from '@/lib/firestore';
import {
  USERNAME_MAX,
  normaliseUsername,
  usernameErrorMessage,
  validateUsername,
} from '@/lib/username';
import { useAuth } from '@/lib/AuthContext';
import { colors } from '@/lib/theme';

type TakenState = 'idle' | 'checking' | 'free' | 'taken';

export default function EditProfileScreen() {
  const me = auth().currentUser;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [taken, setTaken] = useState<TakenState>('idle');
  const takenSeq = useRef(0);

  useEffect(() => {
    if (!me) return;
    usersCol()
      .doc(me.uid)
      .get()
      .then((snap) => {
        const data = snap.data() ?? {};
        const u = (data.username as string) ?? '';
        setUsername(u);
        setOriginalUsername(u);
        setDisplayName((data.displayName as string) ?? '');
        setBio((data.bio as string) ?? '');
        setPhotoURL((data.photoURL as string) ?? null);
      })
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const lower = normaliseUsername(username);
    if (!lower || lower === originalUsername) {
      setTaken('idle');
      return;
    }
    if (validateUsername(lower)) {
      setTaken('idle');
      return;
    }
    setTaken('checking');
    const seq = ++takenSeq.current;
    const t = setTimeout(async () => {
      try {
        const snap = await usernamesCol().doc(lower).get();
        if (seq !== takenSeq.current) return;
        if (!snap.exists()) setTaken('free');
        else if ((snap.data()?.uid as string) === me.uid) setTaken('free');
        else setTaken('taken');
      } catch {
        if (seq === takenSeq.current) setTaken('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, originalUsername, me]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission needed', 'Enable photo library access in Settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(res.assets[0].uri);
      setPhotoURL(url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again later.');
    } finally {
      setUploading(false);
    }
  }

  const usernameError = username ? validateUsername(normaliseUsername(username)) : null;
  const usernameChanged = normaliseUsername(username) !== originalUsername;
  const usernameBlocking = !!usernameError || taken === 'checking' || taken === 'taken';

  async function save() {
    setBusy(true);
    try {
      if (usernameChanged) {
        if (usernameError) {
          Alert.alert('Username', usernameErrorMessage(usernameError));
          return;
        }
        try {
          await claimUsername(normaliseUsername(username));
        } catch (err: any) {
          if (err?.message === 'username_taken') {
            setTaken('taken');
            Alert.alert('Username taken', 'Pick a different handle.');
            return;
          }
          throw err;
        }
      }
      await updateProfile({ displayName, bio });
      router.back();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Try again later.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your Roamerz account, profile, videos, and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err: any) {
              if (err?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Sign in again to delete',
                  "For your security, please sign in again, then delete your account. We'll sign you out now.",
                  [{ text: 'OK', onPress: () => logout().catch(() => {}) }],
                );
              } else {
                Alert.alert('Could not delete', err?.message ?? 'Try again later.');
              }
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <Pressable onPress={save} disabled={busy || (usernameChanged && usernameBlocking)} hitSlop={8} style={styles.headerBtn}>
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.headerSave, (usernameChanged && usernameBlocking) && styles.headerSaveDisabled]}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.photoRow}>
            <Pressable onPress={pickPhoto} disabled={uploading} style={styles.photoWrap} hitSlop={8}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Ionicons name="person" size={28} color={colors.text} />
                </View>
              )}
              <View style={styles.photoBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Ionicons name="camera" size={14} color={colors.bg} />
                )}
              </View>
            </Pressable>
            <Pressable onPress={pickPhoto} disabled={uploading} hitSlop={8}>
              <Text style={styles.photoAction}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.usernamePrefix}>@</Text>
            <TextInput
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              placeholder="your_handle"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={USERNAME_MAX}
              style={styles.usernameInput}
            />
            <UsernameStatus error={usernameError} changed={usernameChanged} taken={taken} />
          </View>
          <UsernameHelper error={usernameError} changed={usernameChanged} taken={taken} />

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            maxLength={40}
            style={styles.input}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about you"
            placeholderTextColor={colors.textFaint}
            maxLength={BIO_MAX}
            multiline
            style={[styles.input, styles.bio]}
          />
          <Text style={styles.counter}>{bio.length}/{BIO_MAX}</Text>

          <Pressable
            onPress={save}
            disabled={busy || (usernameChanged && usernameBlocking)}
            style={[styles.saveBtn, (busy || (usernameChanged && usernameBlocking)) && styles.saveBtnDisabled]}
          >
            {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>

          <Pressable onPress={confirmDelete} style={styles.deleteBtn} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Delete account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function UsernameStatus({
  error,
  changed,
  taken,
}: {
  error: ReturnType<typeof validateUsername>;
  changed: boolean;
  taken: TakenState;
}) {
  if (!changed) return null;
  if (error) return <Ionicons name="close-circle" size={18} color={colors.danger} />;
  if (taken === 'checking') return <ActivityIndicator size="small" color={colors.textDim} />;
  if (taken === 'taken') return <Ionicons name="close-circle" size={18} color={colors.danger} />;
  if (taken === 'free') return <Ionicons name="checkmark-circle" size={18} color={colors.accent} />;
  return null;
}

function UsernameHelper({
  error,
  changed,
  taken,
}: {
  error: ReturnType<typeof validateUsername>;
  changed: boolean;
  taken: TakenState;
}) {
  if (changed && error) return <Text style={styles.helperError}>{usernameErrorMessage(error)}</Text>;
  if (changed && taken === 'taken') return <Text style={styles.helperError}>That handle is already taken.</Text>;
  if (changed && taken === 'free') return <Text style={styles.helperOk}>Available.</Text>;
  return <Text style={styles.helper}>3–24 chars · letters, numbers, &quot;.&quot; and &quot;_&quot;</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 56, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  headerSave: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  headerSaveDisabled: { opacity: 0.4 },
  body: { padding: 16, paddingBottom: 48 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.bg,
    borderWidth: 2,
  },
  photoAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  label: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 14,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  usernamePrefix: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  usernameInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 14 },
  helper: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  helperError: { color: colors.danger, fontSize: 11, marginTop: 4 },
  helperOk: { color: colors.accent, fontSize: 11, marginTop: 4 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  bio: { minHeight: 90, textAlignVertical: 'top' },
  counter: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
