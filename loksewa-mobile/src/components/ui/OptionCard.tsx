/**
 * OptionCard Component - For displaying MCQ options in various modes
 *
 * Fully theme-driven (rule 28): every state reads its colors from the design
 * tokens, so light/dark both render deliberately. State is communicated by
 * icon AND color (rule 10), never color alone.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { radius, spacing, touchTarget, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../constants/theme';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled';

interface OptionCardProps {
  key: string;
  text: string;
  state: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  showLetter?: boolean;
  letter?: string;
  style?: object;
}

interface OptionTheme {
  bg: string;
  border: string;
  borderWidth: number;
  text: string;
  textWeight: '400' | '600';
  letterBg: string;
  letterText: string;
  icon: 'none' | 'check' | 'cross';
}

function optionTheme(t: ThemeColors, state: OptionState): OptionTheme {
  switch (state) {
    case 'selected':
      return {
        bg: t.optionSelectedBg,
        border: t.optionSelectedBorder,
        borderWidth: 2,
        text: t.secondary,
        textWeight: '600',
        letterBg: t.secondary,
        letterText: t.textOnPrimary,
        icon: 'none',
      };
    case 'correct':
      return {
        bg: t.optionCorrectBg,
        border: t.optionCorrectBorder,
        borderWidth: 2,
        text: t.success,
        textWeight: '600',
        letterBg: t.success,
        letterText: '#FFFFFF',
        icon: 'check',
      };
    case 'wrong':
      return {
        bg: t.optionWrongBg,
        border: t.optionWrongBorder,
        borderWidth: 2,
        text: t.error,
        textWeight: '600',
        letterBg: t.error,
        letterText: '#FFFFFF',
        icon: 'cross',
      };
    case 'disabled':
      return {
        bg: t.optionIdleBg,
        border: t.optionIdleBorder,
        borderWidth: 1,
        text: t.textTertiary,
        textWeight: '400',
        letterBg: t.surfaceMuted,
        letterText: t.textTertiary,
        icon: 'none',
      };
    default:
      return {
        bg: t.optionIdleBg,
        border: t.optionIdleBorder,
        borderWidth: 1,
        text: t.textPrimary,
        textWeight: '400',
        letterBg: t.surfaceMuted,
        letterText: t.textSecondary,
        icon: 'none',
      };
  }
}

export function OptionCard({
  key: optionKey,
  text,
  state,
  onPress,
  disabled = false,
  showLetter = true,
  letter,
  style,
}: OptionCardProps) {
  const t = useTheme();
  const theme = optionTheme(t, state);
  const isBlocked = disabled || state === 'correct' || state === 'wrong';

  return (
    <TouchableOpacity
      key={optionKey}
      style={[
        styles.option,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          borderWidth: theme.borderWidth,
          opacity: state === 'disabled' ? 0.6 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isBlocked}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: state === 'selected', disabled: isBlocked }}
      accessibilityLabel={`Option ${letter ? letter.toUpperCase() : ''}: ${text}`}
    >
      {showLetter && letter && (
        <View style={[styles.letter, { backgroundColor: theme.letterBg }]}>
          <Text style={[styles.letterText, { color: theme.letterText }]}>
            {letter.toUpperCase()}
          </Text>
        </View>
      )}
      <Text
        style={[
          styles.text,
          { color: theme.text, fontWeight: theme.textWeight },
        ]}
      >
        {text}
      </Text>
      {theme.icon === 'check' && <Check size={20} color={t.success} />}
      {theme.icon === 'cross' && <X size={20} color={t.error} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    minHeight: touchTarget,
  },
  letter: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  letterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    ...typography.body,
  },
});
