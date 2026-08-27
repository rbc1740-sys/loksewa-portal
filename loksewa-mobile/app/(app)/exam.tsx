/**
 * Exam — the exam hub (rules 3, 27, 28, 23). Lists past papers and the user's
 * custom exams, offers resume of an in-progress session, and starts papers
 * through the one shared exam pipeline (startExam → quiz → submitExamSession).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, FileText, Plus, Trophy, Trash2 } from 'lucide-react-native';
import {
  getAllQuestions,
  getQuestionsBySubject,
  getLatestActiveExamSession,
  type Question,
} from '../../src/services/database';
import { startExam, startCustomExamSession } from '../../src/services/examService';
import { useAuthStore } from '../../src/stores/authStore';
import { useCourseStore } from '../../src/stores/courseStore';
import { useCustomExamStore } from '../../src/stores/customExamStore';
import { themes, spacing, radius, typography } from '../../src/constants/theme';
import {
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
} from '../../src/components/ui';
import { useTypedPush } from '../../src/utils/navigation';

interface PaperDef {
  id: string;
  title: string;
  desc: string;
  count: number;
  minutes: number;
  source: 'all' | 'subject';
  /** Honest history label (rule 80): these are generated mocks, not real
   *  past-year papers — real past papers arrive with licensed content. */
  type: 'model' | 'subject';
  subjectId?: string;
}

const PAPERS: PaperDef[] = [
  { id: 'model', title: 'Full Mock Exam', desc: 'Mixed questions across the bank', count: 40, minutes: 60, source: 'all', type: 'model' },
  { id: 'tech', title: 'Civil Engineering Exam', desc: 'Technical paper', count: 25, minutes: 35, source: 'subject', type: 'subject', subjectId: 'ce_technical' },
  { id: 'gk', title: 'GK & Administration Exam', desc: 'General studies paper', count: 25, minutes: 30, source: 'subject', type: 'subject', subjectId: 'ce_gk' },
];

export default function ExamScreen() {
  const push = useTypedPush();
  const user = useAuthStore(s => s.user);
  const uid = user?.uid ?? 'device-user';

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasResumable, setHasResumable] = useState(false);
  const [resumableId, setResumableId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const custom = useCustomExamStore(s => s.exams);
  const customLoading = useCustomExamStore(s => s.loading);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const store = useCourseStore.getState();
        await (store.hydrated ? Promise.resolve() : store.hydrate());
        const sess = await getLatestActiveExamSession(uid);
        if (!alive) return;
        setHasResumable(!!(sess && sess.submitted_at == null));
        if (sess && sess.submitted_at == null) setResumableId(sess.id);
        await useCustomExamStore.getState().refresh(uid);
      } catch (e) {
        console.error('[Exam] boot failed', e);
        if (alive) setError('Could not prepare the exam section.');
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const launchPaper = useCallback(
    async (paper: PaperDef) => {
      if (!user?.uid) return;
      setStarting(paper.id);
      setError(null);
      try {
        const rows: Question[] =
          paper.source === 'subject' && paper.subjectId
            ? await getQuestionsBySubject(paper.subjectId, 1000)
            : await getAllQuestions(500, 0);
        if (!rows.length) {
          setError('No questions available for this paper yet.');
          return;
        }
        const { sessionId } = await startExam({
          userId: user.uid,
          rows,
          count: paper.count,
          durationMinutes: paper.minutes,
          // Structured scope so the result screen can rebuild an identical
          // retry (rule 25): 'all' | 'subject:<subjectId>'; custom = custom:<id>.
          topicLabel:
            paper.source === 'subject' && paper.subjectId
              ? `subject:${paper.subjectId}`
              : 'all',
        });
        push('/quiz', { sessionId, title: paper.title, type: paper.type });
      } catch (e) {
        console.error('[Exam] launch failed', e);
        setError('Could not start the exam. Please try again.');
      } finally {
        setStarting(null);
      }
    },
    [push, user?.uid]
  );

  const launchCustom = useCallback(
    async (examId: string) => {
      const exam = useCustomExamStore.getState().exams.find(e => e.id === examId);
      if (!exam || !user?.uid) return;
      setStarting(examId);
      setError(null);
      try {
        const { sessionId } = await startCustomExamSession(user.uid, exam);
        push('/quiz', { sessionId, title: exam.title });
      } catch (e) {
        console.error('[Exam] custom launch failed', e);
        setError(
          e instanceof Error && e.message
            ? e.message
            : 'Could not start the custom exam.'
        );
      } finally {
        setStarting(null);
      }
    },
    [push, user?.uid]
  );

  const deleteCustom = useCallback(
    (id: string) => {
      Alert.alert('Delete custom exam?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void useCustomExamStore.getState().remove(uid, id) },
      ]);
    },
    [uid]
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Exams" />
        <View style={styles.pad}>
          <LoadingState variant="cards" count={2} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <ScreenHeader
        title="Exams"
        subtitle="Mock tests · custom exams"
        right={
          <Pressable
            onPress={() => push('/history')}
            accessibilityRole="button"
            accessibilityLabel="View exam history"
            style={styles.historyIcon}
          >
            <FileText size={20} color={themes.light.textSecondary} />
          </Pressable>
        }
      />
      <FlatList
        data={PAPERS}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {resumableId ? (
              <View style={[styles.resumeCard, { backgroundColor: themes.light.primaryLight }]}>
                <View style={styles.resumeRow}>
                  <Clock size={18} color={themes.light.primaryDark} />
                  <Text style={styles.resumeText}>You have an in-progress exam.</Text>
                </View>
                <AppButton label="Continue exam" size="sm" onPress={() => push('/quiz', { sessionId: resumableId })} />
              </View>
            ) : null}

            {error ? (
              <ErrorState message={error} onRetry={() => setError(null)} style={{ marginBottom: spacing.sm }} />
            ) : null}

            <Text style={styles.sectionTitle}>Mock Exams</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.paperCard}>
            <View style={styles.paperRow}>
              <View style={[styles.paperIcon, { backgroundColor: themes.light.infoSoft }]}>
                <FileText size={18} color={themes.light.secondary} />
              </View>
              <View style={styles.paperMain}>
                <Text style={styles.paperTitle}>{item.title}</Text>
                <Text style={styles.paperDesc}>{item.desc}</Text>
                <Text style={styles.paperMeta}>{item.count} questions · {item.minutes} min</Text>
              </View>
              <AppButton label={starting === item.id ? '…' : 'Start'} size="sm" disabled={!!starting} onPress={() => launchPaper(item)} />
            </View>
          </View>
        )}
        ListFooterComponent={(
          <View>
            <View style={styles.customHeader}>
                <Text style={styles.sectionTitle}>My Custom Exams</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create a custom exam"
                  onPress={() => push('/custom-exam-create')}
                  style={styles.addBtn}
                >
                  <Plus size={18} color={themes.light.textOnPrimary} />
                </Pressable>
              </View>
              {customLoading ? (
                <LoadingState variant="rows" count={2} />
              ) : custom.length === 0 ? (
                <EmptyState
                  title="No custom exams yet"
                  message="Build your own combination of subjects, duration and marking."
                  actionLabel="Create one"
                  onAction={() => push('/custom-exam-create')}
                />
              ) : (
                custom.map(exam => (
                  <View key={exam.id} style={styles.paperCard}>
                    <View style={styles.paperRow}>
                      <View style={[styles.paperIcon, { backgroundColor: themes.light.surfaceMuted }]}>
                        <Trophy size={18} color={themes.light.warning} />
                      </View>
                      <View style={styles.paperMain}>
                        <Text style={styles.paperTitle}>{exam.title}</Text>
                        <Text style={styles.paperDesc}>
                          {exam.questionCount} Q · {Math.max(1, Math.round(exam.durationSeconds / 60))} min · {exam.marksPerQuestion}mk
                        </Text>
                        <Text style={styles.paperMeta}>
                          best {exam.best_percent}% · {exam.attempts} attempt{exam.attempts === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View style={styles.rowActions}>
                        <AppButton label={starting === exam.id ? '…' : 'Start'} size="sm" disabled={!!starting} onPress={() => launchCustom(exam.id)} />
                        <Pressable accessibilityRole="button" accessibilityLabel="Delete custom exam" onPress={() => deleteCustom(exam.id)} hitSlop={8} style={styles.trashBtn}>
                          <Trash2 size={16} color={themes.light.error} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))
              )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const t = themes.light;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  pad: { padding: spacing.screenX },
  list: { padding: spacing.screenX, gap: spacing.sm, paddingBottom: spacing.xxl },
  resumeCard: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resumeText: { ...typography.bodySmall, fontWeight: '600', color: t.primaryDark },
  sectionTitle: { ...typography.sectionTitle, fontWeight: '700', color: t.textPrimary, marginBottom: spacing.sm },
  paperCard: { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, padding: spacing.md },
  paperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paperIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  paperMain: { flex: 1, minWidth: 0 },
  paperTitle: { ...typography.cardTitle, fontWeight: '700', color: t.textPrimary },
  paperDesc: { ...typography.bodySmall, color: t.textSecondary },
  paperMeta: { ...typography.caption, color: t.textTertiary, marginTop: 2 },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  addBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    trashBtn: { padding: spacing.xxs },
  historyIcon: {
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: themes.light.surfaceMuted,
  },
});