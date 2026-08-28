/**
 * Skeleton — subtle looping pulse placeholders (rule 52).
 * Pre-composed cards match the shapes of real content so screens never
 * blank-flash before data arrives.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function Skeleton({
  width,
  height = 14,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: object;
}) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width ?? '100%', height, opacity: pulse, backgroundColor: t.skeleton },
        style,
      ]}
    />
  );
}

/** Matches an AppCard-shaped content block. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Skeleton width="45%" height={typography.cardTitle.fontSize} />
      <View style={styles.gapSm} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i}>
          <Skeleton width={`${90 - i * 15}%`} height={typography.bodySmall.fontSize} />
          <View style={styles.gapXs} />
        </View>
      ))}
      <View style={styles.gapSm} />
      <Skeleton width={120} height={spacing.controlHeight * 0.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gapXs: { height: spacing.xs },
  gapSm: { height: spacing.xs + 4 },
});
