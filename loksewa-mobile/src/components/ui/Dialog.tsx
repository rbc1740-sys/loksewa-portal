/**
 * Dialog — centered confirmation/alert dialog with clear action hierarchy.
 * Used for destructive confirms (submit exam, sign out, delete). Theme-driven.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, elevation } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { AppButton } from './AppButton';

interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  onClose?: () => void;
}

export function Dialog({ visible, title, message, actions, onClose }: DialogProps) {
  const t = useTheme();

  return (
    <Modal transparent visible={visible} statusBarTranslucent onRequestClose={onClose} animationType="fade">
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss dialog" onPress={onClose} />
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: t.textSecondary }]}>{message}</Text>
          ) : null}
          <View style={styles.actions}>
            {actions.map((a) => (
              <AppButton
                key={a.label}
                label={a.label}
                variant={a.variant ?? 'primary'}
                size="sm"
                fullWidth={actions.length === 1}
                onPress={a.onPress}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...elevation.modal,
  },
  title: {
    ...typography.cardTitle,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  message: {
    ...typography.bodySmall,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
