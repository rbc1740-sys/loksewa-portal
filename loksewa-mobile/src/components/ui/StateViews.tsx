/**
 * EmptyState & ErrorState & LoadingState Components - Standardized states
 * Theme-driven (rule 28): light/dark both render with deliberate tokens.
 */
import React, { ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BookOpen, RefreshCw, AlertCircle, WifiOff, Database } from 'lucide-react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface EmptyStateProps {
  icon?: typeof BookOpen | ReactElement;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: object;
}

export function EmptyState({
  icon: IconComponent = BookOpen,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: t.surfaceMuted }]}>
        {React.isValidElement(IconComponent)
          ? IconComponent
          : <IconComponent size={48} color={t.textTertiary} />}
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: t.textTertiary }]}>{message}</Text>}
      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: t.secondary },
                pressed && { opacity: 0.85 },
              ]}
              onPress={onAction}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Text style={[styles.primaryActionText, { color: t.textOnPrimary }]}>{actionLabel}</Text>
            </Pressable>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: t.borderStrong, backgroundColor: t.surface },
                pressed && { opacity: 0.85 },
              ]}
              onPress={onSecondaryAction}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionLabel}
            >
              <Text style={[styles.secondaryActionText, { color: t.secondary }]}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'default' | 'network' | 'server';
  style?: object;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
  variant = 'default',
  style,
}: ErrorStateProps) {
  const t = useTheme();
  const getIcon = () => {
    switch (variant) {
      case 'network':
        return WifiOff;
      case 'server':
        return Database;
      default:
        return AlertCircle;
    }
  };

  const IconComponent = getIcon();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: t.surfaceMuted }]}>
        <IconComponent size={48} color={t.error} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: t.textTertiary }]}>{message}</Text>
      {onRetry && (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: t.secondary },
            pressed && { opacity: 0.85 },
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <RefreshCw size={18} color={t.textOnPrimary} style={{ marginRight: 8 }} />
          <Text style={[styles.retryButtonText, { color: t.textOnPrimary }]}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export type LoadingVariant = 'spinner' | 'cards' | 'rows';

export interface LoadingStateProps {
  variant?: LoadingVariant;
  count?: number;
  style?: object;
}

export function LoadingState({
  variant = 'spinner',
  count = 3,
  style,
}: LoadingStateProps) {
  const t = useTheme();
  if (variant === 'spinner') {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color={t.secondary} />
      </View>
    );
  }

  if (variant === 'cards') {
    return (
      <View style={[styles.container, style, { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }]}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.skeletonCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.skeletonLine, { backgroundColor: t.skeleton }]} />
            <View style={[styles.skeletonLine, { width: '60%', backgroundColor: t.skeleton }]} />
          </View>
        ))}
      </View>
    );
  }

  // rows variant
  return (
    <View style={[styles.container, style, { gap: 12 }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonAvatar, { backgroundColor: t.skeleton }]} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonLine, { backgroundColor: t.skeleton }]} />
            <View style={[styles.skeletonLine, { width: '40%', backgroundColor: t.skeleton }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.sectionTitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryAction: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  primaryActionText: {
    ...typography.body,
    fontWeight: '700',
  },
  secondaryAction: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
  },
  secondaryActionText: {
    ...typography.body,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  retryButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  skeletonCard: {
    width: 160,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  skeletonContent: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 14,
    borderRadius: radius.sm,
  },
});