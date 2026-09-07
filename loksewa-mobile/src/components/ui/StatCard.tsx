/** StatCard — compact value+label tile used on Home/Analytics/Results. */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
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
  const t = useTheme();
  const valueColor =
    tone === 'success' ? t.success :
    tone === 'warning' ? t.warning :
    tone === 'error' ? t.error :
    t.textPrimary;

  return (
    <AppCard padded={false} elevated={false} style={[styles.card, { backgroundColor: t.surfaceAlt }, style]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: t.textSecondary }]} numberOfLines={2}>
        {label}
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 0,
  },
  iconWrap: { marginBottom: spacing.xxs },
  value: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  label: {
    ...typography.micro,
    textAlign: 'center',
    marginTop: 2,
  },
});
