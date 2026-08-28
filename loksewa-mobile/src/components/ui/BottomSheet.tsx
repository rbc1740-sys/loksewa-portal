/**
 * BottomSheet — standard modal sheet for progressive disclosure (rule 26).
 * Backdrop fade + slide-up enter/exit, drag handle, safe-area aware, max 88%
 * height with internal scrolling. Theme-driven for light/dark parity (rule 28).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, elevation } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from './IconButton';
import { X } from 'lucide-react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional sticky footer (e.g. a primary CTA). */
  footer?: React.ReactNode;
  maxHeightRatio?: number;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightRatio = 0.88,
}: BottomSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, progress, backdrop]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={onClose} animationType="none">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={styles.flex} accessibilityLabel="Close sheet" onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.surface,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%` as `${number}%`,
              paddingBottom: insets.bottom + spacing.sm,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: t.borderStrong }]} />
          </View>
          {(title || subtitle) && (
            <View style={[styles.header, { borderBottomColor: t.border }]}>
              <View style={styles.headerText}>
                {title ? (
                  <Text numberOfLines={1} style={[styles.title, { color: t.textPrimary }]}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text numberOfLines={1} style={[styles.subtitle, { color: t.textSecondary }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton accessibilityLabel="Close" onPress={onClose} size={36}>
                <X size={20} color={t.textSecondary} />
              </IconButton>
            </View>
          )}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { borderTopColor: t.border, paddingBottom: Math.max(0, insets.bottom - spacing.xs) }]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...elevation.sheet,
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    ...typography.sectionTitle,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  body: { flexGrow: 0 },
  bodyContent: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
