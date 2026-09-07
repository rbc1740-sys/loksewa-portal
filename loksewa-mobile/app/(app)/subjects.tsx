/**
 * Subjects — Course → Subjects browser (master-prompt rules 4/7).
 * Statistics come from getSubjectsWithProgress (real user_progress rows joined
 * through question_hierarchy) — never hard-coded numbers.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calculator, BookOpen } from 'lucide-react-native';
import {
  getSubjectsWithProgress,
  SubjectStats,
} from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { useCourseStore } from '../../src/stores/courseStore';
import { useTypedPush } from '../../src/utils/navigation';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import {
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  ScreenHeader,
} from '../../src/components/ui';

const SUBJECT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Calculator,
  BookOpen,
};

export default function SubjectsScreen() {
  const router = useRouter();
  const pushRoute = useTypedPush();
  const t = useTheme();
  const user = useAuthStore(s => s.user);
  const activeCourseId = useCourseStore(s => s.activeCourseId);

  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      // Guarantee the catalog/hierarchy exists before querying (idempotent).
      const store = useCourseStore.getState();
      await (store.hydrated ? Promise.resolve() : store.hydrate());
      const list = await getSubjectsWithProgress(user.uid, activeCourseId ?? undefined);
      setSubjects(list);
    } catch (e) {
      console.error('[Subjects] Failed to load:', e);
      setError('Could not load your subjects.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, activeCourseId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const renderItem = useCallback(
    ({ item }: { item: SubjectStats }) => {
      const IconComp = SUBJECT_ICONS[item.icon] ?? Calculator;
      return (
        <AppCard onPress={() => pushRoute('/chapters?subjectId=' + item.id + '&title=' + encodeURIComponent(item.name))}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: `${item.color}1A` }]}>
              <IconComp size={22} color={item.color} />
            </View>
            <View style={styles.cardMain}>
              <Text numberOfLines={1} style={[styles.subjectName, { color: t.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.subjectMeta, { color: t.textSecondary }]}>
                {item.chapterCount} chapters · {item.questionCount} questions
              </Text>
              <View style={styles.barWrap}>
                <ProgressBar progress={item.completionPercent / 100} height={6} color={item.color} />
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statPct, { color: t.secondary }]}>{item.completionPercent}% complete</Text>
                <Text style={[styles.statAcc, { color: t.success }]}>{item.accuracyPercent}% accuracy</Text>
              </View>
            </View>
          </View>
        </AppCard>
      );
    },
    [router, t]
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <ScreenHeader title="Subjects" />
        <EmptyState
          icon={<BookOpen size={40} color={t.textTertiary} />}
          title="Sign in required"
          message="Sign in to track subject progress."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Subjects"
        subtitle="Your progress by course subject"
      />
      <FlatList
        data={subjects}
        keyExtractor={s => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        ListEmptyComponent={
          loading ? (
            <LoadingState variant="cards" count={2} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken(n => n + 1)} />
          ) : (
            <EmptyState
              icon={<BookOpen size={40} color={t.textTertiary} />}
              title="No subjects yet"
              message="The question bank for this course hasn't finished loading. Pull down to retry or restart the app once."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    padding: spacing.screenX,
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  subjectName: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  subjectMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  barWrap: {
    marginTop: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  statPct: {
    ...typography.caption,
    fontWeight: '600',
  },
  statAcc: {
    ...typography.caption,
    fontWeight: '600',
  },
});

