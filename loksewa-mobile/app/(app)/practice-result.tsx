/**
 * Practice Result — post-practice summary for engine sessions (rule 14).
 *
 * Reads the JUST-finished session from the central session store and computes
 * a real summary (correct / incorrect / skipped / accuracy / time). Learning
 * actions guide the user's next step. Exam attempts keep using the richer
 * result.tsx (stored exam_history); this covers the QuestionRunner flows.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, Target, XCircle, MinusCircle, Trophy } from 'lucide-react-native';
import { useSessionStore } from '../../src/engine/questionSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import { AppButton, EmptyState, ScreenHeader, StatCard } from '../../src/components/ui';

export default function PracticeResultScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const questions = useSessionStore((s) => s.questions);
  const answers = useSessionStore((s) => s.answers);
  const timeSpent = useSessionStore((s) => s.timeSpent);
  const mode = useSessionStore((s) => s.mode);
  const title = useSessionStore((s) => s.title);
  const subtitle = useSessionStore((s) => s.subtitle);
  const resetSession = useSessionStore((s) => s.reset);
  const start = useSessionStore((s) => s.start);

  // Stats from the frozen session — the same array the runner used (rules 9/31).
  const stats = useMemo(() => {
    let correct = 0, incorrect = 0, skipped = 0, totalTime = 0;
    for (const q of questions) {
      const sel = answers[q.id];
      if (!sel) skipped += 1;
      else if (sel === q.answer) correct += 1;
      else incorrect += 1;
      totalTime += timeSpent[q.id] ?? 0;
    }
    const attempted = correct + incorrect;
    return {
      total: questions.length,
      correct,
      incorrect,
      skipped,
      attempted,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      minutes: Math.max(1, Math.round(totalTime / 60000)),
    };
  }, [questions, answers, timeSpent]);

  const wrongIds = useMemo(
    () => questions.filter((q) => answers[q.id] && answers[q.id] !== q.answer).map((q) => q.id),
    [questions, answers]
  );

  // Reset the session once the user leaves so the next run starts fresh.
  useEffect(() => {
    return () => resetSession();
  }, [resetSession]);

  const goReviewWrong = useCallback(async () => {
    if (!user?.uid || wrongIds.length === 0) return;
    await start(
      { kind: 'ids', ids: wrongIds, title: 'Review wrong answers' },
      'review',
      user.uid
    );
    router.replace('/question-runner' as never);
  }, [user, wrongIds, start, router]);

  const goRetry = useCallback(async () => {
    if (!user?.uid) return;
    await start(
      { kind: 'ids', ids: questions.map((q) => q.id), title: `${title} (retry)`, limit: questions.length },
      mode,
      user.uid
    );
    router.replace('/question-runner' as never);
  }, [user, questions, title, mode, start, router]);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Results" />
        <EmptyState
          icon={<Target size={40} color={t.textTertiary} />}
          title="No session to show"
          message="Start a practice session to see your results here."
          actionLabel="Go to Practice"
          onAction={() => router.replace('/(app)/practice' as never)}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  const passed = stats.accuracy >= 60;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader title="Results" subtitle={subtitle ?? title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: t.surfaceAlt }]}>
          <Trophy size={34} color={passed ? t.success : t.warning} />
          <Text style={[styles.heroTitle, { color: t.textPrimary }]}>
            {passed ? 'Well done!' : 'Keep practicing'}
          </Text>
          <Text style={[styles.heroScore, { color: t.secondary }]}>{stats.accuracy}%</Text>
          <Text style={[styles.heroSub, { color: t.textSecondary }]}>
            {stats.correct} of {stats.total} correct
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard value={stats.correct} label="Correct" tone="success" icon={<CheckCircle2 size={18} color={t.success} />} />
          <StatCard value={stats.incorrect} label="Incorrect" tone="error" icon={<XCircle size={18} color={t.error} />} />
          <StatCard value={stats.skipped} label="Skipped" icon={<MinusCircle size={18} color={t.textTertiary} />} />
        </View>
        <View style={[styles.timeRow, { borderColor: t.border }]}>
          <Clock size={16} color={t.textSecondary} />
          <Text style={[styles.timeText, { color: t.textSecondary }]}>
            {stats.minutes} min · {stats.attempted} attempted
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Next steps</Text>
        <View style={styles.actions}>
          <AppButton
            label={`Review wrong answers (${wrongIds.length})`}
            onPress={goReviewWrong}
            disabled={wrongIds.length === 0}
            fullWidth
          />
          <AppButton label="Retry this set" variant="secondary" onPress={goRetry} fullWidth />
          <AppButton
            label="Back to Practice"
            variant="ghost"
            onPress={() => router.replace('/(app)/practice' as never)}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.screenX },
  hero: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  heroTitle: { ...typography.cardTitle, fontWeight: '700' },
  heroScore: { ...typography.pageTitle, fontWeight: '800' },
  heroSub: { ...typography.bodySmall },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  timeText: { ...typography.bodySmall },
  sectionLabel: { ...typography.bodySmall, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});

