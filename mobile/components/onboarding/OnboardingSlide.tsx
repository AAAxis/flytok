import { ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

/**
 * One page inside the onboarding pager. The `hero` slot accepts an arbitrary
 * ReactNode so each slide ships its own placeholder illustration — final art
 * will swap in by replacing what each slide passes here. Width is locked to
 * the window so the parent's horizontal `pagingEnabled` FlatList can snap
 * cleanly at the page boundary.
 */
export function OnboardingSlide({
  hero,
  title,
  subtitle,
}: {
  hero: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.page}>
      <View style={styles.heroWrap}>{hero}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: WINDOW_WIDTH,
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  heroWrap: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: 12, alignItems: 'center' },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
