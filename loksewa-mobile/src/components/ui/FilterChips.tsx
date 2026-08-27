/**
 * FilterChips Component - Horizontal scrollable filter chips
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useMemo } from 'react';

export interface FilterChip {
  key: string;
  label: string;
  icon?: string;
  count?: number;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  allowMultiple?: boolean;
  selectedKeys?: string[];
  onSelectMultiple?: (keys: string[]) => void;
  showReset?: boolean;
  resetLabel?: string;
  onReset?: () => void;
}

export function FilterChips({
  chips,
  selectedKey,
  onSelect,
  allowMultiple = false,
  selectedKeys = [],
  onSelectMultiple,
  showReset = false,
  resetLabel = 'Reset',
  onReset,
}: FilterChipsProps) {
  const isSelected = useMemo(() => {
    if (allowMultiple) {
      return (key: string) => selectedKeys.includes(key);
    }
    return (key: string) => selectedKey === key;
  }, [selectedKey, selectedKeys, allowMultiple]);

  const handlePress = (chip: FilterChip) => {
    if (allowMultiple && onSelectMultiple) {
      const newKeys = selectedKeys.includes(chip.key)
        ? selectedKeys.filter(k => k !== chip.key)
        : [...selectedKeys, chip.key];
      onSelectMultiple(newKeys);
    } else {
      onSelect(chip.key);
    }
  };

  const renderChip = (chip: FilterChip, index: number) => {
    const selected = isSelected(chip.key);
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.chip,
          selected && styles.chipActive,
          chip.count !== undefined && styles.chipWithCount,
        ]}
        onPress={() => handlePress(chip)}
      >
        <View style={styles.chipContent}>
          {chip.icon && <Text style={styles.chipIcon}>{chip.icon}</Text>}
          <Text style={[styles.chipText, selected && styles.chipTextActive]}>{chip.label}</Text>
          {chip.count !== undefined && (
            <View style={[styles.chipCount, selected && styles.chipCountActive]}>
              <Text style={[styles.chipCountText, selected && styles.chipCountTextActive]}>
                {chip.count}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {chips.map(renderChip)}
        {showReset && (selectedKey || selectedKeys.length > 0) && (
          <TouchableOpacity style={[styles.chip, styles.chipReset]} onPress={onReset}>
            <Text style={styles.chipResetText}>✕ {resetLabel}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipWithCount: {
    paddingRight: 12,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipCount: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  chipCountTextActive: {
    color: '#fff',
  },
  chipReset: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  chipResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
});