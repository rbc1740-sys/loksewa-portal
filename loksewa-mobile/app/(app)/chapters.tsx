/**
 * Chapters — Subject → Chapters browser (master-prompt rules 7/26).
 * Statistics come from getChaptersWithProgress (real user_progress joined via
 * question_hierarchy) — never hard-coded numbers.
 *
 * Progressive disclosure: chapter rows open the dedicated Topic detail screen
 * (topic.tsx) where the user configures and starts practice — the chapter row
 * itself never embeds controls. Uses Pressable (not onTouchEnd) so the cards
 * are accessible and never double-fire during scroll.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { CheckCircle2, CircleDashed, ListChecks, PlayCircle } from 'lucide-react-native';
import {
  getChaptersWithProgress,
  ChapterStats,
} from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { useTypedPush } from '../../src/utils/navigation';
import { spacing, radius, typography } from '../../src/constants/theme';
import {
  AppButton,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ScreenHeader,
} from '../../src/components/ui';

interface ChapterRow extends ChapterStats {
  status: 'not-started' | 'in-progress' | 'completed';
}

export default function ChaptersScreen() {
  const pushRoute = useTypedPush();
  const t = useTheme();
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
    pushRoute('/practice', { subjectId: String(subjectId) });
  }, [pushRoute, subjectId]);

  const openChapter = useCallback(
    (chapter: ChapterRow) => {
      // Progressive disclosure (rule 26): rows open the topic detail screen,
      // practice configuration happens there.
      pushRoute('/topic', {
        subjectId: String(subjectId ?? ''),
        chapterId: chapter.id,
        title: chapter.name,
        subjectTitle: title ?? '',
      });
    },
    [pushRoute, subjectId, title]
  );

  const totalQuestions = useMemo(
    () => (chapters ?? []).reduce((sum, c) => sum + c.questionCount, 0),
    [chapters]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChapterRow }) => {
      const Icon =
        item.status === 'completed'
          ? CheckCircle2
          : item.status === 'in-progress'
            ? PlayCircle
            : CircleDashed;
      const iconColor =
        item.status === 'completed'
          ? t.success
          : item.status === 'in-progress'
            ? t.secondary
            : t.textTertiary;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}
          accessibilityHint="View topic progress and start practice"
          onPress={() => openChapter(item)}
          style={({ pressed }) => [
            styles.chapterCard,
            { backgroundColor: t.surface, borderColor: t.border },
            item.status !== 'not-started' && {
              borderLeftWidth: 3,
              borderLeftColor: t.secondary,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={styles.statusIcon}>
              <Icon size={22} color={iconColor} />
            </View>
            <View style={styles.rowText}>
              <Text numberOfLines={2} style={[styles.chapterName, { color: t.textPrimary }]}>
                {item.name}
              </Text>
              <Text style={[styles.chapterMeta, { color: t.textSecondary }]}>
                {item.questionCount} questions
                {item.attemptedCount > 0
                  ? ` · ${item.attemptedCount} attempted · ${Math.round(
                      (item.correctCount / item.attemptedCount) * 100
                    )}% accuracy`
                  : ''}
              </Text>
            </View>
            {item.attemptedCount > 0 ? (
              <Text style={[styles.pct, { color: t.textPrimary }]}>
                {Math.round(item.completionPercent)}%
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [openChapter, t]
  );

  if (!user || !subjectId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
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
    <SafeAreaView
      style={[styles.safe, { backgroundColor: t.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader
        title={title ?? 'Chapters'}
        subtitle={`${totalQuestions} questions`}
        right={
          <IconButton accessibilityLabel="Practice entire subject" onPress={openWholeSubject}>
            <ListChecks size={20} color={t.secondary} />
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
              icon={<ListChecks size={40} color={t.textTertiary} />}
              title="No questions yet"
              message="This subject has no questions in the current question bank."
            />
          )
        }
      />
      {!error && chapters && chapters.length > 0 && (
        <View style={[styles.footerBar, { borderTopColor: t.border, backgroundColor: t.surface }]}>
          <AppButton label="Practice all chapters" onPress={openWholeSubject} fullWidth />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: {
    padding: spacing.screenX,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  chapterCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: { width: 32, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  chapterName: {
    ...typography.body,
    fontWeight: '600',
  },
  chapterMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  pct: {
    ...typography.cardTitle,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 46,
    textAlign: 'right',
  },
  footerBar: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
