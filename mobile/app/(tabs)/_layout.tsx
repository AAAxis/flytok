import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import { AppHeader } from '@/components/AppHeader';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <AppHeader />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.uploadButton}>
              <Ionicons name="add" size={28} color={colors.accent} />
            </View>
          ),
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/camera' as never)}
              style={props.style}
            >
              {props.children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Post viewer lives inside the tabs so the navbar stays visible; no tab button. */}
      <Tabs.Screen name="posts/[uid]" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  uploadButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
