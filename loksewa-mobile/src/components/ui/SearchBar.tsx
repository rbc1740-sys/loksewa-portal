/**
 * SearchBar Component - Reusable search input with debouncing
 */
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  showClearButton?: boolean;
  leftIcon?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search...',
  debounceMs = 300,
  autoFocus = false,
  showClearButton = true,
  leftIcon = true,
}: SearchBarProps) {
  const t = useTheme();
  const [internalValue, setInternalValue] = useState(value);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [showClear, setShowClear] = useState(false);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(internalValue);
      onChangeText(internalValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, onChangeText]);

  useEffect(() => {
    setShowClear(showClearButton && internalValue.length > 0);
  }, [internalValue, showClearButton]);

  const handleChangeText = useCallback((text: string) => {
    setInternalValue(text);
  }, []);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChangeText('');
    if (onSubmit) onSubmit('');
  }, [onChangeText, onSubmit]);

  const handleSubmit = useCallback(() => {
    if (onSubmit) onSubmit(internalValue);
  }, [internalValue, onSubmit]);

  return (
    <View style={[styles.container, { backgroundColor: t.surfaceMuted, borderColor: t.border }]}>
      {leftIcon && <Search size={20} color={t.textTertiary} style={styles.icon} />}
      <TextInput
        style={[styles.input, leftIcon && styles.inputWithIcon, { color: t.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={t.textTertiary}
        value={internalValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityRole="search"
      />
      {showClear && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <X size={20} color={t.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: spacing.controlHeight,
    gap: spacing.xs,
  },
  icon: {
    marginLeft: 2,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  clearButton: {
    padding: 4,
    marginRight: 4,
  },
});