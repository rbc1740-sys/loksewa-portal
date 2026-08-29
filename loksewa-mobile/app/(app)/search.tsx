/**
 * Search — a real product search, not a database box (rule 17).
 * Debounced text over question text/topic, topic filter chips, bookmarked-only
 * toggle, and explicit loading / empty / error / clear / retry states. A result
 * opens in the central QuestionRunner (single question) so it reuses the engine.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bookmark, Search as SearchIcon } from 'lucide-react-native';
import { searchQuestions, getAllTopics, getBookmarkQuestionIds, type Question } from '../../src/services/database';
import { useSessionStore } from '../../src/engine/questionSession';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import { AppCard, EmptyState, ErrorState, LoadingState, ScreenHeader, SearchBar, FilterChips } from '../../src/components/ui';

export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const start = useSessionStore((s) => s.start);

  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [results, setResults] = useState<Question[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        setTopics(await getAllTopics());
      } catch (e) {
        console.error('[Search] topics failed', e);
      }
    })();
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    if (!query.trim() && !bookmarkedOnly) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let list: Question[];
      if (bookmarkedOnly) {
        const ids = await getBookmarkQuestionIds(user.uid);
        setBookmarkIds(new Set(ids));
        list = await searchQuestions(query.trim() || '*', 300);
        list = list.filter((q) => ids.includes(q.id));
      } else {
        setBookmarkIds(new Set(await getBookmarkQuestionIds(user.uid)));
        list = await searchQuestions(query.trim(), 300);
      }
      if (topic) list = list.filter((q) => q.topic === topic);
      setResults(list);
    } catch (e) {
      console.error('[Search] failed:', e);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, query, topic, bookmarkedOnly]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load, reloadToken]);

  const openQuestion = useCallback(
    async (q: Question) => {
      if (!user?.uid) return;
      await start({ kind: 'ids', ids: [q.id], title: 'Search result' }, 'review', user.uid);
      router.replace('/question-runner' as never);
    },
    [user, start, router]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScreenHeader title="Search" subtitle="Questions, topics & bookmarks" />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search questions or topics…" debounceMs={300} />
      <View style={styles.filters}>
        <FilterChips
          chips={[
            { key: 'bookmarked', label: '🔖 Bookmarked' },
            ...topics.map((tp) => ({ key: tp, label: tp })),
          ]}
          selectedKey={bookmarkedOnly ? 'bookmarked' : topic}
          onSelect={(key) => {
            if (key === 'bookmarked') {
              setBookmarkedOnly(true);
              setTopic(null);
            } else {
              setTopic(key);
              setBookmarkedOnly(false);
            }
          }}
          showReset={!!topic || bookmarkedOnly}
          onReset={() => {
            setTopic(null);
            setBookmarkedOnly(false);
          }}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <LoadingState variant="rows" count={4} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadToken((n) => n + 1)} />
          ) : (
            <EmptyState
              icon={<SearchIcon size={40} color={t.textTertiary} />}
              title={query.trim() || bookmarkedOnly ? 'No matches' : 'Search the question bank'}
              message={query.trim() || bookmarkedOnly ? 'Try a different term or clear your filters.' : 'Type a topic or phrase, then tap a result to open the question.'}
              actionLabel={query.trim() || bookmarkedOnly ? 'Clear' : undefined}
              onAction={() => {
                setQuery('');
                setTopic(null);
                setBookmarkedOnly(false);
              }}
            />
          )
        }
        renderItem={({ item }) => (
          <AppCard onPress={() => openQuestion(item)}>
            <View style={styles.resultRow}>
              <View style={styles.resultMain}>
                <Text numberOfLines={2} style={[styles.resultQ, { color: t.textPrimary }]}>{item.question}</Text>
                <Text style={[styles.resultTopic, { color: t.textSecondary }]}>
                  {item.topic}{bookmarkIds.has(item.id) ? '  •  🔖' : ''}
                </Text>
              </View>
              {bookmarkIds.has(item.id) ? <Bookmark size={16} color={t.warning} fill={t.warning} /> : null}
            </View>
          </AppCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  filters: { marginTop: spacing.xs },
  list: { padding: spacing.screenX, paddingTop: spacing.xs, gap: spacing.sm, paddingBottom: spacing.xxl },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultMain: { flex: 1, minWidth: 0 },
  resultQ: { ...typography.body, fontWeight: '500' },
  resultTopic: { ...typography.caption, marginTop: 4 },
});
