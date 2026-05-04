import { useEffect, useRef, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  claimUsername,
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
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

type TakenState = 'idle' | 'checking' | 'free' | 'taken';

export function EditProfileSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const me = auth().currentUser;
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
    if (!visible || !me) return;
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
        setTaken('idle');
      })
      .catch(() => {});
  }, [visible, me]);

  // Debounced server-side taken-check. Only runs when the local validator
  // passes AND the value differs from the original — saves a Firestore read
  // per keystroke.
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
        if (!snap.exists) setTaken('free');
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
      onSaved?.();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Try again later.');
    } finally {
      setUploading(false);
    }
  }

  const usernameError = username ? validateUsername(normaliseUsername(username)) : null;
  const usernameChanged = normaliseUsername(username) !== originalUsername;
  const usernameBlocking =
    !!usernameError || taken === 'checking' || taken === 'taken';

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
      onSaved?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['85%']}
      title="Edit profile"
    >
      <BottomSheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
            <Text style={styles.photoAction}>
              {uploading ? 'Uploading…' : 'Change photo'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Username</Text>
        <View style={styles.usernameRow}>
          <Text style={styles.usernamePrefix}>@</Text>
          <BottomSheetTextInput
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder="your_handle"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
            style={styles.usernameInput}
          />
          <UsernameStatus
            error={usernameError}
            changed={usernameChanged}
            taken={taken}
          />
        </View>
        <UsernameHelper
          error={usernameError}
          changed={usernameChanged}
          taken={taken}
        />

        <Text style={styles.label}>Name</Text>
        <BottomSheetTextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          style={styles.input}
        />

        <Text style={styles.label}>Bio</Text>
        <BottomSheetTextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about you"
          placeholderTextColor={colors.textFaint}
          maxLength={120}
          multiline
          style={[styles.input, styles.bio]}
        />
        <Text style={styles.counter}>{bio.length}/120</Text>

        <Pressable
          onPress={save}
          disabled={busy || (usernameChanged && usernameBlocking)}
          style={[
            styles.saveBtn,
            (busy || (usernameChanged && usernameBlocking)) && styles.saveBtnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </BottomSheetScrollView>
    </AppBottomSheet>
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
  if (!changed) {
    return <Text style={styles.helper}>3–24 chars · letters, numbers, "." and "_"</Text>;
  }
  if (error) {
    return <Text style={styles.helperError}>{usernameErrorMessage(error)}</Text>;
  }
  if (taken === 'taken') {
    return <Text style={styles.helperError}>That handle is already taken.</Text>;
  }
  if (taken === 'free') {
    return <Text style={styles.helperOk}>Available.</Text>;
  }
  return <Text style={styles.helper}>3–24 chars · letters, numbers, "." and "_"</Text>;
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg },
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
    borderColor: colors.surface,
    borderWidth: 2,
  },
  photoAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  label: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  usernamePrefix: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  usernameInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  helper: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  helperError: { color: colors.danger, fontSize: 11, marginTop: 4 },
  helperOk: { color: colors.accent, fontSize: 11, marginTop: 4 },
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
  bio: { minHeight: 90, textAlignVertical: 'top' },
  counter: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
});
