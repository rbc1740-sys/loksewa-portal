/**
 * ScreenHeader — shared header for stack-pushed detail screens inside (app).
 * Deterministic back behavior via router.back() (rule 60); theme tokens only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { radius, spacing, themes, typography } from '../../constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const router = useRouter();
  const t = themes.light;

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
      <View style={styles.row}>
        <View
          style={[styles.backButton, { backgroundColor: t.surfaceMuted }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onTouchEnd={() => {
            if (router.canDismiss()) router.back();
          }}
        >
          <ChevronLeft size={22} color={t.textPrimary} />
        </View>
        <View style={styles.titles}>
          <Text numberOfLines={1} style={[styles.title, { color: t.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: t.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const t = themes.light;

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.screenX,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.sectionTitle,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  right: {
    marginLeft: spacing.xs,
  },
});
