/**
 * AppCard — the standard card surface used across all screens (rule 45).
 * Uses Pressable only when interactive, so static cards never flash.
 */
import React from 'react';
import { Pressable, PressableProps, StyleSheet, StyleProp, View, ViewStyle } from 'react-native';
import { elevation, radius, spacing, themes } from '../../constants/theme';

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
  const base: ViewStyle = {
    backgroundColor: themes.light.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themes.light.border,
    paddingHorizontal: padded ? spacing.md : 0,
    paddingVertical: padded ? spacing.md : 0,
    ...(elevated ? elevation.card : null),
  };

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}
        onPress={onPress}
        android_ripple={{ color: themes.light.surfaceMuted }}
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
