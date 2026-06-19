import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/AuthContext';
import { usersCol } from '@/lib/firestore';
import { CustomizeThemeSheet } from '@/components/CustomizeThemeSheet';
import { colors } from '@/lib/theme';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = auth().currentUser;
  const [showCustomize, setShowCustomize] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    usersCol()
      .doc(me.uid)
      .get()
      .then((snap) => {
        const data = snap.data() ?? {};
        setName((data.displayName as string) ?? null);
        setHandle((data.username as string) ?? null);
        setPhoto((data.photoURL as string) ?? null);
      })
      .catch(() => {});
  }, [me]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.push('/(tabs)/profile' as never)}
          style={({ pressed }) => [styles.profileCard, pressed && styles.rowPressed]}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
              <Ionicons name="person" size={24} color={colors.text} />
            </View>
          )}
          <View style={styles.profileMeta}>
            {name?.trim() ? <Text style={styles.profileName}>{name.trim()}</Text> : null}
            <Text style={styles.profileHandle}>@{handle ?? (me ? `user_${me.uid.slice(0, 6)}` : '')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Section title="Appearance">
          <Row
            icon="color-palette-outline"
            label="Customize theme"
            onPress={() => setShowCustomize(true)}
          />
        </Section>

        <Section title="Account">
          <Row
            icon="person-circle-outline"
            label="Edit profile"
            onPress={() => router.push('/edit-profile' as never)}
          />
        </Section>

        <Section title="Legal">
          <Row icon="document-text-outline" label="Terms of Service" onPress={() => router.push('/legal/terms' as never)} />
          <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push('/legal/privacy' as never)} />
        </Section>

        <Section title="Session">
          <Row icon="log-out-outline" label="Sign out" onPress={() => logout()} />
        </Section>
      </ScrollView>

      <CustomizeThemeSheet visible={showCustomize} onClose={() => setShowCustomize(false)} />
    </View>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textMuted} />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  back: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 6,
    padding: 14,
    backgroundColor: '#131313',
    borderColor: '#1f1f1f',
    borderWidth: 1,
    borderRadius: 12,
  },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt },
  profileAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  profileMeta: { flex: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  profileHandle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 8,
  },
  list: {
    backgroundColor: '#131313',
    borderColor: '#1f1f1f',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderBottomColor: '#1f1f1f',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15 },
  rowLabelDestructive: { color: colors.danger },
});
