/**
 * Exam Info — instructions screen before an exam (rule 13).
 *
 * The session is created ONLY when the user taps "Start Exam", so the timer
 * begins on their action — never while they are still reading the rules.
 * Supports the mock papers (from the Exam hub) and custom exams.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, FileText, ListChecks } from 'lucide-react-native';
import {
  getAllQuestions,
  getQuestionsBySubject,
  type Question,
} from '../../src/services/database';
import { startExam, startCustomExamSession } from '../../src/services/examService';
import { useAuthStore } from '../../src/stores/authStore';
import { useCustomExamStore } from '../../src/stores/customExamStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import {
  AppButton, EmptyState, LoadingState, ScreenHeader,
} from '../../src/components/ui';
import { useTypedPush } from '../../src/utils/navigation';

const INSTRUCTIONS: string[] = [
  'Read each question and select the single best answer.',
  'Use "Mark for review" on questions you want to revisit.',
  'Open the palette to jump to any question and see your progress.',
  'Answering is saved instantly — you can leave and resume any time.',
  'Unanswered questions count as skipped, not wrong.',
  'The timer keeps running once you start, so pace yourself.',
];

export default function ExamInfoScreen() {
  const t = useTheme();
  const push = useTypedPush();
  const user = useAuthStore((s) => s.user);
  const { kind, paperId, customId, title, count, minutes, type, source, subjectId } =
    useLocalSearchParams<{
      kind?: string;
      paperId?: string;
      customId?: string;
      title?: string;
      count?: string;
      minutes?: string;
      type?: string;
      source?: string;
      subjectId?: string;
    }>();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Marking config for mock papers (custom exams carry their own config).
  // Raw text so decimal values like "0.25" can be typed.
  const [marksPerQ, setMarksPerQ] = useState('1');
  const [negativeMarks, setNegativeMarks] = useState('0');

  const isCustom = kind === 'custom' || !!customId;
  const qCount = parseInt(count ?? '0', 10) || 0;
  const mins = parseInt(minutes ?? '0', 10) || 0;

  const start = useCallback(async () => {
    if (!user?.uid) return;
    setStarting(true);
    setError(null);
    try {
      if (isCustom && customId) {
        const exam = useCustomExamStore.getState().exams.find((e) => e.id === customId);
        if (!exam) {
          setError('Custom exam not found. It may have been deleted.');
          return;
        }
        const { sessionId } = await startCustomExamSession(user.uid, exam);
        push('/quiz', { sessionId, title: title ?? 'Custom exam' });
      } else {
        const rows: Question[] =
          source === 'subject' && subjectId
            ? await getQuestionsBySubject(subjectId, 1000)
            : await getAllQuestions(500, 0);
        if (!rows.length) {
          setError('No questions available for this paper yet.');
          return;
        }
        const { sessionId } = await startExam({
          userId: user.uid,
          rows,
          count: qCount,
          durationMinutes: mins,
          topicLabel: source === 'subject' && subjectId ? `subject:${subjectId}` : 'all',
        });
        push('/quiz', {
          sessionId,
          title: title ?? 'Exam',
          type: type ?? 'model',
          marksPerQ,
          negative: negativeMarks,
        });
      }
    } catch (e) {
      console.error('[ExamInfo] start failed:', e);
      setError('Could not start the exam. Please try again.');
    } finally {
      setStarting(false);
    }
  }, [user, isCustom, customId, source, subjectId, qCount, mins, title, type, marksPerQ, negativeMarks, push]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Exam" />
        <EmptyState title="Sign in required" message="Sign in to start an exam." style={{ flex: 1, justifyContent: 'center' }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader title={isCustom ? 'Custom Exam' : 'Exam Instructions'} subtitle={title ?? ''} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.summary, { backgroundColor: t.surfaceAlt }]}>
          <FileText size={26} color={t.secondary} />
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: t.textPrimary }]} numberOfLines={2}>
              {title ?? 'Exam'}
            </Text>
            <Text style={[styles.summaryMeta, { color: t.textSecondary }]}>
              {qCount} questions · {Math.max(1, mins)} minutes
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Instructions</Text>
        <View style={[styles.rules, { borderColor: t.border }]}>
          {INSTRUCTIONS.map((line, i) => (
            <View key={i} style={styles.ruleRow}>
              <CheckCircle2 size={16} color={t.success} style={styles.ruleIcon} />
              <Text style={[styles.ruleText, { color: t.textPrimary }]}>{line}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={[styles.warn, { backgroundColor: t.errorSoft }]}>
            <AlertTriangle size={16} color={t.error} />
            <Text style={[styles.warnText, { color: t.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.timeNote, { borderColor: t.border }]}>
          <Clock size={16} color={t.warning} />
          <Text style={[styles.timeNoteText, { color: t.textSecondary }]}>
            The timer starts when you tap Start. Feel free to also come back later — your progress is saved.
          </Text>
        </View>

        {!isCustom ? (
          <View style={styles.markingRow}>
            <View style={styles.markingField}>
              <Text style={styles.markingLabel}>Marks / Q</Text>
              <TextInput
                style={styles.markingInput}
                value={marksPerQ}
                onChangeText={setMarksPerQ}
                keyboardType="decimal-pad"
                maxLength={4}
              />
            </View>
            <View style={styles.markingField}>
              <Text style={styles.markingLabel}>Negative marks</Text>
              <TextInput
                style={styles.markingInput}
                value={negativeMarks}
                onChangeText={setNegativeMarks}
                keyboardType="decimal-pad"
                maxLength={5}
              />
            </View>
          </View>
        ) : null}

        <AppButton
          label={starting ? 'Starting…' : 'Start Exam'}
          onPress={start}
          loading={starting}
          disabled={starting}
          fullWidth
        />
        <View style={styles.hint}>
          <ListChecks size={14} color={t.textTertiary} />
          <Text style={[styles.hintText, { color: t.textTertiary }]}>
            This is a timed mock — review your answers before the final Submit.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.screenX, paddingBottom: spacing.xxl },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  summaryText: { flex: 1, minWidth: 0 },
  summaryTitle: { ...typography.cardTitle, fontWeight: '700' },
  summaryMeta: { ...typography.caption, marginTop: 2 },
  sectionLabel: { ...typography.bodySmall, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  rules: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ruleIcon: { marginTop: 2 },
  ruleText: { flex: 1, ...typography.bodySmall },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, borderRadius: radius.md, padding: spacing.sm },
  warnText: { flex: 1, ...typography.bodySmall, fontWeight: '600' },
  timeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  timeNoteText: { flex: 1, ...typography.bodySmall },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, justifyContent: 'center' },
  hintText: { ...typography.caption },
  markingRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  markingField: { flex: 1, gap: spacing.xs },
  markingLabel: { ...typography.bodySmall, fontWeight: '700', color: '#475569' },
  markingInput: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: '#0f172a',
  },
});
