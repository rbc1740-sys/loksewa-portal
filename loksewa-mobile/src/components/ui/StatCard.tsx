/** StatCard — compact value+label tile used on Home/Analytics/Results. */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radius, spacing, themes, typography } from '../../constants/theme';
import { AppCard } from './AppCard';

type Tone = 'default' | 'success' | 'warning' | 'error';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  tone?: Tone;
  style?: ViewStyle;
}

export function StatCard({ value, label, icon, tone = 'default', style }: StatCardProps) {
  const t = themes.light;
  const valueColor =
    tone === 'success' ? t.success :
    tone === 'warning' ? t.warning :
    tone === 'error' ? t.error :
    t.textPrimary;

  return (
    <AppCard padded={false} elevated={false} style={[styles.card, style]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </AppCard>
  );
}

const t = themes.light;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: t.surfaceAlt,
    borderWidth: 0,
  },
  iconWrap: { marginBottom: spacing.xxs },
  value: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  label: {
    ...typography.micro,
    color: t.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});
