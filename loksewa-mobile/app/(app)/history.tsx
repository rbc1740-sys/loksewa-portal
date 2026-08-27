/**
 * History — hub for past exam attempts (rule 25).
 *
 * Lists exam_history rows (newest first), shows a pass/fail + score summary,
 * and deep-links each attempt back to the typed Result screen. No scores are
 * computed here — they come straight from the graded history row written by
 * the idempotent submit pipeline.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Clock, XCircle } from 'lucide-react-native';
import { getExamHistory, type ExamHistoryRecord } from '../../src/services/database';
import { formatDuration } from '../../src/services/examEngine';
import { parseDetails } from '../../src/utils/examDetails';
import { useAuthStore } from '../../src/stores/authStore';
import { themes, spacing, radius, typography } from '../../src/constants/theme';
import { EmptyState, ErrorState, LoadingState, ScreenHeader } from '../../src/components/ui';
import { useTypedPush } from '../../src/utils/navigation';

const EXAM_TYPE_LABEL: Record<string, string> = {
  model: 'Full Mock Exam',
  subject: 'Subject Paper',
  custom: 'Custom Exam',
  past_paper: 'Past Paper',
};

function attemptTitle(rec: ExamHistoryRecord): string {
  const details = parseDetails(rec.details_json ?? null);
  return details?.title ?? EXAM_TYPE_LABEL[rec.exam_type] ?? 'Exam Attempt';
}

function AttemptRow({ rec, onPress }: { rec: ExamHistoryRecord; onPress: () => void }) {
  const t = themes.light;
  const pct = rec.percentage ?? 0;
  const passMark = rec.pass_mark ?? 40;
  const passed = pct >= passMark;
  const date = rec.completed_at
    ? new Date(rec.completed_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
  const duration = formatDuration((rec.time_spent_ms ?? 0) * 1000);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: t.surface, borderBottomColor: t.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${attemptTitle(rec)} — ${pct}% — ${passed ? 'passed' : 'try again'}`}
    >
      <View style={[styles.rowIcon, passed ? { backgroundColor: t.successSoft } : { backgroundColor: t.errorSoft }]}>
        {passed ? <CheckCircle size={20} color={t.success} /> : <XCircle size={20} color={t.error} />}
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: t.textPrimary }]} numberOfLines={1}>
          {attemptTitle(rec)}
        </Text>
        <Text style={[styles.rowSub, { color: t.textSecondary }]}>
          {EXAM_TYPE_LABEL[rec.exam_type] ?? rec.exam_type} · {date}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.scoreText, { color: passed ? t.success : t.error }]}>{pct}%</Text>
          <View style={styles.rowHint}>
            <Text style={{ color: t.textTertiary }}>{rec.correct}✓ {rec.wrong}✗ {rec.skipped}–</Text>
            <Clock size={12} color={t.textTertiary} />
            <Text style={{ color: t.textTertiary }}>{duration}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const push = useTypedPush();
  const user = useAuthStore(s => s.user);
  const uid = user?.uid ?? 'device-user';

  const [attempts, setAttempts] = useState<ExamHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAttempts(await getExamHistory(uid, { limit: 50 }));
    } catch (e) {
      console.error('[History] load failed', e);
      setError('Could not load your exam history.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const open = useCallback(
    (rec: ExamHistoryRecord) => push('/result', { attemptId: rec.id ?? '' }),
    [push]
  );

  if (loading) return <LoadingState variant="rows" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (!attempts.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="History" subtitle="Your past attempts" />
        <EmptyState
          title="No attempts yet"
          message="Start an exam from the Exams tab — your results will appear here."
          actionLabel="Go to Exams"
          onAction={() => push('/exam')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="History"
        subtitle={`${attempts.length} attempt${attempts.length === 1 ? '' : 's'}`}
      />
      <FlatList
        data={attempts}
        keyExtractor={rec => rec.id ?? `${rec.session_id ?? ''}@${rec.completed_at ?? 0}`}
        renderItem={({ item }) => <AttemptRow rec={item} onPress={() => open(item)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: themes.light.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themes.light.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodySmall, fontWeight: '700' },
  rowSub: { ...typography.caption, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  scoreText: { ...typography.cardTitle, fontWeight: '800' },
  rowHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});