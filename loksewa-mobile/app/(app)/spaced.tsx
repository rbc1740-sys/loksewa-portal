/**
 * Review — Smart spaced-repetition dashboard (rules 15/31/30).
 *
 * Shows real SM-2 stats (due / learning / review / mastered) and launches the
 * SAME central QuestionRunner for every review session — no bespoke answering
 * loop. Correcting a previously-weak question updates its SR stage and
 * mistakes status automatically via answerService.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Brain, CheckCircle2, Clock, Flame, Layers, Play, RefreshCw, Target } from 'lucide-react-native';
import { getSRStats, getQuestionsByStage } from '../../src/services/database';
import { useSessionStore } from '../../src/engine/questionSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import { AppButton, EmptyState, ErrorState, LoadingState } from '../../src/components/ui';

const STAGES = [
  { key: 'due', label: 'Due now' },
  { key: 'learning', label: 'Learning' },
  { key: 'review', label: 'Review' },
  { key: 'mastered', label: 'Mastered' },
] as const;

export default function SpacedReviewScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const start = useSessionStore((s) => s.start);

  const [srStats, setSrStats] = useState({ due: 0, learning: 0, review: 0, mastered: 0 });
  const [dueQ, setDueQ] = useState<{ topic: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      setSrStats(await getSRStats(user.uid));
      const due = await getQuestionsByStage(user.uid, 'due');
      const byTopic = new Map<string, number>();
      for (const d of due) byTopic.set(d.topic, (byTopic.get(d.topic) ?? 0) + 1);
      setDueQ([...byTopic.entries()].map(([topic, count]) => ({ topic, count })));
    } catch (e) {
      console.error('[Review] load failed:', e);
      setError('Could not load your review data.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const startStage = useCallback(
    async (stage: string, label: string) => {
      if (!user?.uid) return;
      setStarting(stage);
      try {
        await start({ kind: 'stage', stage, title: `Review: ${label}` }, 'review', user.uid);
        router.replace('/question-runner' as never);
      } catch (e) {
        console.error('[Review] start failed:', e);
      } finally {
        setStarting(null);
      }
    },
    [user, start, router]
  );

  const iconFor = (key: string) => {
    switch (key) {
      case 'due': return <Flame size={18} color={t.warning} />;
      case 'learning': return <Layers size={18} color={t.info} />;
      case 'review': return <RefreshCw size={18} color={t.secondary} />;
      default: return <CheckCircle2 size={18} color={t.success} />;
    }
  };


  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <EmptyState
          icon={<Brain size={40} color={t.textTertiary} />}
          title="Sign in required"
          message="Sign in to see your spaced review."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={STAGES}
        keyExtractor={(s) => s.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.textPrimary }]}>Review</Text>
              <Text style={[styles.subtitle, { color: t.textSecondary }]}>
                Smart spaced repetition keeps weak areas fresh
              </Text>
            </View>
            <View style={[styles.hero, { backgroundColor: t.primaryLight }]}>
              <View style={styles.heroRow}>
                <Clock size={20} color={t.primaryDark} />
                <View style={styles.heroText}>
                  <Text style={[styles.heroValue, { color: t.primaryDark }]}>{srStats.due}</Text>
                  <Text style={[styles.heroLabel, { color: t.primaryDark }]}>questions due now</Text>
                </View>
              </View>
              <AppButton
                label={starting === 'due' ? 'Starting…' : 'Start Review'}
                onPress={() => startStage('due', 'Due now')}
                disabled={srStats.due === 0 || !!starting}
                fullWidth
              />
            </View>
            {error ? <ErrorState message={error} onRetry={() => load()} /> : null}
            <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Your progress</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statKey = item.key as keyof typeof srStats;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Review ${item.label}: ${srStats[statKey]} questions`}
              onPress={() => startStage(item.key, item.label)}
              style={({ pressed }) => [
                styles.stageRow,
                { backgroundColor: t.surface, borderColor: t.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.stageIcon, { backgroundColor: t.surfaceAlt }]}>{iconFor(item.key)}</View>
              <View style={styles.stageMain}>
                <Text style={[styles.stageLabel, { color: t.textPrimary }]}>{item.label}</Text>
                <Text style={[styles.stageMeta, { color: t.textSecondary }]}>
                  {srStats[statKey]} question{srStats[statKey] === 1 ? '' : 's'}
                </Text>
              </View>
              <Play size={18} color={t.textTertiary} />
            </Pressable>
          );
        }}
        ListFooterComponent={
          loading ? (
            <LoadingState variant="cards" count={1} />
          ) : dueQ.length > 0 ? (
            <View>
              <View style={styles.dueHeader}>
                <Target size={16} color={t.textSecondary} />
                <Text style={[styles.dueTitle, { color: t.textPrimary }]}>Due by topic</Text>
              </View>
              {dueQ.map((d) => (
                <View key={d.topic} style={[styles.dueRow, { borderColor: t.border }]}>
                  <Text numberOfLines={1} style={[styles.dueTopic, { color: t.textPrimary }]}>{d.topic}</Text>
                  <Text style={[styles.dueCount, { color: t.secondary }]}>{d.count}</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={<Brain size={36} color={t.textTertiary} />}
              title="All caught up!"
              message="No review questions yet. Keep practicing a topic to build your queue."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.screenX, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.md, marginBottom: spacing.sm },
  title: { ...typography.pageTitle, fontWeight: '800' },
  subtitle: { ...typography.bodySmall, marginTop: 2 },
  hero: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroText: { flex: 1 },
  heroValue: { ...typography.cardTitle, fontWeight: '800' },
  heroLabel: { ...typography.caption },
  sectionLabel: { ...typography.bodySmall, fontWeight: '700', marginVertical: spacing.sm },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.sm, marginBottom: spacing.sm },
  stageIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  stageMain: { flex: 1 },
  stageLabel: { ...typography.body, fontWeight: '600' },
  stageMeta: { ...typography.caption },
  dueHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  dueTitle: { ...typography.bodySmall, fontWeight: '700' },
  dueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  dueTopic: { flex: 1, ...typography.bodySmall, paddingRight: spacing.sm },
  dueCount: { ...typography.bodySmall, fontWeight: '700' },
});

