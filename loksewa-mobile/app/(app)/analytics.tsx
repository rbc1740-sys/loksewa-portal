/**
 * Analytics — performance dashboard (rule 18/31).
 * Every number traces to the SAME persisted data as Home/Subjects/Profile —
 * user_progress joined through question_hierarchy and the SM-2 SR table.
 * No per-screen recomputation of the same figure.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brain, Flame, Target, TrendingUp, Trophy, XCircle } from 'lucide-react-native';
import { getAttemptStats, getSubjectsWithProgress, getSRStats, getUserProfile } from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import { EmptyState, LoadingState, ScreenHeader, StatCard, ProgressBar } from '../../src/components/ui';

export default function AnalyticsScreen() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<{
    attempted: number; correct: number; wrong: number; xp: number; streak: number;
    rank: string; due: number; subjects: { name: string; accuracy: number; completion: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.uid) return;
      try {
        const [attempts, profile, sr, subjects] = await Promise.all([
          getAttemptStats(user.uid),
          getUserProfile(user.uid),
          getSRStats(user.uid),
          getSubjectsWithProgress(user.uid),
        ]);
        if (!alive) return;
        setData({
          attempted: attempts.attempted,
          correct: attempts.correct,
          wrong: attempts.wrong,
          xp: profile?.xp ?? 0,
          streak: profile?.streak_days ?? 0,
          rank: profile ? (profile.rank_sub ? `${profile.rank_tier} ${profile.rank_sub}` : profile.rank_tier) : 'Unranked',
          due: sr.due,
          subjects: subjects.map((s) => ({ name: s.name, accuracy: s.accuracyPercent, completion: s.completionPercent })),
        });
      } catch (e) {
        console.error('[Analytics] load failed:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.uid]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Analytics" />
        <EmptyState title="Sign in required" message="Sign in to see your performance." style={{ flex: 1, justifyContent: 'center' }} />
      </SafeAreaView>
    );
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Analytics" />
        <LoadingState variant="rows" count={6} />
      </SafeAreaView>
    );
  }

  const accuracy = data.attempted ? Math.round((data.correct / data.attempted) * 100) : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader title="Analytics" subtitle="Your performance at a glance" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <StatCard value={accuracy} label="Accuracy %" tone="success" icon={<TrendingUp size={18} color={t.success} />} />
          <StatCard value={data.attempted} label="Attempted" icon={<Target size={18} color={t.secondary} />} />
          <StatCard value={data.wrong} label="Wrong" tone="error" icon={<XCircle size={18} color={t.error} />} />
        </View>
        <View style={styles.statsRow}>
          <StatCard value={data.xp} label="XP" icon={<Trophy size={18} color={t.warning} />} />
          <StatCard value={data.streak} label="Day streak" icon={<Flame size={18} color={t.error} />} />
          <StatCard value={data.due} label="Due review" icon={<Brain size={18} color={t.info} />} />
        </View>

        <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Subject accuracy</Text>
        {data.subjects.length === 0 ? (
          <EmptyState icon={<Target size={32} color={t.textTertiary} />} title="No subject data yet" message="Answer some questions to see subject-level performance here." />
        ) : data.subjects.map((s) => (
          <View key={s.name} style={[styles.subjectRow, { borderColor: t.border }]}>
            <View style={styles.subjectHead}>
              <Text numberOfLines={1} style={[styles.subjectName, { color: t.textPrimary }]}>{s.name}</Text>
              <Text style={[styles.subjectPct, { color: t.secondary }]}>{s.accuracy}%</Text>
            </View>
            <ProgressBar progress={s.completion / 100} height={6} accessibilityLabel={`${s.name} completion`} />
            <Text style={[styles.subjectMeta, { color: t.textTertiary }]}>{s.completion}% complete</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  sectionLabel: { ...typography.bodySmall, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  subjectRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  subjectName: { ...typography.body, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  subjectPct: { ...typography.bodySmall, fontWeight: '700' },
  subjectMeta: { ...typography.caption, marginTop: 4 },
});
