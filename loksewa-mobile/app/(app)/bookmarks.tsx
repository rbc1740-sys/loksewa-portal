/**
 * Bookmarks — global persistent bookmark manager (rule 17).
 * Search + subject filtering over real bookmark rows; tapping a row opens the
 * question in the practice engine; removal is optimistic with rollback.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bookmark as BookmarkIcon, Search, Trash2 } from 'lucide-react-native';
import {
  getBookmarkedQuestions,
  toggleBookmark,
  Question,
} from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { getTopicPath } from '../../src/constants/courses';
import { spacing, radius, typography, type AppTheme } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';
import {
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  ScreenHeader,
} from '../../src/components/ui';

export default function BookmarksScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  const [all, setAll] = useState<Question[] | null>(null);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const rows = await getBookmarkedQuestions(user.uid, 500);
      setAll(rows);
    } catch (e) {
      console.error('[Bookmarks] Failed to load:', e);
      setError('Could not load your bookmarks.');
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const subjects = useMemo(() => {
    const names = new Set<string>();
    for (const q of all ?? []) {
      const path = q.topic ? getTopicPath(q.topic) : null;
      if (path) names.add(path.subjectName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [all]);

  // Derived list — recomputed only when inputs change; never mutates `all`,
  // so filtering/removing one item cannot rebuild or reorder unrelated rows.
  const visible = useMemo(() => {
    let rows = all ?? [];
    if (subjectFilter) {
      rows = rows.filter(q => {
        const path = q.topic ? getTopicPath(q.topic) : null;
        return path?.subjectName === subjectFilter;
      });
    }
    const needle = query.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        q =>
          (q.question ?? '').toLowerCase().includes(needle) ||
          (q.topic ?? '').toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [all, query, subjectFilter]);

  const removeBookmark = useCallback(
    async (questionId: string) => {
      if (!user?.uid) return;
      // Optimistic removal with rollback on failure.
      const prev = all;
      setAll(rows => rows?.filter(r => r.id !== questionId) ?? null);
      try {
        await toggleBookmark(user.uid, questionId);
      } catch (e) {
        console.error('[Bookmarks] Failed to remove:', e);
        setAll(prev ?? null);
        setError('Could not remove that bookmark.');
      }
    },
    [user?.uid, all]
  );

  const renderItem = useCallback(
    ({ item }: { item: Question }) => (
      <View
        style={styles.rowCard}
        accessibilityRole="button"
        accessibilityLabel="Open bookmarked question"
        onTouchEnd={() =>
          router.push({ pathname: '/practice', params: { reviewIds: item.id, reviewTitle: 'Bookmark' } })
        }
      >
        <View style={styles.rowText}>
          {!!item.topic && <Text style={styles.rowTopic}>{item.topic}</Text>}
          <Text numberOfLines={2} style={styles.rowQuestion}>{item.question}</Text>
        </View>
        <IconButton
          accessibilityLabel="Remove bookmark"
          size={38}
          onPress={() => removeBookmark(item.id)}
        >
          <Trash2 size={18} color={t.error} />
        </IconButton>
      </View>
    ),
    [router, removeBookmark]
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Bookmarks" />
        <EmptyState
          icon={<BookmarkIcon size={40} color={t.textTertiary} />}
          title="Sign in required"
          message="Sign in to keep bookmarks across devices."
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Bookmarks"
        subtitle={`${visible.length} saved${subjectFilter ? ` · ${subjectFilter}` : ''}`}
      />

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: t.surfaceMuted }]}>
          <Search size={18} color={t.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bookmarks"
            placeholderTextColor={t.textTertiary}
            style={[styles.searchInput, { color: t.textPrimary }]}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search bookmarks"
          />
        </View>
      </View>

      {subjects.length > 0 && (
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            data={['All', ...subjects]}
            keyExtractor={s => s}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = subjectFilter === item || (item === 'All' && !subjectFilter);
              return (
                <Text
                  onPress={() => setSubjectFilter(item === 'All' ? null : item)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                    { backgroundColor: active ? t.secondary : t.surface },
                  ]}
                  accessibilityRole="button"
                >
                  {item}
                </Text>
              );
            }}
          />
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={q => q.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListEmptyComponent={
          all === null ? (
            <LoadingState variant="rows" count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken(n => n + 1)} />
          ) : (
            <EmptyState
              icon={<BookmarkIcon size={40} color={t.textTertiary} />}
              title={query || subjectFilter ? 'No matching bookmarks' : 'No bookmarks yet'}
              message={
                query || subjectFilter
                  ? 'Try clearing the search or filter.'
                  : 'Tap the bookmark icon on any question to save it here.'
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}


const makeStyles = (t: AppTheme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.background,
  },
  searchRow: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    height: spacing.controlHeight - 4,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.bodySmall,
  },
  filterRow: {
    paddingBottom: spacing.xs,
  },
  filterChip: {
    ...typography.caption,
    fontWeight: '600',
    color: t.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    marginHorizontal: spacing.xxs,
    overflow: 'hidden',
  },
  filterChipActive: {
    color: '#FFFFFF',
    borderColor: t.secondary,
  },
  list: {
    padding: spacing.screenX,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: spacing.md,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTopic: {
    ...typography.micro,
    fontWeight: '700',
    color: t.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  rowQuestion: {
    ...typography.bodySmall,
    color: t.textPrimary,
  },
});
