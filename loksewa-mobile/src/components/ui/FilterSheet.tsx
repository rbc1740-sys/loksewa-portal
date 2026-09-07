/**
 * FilterSheet — standard filter bottom sheet (Phase 8). Sections of single-
 * or multi-select chips; "Clear all" appears only when filters are active.
 * Controlled: the sheet never owns filter state, so reopening always shows
 * the applied filters exactly.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { FilterChips, type FilterChip } from './FilterChips';
import { AppButton } from './AppButton';

export interface FilterSection {
  key: string;
  title: string;
  chips: FilterChip[];
  /** single (default) or multi select */
  mode?: 'single' | 'multi';
  selectedKey?: string | null;
  selectedKeys?: string[];
  onSelect?: (key: string) => void;
  onSelectMultiple?: (keys: string[]) => void;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  sections: FilterSection[];
  /** Number of active filters — drives the Apply button label. */
  activeCount?: number;
  onClearAll?: () => void;
}

export function FilterSheet({
  visible,
  onClose,
  title = 'Filters',
  sections,
  activeCount = 0,
  onClearAll,
}: FilterSheetProps) {
  const t = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.footerRow}>
          {onClearAll && activeCount > 0 ? (
            <AppButton label="Clear all" variant="ghost" size="sm" onPress={onClearAll} />
          ) : null}
          <View style={styles.footerSpacer} />
          <AppButton
            label={activeCount > 0 ? `Apply (${activeCount})` : 'Apply'}
            size="sm"
            onPress={onClose}
          />
        </View>
      }
    >
      {sections.length === 0 ? (
        <Text style={[styles.empty, { color: t.textTertiary }]}>No filters available</Text>
      ) : (
        sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{section.title}</Text>
            <FilterChips
              chips={section.chips}
              selectedKey={section.selectedKey ?? null}
              onSelect={section.onSelect ?? (() => {})}
              allowMultiple={section.mode === 'multi'}
              selectedKeys={section.selectedKeys ?? []}
              onSelectMultiple={section.onSelectMultiple}
            />
          </View>
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
  empty: {
    ...typography.bodySmall,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  footerSpacer: { flex: 1 },
});
