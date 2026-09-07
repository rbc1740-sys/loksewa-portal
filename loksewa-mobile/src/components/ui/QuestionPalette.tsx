/**
 * QuestionPalette — exam question navigation grid (Phase 6). States are
 * communicated by fill + outline + label (never color alone, rule 10).
 * Purely controlled: cells render from a state array, so navigating never
 * rebuilds or reshuffles the session.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export type PaletteCellState = 'unanswered' | 'answered' | 'marked' | 'current' | 'skipped';

export interface PaletteCell {
  /** 1-based question number. */
  number: number;
  state: PaletteCellState;
  marked?: boolean;
}

interface QuestionPaletteProps {
  cells: PaletteCell[];
  onSelect?: (index: number) => void;
  columns?: number;
  showLegend?: boolean;
}

export function QuestionPalette({
  cells,
  onSelect,
  columns = 5,
  showLegend = true,
}: QuestionPaletteProps) {
  const t = useTheme();

  const cellStyle = (state: PaletteCellState, marked: boolean) => {
    const bg =
      state === 'current' ? t.secondary :
      state === 'answered' ? t.optionCorrectBg :
      state === 'marked' ? t.optionWrongBg :
      state === 'skipped' ? t.surfaceMuted :
      t.surfaceAlt;
    const border =
      state === 'current' ? t.secondary :
      state === 'answered' ? t.success :
      state === 'marked' ? t.error :
      t.borderStrong;
    const fg =
      state === 'current' ? t.textOnPrimary :
      state === 'answered' ? t.success :
      state === 'marked' ? t.error :
      t.textSecondary;
    return { backgroundColor: bg, borderColor: border, borderWidth: state === 'unanswered' ? 1 : 2, cellFg: fg, marked };
  };

  return (
    <View>
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          const s = cellStyle(cell.state, !!cell.marked);
          return (
            <Pressable
              key={cell.number}
              onPress={() => onSelect?.(i)}
              accessibilityRole="button"
              accessibilityLabel={`Question ${cell.number}${
                cell.state === 'answered' ? ', answered' : cell.state === 'marked' ? ', marked for review' : ''
              }`}
              accessibilityState={{ selected: cell.state === 'current' }}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: s.backgroundColor,
                  borderColor: s.borderColor,
                  borderWidth: s.borderWidth,
                  width: `${100 / columns - 2}%` as `${number}%`,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {cell.marked ? (
                <Bookmark size={10} color={s.cellFg} fill={s.cellFg} style={styles.markIcon} />
              ) : null}
              <Text style={[styles.cellText, { color: s.cellFg }]}>{cell.number}</Text>
            </Pressable>
          );
        })}
      </View>
      {showLegend ? (
        <View style={styles.legend}>
          <LegendDot color={t.optionCorrectBg} border={t.success} label="Answered" />
          <LegendDot color={t.optionWrongBg} border={t.error} label="Marked" />
          <LegendDot color={t.surface} border={t.borderStrong} label="Unanswered" />
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({ color, border, label }: { color: string; border: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color, borderColor: border }]} />
      <Text style={[styles.legendText, { color: t.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  cell: {
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  markIcon: {
    position: 'absolute',
    top: 3,
    right: 3,
  },
  cellText: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  legendText: {
    ...typography.micro,
  },
});
