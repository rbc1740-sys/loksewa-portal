/**
 * Toast Component - Non-blocking notifications
 */
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { useRef, useEffect, useState } from 'react';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../constants/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

function getToastColors(
  t: ThemeColors,
  type: ToastType
): { bg: string; text: string; icon: string } {
  switch (type) {
    case 'success':
      return { bg: t.successSoft, text: t.success, icon: t.success };
    case 'error':
      return { bg: t.errorSoft, text: t.error, icon: t.error };
    case 'warning':
      return { bg: t.warningSoft, text: t.warning, icon: t.warning };
    default:
      return { bg: t.infoSoft, text: t.info, icon: t.info };
  }
}

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onClose?: () => void;
  duration?: number;
  position?: 'top' | 'bottom';
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle,
};

export function Toast({
  visible,
  message,
  type = 'info',
  onClose,
  duration = 4000,
  position = 'top',
}: ToastProps) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          hide();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      hide();
    }
  }, [visible, duration]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShow(false);
        onClose?.();
      }
    });
  };

  if (!show) return null;

  const colors = getToastColors(t, type);
  const IconComponent = ICONS[type];

  const animatedStyle = {
    transform: [{ translateY }],
    opacity,
  };

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        position === 'top' ? styles.positionTop : styles.positionBottom,
        { backgroundColor: colors.bg },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.content}>
        <View style={{ marginRight: 8 }}>
          <IconComponent size={20} color={colors.icon} />
        </View>
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={hide}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={18} color={colors.text} style={{ opacity: 0.6 }} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  positionTop: {
    top: 50,
  },
  positionBottom: {
    bottom: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
});

// Toast Manager Hook
interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const hideAll = () => {
    setToasts([]);
  };

  return { toasts, showToast, hideToast, hideAll };
}

export function ToastContainer({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const { toasts, hideToast } = useToast();

  return (
    <View style={toastContainerStyles.toastContainer} pointerEvents="box-none">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          visible={true}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          position={position}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </View>
  );
}

const toastContainerStyles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  },
});