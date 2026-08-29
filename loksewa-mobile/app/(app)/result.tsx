/**
 * Result — post-exam summary (rule 25). Reads the stored attempt from
 * exam_history (written by the idempotent grading pipeline) and renders the
 * engine-computed numbers. No score is ever derived here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Clock, Trophy, TrendingUp, XCircle, MinusCircle } from 'lucide-react-native';
import {
  getAllQuestions,
  getExamHistoryEntry,
  getQuestionsBySubject,
  type ExamHistoryRecord,
  type Question,
} from '../../src/services/database';
import { startExam, startCustomExamSession } from '../../src/services/examService';
import { formatDuration } from '../../src/services/examEngine';
import { AttemptDetails, parseDetails } from '../../src/utils/examDetails';
import { useCustomExamStore } from '../../src/stores/customExamStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getTopicPath } from '../../src/constants/courses';
import { spacing, radius, typography, type AppTheme } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import {
  AppButton,
  ErrorState,
  FilterChips,
  LoadingState,
  ProgressBar,
  ScreenHeader,
} from '../../src/components/ui';
import { QuestionCard } from '../../src/components/QuestionCard';
import { useTypedPush } from '../../src/utils/navigation';

/** Attempt details + tolerant parser now live in src/utils/examDetails.ts (tested); see examDetails.test.ts. */

/** Shared accuracy color: weak = error, strong = success, else secondary. */
function accColor(t: AppTheme, accuracy: number, attempted: number): string {
  if (!attempted) return t.textTertiary;
  if (accuracy < 60) return t.error;
  if (accuracy >= 80) return t.success;
  return t.secondary;
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={[styles.metric, { backgroundColor: t.surfaceAlt }]}>
      {icon}
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const push = useTypedPush();
  const user = useAuthStore(s => s.user);
  const { attemptId, auto } = useLocalSearchParams<{ attemptId?: string; auto?: string }>();
  const [rec, setRec] = useState<ExamHistoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<string | null>('all');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let alive = true;
    getExamHistoryEntry(attemptId ?? '')
      .then(r => { if (alive) setRec(r); })
      .catch(() => { if (alive) setError('Could not load your result.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attemptId]);

  const details = useMemo(() => parseDetails(rec?.details_json), [rec]);

  // Per-subject accuracy computed from the SAME stored paper + answers the
  // grading engine used (rule 40: analytics from real data, never invented).
  const subjectStats = useMemo(() => {
    const paper = details?.paper ?? [];
    const answers = details?.answers ?? {};
    const map = new Map<string, { attempted: number; correct: number; total: number }>();
    for (const q of paper) {
      const name = getTopicPath(q.topic)?.subjectName ?? 'Other';
      const s = map.get(name) ?? { attempted: 0, correct: 0, total: 0 };
      s.total += 1;
      const a = answers[q.id];
      if (a) {
        s.attempted += 1;
        if (a === q.answer) s.correct += 1;
      }
      map.set(name, s);
    }
    return [...map.entries()]
      .map(([name, s]) => ({
        name,
        ...s,
        accuracy: s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [details]);

  const reviewItems = useMemo(() => {
    const paper = details?.paper ?? [];
    const answers = details?.answers ?? {};
    return paper.map(q => ({ q, selected: answers[q.id] ?? null }));
  }, [details]);

  const reviewCounts = useMemo(() => {
    let correct = 0, incorrect = 0, skipped = 0;
    for (const r of reviewItems) {
      if (!r.selected) skipped += 1;
      else if (r.selected === r.q.answer) correct += 1;
      else incorrect += 1;
    }
    return { all: reviewItems.length, correct, incorrect, skipped };
  }, [reviewItems]);

  const filteredReview = useMemo(() => {
    if (reviewFilter === 'incorrect') return reviewItems.filter(r => r.selected && r.selected !== r.q.answer);
    if (reviewFilter === 'skipped') return reviewItems.filter(r => !r.selected);
    if (reviewFilter === 'correct') return reviewItems.filter(r => r.selected === r.q.answer);
    return reviewItems;
  }, [reviewItems, reviewFilter]);

  const goBack = useCallback(() => push('/exam'), [push]);

  /** Rebuilds an identical fresh attempt (rule 25 Retry): custom exams relaunch
   *  from their stored config; mock papers re-sample the same scope/size/time. */
  const retryExam = useCallback(async () => {
    if (!user?.uid || !rec || retrying) return;
    setRetrying(true);
    try {
      const topic = details?.topic ?? '';
      if (topic.startsWith('custom:')) {
        const id = topic.slice('custom:'.length);
        await useCustomExamStore.getState().refresh(user.uid);
        const exam = useCustomExamStore.getState().exams.find(e => e.id === id);
        if (!exam) throw new Error('This custom exam no longer exists.');
        const { sessionId } = await startCustomExamSession(user.uid, exam);
        push('/quiz', { sessionId, title: exam.title });
        return;
      }
      const rows: Question[] = topic.startsWith('subject:')
        ? await getQuestionsBySubject(topic.slice('subject:'.length), 1000)
        : await getAllQuestions(500, 0);
      const { sessionId } = await startExam({
        userId: user.uid,
        rows,
        count: rec.total || 25,
        durationMinutes: Math.max(1, Math.ceil((details?.timeLimitSeconds ?? 1800) / 60)),
        topicLabel: topic || 'all',
      });
      push('/quiz', { sessionId, title: details?.title ?? 'Exam attempt' });
    } catch (e) {
      console.error('[Result] retry failed', e);
      Alert.alert(
        'Retry failed',
        e instanceof Error && e.message ? e.message : 'Could not start a new attempt.'
      );
    } finally {
      setRetrying(false);
    }
  }, [user?.uid, rec, retrying, details, push]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Result" />
        <LoadingState variant="spinner" style={{ paddingHorizontal: spacing.screenX, marginTop: spacing.md }} />
      </SafeAreaView>
    );
  }

  if (error || !rec) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Result" />
        <ErrorState message={error ?? 'This attempt is no longer available.'} onRetry={goBack} retryLabel="Back to Exams" style={{ flex: 1, justifyContent: 'center' }} />
      </SafeAreaView>
    );
  }

  const attempted = rec.correct + rec.wrong;
  const accuracy = attempted > 0 ? Math.round((rec.correct / attempted) * 100) : 0;
  const pass = typeof rec.pass_mark === 'number' ? rec.percentage >= rec.pass_mark : null;

  // __APPEND_R2__
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Exam Result"
        subtitle={details?.title ?? (rec.exam_type === 'custom' ? 'Custom exam' : 'Exam attempt')}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {auto === '1' && (
          <View style={styles.autoBanner}>
            <Text style={styles.autoText}>
              Time expired - your exam was submitted automatically.
            </Text>
          </View>
        )}
        <View style={[styles.hero, { backgroundColor: pass === false ? t.error : t.primary }]}>
          <Trophy size={26} color={t.textOnPrimary} />
          <Text style={styles.heroScore}>{rec.percentage}%</Text>
          <Text style={styles.heroLabel}>{pass === null ? 'Score' : pass ? 'Passed' : 'Not passed'}</Text>
        </View>

        <View style={styles.grid}>
          <Metric icon={<CheckCircle2 size={18} color={t.success} />} label="Correct" value={String(rec.correct)} color={t.success} />
          <Metric icon={<XCircle size={18} color={t.error} />} label="Wrong" value={String(rec.wrong)} color={t.error} />
          <Metric icon={<MinusCircle size={18} color={t.textTertiary} />} label="Skipped" value={String(rec.skipped)} color={t.textTertiary} />
          <Metric icon={<TrendingUp size={18} color={t.secondary} />} label="Accuracy" value={accuracy + '%'} color={t.secondary} />
          <Metric icon={<Clock size={18} color={t.warning} />} label="Time" value={formatDuration(rec.time_spent_ms)} color={t.warning} />
          <Metric icon={<Trophy size={18} color={t.primaryDark} />} label="Total Q" value={String(rec.total)} color={t.primaryDark} />
        </View>

        {pass === false && typeof rec.pass_mark === 'number' && (
          <View style={[styles.hint, { backgroundColor: t.warningSoft }]}>
            <Text style={[styles.hintText, { color: t.warning }]}>
              Pass mark is {rec.pass_mark}%. Keep practising to move past it.
            </Text>
          </View>
        )}

        {subjectStats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Subject performance</Text>
            <View style={styles.subjectCard}>
              {subjectStats.map(s => (
                <View
                  key={s.name}
                  style={styles.subjectRow}
                  accessibilityLabel={`${s.name}: ${s.attempted ? `${s.accuracy}% accuracy` : 'not attempted'}`}
                >
                  <View style={styles.subjectHead}>
                    <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
                    <Text style={[styles.subjectAcc, { color: accColor(t, s.accuracy, s.attempted) }]}>
                      {s.attempted ? `${s.accuracy}%` : '-'}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={s.attempted ? s.accuracy / 100 : 0}
                    height={6}
                    color={accColor(t, s.accuracy, s.attempted)}
                    accessibilityLabel={`${s.name} accuracy`}
                  />
                  <Text style={styles.subjectMeta}>
                    {s.correct}/{s.attempted} correct of {s.total}
                    {s.attempted > 0 && s.accuracy < 60
                      ? ' - weak area'
                      : s.attempted > 0 && s.accuracy >= 80
                        ? ' - strong'
                        : ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {reviewItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Review questions</Text>
            <FilterChips
              chips={[
                { key: 'all', label: 'All', count: reviewCounts.all },
                { key: 'incorrect', label: 'Incorrect', count: reviewCounts.incorrect },
                { key: 'skipped', label: 'Skipped', count: reviewCounts.skipped },
                { key: 'correct', label: 'Correct', count: reviewCounts.correct },
              ]}
              selectedKey={reviewFilter}
              onSelect={setReviewFilter}
            />
            {filteredReview.length === 0 ? (
              <Text style={styles.reviewEmpty}>Nothing in this category.</Text>
            ) : (
              filteredReview.map(({ q, selected }) => (
                <View key={q.id}>
                  {!selected && (
                    <View style={styles.skipChip}>
                      <Text style={styles.skipText}>
                        Skipped - correct answer: {q.answer.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <QuestionCard
                    question={{
                      id: q.id,
                      topic: q.topic,
                      question: q.question,
                      options: q.options,
                      answer: q.answer,
                      explanation: q.explanation,
                    }}
                    userAnswer={selected}
                    mode="review"
                    showResult
                    showExplanation
                  />
                </View>
              ))
            )}
          </>
        )}

        <View style={styles.actions}>
          <AppButton
            label="Retry Exam"
            variant="secondary"
            onPress={retryExam}
            loading={retrying}
            disabled={retrying || !user?.uid}
            fullWidth
          />
          <AppButton label="Back to Exams" onPress={goBack} fullWidth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const makeStyles = (t: AppTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  scroll: { padding: spacing.screenX },
  hero: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs, marginBottom: spacing.md },
  heroScore: { ...typography.pageTitle, fontSize: 40, fontWeight: '800', color: t.textOnPrimary, fontVariant: ['tabular-nums'] },
  heroLabel: { ...typography.bodySmall, fontWeight: '700', color: t.textOnPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  metric: { width: '31%', alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.md, gap: spacing.xxs },
  metricValue: { ...typography.cardTitle, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { ...typography.micro, color: t.textSecondary },
  hint: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  hintText: { ...typography.bodySmall, fontWeight: '600', textAlign: 'center' },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  autoBanner: {
    backgroundColor: t.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  autoText: { ...typography.bodySmall, fontWeight: '600', color: t.warning, textAlign: 'center' },
  sectionTitle: { ...typography.cardTitle, fontSize: 18, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm },
  subjectCard: { gap: spacing.md },
  subjectRow: {
    backgroundColor: t.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { ...typography.cardTitle, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  subjectAcc: { ...typography.cardTitle, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subjectMeta: { ...typography.micro, color: t.textSecondary },
  reviewEmpty: { ...typography.bodySmall, color: t.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  skipChip: {
    alignSelf: 'flex-start',
    backgroundColor: t.warningSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  skipText: { ...typography.micro, fontWeight: '700', color: t.warning },
});