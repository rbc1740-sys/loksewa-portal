/**
 * ExplanationCard — structured post-answer learning block (rule 11).
 * Result banner (icon + color + text, never color alone) → correct answer
 * callout → explanation body → optional extended sections. Reused by the
 * central question engine across practice / review / mistakes / smart review.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, XCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react-native';
import { radius, spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { AppCard } from './AppCard';

export type ExplanationResult = 'correct' | 'incorrect' | 'skipped';

export interface ExplanationSection {
  title: string;
  body: string;
}

interface ExplanationCardProps {
  result: ExplanationResult;
  correctAnswerLabel?: string;
  explanation?: string;
  sections?: ExplanationSection[];
  /** Collapse the extended sections by default to control density. */
  collapsible?: boolean;
}

export function ExplanationCard({
  result,
  correctAnswerLabel,
  explanation,
  sections = [],
  collapsible = true,
}: ExplanationCardProps) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(!collapsible);

  const bannerBg =
    result === 'correct' ? t.optionCorrectBg :
    result === 'incorrect' ? t.optionWrongBg :
    t.surfaceMuted;
  const bannerColor =
    result === 'correct' ? t.success :
    result === 'incorrect' ? t.error :
    t.textSecondary;
  const ResultIcon =
    result === 'correct' ? CheckCircle2 :
    result === 'incorrect' ? XCircle :
    Lightbulb;
  const bannerText =
    result === 'correct' ? 'Correct' :
    result === 'incorrect' ? 'Incorrect' :
    'Not answered';

  const hasExtended = sections.length > 0;

  return (
    <AppCard style={styles.card}>
      <View style={[styles.banner, { backgroundColor: bannerBg }]}>
        <ResultIcon size={20} color={bannerColor} />
        <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerText}</Text>
        {correctAnswerLabel ? (
          <Text style={[styles.correctAnswer, { color: bannerColor }]} numberOfLines={1}>
            {correctAnswerLabel}
          </Text>
        ) : null}
      </View>

      {explanation ? (
        <View style={styles.explanation}>
          <View style={styles.explanationHeader}>
            <Lightbulb size={16} color={t.warning} />
            <Text style={[styles.explanationTitle, { color: t.textPrimary }]}>Explanation</Text>
          </View>
          <Text style={[styles.explanationBody, { color: t.textSecondary }]}>{explanation}</Text>
        </View>
      ) : null}

      {hasExtended ? (
        <View>
          {collapsible ? (
            <>
              <PressableRow
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                label={expanded ? 'Show less' : 'Learn more'}
              />
              {expanded ? <SectionList sections={sections} /> : null}
            </>
          ) : (
            <SectionList sections={sections} />
          )}
        </View>
      ) : null}
    </AppCard>
  );
}

function PressableRow({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      hitSlop={8}
      style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.toggleLabel, { color: t.secondary }]}>{label}</Text>
      {expanded ? (
        <ChevronUp size={16} color={t.secondary} />
      ) : (
        <ChevronDown size={16} color={t.secondary} />
      )}
    </Pressable>
  );
}

function SectionList({ sections }: { sections: ExplanationSection[] }) {
  const t = useTheme();
  return (
    <View style={styles.sections}>
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{s.title}</Text>
          <Text style={[styles.sectionBody, { color: t.textSecondary }]}>{s.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  bannerText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  correctAnswer: {
    ...typography.caption,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  explanation: {
    marginTop: spacing.sm,
    gap: spacing.xxs,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  explanationTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  explanationBody: {
    ...typography.bodySmall,
    lineHeight: 21,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    marginTop: spacing.xxs,
  },
  toggleLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  sections: {
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionBody: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
});
