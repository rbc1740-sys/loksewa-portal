/**
 * Quiz — timed exam runner (rules 23–24, 61).
 *
 * A single player for every exam type (past papers, custom, model). It loads
 * the saved session, drives a countdown from an absolute deadline, persists
 * every answer/flag/navigation through examService (so the exact question,
 * answers, flags and remaining time survive app restarts), and submits through
 * the shared idempotent grading pipeline. Back is guarded — it never silently
 * discards the exam.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Flag, Grid3x3 } from 'lucide-react-native';
import {
  loadActiveSession,
  persistExamProgress,
  submitExamSession,
  type ActiveSession,
} from '../../src/services/examService';
import { deadlineState, formatDuration } from '../../src/services/examEngine';
import { themes, spacing, radius, typography } from '../../src/constants/theme';
import { AppButton, ErrorState, LoadingState, ScreenHeader } from '../../src/components/ui';
import { QuestionCard } from '../../src/components/QuestionCard';
import { useTypedPush, useTypedBack } from '../../src/utils/navigation';
import { useAuthStore } from '../../src/stores/authStore';
import { useCustomExamStore } from '../../src/stores/customExamStore';

export default function QuizScreen() {
  const push = useTypedPush();
  const user = useAuthStore(s => s.user);
  const { sessionId, title, type } = useLocalSearchParams<{
    sessionId: string;
    title?: string;
    type?: string;
  }>();
  const sid = sessionId;
  // History label for non-custom papers ('model' | 'subject'); validated, never
  // trusted blindly from the URL (rule 66).
  const paperType: 'model' | 'subject' = type === 'subject' ? 'subject' : 'model';

  const [active, setActive] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single mutable exam-state bucket → one re-render path (rule 51).
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);

  const [remainingMs, setRemainingMs] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Marking config. Present for custom sessions, defaulted otherwise.
  const [marksPer, setMarksPer] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [passPercent, setPassPercent] = useState(40);
  const customIdRef = useRef<string | null>(null);

  const paperTitle = typeof title === 'string' && title ? title : active?.session.topic ?? 'Exam';

  // ---- Load / resume ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadActiveSession(sid)
      .then(a => {
        if (cancelled || !a || a.paper.length === 0) {
          if (!cancelled) setError('This exam is no longer available.');
          return;
        }
        setActive(a);
        setAnswers({ ...(a.progress?.answers ?? {}) });
        setMarked(new Set(a.progress?.flagged ?? []));
        setIndex(Math.min(a.progress?.currentIndex ?? 0, a.paper.length - 1));
        setRemainingMs(Math.max((a.progress?.endAt ?? 0) - Date.now(), 0));

        // Custom sessions carry their config id in the topic tag; re-hydrate.
        const tag = a.session.topic ?? '';
        if (tag.startsWith('custom:')) {
          const cid = tag.slice('custom:'.length);
          customIdRef.current = cid;
          const exam = useCustomExamStore.getState().exams.find(e => e.id === cid);
          if (exam) {
            setMarksPer(exam.marksPerQuestion);
            setNegativeMarks(exam.negativeMarks);
            setPassPercent(exam.passPercent);
          }
        }
      })
      .catch(e => {
        console.error('[Quiz] load failed', e);
        if (!cancelled) setError('Could not load this exam.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sid]);

  const answersRef = useRef(answers);
  const markedRef = useRef(marked);
  answersRef.current = answers;
  markedRef.current = marked;

  const persist = useCallback(
    (next: { answers?: Record<string, string>; marked?: Set<string>; index: number }) => {
      if (!active) return;
      persistExamProgress(active.session.id, {
        answers: next.answers ?? answersRef.current,
        flagged: [...(next.marked ?? markedRef.current)],
        currentIndex: next.index,
        endAt: active.progress?.endAt ?? 0,
      }).catch(e => console.warn('[Quiz] persist failed', e));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  );

  // ---- Submit (idempotent) + navigate to result -----------------------------
  const doSubmit = useCallback(
    async (autoSubmitted: boolean) => {
      if (!active || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const result = await submitExamSession(active.session.id, {
          title: paperTitle,
          marksPerQuestion: marksPer,
          negativeMarks,
          passMarkPct: passPercent,
          examType: customIdRef.current ? 'custom' : paperType,
        });
        if (customIdRef.current && user?.uid) {
          await useCustomExamStore.getState().recordAttempt(
            user.uid, customIdRef.current, result.graded.percentage
          );
        }
        push(`/result?attemptId=${encodeURIComponent(result.attemptId)}&auto=${autoSubmitted ? '1' : '0'}`);
      } catch (e) {
        console.error('[Quiz] submit failed', e);
        submittingRef.current = false;
        setSubmitting(false);
        Alert.alert('Submission failed', 'Please try again.');
      }
    },
    [active, paperTitle, marksPer, negativeMarks, passPercent, paperType, push, user]
  );

    // ---- Countdown from the absolute deadline ----------------------------------
  const endAt = active?.progress?.endAt ?? 0;
  useEffect(() => {
    if (!active || !endAt) return;
    const tick = () => {
      const { remainingMs, expired } = deadlineState(endAt, Date.now());
      setRemainingMs(remainingMs);
      if (expired && !submittingRef.current) void doSubmit(true);
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [active, endAt, doSubmit]);

  // ---- Answer / mark / navigate ----------------------------------------------
  const handleAnswer = useCallback(
    (qid: string, optionKey: string) => {
      setAnswers(prev => {
        const next = { ...prev, [qid]: optionKey };
        persist({ answers: next, index });
        return next;
      });
    },
    [index, persist]
  );

  const handleFlag = useCallback(
    (qid: string) => {
      setMarked(prev => {
        const next = new Set(prev);
        if (next.has(qid)) next.delete(qid);
        else next.add(qid);
        persist({ marked: next, index });
        return next;
      });
    },
    [index, persist]
  );

  const goTo = useCallback(
    (i: number) => {
      if (!active) return;
      const clamped = Math.max(0, Math.min(i, active.paper.length - 1));
      setIndex(clamped);
      persist({ index: clamped });
      setPaletteOpen(false);
    },
    [active, persist]
  );

  // ---- Leave guard (rule 61): back never silently discards the exam; the
  // session (answers, flags, timer) is already persisted on every change.
  const goBack = useTypedBack();
  const confirmLeave = useCallback(() => {
    Alert.alert('Leave exam?', 'Your answers will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: goBack },
    ]);
  }, [goBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  }, [confirmLeave]);

const current = active?.paper[index];
  const answeredCount = Object.keys(answers).length;
  const lowTime = remainingMs > 0 && remainingMs < 60_000;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Loading…" />
        <View style={styles.bodyPad}>
          <LoadingState variant="cards" count={2} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !active || !current) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Exam" />
        <ErrorState
          message={error ?? 'This exam is no longer available.'}
          onRetry={() => push('/exam')}
          retryLabel="Back to Exams"
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.examBar}>
        <View style={styles.barCell}>
          <Text style={styles.barTitle} numberOfLines={1}>{paperTitle}</Text>
          <Text style={styles.barValue}>Question {index + 1} of {active.paper.length}</Text>
        </View>
        <TouchableOpacity
          style={[styles.paletteBtn, lowTime && styles.paletteBtnDanger]}
          onPress={() => setPaletteOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open question palette and timer"
        >
          <Grid3x3 size={16} color={lowTime ? themes.light.error : themes.light.secondary} />
          <Text style={[styles.timerText, lowTime && { color: themes.light.error }]}>
            {formatDuration(remainingMs)}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <QuestionCard
          key={current.id}
          question={current}
          userAnswer={answers[current.id] ?? null}
          isFlagged={marked.has(current.id)}
          mode="exam"
          showResult={false}
        />
        <TouchableOpacity
          style={styles.flagRow}
          onPress={() => handleFlag(current.id)}
          accessibilityRole="button"
        >
          <Flag size={16} color={marked.has(current.id) ? themes.light.warning : themes.light.textTertiary} />
          <Text style={[styles.flagText, marked.has(current.id) && { color: themes.light.warning }]}>
            {marked.has(current.id) ? 'Marked for review' : 'Mark for review'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton label="Previous" onPress={() => goTo(index - 1)} disabled={index === 0} variant="secondary" />
        {index < active.paper.length - 1 ? (
          <AppButton label="Next" onPress={() => goTo(index + 1)} />
        ) : (
          <AppButton label="Submit" onPress={() => setPaletteOpen(true)} loading={submitting} />
        )}
      </View>

<Modal visible={paletteOpen} transparent animationType="slide" onRequestClose={() => setPaletteOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{answeredCount} of {active.paper.length} answered</Text>
              <TouchableOpacity onPress={() => setPaletteOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.sheetClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.gridWrap}>
              <View style={styles.grid}>
                {active.paper.map((q, i) => {
                  const answered = !!answers[q.id];
                  const isFlagged = marked.has(q.id);
                  return (
                    <TouchableOpacity
                      key={q.id}
                      style={[
                        styles.cell,
                        answered && styles.cellAnswered,
                        isFlagged && styles.cellFlagged,
                        i === index && styles.cellCurrent,
                      ]}
                      onPress={() => goTo(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Question ${i + 1}`}
                    >
                      <Text style={styles.cellText}>{i + 1}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.sheetFooter}>
              <AppButton
                label={`Submit exam (${answeredCount}/${active.paper.length})`}
                fullWidth
                loading={submitting}
                onPress={() =>
                  Alert.alert('Submit exam?', `You answered ${answeredCount} of ${active.paper.length}.`, [
                    { text: 'Keep working', style: 'cancel' },
                    { text: 'Submit', style: 'default', onPress: () => void doSubmit(false) },
                  ])
                }
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const t = themes.light;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  bodyPad: { padding: spacing.screenX },
  examBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  barCell: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  barTitle: { ...typography.cardTitle, fontWeight: '700', color: t.textPrimary },
  barValue: { ...typography.micro, color: t.textSecondary, marginTop: 2 },
  paletteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: t.infoSoft,
  },
  paletteBtnDanger: { backgroundColor: t.errorSoft },
  timerText: { ...typography.bodySmall, fontWeight: '700', fontVariant: ['tabular-nums'], color: t.secondary },
  scroll: { padding: spacing.screenX, paddingBottom: spacing.xxl },
  flagRow: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  flagText: { ...typography.caption, color: t.textTertiary },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.screenX,
    paddingBottom: spacing.md,
    backgroundColor: t.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.border,
  },
  sheetOverlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: t.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sheetTitle: { ...typography.cardTitle, fontWeight: '700', color: t.textPrimary },
  sheetClose: { ...typography.bodySmall, fontWeight: '600', color: t.secondary },
  gridWrap: { paddingHorizontal: spacing.screenX, paddingVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellAnswered: { backgroundColor: t.successSoft, borderColor: t.success },
  cellFlagged: { borderColor: t.warning, borderWidth: 2 },
  cellCurrent: { borderColor: t.secondary, borderWidth: 2 },
  cellText: { ...typography.caption, fontWeight: '700', color: t.textPrimary },
  sheetFooter: { paddingHorizontal: spacing.screenX, paddingTop: spacing.xs },
});