/**
 * SearchBar Component - Reusable search input with debouncing
 */
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';

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
    <View style={styles.container}>
      {leftIcon && <Search size={20} color="#94a3b8" style={styles.icon} />}
      <TextInput
        style={[styles.input, leftIcon && styles.inputWithIcon]}
        placeholder={placeholder}
        value={internalValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        placeholderTextColor="#94a3b8"
      />
      {showClear && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={20} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
  },
  icon: {
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
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