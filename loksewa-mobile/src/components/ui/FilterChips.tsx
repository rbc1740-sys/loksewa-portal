/**
 * FilterChips Component - Horizontal scrollable filter chips
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

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
  const t = useTheme();
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
          { backgroundColor: t.surfaceMuted, borderColor: t.border },
          selected && { backgroundColor: t.secondary, borderColor: t.secondary },
          chip.count !== undefined && styles.chipWithCount,
        ]}
        onPress={() => handlePress(chip)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={chip.label}
      >
        <View style={styles.chipContent}>
          {chip.icon && <Text style={styles.chipIcon}>{chip.icon}</Text>}
          <Text
            style={[
              styles.chipText,
              { color: t.textSecondary },
              selected && { color: t.textOnPrimary },
            ]}
          >
            {chip.label}
          </Text>
          {chip.count !== undefined && (
            <View
              style={[
                styles.chipCount,
                { backgroundColor: t.border },
                selected && { backgroundColor: 'rgba(255,255,255,0.3)' },
              ]}
            >
              <Text
                style={[
                  styles.chipCountText,
                  { color: t.textSecondary },
                  selected && { color: t.textOnPrimary },
                ]}
              >
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
          <TouchableOpacity
            style={[styles.chip, styles.chipReset, { backgroundColor: t.errorSoft, borderColor: t.error }]}
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel={resetLabel}
          >
            <Text style={[styles.chipResetText, { color: t.error }]}>✕ {resetLabel}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipWithCount: {
    paddingRight: spacing.sm,
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
    ...typography.caption,
    fontWeight: '600',
  },
  chipCount: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipReset: {
    // colors applied inline from tokens
  },
  chipResetText: {
    ...typography.caption,
    fontWeight: '600',
  },
});