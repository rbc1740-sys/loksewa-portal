/** IconButton — circular touch target for header/row actions. */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radius, themes } from '../../constants/theme';

interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Minimum 44px target (rule 58). */
  size?: number;
  variant?: 'plain' | 'surface';
  accessibilityLabel: string;
  disabled?: boolean;
}

export function IconButton({
  children,
  onPress,
  size = 44,
  variant = 'plain',
  accessibilityLabel,
  disabled = false,
}: IconButtonProps) {
  const t = themes.light;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        variant === 'surface' && {
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: radius.md,
        },
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.35 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
