/** SectionHeader — consistent section titles with optional action (rule 45). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, themes } from '../../constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          hitSlop={12}
          onPress={onActionPress}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const t = themes.light;

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
    color: t.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: t.textSecondary,
    marginTop: 2,
  },
  action: {
    ...typography.bodySmall,
    color: t.secondary,
    fontWeight: '600',
  },
});

