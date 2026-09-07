/**
 * Practice — Course → Subject → Chapter → Topic practice entry (rules 5, 12, 26).
 *
 * Replaced the old feature-dump screen (search + 27 topic chips + 4 special
 * chips + one infinite list). This is now a clean subject browser with real
 * progress, which routes every answer straight into the central QuestionRunner.
 *
 * Deep-links are honored so existing navigation keeps working:
 *   ?topic=<name>       → start a topic session  (Home "Continue Learning")
 *   ?reviewIds=<ids>    → start an ids session    (Mistakes, Bookmarks, QOTD)
 *   ?subjectId=<id>     → start a subject session (chapters "whole subject")
 * All three launch the ONE question engine — never a bespoke list.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calculator, BookOpen } from 'lucide-react-native';
import {
  getSubjectsWithProgress,
  SubjectStats,
} from '../../src/services/database';
import { useSessionStore } from '../../src/engine/questionSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useCourseStore } from '../../src/stores/courseStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import {
  AppCard, EmptyState, ErrorState, LoadingState, ProgressBar,
} from '../../src/components/ui';

const SUBJECT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Calculator,
  BookOpen,
};

export default function PracticeScreen() {
  const router = useRouter();
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const activeCourseId = useCourseStore((s) => s.activeCourseId);

  const { topic, reviewIds, reviewTitle, subjectId } = useLocalSearchParams<{
    topic?: string;
    reviewIds?: string;
    reviewTitle?: string;
    subjectId?: string;
  }>();
  const launchHandled = useRef(false);

  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // ---- Deep-link entry: hand a session to the central QuestionRunner -------
  useEffect(() => {
    if (launchHandled.current || !user?.uid) return;
    const title = reviewTitle ?? 'Practice';
    let source:
      | { kind: 'topic'; topic: string; title: string }
      | { kind: 'subject'; subjectId: string; title: string }
      | { kind: 'ids'; ids: string[]; title: string }
      | null = null;

    if (topic) source = { kind: 'topic', topic, title };
    else if (subjectId) source = { kind: 'subject', subjectId, title };
    else if (reviewIds) {
      const ids = reviewIds.split(',').map((s) => s.trim()).filter(Boolean);
      source = { kind: 'ids', ids, title };
    }
    if (!source) return;

    launchHandled.current = true;
    const mode = source.kind === 'ids' ? 'review' : 'practice';
    // Do not block on the async start; the runner renders its own loading.
    useSessionStore.getState().start(source as never, mode, user.uid);
    router.replace('/question-runner' as never);
  }, [topic, subjectId, reviewIds, reviewTitle, user, router]);

  // ---- Subject browser data ------------------------------------------------
  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const store = useCourseStore.getState();
      await (store.hydrated ? Promise.resolve() : store.hydrate());
      const list = await getSubjectsWithProgress(user.uid, activeCourseId ?? undefined);
      setSubjects(list);
    } catch (e) {
      console.error('[Practice] Failed to load subjects:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, activeCourseId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const openSubject = useCallback(
    (id: string, name: string) => {
      router.push(
        `/chapters?subjectId=${id}&title=${encodeURIComponent(name)}` as never
      );
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: SubjectStats }) => {
      const IconComp = SUBJECT_ICONS[item.icon] ?? Calculator;
      return (
        <AppCard onPress={() => openSubject(item.id, item.name)}>
          <View style={styles.cardRow}>
            <View style={[styles.iconBox, { backgroundColor: `${item.color}1A` }]}>
              <IconComp size={22} color={item.color} />
            </View>
            <View style={styles.cardMain}>
              <Text numberOfLines={1} style={[styles.subjectName, { color: t.textPrimary }]}>
                {item.name}
              </Text>
              <Text style={[styles.subjectMeta, { color: t.textSecondary }]}>
                {item.chapterCount} chapters · {item.questionCount} questions
              </Text>
              <View style={styles.barWrap}>
                <ProgressBar
                  progress={item.completionPercent / 100}
                  height={6}
                  color={item.color}
                />
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statPct, { color: t.secondary }]}>
                  {item.completionPercent}% complete
                </Text>
                <Text style={[styles.statAcc, { color: t.success }]}>
                  {item.accuracyPercent}% accuracy
                </Text>
              </View>
            </View>
          </View>
        </AppCard>
      );
    },
    [t, openSubject]
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        <EmptyState
          icon={<BookOpen size={40} color={t.textTertiary} />}
          title="Sign in required"
          message="Sign in to practice and track progress."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.textPrimary }]}>Practice</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Choose a subject to start practicing
        </Text>
      </View>
      <FlatList
        data={subjects}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        ListEmptyComponent={
          loading ? (
            <LoadingState variant="cards" count={2} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />
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
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.screenX, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.pageTitle, fontWeight: '800' },
  subtitle: { ...typography.bodySmall, marginTop: 2 },
  list: { padding: spacing.screenX, paddingTop: spacing.xs, gap: spacing.sm, paddingBottom: spacing.xxl },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  iconBox: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1, minWidth: 0 },
  subjectName: { ...typography.cardTitle, fontWeight: '700' },
  subjectMeta: { ...typography.caption, marginTop: 2 },
  barWrap: { marginTop: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  statPct: { ...typography.caption, fontWeight: '600' },
  statAcc: { ...typography.caption, fontWeight: '600' },
});
