/**
 * Question Runner — the ONE focused question experience (master-prompt rule 8).
 *
 * Consumed by Practice, Daily Challenge, Mistakes, Bookmarks, Smart Review and
 * Custom Exams via the central session store. One question at a time; the
 * active question gets the majority of the visual focus.
 *
 * STATE STABILITY (rule 9): selecting an option only writes to the session
 * store's `answers` map — the question array identity never changes, scroll
 * position is preserved, nothing auto-advances.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Flag, Bookmark, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, radius } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import { useSessionStore } from '../../src/engine/questionSession';
import { XP_PER_WRONG, correctRewardForTry } from '../../src/utils/gamification';
import { OptionCard, OptionState } from '../../src/components/ui/OptionCard';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { AppButton } from '../../src/components/ui/AppButton';
import { ExplanationCard } from '../../src/components/ui/ExplanationCard';
import { IconButton } from '../../src/components/ui/IconButton';
import { EmptyState } from '../../src/components/ui/StateViews';

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

interface ParsedOptions {
  entries: { key: string; text: string }[];
  map: Record<string, string>;
}

export function QuestionRunner() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const questions = useSessionStore((s) => s.questions);
  const answers = useSessionStore((s) => s.answers);
  const wrongAttempts = useSessionStore((s) => s.wrongAttempts);
  const bookmarkIds = useSessionStore((s) => s.bookmarkIds);
  const index = useSessionStore((s) => s.index);
  const mode = useSessionStore((s) => s.mode);
  const title = useSessionStore((s) => s.title);
  const loading = useSessionStore((s) => s.loading);
  const error = useSessionStore((s) => s.error);
  const selectAnswer = useSessionStore((s) => s.selectAnswer);
  const commitAnswer = useSessionStore((s) => s.commitAnswer);
  const recordWrongAttempt = useSessionStore((s) => s.recordWrongAttempt);
  const toggleBookmark = useSessionStore((s) => s.toggleBookmark);
  const next = useSessionStore((s) => s.next);
  const prev = useSessionStore((s) => s.prev);
  const reset = useSessionStore((s) => s.reset);
  const current = questions[index];
  const total = questions.length;
  const parsed = useMemo(
    () => (current ? parseOptions(current.options_json) : { entries: [], map: {} }),
    [current]
  );
  const selectedChoice = current ? answers[current.id] : undefined;
  const wrongPicks = current ? wrongAttempts[current.id] || [] : [];
  const hasWrongPicks = wrongPicks.length > 0;
  const answeredCorrect =
    !!selectedChoice && selectedChoice.toLowerCase() === (current?.answer || '').toLowerCase();
  const isBookmarked = current ? bookmarkIds.has(current.id) : false;
  // Feedback (green/red + explanation) shows only after the question is solved; while
  // guessing, only eliminated (red) wrong options are marked. Exams stay open.
  const showFeedback = mode !== 'test' && answeredCorrect;
  const isCorrect = answeredCorrect;
  const handleSelect = useCallback(
    (key: string) => {
      if (!current) return;
      const qAns = (current.answer || '').toLowerCase();
      const k = (key || '').toLowerCase();
      if (mode === 'test') {
        selectAnswer(current.id, k);
        return;
      }
      if (answeredCorrect || wrongPicks.includes(k)) return;
      const tryNumber = wrongPicks.length + 1; // 1st/2nd/3rd/4th+ try
      if (k === qAns) {
        selectAnswer(current.id, k);
        commitAnswer(current.id, { xpGainedOverride: correctRewardForTry(tryNumber) });
      } else {
        recordWrongAttempt(current.id, k);
        commitAnswer(current.id, { choice: k, xpGainedOverride: -XP_PER_WRONG });
      }
    },
    [current, mode, answeredCorrect, wrongPicks, selectAnswer, commitAnswer, recordWrongAttempt]
  );
  const handleNext = useCallback(() => {
    if (index < total - 1) next();
    else router.replace('/practice-result' as never);
  }, [index, total, next, router]);
  const handleBack = useCallback(() => {
    reset();
    if (router.canDismiss()) router.back();
    else router.replace('/(app)');
  }, [reset, router]);
  const progress = total > 0 ? (index + 1) / total : 0;
  function optionState(key: string): OptionState {
    const k = (key || '').toLowerCase();
    if (showFeedback) {
      if (k === (current?.answer || '').toLowerCase()) return 'correct';
      if (wrongPicks.includes(k)) return 'wrong';
      return 'disabled';
    }
    if (wrongPicks.includes(k)) return 'wrong';
    if (selectedChoice === k) return 'selected';
    return 'idle';
  }
  const correctLabel = current && parsed.map[current.answer]
    ? `${current.answer.toUpperCase()}: ${parsed.map[current.answer]}`
    : '';
  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton onPress={handleBack} accessibilityLabel="Go back">
          <ChevronLeft size={22} color={t.textPrimary} />
        </IconButton>
        <Text style={[styles.progressLabel, { color: t.textSecondary }]}>
          {index + 1} / {total}
        </Text>
        <View style={styles.topbarSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <ProgressBar progress={progress} height={6} accessibilityLabel={`Question ${index + 1} of ${total}`} />
        <Text style={[styles.breadcrumb, { color: t.textTertiary }]} numberOfLines={1}>
          {title}{current?.topic ? ` · ${current.topic}` : ''}
        </Text>
        <Text style={[styles.questionNumber, { color: t.secondary }]}>Question {index + 1}</Text>
        <Text style={[styles.questionText, { color: t.textPrimary }]}>{current?.question}</Text>
        <View style={styles.options}>
          {parsed.entries.map((entry) => (
            <OptionCard key={entry.key} letter={entry.key} text={entry.text} state={optionState(entry.key)} onPress={() => handleSelect(entry.key)} />
          ))}
        </View>
        {hasWrongPicks && !answeredCorrect && mode !== 'test' ? (
          <View style={[styles.hintBox, { backgroundColor: t.surface, borderColor: t.warning }]}>
            <Text style={[styles.hintText, { color: t.warning }]}>
              ✗ {wrongPicks.length} wrong {wrongPicks.length === 1 ? 'attempt' : 'attempts'} (−2 XP each) — red options are eliminated, keep trying!
            </Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => current && toggleBookmark(current.id)}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
            hitSlop={8}
            style={({ pressed }) => [styles.actionButton, { backgroundColor: t.surface, borderColor: t.border }, pressed && { opacity: 0.6 }]}
          >
            <Bookmark size={20} color={isBookmarked ? t.warning : t.textSecondary} fill={isBookmarked ? t.warning : 'none'} />
            <Text style={[styles.actionLabel, { color: t.textSecondary }]}>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report this question"
            hitSlop={8}
            style={({ pressed }) => [styles.actionButton, { backgroundColor: t.surface, borderColor: t.border }, pressed && { opacity: 0.6 }]}
          >
            <Flag size={20} color={t.textSecondary} />
            <Text style={[styles.actionLabel, { color: t.textSecondary }]}>Report</Text>
          </Pressable>
        </View>
        {showFeedback ? (
          <View style={styles.explanation}>
            <ExplanationCard result={isCorrect ? 'correct' : 'incorrect'} correctAnswerLabel={correctLabel} explanation={current?.explanation} />
          </View>
        ) : null}
      </ScrollView>
            <View style={[styles.footer, { backgroundColor: t.surface, borderTopColor: t.border, paddingBottom: insets.bottom + spacing.sm }]}>
        <AppButton label="Previous" variant="secondary" onPress={prev} disabled={index === 0} fullWidth />
        <AppButton label={index < total - 1 ? 'Next' : 'Finish'} onPress={handleNext} fullWidth />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers

/** Parses the `options_json` text column into ordered entries + a lookup map. */
function parseOptions(raw: string | undefined | null): ParsedOptions {
  if (!raw) return { entries: [], map: {} };
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], map: {} };
  }
  const entries = Object.keys(parsed)
    .sort((a, b) => OPTION_KEYS.indexOf(a) - OPTION_KEYS.indexOf(b))
    .filter((key) => typeof parsed[key] === 'string' && parsed[key].trim().length > 0)
    .map((key) => ({ key, text: parsed[key] }));
  return { entries, map: parsed };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    gap: spacing.sm,
  },
  topbarSpacer: {
    flex: 1,
  },
  progressLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing.screenX,
  },
  breadcrumb: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  questionNumber: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  questionText: {
    ...typography.body,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  hintText: {
    ...typography.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: spacing.controlHeight,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  explanation: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default QuestionRunner;
