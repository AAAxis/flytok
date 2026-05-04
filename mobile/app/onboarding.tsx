import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';
import { setHasSeenOnboarding } from '@/lib/onboarding';
import { colors } from '@/lib/theme';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  hero: () => React.ReactNode;
};

// Placeholder hero illustrations. Roman commissions final art before store
// submission — see docs/10-wave-7-onboarding-share.md "Out of scope".
function DiscoverHero() {
  return (
    <View style={heroStyles.canvas}>
      <View style={[heroStyles.halo, heroStyles.haloLg]} />
      <View style={[heroStyles.halo, heroStyles.haloMd]} />
      <View style={[heroStyles.halo, heroStyles.haloSm]} />
      <View style={[heroStyles.satellite, heroStyles.satTopLeft]}>
        <Ionicons name="videocam" size={18} color={colors.text} />
      </View>
      <View style={[heroStyles.satellite, heroStyles.satTopRight]}>
        <Ionicons name="airplane" size={18} color={colors.text} />
      </View>
      <View style={[heroStyles.satellite, heroStyles.satBottomLeft]}>
        <Ionicons name="compass" size={18} color={colors.text} />
      </View>
      <View style={heroStyles.center}>
        <Ionicons name="location" size={56} color={colors.bg} />
      </View>
    </View>
  );
}

function ShareHero() {
  return (
    <View style={heroStyles.canvas}>
      <View style={[heroStyles.halo, heroStyles.haloLg]} />
      <View style={[heroStyles.halo, heroStyles.haloMd]} />
      <View style={[heroStyles.halo, heroStyles.haloSm]} />
      <View style={[heroStyles.satellite, heroStyles.satTopLeft]}>
        <Ionicons name="heart" size={18} color="#ff3b5c" />
      </View>
      <View style={[heroStyles.satellite, heroStyles.satTopRight]}>
        <Ionicons name="paper-plane" size={18} color={colors.text} />
      </View>
      <View style={[heroStyles.satellite, heroStyles.satBottomLeft]}>
        <Ionicons name="bookmark" size={18} color={colors.text} />
      </View>
      <View style={heroStyles.center}>
        <Ionicons name="chatbubbles" size={56} color={colors.bg} />
      </View>
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    key: 'discover',
    title: 'Discover places worth flying for',
    subtitle:
      'Browse short, punchy travel videos pinned to real-world places. Tap any video to see its location on the map.',
    hero: () => <DiscoverHero />,
  },
  {
    key: 'share',
    title: 'Share moments. Chat with creators.',
    subtitle:
      'Save the spots you love, message the people who shot the videos, and post your own clips when you’re on the road.',
    hero: () => <ShareHero />,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const goToLogin = useCallback(async () => {
    await setHasSeenOnboarding(true);
    router.replace('/login');
  }, [router]);

  const handleNext = useCallback(() => {
    if (index >= SLIDES.length - 1) {
      void goToLogin();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }, [index, goToLogin]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') setIndex(first.index);
  }).current;

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        renderItem={({ item }) => (
          <OnboardingSlide
            hero={item.hero()}
            title={item.title}
            subtitle={item.subtitle}
          />
        )}
        getItemLayout={(_, i) => ({
          length: WINDOW_WIDTH,
          offset: WINDOW_WIDTH * i,
          index: i,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={goToLogin}
          hitSlop={12}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        >
          <Text style={styles.primaryText}>{isLast ? 'Get started' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderAlt,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipBtnPressed: { opacity: 0.6 },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  primary: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  primaryPressed: { backgroundColor: colors.accentDim },
  primaryText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

const heroStyles = StyleSheet.create({
  canvas: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  haloLg: { width: '90%', height: '90%', opacity: 0.06 },
  haloMd: { width: '60%', height: '60%', opacity: 0.12 },
  haloSm: { width: '38%', height: '38%', opacity: 0.22 },
  center: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  satellite: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satTopLeft: { top: '14%', left: '12%' },
  satTopRight: { top: '20%', right: '8%' },
  satBottomLeft: { bottom: '18%', left: '20%' },
});
