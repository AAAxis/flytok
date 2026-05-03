import { useEffect, useState } from 'react';
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
import { updateProfile, uploadProfilePhoto, usersCol } from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

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
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!visible || !me) return;
    usersCol()
      .doc(me.uid)
      .get()
      .then((snap) => {
        const data = snap.data() ?? {};
        setDisplayName((data.displayName as string) ?? '');
        setBio((data.bio as string) ?? '');
        setPhotoURL((data.photoURL as string) ?? null);
      })
      .catch(() => {});
  }, [visible, me]);

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

  async function save() {
    setBusy(true);
    try {
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

        <Pressable onPress={save} disabled={busy} style={styles.saveBtn}>
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
  saveText: { color: colors.bg, fontSize: 14, fontWeight: '600' },
});
