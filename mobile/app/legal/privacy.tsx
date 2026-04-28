import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function Privacy() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Privacy Policy',
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h2}>What we collect</Text>
          <Text style={styles.p}>
            • Account data: email address, sign-in provider (Apple, Google, or password), and
            display info you provide.{'\n'}
            • Content: videos, captions, comments, and chat messages you create.{'\n'}
            • Device data: when you allow it, your approximate location for the Map feature.{'\n'}
            • Diagnostics: crash reports to keep the app stable.
          </Text>

          <Text style={styles.h2}>How we use it</Text>
          <Text style={styles.p}>
            We use this data to operate Roamrez — to show you a feed, deliver chats, fix bugs, and
            keep the service safe. We do not sell your personal data.
          </Text>

          <Text style={styles.h2}>Sharing</Text>
          <Text style={styles.p}>
            Content you post is visible to other Roamrez users. We use Firebase (Google Cloud) for
            authentication, storage, database, and crash reporting; data is processed under
            Google's terms.
          </Text>

          <Text style={styles.h2}>Your choices</Text>
          <Text style={styles.p}>
            You can block users, report content, and delete your account from your profile.
            Deleting your account removes your authentication record and clears your profile
            details. Content you've shared may persist in others' chats.
          </Text>

          <Text style={styles.h2}>Children</Text>
          <Text style={styles.p}>
            Roamrez is not directed to children under 13. We do not knowingly collect data from
            children under 13.
          </Text>

          <Text style={styles.h2}>Contact</Text>
          <Text style={styles.p}>
            Questions? Email support@flytok.app.
          </Text>

          <Text style={styles.updated}>Last updated April 2026.</Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 12 },
  p: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  updated: { color: colors.textFaint, fontSize: 12, marginTop: 24 },
});
