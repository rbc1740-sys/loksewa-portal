/**
 * Chapters — Subject → Chapters browser. All stats come from
 * getChaptersWithProgress (real user_progress joined via question_hierarchy).
 * Both entry points reuse the existing stable practice engine:
 *   • chapter → practice.tsx?topic=<chapter topic name>
 *   • whole subject → practice.tsx?subject=<subjectId>
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, CircleDashed, ListChecks } from 'lucide-react-native';
import {
  getChaptersWithProgress,
  ChapterStats,
} from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { themes, spacing, radius, typography } from '../../src/constants/theme';
import {
  AppButton,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ProgressBar,
  ScreenHeader,
} from '../../src/components/ui';

interface ChapterRow extends ChapterStats {
  status: 'not-started' | 'in-progress' | 'completed';
}

export default function ChaptersScreen() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const { subjectId, title } = useLocalSearchParams<{
    subjectId?: string;
    title?: string;
  }>();

  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId) return;
    setError(null);
    try {
      const rows = await getChaptersWithProgress(user.uid, subjectId);
      const mapped: ChapterRow[] = rows.map(r => ({
        ...r,
        status:
          r.attemptedCount === 0
            ? 'not-started'
            : r.completionPercent >= 100
              ? 'completed'
              : 'in-progress',
      }));
      setChapters(mapped);
    } catch (e) {
      console.error('[Chapters] Failed to load:', e);
      setError('Could not load chapters for this subject.');
    }
  }, [user?.uid, subjectId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const openWholeSubject = useCallback(() => {
    if (!subjectId) return;
    router.push({ pathname: '/practice', params: { subjectId: String(subjectId) } });
  }, [router, subjectId]);

  const openChapter = useCallback(
    (chapter: ChapterRow) => {
      // Catalog chapters own exactly one bundled topic each — reuse it.
      router.push({ pathname: '/practice', params: { topic: chapter.name } });
    },
    [router]
  );

  const totalQuestions = useMemo(
    () => (chapters ?? []).reduce((sum, c) => sum + c.questionCount, 0),
    [chapters]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChapterRow }) => {
      const done = item.status === 'completed';
      const started = item.status !== 'not-started';
      return (
        <View
          style={[styles.chapterCard, started && styles.chapterCardStarted]}
          accessibilityRole="button"
          accessibilityLabel={`Practice ${item.name}: ${item.attemptedCount} of ${item.questionCount} attempted`}
          onTouchEnd={() => openChapter(item)}
        >
          <View style={styles.rowMain}>
            <View style={styles.statusIcon}>
              {done ? (
                <CheckCircle2 size={20} color={themes.light.success} />
              ) : started ? (
                <ListChecks size={20} color={themes.light.secondary} />
              ) : (
                <CircleDashed size={20} color={themes.light.textTertiary} />
              )}
            </View>
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={styles.chapterName}>{item.name}</Text>
              <Text style={styles.chapterMeta}>
                {item.attemptedCount} / {item.questionCount} attempted · {item.accuracyPercent}% accuracy
              </Text>
            </View>
            <Text style={[styles.pct, done && styles.pctDone]}>{item.completionPercent}%</Text>
          </View>
          <ProgressBar
            progress={item.completionPercent / 100}
            height={5}
            color={done ? themes.light.success : themes.light.secondary}
          />
        </View>
      );
    },
    [openChapter]
  );

  if (!user || !subjectId) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Chapters" />
        <EmptyState
          title="Subject not found"
          message="Open this screen from a subject."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={title ?? 'Chapters'}
        subtitle={`${totalQuestions} questions`}
        right={
          <IconButton
            accessibilityLabel="Practice entire subject"
            onPress={openWholeSubject}
          >
            <ListChecks size={20} color={themes.light.secondary} />
          </IconButton>
        }
      />
      <FlatList
        data={chapters ?? []}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListEmptyComponent={
          chapters === null ? (
            <LoadingState variant="rows" count={8} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken(n => n + 1)} />
          ) : (
            <EmptyState
              icon={<ListChecks size={40} color={themes.light.textTertiary} />}
              title="No questions yet"
              message="This subject has no questions in the current question bank."
            />
          )
        }
      />
      {!error && chapters && chapters.length > 0 && (
        <View style={styles.footerBar}>
          <AppButton label="Practice all chapters" onPress={openWholeSubject} fullWidth />
        </View>
      )}
    </SafeAreaView>
  );
}

const t = themes.light;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.background,
  },
  list: {
    padding: spacing.screenX,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  chapterCard: {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chapterCardStarted: {
    borderLeftWidth: 3,
    borderLeftColor: t.secondary,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    width: 32,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  chapterName: {
    ...typography.body,
    fontWeight: '600',
    color: t.textPrimary,
  },
  chapterMeta: {
    ...typography.caption,
    color: t.textSecondary,
    marginTop: 2,
  },
  pct: {
    ...typography.cardTitle,
    fontWeight: '700',
    color: t.secondary,
    fontVariant: ['tabular-nums'],
    minWidth: 46,
    textAlign: 'right',
  },
  pctDone: {
    color: t.success,
  },
  footerBar: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.border,
    backgroundColor: t.surface,
  },
});
