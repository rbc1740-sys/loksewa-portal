/**
 * Practice Screen - Objective MCQ practice with list view
 *
 * Session rules: the question array is frozen per filter/search selection;
 * answering, bookmarking, flagging or re-rendering NEVER recreates or
 * reshuffles it. Selecting an answer updates only that card — no auto-scroll,
 * no auto-advance, no layout jump. Answers flow through answerService.
 */
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getAllTopics, getQuestionsByTopic, getAllQuestions, searchQuestions,
  getQuestionsByStage, getBookmarkedQuestions, getFlaggedQuestions,
  getBookmarkQuestionIds, getFlaggedQuestionIds,
  getQuestionsBySubject, getWrongQuestions, getQuestionsByIds,
  toggleBookmark as dbToggleBookmark, toggleWeakPoint as dbToggleWeakPoint,
  Question,
} from '../../src/services/database';
import { recordAnswer } from '../../src/services/answerService';
import { QuestionCard } from '../../src/components/QuestionCard';
import { useAuthStore } from '../../src/stores/authStore';
import { SearchBar, FilterChips, EmptyState, useToast } from '../../src/components/ui';

type FilterMode = 'all' | 'due' | 'weak' | 'bookmarked' | 'mistakes';
const PAGE_SIZE = 20;

export default function PracticeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const {
    topic: initialTopic,
    subjectId: subjectParam,
    subjectTitle: subjectTitleParam,
    reviewIds: reviewIdsParam,
    reviewTitle: reviewTitleParam,
  } = useLocalSearchParams<{
    topic?: string;
    subjectId?: string;
    subjectTitle?: string;
    /** Comma-separated question ids from Mistakes drill-down (rule 18). */
    reviewIds?: string;
    reviewTitle?: string;
  }>();

  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Derived session scope. When deep-linked into a subject or a review set we
  // keep the picker at 'all' so leaves/clear operate on the CURRENT session
  // instead of silently switching the user back to the whole bank (rule 21).
  // The derived value is cached in state so the FlatList identity stays stable.
  const reviewIdsRef = useRef<string[]>([]);
  if (reviewIdsParam) {
    const next = reviewIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (
      next.length !== reviewIdsRef.current.length ||
      next.some((id, i) => id !== reviewIdsRef.current[i])
    ) {
      reviewIdsRef.current = next;
    }
  }
  const hasReviewSet = reviewIdsRef.current.length > 0;
  const [subjectScope] = useState<string | undefined>(subjectParam);

  // Answer / bookmark / flag state lives HERE (not inside cards) so list
  // recycling can never lose it.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());
  const [flagIds, setFlagIds] = useState<Set<string>>(new Set());

  // Guards against out-of-order async loads overwriting newer results.
  const loadTokenRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAllTopics()
      .then(list => { if (!cancelled) setTopics(list); })
      .catch(err => console.error('Failed to load topics:', err));
    if (initialTopic) setSelectedTopic(initialTopic);
    return () => { cancelled = true; };
  }, [initialTopic]);

  // Load the user's persisted bookmarks & flags once
  useEffect(() => {
    if (!user) return;
    Promise.all([getBookmarkQuestionIds(user.uid), getFlaggedQuestionIds(user.uid)])
      .then(([bm, fl]) => {
        setBookmarkIds(new Set(bm));
        setFlagIds(new Set(fl));
      })
      .catch(err => console.error('Failed to load bookmark/flag state:', err));
  }, [user]);

  // Debounce search input (no stale results; DB LIKE is case-insensitive)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reload whenever the session definition changes
  useEffect(() => {
    loadQuestions(true);
  }, [debouncedSearch, selectedTopic, filterMode, subjectScope, hasReviewSet]);

  const loadQuestions = async (reset = false) => {
    if (!user || loadingRef.current) return;

    const token = ++loadTokenRef.current;
    const currentPage = reset ? 0 : page;
    loadingRef.current = true;

    if (reset) {
      setPage(0);
      setHasMore(true);
    }
    setLoading(true);
    setError(null);

    try {
      let newQuestions: Question[] = [];
      const offset = currentPage * PAGE_SIZE;
      // Only whole-bank / per-topic modes page; explicit sets do not.
      let canPage = false;

      if (hasReviewSet) {
        // Explicit session (e.g. mistakes drill-down) — fixed question list.
        newQuestions = await getQuestionsByIds(reviewIdsRef.current);
      } else if (filterMode === 'mistakes' && user) {
        newQuestions = await getWrongQuestions(user.uid, PAGE_SIZE);
      } else if (debouncedSearch) {
        newQuestions = await searchQuestions(debouncedSearch, PAGE_SIZE);
      } else if (subjectScope) {
        // Whole-subject practice from the course hierarchy.
        newQuestions = await getQuestionsBySubject(subjectScope, PAGE_SIZE, offset);
        canPage = true;
      } else if (filterMode === 'due') {
        newQuestions = await getQuestionsByStage(user.uid, 'due', PAGE_SIZE);
      } else if (filterMode === 'weak') {
        newQuestions = await getFlaggedQuestions(user.uid, PAGE_SIZE);
      } else if (filterMode === 'bookmarked') {
        newQuestions = await getBookmarkedQuestions(user.uid, PAGE_SIZE);
      } else if (selectedTopic === 'all') {
        newQuestions = await getAllQuestions(PAGE_SIZE, offset);
        canPage = true;
      } else {
        newQuestions = await getQuestionsByTopic(selectedTopic, PAGE_SIZE, offset);
        canPage = true;
      }

      if (token !== loadTokenRef.current) return; // a newer load superseded us

      setQuestions(prev => (reset ? newQuestions : [...prev, ...newQuestions]));
      setHasMore(canPage && newQuestions.length === PAGE_SIZE);
      if (!reset) setPage(currentPage + 1);
    } catch (err) {
      console.error('Failed to load questions:', err);
      if (token === loadTokenRef.current) setError('Could not load questions. Please try again.');
    } finally {
      if (token === loadTokenRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      loadingRef.current = false;
    }
  };

  /** Records the answer via the central service; UI updates instantly. */
  const handleAnswer = useCallback(async (questionId: string, selectedAnswer: string, timeSpent: number) => {
    if (!user) return;
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    // Optimistic local update - card feedback appears immediately.
    setAnswers(prev => ({ ...prev, [questionId]: selectedAnswer }));

    try {
      await recordAnswer(user.uid, question, selectedAnswer, timeSpent);
    } catch (err) {
      console.error('Failed to record answer:', err);
      // Roll back so the UI never shows a state that was not saved.
      setAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }, [user, questions]);

  const handleBookmark = useCallback(async (questionId: string) => {
    if (!user) return;
    const wasSaved = bookmarkIds.has(questionId);
    setBookmarkIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(questionId); else next.add(questionId);
      return next;
    });
    try {
      await dbToggleBookmark(user.uid, questionId);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      setBookmarkIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(questionId); else next.delete(questionId);
        return next;
      });
    }
  }, [user, bookmarkIds]);

  const handleFlag = useCallback(async (questionId: string) => {
    if (!user) return;
    const wasFlagged = flagIds.has(questionId);
    setFlagIds(prev => {
      const next = new Set(prev);
      if (wasFlagged) next.delete(questionId); else next.add(questionId);
      return next;
    });
    try {
      await dbToggleWeakPoint(user.uid, questionId);
    } catch (err) {
      console.error('Failed to toggle flag:', err);
      setFlagIds(prev => {
        const next = new Set(prev);
        if (wasFlagged) next.add(questionId); else next.delete(questionId);
        return next;
      });
    }
  }, [user, flagIds]);

  const clearSearch = () => setSearchQuery('');

  const filtersActive = !!debouncedSearch || selectedTopic !== 'all' || filterMode !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTopic('all');
    setFilterMode('all');
  };

  const renderItem = useCallback(({ item }: { item: Question }) => (
    <QuestionCard
      question={{
        id: item.id,
        topic: item.topic,
        question: item.question,
        options: JSON.parse(item.options_json),
        answer: item.answer,
        explanation: item.explanation,
      }}
      userAnswer={answers[item.id] ?? null}
      onAnswer={handleAnswer}
      onBookmark={handleBookmark}
      onFlag={handleFlag}
      isBookmarked={bookmarkIds.has(item.id)}
      isFlagged={flagIds.has(item.id)}
      mode="practice"
    />
  ), [answers, handleAnswer, handleBookmark, handleFlag, bookmarkIds, flagIds]);

const emptyMessage = debouncedSearch
    ? `No questions found for "${debouncedSearch}"`
    : filterMode === 'bookmarked' ? 'No bookmarked questions yet'
    : filterMode === 'weak' ? 'No flagged questions yet'
    : filterMode === 'mistakes' ? 'No mistakes to review — keep it up!'
    : hasReviewSet ? 'These questions are no longer available'
    : subjectScope ? 'No questions in this subject yet'
    : filterMode === 'due' ? 'Nothing due for review right now'
    : 'No questions available for this filter';

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search questions..."
        debounceMs={300}
        showClearButton={true}
      />

      {/* Filter Chips */}
      <FilterChips
        chips={[
          { key: 'all', label: 'All Topics' },
          ...topics.map(t => ({ key: t, label: t })),
          { key: 'due', label: '📅 Due' },
          { key: 'weak', label: '📚 Weak Areas' },
          { key: 'bookmarked', label: '🔖 Bookmarked' },
          { key: 'mistakes', label: '❌ Mistakes' },
        ]}
        selectedKey={debouncedSearch ? null : selectedTopic === 'all' ? 'all' : selectedTopic}
        onSelect={(key) => {
          if (key === 'all') {
            setSelectedTopic('all');
            setFilterMode('all');
            setSearchQuery('');
          } else if (key === 'due') {
            setFilterMode('due');
            setSelectedTopic('all');
            setSearchQuery('');
          } else if (key === 'weak') {
            setFilterMode('weak');
            setSelectedTopic('all');
            setSearchQuery('');
          } else if (key === 'bookmarked') {
            setFilterMode('bookmarked');
            setSelectedTopic('all');
            setSearchQuery('');
          } else if (key === 'mistakes') {
            setFilterMode('mistakes');
            setSelectedTopic('all');
            setSearchQuery('');
          } else {
            setSelectedTopic(key);
            setFilterMode('all');
            setSearchQuery('');
          }
        }}
        showReset={filtersActive}
        onReset={resetFilters}
      />

      {/* Question List */}
      <FlatList
        data={questions}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        extraData={{ answers, bookmarkIds, flagIds }}
        onEndReached={() => { if (hasMore && !loading) loadQuestions(); }}
        onEndReachedThreshold={0.5}
        onRefresh={() => { setRefreshing(true); loadQuestions(true); }}
        refreshing={refreshing}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={error ? 'Failed to load' : 'No questions found'}
              message={error ?? emptyMessage}
              actionLabel={error ? 'Retry' : filtersActive ? 'Clear Filters' : undefined}
              onAction={error ? () => loadQuestions(true) : filtersActive ? resetFilters : undefined}
            />
          ) : null
        }
      />

      {loading && questions.length === 0 && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
});