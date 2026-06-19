import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUnreadBadge } from '@/lib/messaging';

/**
 * Shared top bar rendered once by the tabs layout, so the black brand bar
 * (notifications · Roamerz · menu) is identical across every tab.
 *
 * On detail screens nested inside the tabs (e.g. the post viewer), the left
 * notifications button is swapped for a Back button.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const unread = useUnreadBadge();

  // Detail routes pushed inside the tabs group (post viewer, etc.) show Back
  // instead of the notifications bell.
  const isDetail = (segments as string[]).includes('posts');

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      {isDetail ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.icon}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/inbox' as never)}
          hitSlop={10}
          style={styles.icon}
          accessibilityLabel="Notifications and messages"
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      )}

      <View style={styles.brand}>
        <Image
          source={require('@/assets/images/logo-bird.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.name}>Roamerz</Text>
      </View>

      <Pressable
        onPress={() => router.push('/settings' as never)}
        hitSlop={10}
        style={styles.icon}
        accessibilityLabel="Settings"
      >
        <Ionicons name="menu" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#000',
  },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 26, height: 26 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderColor: '#000',
    borderWidth: 2,
  },
});
