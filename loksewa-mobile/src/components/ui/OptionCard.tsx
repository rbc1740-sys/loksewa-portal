/**
 * OptionCard Component - For displaying MCQ options in various modes
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';

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
  const getStyles = () => {
    const base = [styles.option, style];
    switch (state) {
      case 'selected':
        return [...base, styles.selected];
      case 'correct':
        return [...base, styles.correct];
      case 'wrong':
        return [...base, styles.wrong];
      case 'disabled':
        return [...base, styles.disabled];
      default:
        return base;
    }
  };

  const getTextStyles = () => {
    const base = [styles.text];
    switch (state) {
      case 'selected':
        return [...base, styles.selectedText];
      case 'correct':
        return [...base, styles.correctText];
      case 'wrong':
        return [...base, styles.wrongText];
      case 'disabled':
        return [...base, styles.disabledText];
      default:
        return base;
    }
  };

  const getLetterStyles = () => {
    const base = [styles.letter];
    switch (state) {
      case 'selected':
        return [...base, styles.selectedLetter];
      case 'correct':
        return [...base, styles.correctLetter];
      case 'wrong':
        return [...base, styles.wrongLetter];
      default:
        return base;
    }
  };

  const renderIcon = () => {
    if (state === 'correct') return <Check size={20} color="#10b981" />;
    if (state === 'wrong') return <X size={20} color="#ef4444" />;
    return null;
  };

  return (
    <TouchableOpacity
      key={optionKey}
      style={getStyles()}
      onPress={onPress}
      disabled={disabled || state === 'correct' || state === 'wrong'}
      activeOpacity={0.8}
    >
      {showLetter && letter && (
        <View style={getLetterStyles()}>
          <Text style={styles.letterText}>{letter.toUpperCase()}</Text>
        </View>
      )}
      <Text style={getTextStyles()}>{text}</Text>
      {renderIcon()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    minHeight: 56,
  },
  selected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  correct: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  wrong: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  disabled: {
    opacity: 0.6,
  },
  letter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  selectedLetter: {
    backgroundColor: '#6366f1',
  },
  correctLetter: {
    backgroundColor: '#10b981',
  },
  wrongLetter: {
    backgroundColor: '#ef4444',
  },
  letterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
  },
  selectedText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  correctText: {
    color: '#059669',
    fontWeight: '600',
  },
  wrongText: {
    color: '#dc2626',
  },
  disabledText: {
    color: '#94a3b8',
  },
});