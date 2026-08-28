/**
 * ScreenHeader — shared header for stack-pushed detail screens inside (app).
 * Deterministic back behavior via router.back() (rule 60); theme tokens only.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const router = useRouter();
  const t = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: t.surfaceMuted },
            pressed && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canDismiss()) router.back();
          }}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={t.textPrimary} />
        </Pressable>
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
