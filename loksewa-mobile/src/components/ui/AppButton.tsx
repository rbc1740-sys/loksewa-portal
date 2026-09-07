/**
 * AppButton — primary CTA with variants, loading and disabled states.
 * Standard height from tokens so touch targets stay accessible (rule 58).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
}: AppButtonProps) {
  const t = useTheme();
  const blocked = disabled || loading;

  const bg =
    variant === 'primary' ? t.primary :
    variant === 'secondary' ? t.primaryLight :
    variant === 'danger' ? t.errorSoft : 'transparent';
  const fg =
    variant === 'primary' ? t.textOnPrimary :
    variant === 'secondary' ? t.primaryDark :
    variant === 'danger' ? t.error : t.secondary;
  const border = variant === 'ghost' ? t.borderStrong : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : undefined,
        { backgroundColor: bg, borderColor: border },
        !fullWidth && styles.inline,
        pressed && !blocked && { opacity: 0.85 },
        blocked && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[
              styles.label,
              size === 'sm' ? styles.labelSm : undefined,
              { color: fg },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: spacing.controlHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  inline: { alignSelf: 'flex-start' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  labelSm: {
    ...typography.caption,
  },
});
