/**
 * Topic — Chapter detail screen (master-prompt rules 7/12/26).
 *
 * Progressive disclosure terminal: the chapter row opened THIS screen; here
 * the user sees real progress stats and configures practice via a bottom
 * sheet (question count + mode + estimated duration), then starts.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Clock, Play, Target, Trophy } from 'lucide-react-native';
import { getChaptersWithProgress, ChapterStats } from '../../src/services/database';
import { useSessionStore } from '../../src/engine/questionSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useTypedPush } from '../../src/utils/navigation';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import {
  AppButton, BottomSheet, EmptyState, ErrorState,
  LoadingState, ProgressBar, ScreenHeader, StatCard,
} from '../../src/components/ui';

const COUNT_CHOICES = [10, 25] as const;
const SECONDS_PER_QUESTION = 45;
type PracticeMode = 'practice' | 'test';

export default function TopicScreen() {
  const pushRoute = useTypedPush();
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const { subjectId, chapterId, title, subjectTitle } = useLocalSearchParams<{
    subjectId?: string;
    chapterId?: string;
    title?: string;
    subjectTitle?: string;
  }>();

  const [chapter, setChapter] = useState<ChapterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [count, setCount] = useState<number | 'all'>('all');
  const [mode, setMode] = useState<PracticeMode>('practice');

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId || !chapterId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await getChaptersWithProgress(user.uid, String(subjectId));
      setChapter(rows.find((r) => r.id === chapterId) ?? null);
    } catch (e) {
      console.error('[Topic] Failed to load:', e);
      setError('Could not load this topic.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, subjectId, chapterId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const accuracyPercent = useMemo(() => {
    if (!chapter || chapter.attemptedCount === 0) return null;
    return Math.round((chapter.correctCount / chapter.attemptedCount) * 100);
  }, [chapter]);

  const effectiveCount = useMemo(() => {
    if (!chapter) return 0;
    return count === 'all' ? chapter.questionCount : Math.min(count, chapter.questionCount);
  }, [chapter, count]);

  const estimatedMinutes = useMemo(
    () => Math.max(1, Math.ceil((effectiveCount * SECONDS_PER_QUESTION) / 60)),
    [effectiveCount]
  );

  const startPractice = useCallback(async () => {
    if (!user?.uid) return;
    setSetupOpen(false);
    try {
      await useSessionStore.getState().start(
        {
          kind: 'topic',
          topic: title ?? '',
          title: title ?? chapter?.name ?? '',
          limit: count === 'all' ? undefined : count,
        },
        mode,
        user.uid
      );
      pushRoute('/question-runner');
    } catch (e) {
      console.error('[Topic] Failed to start session:', e);
    }
  }, [user, title, chapter, count, mode, pushRoute]);

  if (!user || !subjectId || !chapterId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Topic" />
        <EmptyState title="Topic not found" message="Open this screen from a chapter." style={{ flex: 1, justifyContent: 'center' }} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title={title ?? 'Topic'} subtitle={subjectTitle ?? ''} />
        <LoadingState variant="rows" count={6} />
      </SafeAreaView>
    );
  }

  if (error || !chapter) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title={title ?? 'Topic'} subtitle={subjectTitle ?? ''} />
        <ErrorState message={error ?? 'This topic could not be loaded.'} onRetry={() => setReloadToken((n) => n + 1)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader title={chapter.name} subtitle={subjectTitle ?? ''} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <StatCard value={chapter.questionCount} label="Questions" icon={<Target size={18} color={t.secondary} />} />
          <StatCard value={chapter.attemptedCount} label="Attempted" icon={<Play size={18} color={t.info} />} />
          <StatCard
            value={accuracyPercent !== null ? `${accuracyPercent}%` : '—'}
            label="Accuracy"
            tone={accuracyPercent !== null && accuracyPercent >= 70 ? 'success' : 'default'}
            icon={<Trophy size={18} color={t.warning} />}
          />
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: t.textSecondary }]}>Completion</Text>
            <Text style={[styles.progressPct, { color: t.textPrimary }]}>
              {Math.round((chapter.attemptedCount / Math.max(1, chapter.questionCount)) * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={chapter.attemptedCount / Math.max(1, chapter.questionCount)}
            height={8}
            accessibilityLabel="Topic completion"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        <AppButton label="Start Practice" onPress={() => setSetupOpen(true)} fullWidth />
      </View>

      <BottomSheet visible={setupOpen} onClose={() => setSetupOpen(false)} title="Practice setup">
        <Text style={[styles.setupLabel, { color: t.textSecondary }]}>Number of questions</Text>
        <View style={styles.countRow}>
          {COUNT_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCount(c)}
              style={[styles.countChip, { backgroundColor: count === c ? t.secondary : t.surfaceAlt, borderColor: count === c ? t.secondary : t.border }]}
            >
              <Text style={[styles.countText, { color: count === c ? t.textOnPrimary : t.textPrimary }]}>{c}</Text>
            </Pressable>
          ))}
          <Pressable
            key="all"
            onPress={() => setCount('all')}
            style={[styles.countChip, { backgroundColor: count === 'all' ? t.secondary : t.surfaceAlt, borderColor: count === 'all' ? t.secondary : t.border }]}
          >
            <Text style={[styles.countText, { color: count === 'all' ? t.textOnPrimary : t.textPrimary }]}>All</Text>
          </Pressable>
        </View>

        <Text style={[styles.setupLabel, { color: t.textSecondary, marginTop: spacing.md }]}>Mode</Text>
        <View style={styles.countRow}>
          {(['practice', 'test'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.countChip, { backgroundColor: mode === m ? t.secondary : t.surfaceAlt, borderColor: mode === m ? t.secondary : t.border }]}
            >
              <Text style={[styles.countText, { color: mode === m ? t.textOnPrimary : t.textPrimary }]}>
                {m === 'practice' ? 'Practice' : 'Test'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.setupMeta, { borderTopColor: t.border }]}>
          <Clock size={16} color={t.textSecondary} />
          <Text style={[styles.setupMetaText, { color: t.textSecondary }]}>
            {effectiveCount} questions · ~{estimatedMinutes} min
          </Text>
        </View>

        <AppButton label="Start" onPress={startPractice} fullWidth />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  progressBlock: { marginTop: spacing.md },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressLabel: { ...typography.bodySmall },
  progressPct: { ...typography.bodySmall, fontWeight: '700' },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  setupLabel: { ...typography.bodySmall, fontWeight: '600', marginBottom: spacing.xs },
  countRow: { flexDirection: 'row', gap: spacing.sm },
  countChip: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.body, fontWeight: '600' },
  setupMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginVertical: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  setupMetaText: { ...typography.bodySmall },
});