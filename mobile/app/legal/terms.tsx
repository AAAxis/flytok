import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function Terms() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Terms of Service',
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h2}>Welcome to Roamerz</Text>
          <Text style={styles.p}>
            By creating a Roamerz account or using the app, you agree to these terms. If you don't
            agree, don't use Roamerz.
          </Text>

          <Text style={styles.h2}>Your account</Text>
          <Text style={styles.p}>
            You are responsible for activity on your account and for the content you upload. Don't
            share your password. You must be at least 13 years old to use Roamerz.
          </Text>

          <Text style={styles.h2}>Content rules</Text>
          <Text style={styles.p}>
            You may not upload content that is illegal, sexually explicit, hateful, harassing, or
            that infringes the rights of others. We may remove content and suspend accounts at our
            discretion.
          </Text>

          <Text style={styles.h2}>Reporting and moderation</Text>
          <Text style={styles.p}>
            Use the in-app Report button to flag objectionable content. We aim to review reports
            within 24 hours and act on them.
          </Text>

          <Text style={styles.h2}>Termination</Text>
          <Text style={styles.p}>
            You may delete your account at any time from your profile. We may suspend or terminate
            accounts that violate these terms.
          </Text>

          <Text style={styles.h2}>Audio you upload</Text>
          <Text style={styles.p}>
            Audio you upload is your responsibility. By uploading, you confirm you have the right
            to use it, including any necessary licenses, and that the audio doesn't infringe
            anyone else's copyright or other rights. We honor takedown requests sent to
            support@flytok.com — we'll review and remove infringing content as fast as we can.
          </Text>

          <Text style={styles.h2}>Disclaimer</Text>
          <Text style={styles.p}>
            Roamerz is provided "as is" without warranties. We are not liable for damages arising
            from your use of the service.
          </Text>

          <Text style={styles.updated}>Last updated May 2026.</Text>
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
