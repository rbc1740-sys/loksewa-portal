/**
 * EmptyState & ErrorState & LoadingState Components - Standardized states
 */
import React, { ReactElement } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BookOpen, RefreshCw, AlertCircle, WifiOff, Database } from 'lucide-react-native';

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
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        {React.isValidElement(IconComponent)
          ? IconComponent
          : <IconComponent size={48} color="#94a3b8" />}
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <TouchableOpacity style={styles.primaryAction} onPress={onAction}>
              <Text style={styles.primaryActionText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <TouchableOpacity style={styles.secondaryAction} onPress={onSecondaryAction}>
              <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
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
      <View style={styles.iconContainer}>
        <IconComponent size={48} color="#ef4444" />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <RefreshCw size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.retryButtonText}>{retryLabel}</Text>
        </TouchableOpacity>
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
  if (variant === 'spinner') {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (variant === 'cards') {
    return (
      <View style={[styles.container, style, { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }]}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.skeletonCard}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, { width: '60%' }]} />
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
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, { width: '40%' }]} />
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
    paddingHorizontal: 24,
    gap: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryAction: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryAction: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  skeletonCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  skeletonContent: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
});