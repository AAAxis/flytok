import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { deleteAccount } from '@/lib/firestore';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { colors } from '@/lib/theme';

export function SettingsSheet({
  visible,
  onClose,
  onEditProfile,
}: {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}) {
  const { logout } = useAuth();
  const router = useRouter();

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
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        try {
                          await logout();
                        } catch {
                          // best-effort
                        }
                      },
                    },
                  ],
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
    <AppBottomSheet visible={visible} onClose={onClose} enableDynamicSizing title="Settings">
      <BottomSheetView style={styles.content}>
        <Section>
          <Row icon="person-circle-outline" label="Edit profile" onPress={onEditProfile} />
        </Section>

        <Section title="Legal">
          <Row
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {
              onClose();
              router.push('/legal/terms' as never);
            }}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => {
              onClose();
              router.push('/legal/privacy' as never);
            }}
          />
        </Section>

        <Section title="Account">
          <Row
            icon="log-out-outline"
            label="Sign out"
            onPress={() => {
              onClose();
              logout();
            }}
          />
          <Row
            icon="trash-outline"
            label="Delete account"
            onPress={confirmDelete}
            destructive
          />
        </Section>
      </BottomSheetView>
    </AppBottomSheet>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? colors.danger : colors.textMuted}
      />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  section: { paddingHorizontal: 12, marginTop: 8 },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 6,
  },
  list: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowLabel: { flex: 1, color: colors.text, fontSize: 14 },
  rowLabelDestructive: { color: colors.danger },
});
