/** ProgressBar — animated determinate bar with no layout jump (rule 50). */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radius as radii } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

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
  color,
  trackColor,
  accessibilityLabel,
}: ProgressBarProps) {
  const t = useTheme();
  const fillColor = color ?? t.secondary;
  const track = trackColor ?? t.surfaceMuted;
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
      style={[styles.track, { height, backgroundColor: track }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${Math.round(clamped * 100)}% complete`}
    >
      <Animated.View style={[styles.fill, { width, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
