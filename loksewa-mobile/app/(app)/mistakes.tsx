/**
 * Mistakes — every question whose latest attempt was wrong (rule 18).
 * Groups come from summarizeMistakes (pure) over getWrongQuestions rows;
 * counts therefore always reflect real attempts and self-heal when the user
 * later answers correctly.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, RefreshCcw } from 'lucide-react-native';
import { getWrongQuestions } from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { summarizeMistakes, MistakeSummary } from '../../src/utils/mistakes';
import { spacing, radius, typography, type AppTheme } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import {
  AppCard,
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
  StatCard,
} from '../../src/components/ui';

export default function MistakesScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  const [wrong, setWrong] = useState<{ id: string; topic?: string | null }[] | null>(null);
  const [summary, setSummary] = useState<MistakeSummary>({
    total: 0,
    bySubject: [],
    byChapter: [],
    unmapped: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const questions = await getWrongQuestions(user.uid);
      setWrong(questions);
      setSummary(summarizeMistakes(questions));
    } catch (e) {
      console.error('[Mistakes] Failed to load:', e);
      setError('Could not load your mistake pool.');
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const openAll = useCallback(() => {
    if (!wrong?.length) return;
    router.push({
      pathname: '/practice',
      params: { reviewIds: wrong.map(q => q.id).join(','), reviewTitle: 'All mistakes' },
    });
  }, [router, wrong]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Mistakes" />
        <EmptyState
          icon={<AlertTriangle size={40} color={t.textTertiary} />}
          title="Sign in required"
          message="Sign in to build your mistake pool."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  const openGroupByIds = useCallback(
    (title: string, ids: string[]) => {
      if (ids.length === 0) return;
      router.push({ pathname: '/practice', params: { reviewIds: ids.join(','), reviewTitle: title } });
    },
    [router]
  );

  const renderGroup = (
    label: string,
    groups: MistakeSummary['bySubject']
  ) => {
    if (groups.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {groups.map(g => (
          <AppCard
            key={g.key}
            onPress={() => openGroupByIds(`${g.display} mistakes`, g.questionIds)}
            style={styles.groupCard}
          >
            <View style={styles.groupRow}>
              <AlertTriangle size={18} color={t.warning} />
              <Text numberOfLines={1} style={styles.groupName}>{g.display}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{g.count}</Text>
              </View>
              <ChevronRight size={18} color={t.textTertiary} />
            </View>
          </AppCard>
        ))}
      </View>
    );
  };

  const loading = wrong === null && !error;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Mistakes" subtitle="Questions you got wrong — answer correctly to clear them" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingState variant="spinner" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadToken(n => n + 1)} />
        ) : wrong!.length === 0 ? (
          <EmptyState
            icon={<RefreshCcw size={40} color={t.success} />}
            title="No mistakes right now"
            message="Every question you attempted recently was correct. Keep going!"
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Total"
                value={String(summary.total)}
                tone="error"
                icon={<AlertTriangle size={16} color={t.error} />}
              />
              <StatCard
                label="Subjects"
                value={String(summary.bySubject.length)}
                tone="warning"
              />
              <StatCard
                label="Chapters"
                value={String(summary.byChapter.length)}
              />
            </View>

            <View style={[styles.practiceAll, { backgroundColor: t.primaryLight }]}>
              <AppButton label={`Practice all ${summary.total}`} onPress={openAll} fullWidth />
            </View>

            {renderGroup('By subject', summary.bySubject)}
            {renderGroup('By chapter', summary.byChapter)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


const makeStyles = (t: AppTheme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.background,
  },
  scroll: {
    padding: spacing.screenX,
    paddingBottom: spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  practiceAll: {
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
    color: t.textPrimary,
    marginBottom: spacing.sm,
  },
  groupCard: {
    marginBottom: spacing.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupName: {
    ...typography.body,
    fontWeight: '600',
    color: t.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  countBadge: {
    backgroundColor: t.errorSoft,
    borderRadius: radius.pill,
    minWidth: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
    color: t.error,
    fontVariant: ['tabular-nums'],
  },
});
