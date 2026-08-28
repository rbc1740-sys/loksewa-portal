/**
 * AppCard — the standard card surface used across all screens (rule 45).
 * Uses Pressable only when interactive, so static cards never flash.
 */
import React from 'react';
import { Pressable, PressableProps, StyleSheet, StyleProp, View, ViewStyle } from 'react-native';
import { elevation, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface AppCardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** vertical padding option; horizontal is always card-standard */
  padded?: boolean;
  elevated?: boolean;
  onPress?: () => void;
}

export function AppCard({
  children,
  style,
  padded = true,
  elevated = true,
  onPress,
  ...rest
}: AppCardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    paddingHorizontal: padded ? spacing.md : 0,
    paddingVertical: padded ? spacing.md : 0,
    ...(elevated ? elevation.card : null),
  };

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}
        onPress={onPress}
        android_ripple={{ color: t.surfaceMuted }}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
