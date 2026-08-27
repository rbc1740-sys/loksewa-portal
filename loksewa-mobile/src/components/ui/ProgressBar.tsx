/** ProgressBar — animated determinate bar with no layout jump (rule 50). */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radius as radii, themes } from '../../constants/theme';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  accessibilityLabel?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  color = themes.light.secondary,
  trackColor = themes.light.surfaceMuted,
  accessibilityLabel,
}: ProgressBarProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamped,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${Math.round(clamped * 100)}% complete`}
    >
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: themes.light.surfaceMuted,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
