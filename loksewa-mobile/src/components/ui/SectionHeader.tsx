/** SectionHeader — consistent section titles with optional action (rule 45). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onActionPress }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          hitSlop={12}
          onPress={onActionPress}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.action, { color: t.secondary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  textCol: { flexShrink: 1 },
  title: {
    ...typography.sectionTitle,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  action: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
});

