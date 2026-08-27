/**
 * Spaced Review Screen - SM-2 Spaced Repetition
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Brain, Clock, TrendingUp, RefreshCw, Target, BookOpen, CheckCircle, XCircle } from 'lucide-react-native';
import {
  getDueQuestions, getSRStats, getQuestionsByStage,
  Question, SRState, SRStageFilter,
} from '../../src/services/database';
import { getQuestionById } from '../../src/services/database';
import { recordAnswer } from '../../src/services/answerService';
import { QuestionCard } from '../../src/components/QuestionCard';
import { useAuthStore } from '../../src/stores/authStore';

// QuestionCard consumes questions with parsed `options`; the DB returns the
// flat row (options_json), so we present an options map here.
export interface ReviewQuestion {
  id: string;
  topic: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string;
}

export default function SpacedReviewScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [srStats, setSrStats] = useState({ due: 0, learning: 0, review: 0, mastered: 0 });
  const [dueQuestions, setDueQuestions] = useState<SRState[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'due' | 'learning' | 'review' | 'mastered'>('due');
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, string>>({});
  const [stageQuestions, setStageQuestions] = useState<Question[]>([]);
  const [stageLoading, setStageLoading] = useState(false);
  
  // SR Algorithm constants (from core-logic.js)
  const SR_EASE_MIN = 1.3;
  
  useEffect(() => {
    loadData();
  }, [user]);

  // Switching a category card loads THAT category's real dataset
  useEffect(() => {
    if (user && filter !== 'all') {
      loadStageList(filter, user.uid);
    }
  }, [filter, user]);
  
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [stats, due] = await Promise.all([
        getSRStats(user.uid),
        getDueQuestions(user.uid, 50),
      ]);
      setSrStats(stats);
      setDueQuestions(due);
    } catch (error) {
      console.error('Failed to load SR data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const startReviewSession = async () => {
    if (!user || dueQuestions.length === 0) return;
    
    setLoading(true);
    try {
      // Get full question data for due questions
      const questionIds = dueQuestions.map(sr => sr.question_id);
      const questions: ReviewQuestion[] = [];
      
      for (const id of questionIds.slice(0, 10)) { // Limit to 10 per session
        const q = await getQuestionById(id);
        if (q) {
          questions.push({
            id: q.id,
            topic: q.topic,
            question: q.question,
            options: JSON.parse(q.options_json) as Record<string, string>,
            answer: q.answer,
            explanation: q.explanation,
          });
        }
      }
      
      setSessionQuestions(questions);
      setCurrentIndex(0);
      setShowExplanation(false);
      setSessionActive(true);
      setSessionComplete(false);
      setSessionResults(null);
      setSessionAnswers({});
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getQuestionById = async (id: string): Promise<Question | null> => {
    // This would need to be imported from database service
    const { getQuestionById } = await import('../../src/services/database');
    return getQuestionById(id);
  };
  
  /** Records the answer via the central service. NO auto-advance — the user
   *  taps "Next Question" explicitly (master-prompt rules 2, 7 & 50). */
  const handleAnswer = useCallback(async (questionId: string, selectedAnswer: string, timeSpent: number) => {
    if (!user) return;
    const question = sessionQuestions.find(q => q.id === questionId);
    if (!question || sessionAnswers[questionId]) return; // locked after answering

    setSessionAnswers(prev => ({ ...prev, [questionId]: selectedAnswer }));

    try {
      await recordAnswer(user.uid, question, selectedAnswer, timeSpent);
    } catch (error) {
      console.error('Failed to record review answer:', error);
    }
  }, [user, sessionQuestions, sessionAnswers]);

  const goNextQuestion = () => {
    if (currentIndex < sessionQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
    } else {
      completeSession();
    }
  };

  const completeSession = async () => {
    // Real result computed from the answers actually given this session
    let correct = 0;
    sessionQuestions.forEach(q => {
      if (sessionAnswers[q.id] && sessionAnswers[q.id] === q.answer) correct++;
    });

    setSessionComplete(true);
    setSessionActive(false);
    setSessionResults({ correct, total: sessionQuestions.length });

    // Refresh stats + stage lists
    if (user) {
      const stats = await getSRStats(user.uid);
      setSrStats(stats);
      const due = await getDueQuestions(user.uid, 50);
      setDueQuestions(due);
      loadStageList(filter, user.uid, stats);
    }
  };

  /** Loads the real dataset behind each category card. */
  const loadStageList = async (
    stage: SRStageFilter | 'all',
    userId: string,
    stats?: { due: number; learning: number; review: number; mastered: number }
  ) => {
    if (stage === 'all') {
      setStageQuestions([]);
      return;
    }
    setStageLoading(true);
    try {
      const rows = await getQuestionsByStage(userId, stage, 20);
      setStageQuestions(rows);
    } catch (error) {
      console.error(`Failed to load ${stage} questions:`, error);
      setStageQuestions([]);
    } finally {
      setStageLoading(false);
      if (stats) setSrStats(stats);
    }
  };
  
  const currentQuestion = sessionQuestions[currentIndex];
  const progress = sessionQuestions.length > 0 ? (currentIndex + 1) / sessionQuestions.length : 0;
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Brain size={28} color="#6366f1" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Spaced Review</Text>
            <Text style={styles.headerSubtitle}>Smart repetition for long-term retention</Text>
          </View>
        </View>
        {sessionActive && (
          <View style={styles.sessionProgress}>
            <Text style={styles.sessionProgressText}>
              {currentIndex + 1} / {sessionQuestions.length}
            </Text>
          </View>
        )}
      </View>
      
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={[styles.statCard, filter === 'due' && styles.statCardActive]}
          onPress={() => setFilter('due')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#fef2f2' }]}>
            <Clock size={22} color="#ef4444" />
          </View>
          <Text style={[
            styles.statValue,
            filter === 'due' && styles.statValueActive,
          ]}>{srStats.due}</Text>
          <Text style={[
            styles.statLabel,
            filter === 'due' && styles.statLabelActive,
          ]}>Due Now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filter === 'learning' && styles.statCardActive]}
          onPress={() => setFilter('learning')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#fffbeb' }]}>
            <BookOpen size={22} color="#f59e0b" />
          </View>
          <Text style={[
            styles.statValue,
            filter === 'learning' && styles.statValueActive,
          ]}>{srStats.learning}</Text>
          <Text style={[
            styles.statLabel,
            filter === 'learning' && styles.statLabelActive,
          ]}>Learning</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filter === 'review' && styles.statCardActive]}
          onPress={() => setFilter('review')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}>
            <RefreshCw size={22} color="#3b82f6" />
          </View>
          <Text style={[
            styles.statValue,
            filter === 'review' && styles.statValueActive,
          ]}>{srStats.review}</Text>
          <Text style={[
            styles.statLabel,
            filter === 'review' && styles.statLabelActive,
          ]}>Reviewing</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.statCard, filter === 'mastered' && styles.statCardActive]}
          onPress={() => setFilter('mastered')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#ecfdf5' }]}>
            <CheckCircle size={22} color="#10b981" />
          </View>
          <Text style={[
            styles.statValue,
            filter === 'mastered' && styles.statValueActive,
          ]}>{srStats.mastered}</Text>
          <Text style={[
            styles.statLabel,
            filter === 'mastered' && styles.statLabelActive,
          ]}>Mastered</Text>
        </TouchableOpacity>
      </View>
      
      {/* Session Active */}
      {sessionActive && currentQuestion && (
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionProgressBar}>
              <View style={[styles.sessionProgressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.sessionQuestionNum}>
              Question {currentIndex + 1} of {sessionQuestions.length}
            </Text>
          </View>
          
          <QuestionCard
            question={currentQuestion}
            userAnswer={sessionAnswers[currentQuestion.id] ?? null}
            showExplanation={showExplanation}
            onAnswer={handleAnswer}
            mode="review"
          />

          {sessionAnswers[currentQuestion.id] && (
            <TouchableOpacity style={styles.nextButton} onPress={goNextQuestion}>
              <Text style={styles.nextButtonText}>
                {currentIndex < sessionQuestions.length - 1 ? 'Next Question' : 'Complete Session'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Session Complete */}
      {sessionComplete && sessionResults && (
        <View style={styles.completeCard}>
          <View style={styles.completeIcon}>
            <CheckCircle size={40} color="#10b981" />
          </View>
          <Text style={styles.completeTitle}>Session Complete!</Text>
          <Text style={styles.completeSubtitle}>
            {sessionResults.correct} of {sessionResults.total} correct
          </Text>
          <View style={styles.completeActions}>
            <TouchableOpacity style={styles.completeButtonSecondary} onPress={() => {
              setSessionComplete(false);
              startReviewSession();
            }}>
              <Text style={styles.completeButtonText}>Continue Review</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.completeButtonPrimary} onPress={() => router.back()}>
              <Text style={styles.completeButtonTextPrimary}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Start Session / Category Lists */}
      {!sessionActive && !sessionComplete && (
        <>
          {filter === 'due' && (
            dueQuestions.length > 0 ? (
              <TouchableOpacity style={styles.startButton} onPress={startReviewSession} disabled={loading}>
                {loading ? (
                  <Text style={styles.startButtonText}>Loading...</Text>
                ) : (
                  <Text style={styles.startButtonText}>
                    Start Smart Review ({dueQuestions.length} due)
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyState}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptySubtitle}>
                  No questions due for review right now. Great job staying on top of your studies!
                </Text>
              </View>
            )
          )}

          {/* Selected category's real dataset */}
          <View style={[styles.section, stageQuestions.length > 0 && { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>
              {filter === 'due' && 'Due Questions'}
              {filter === 'learning' && 'Learning Questions'}
              {filter === 'review' && 'Reviewing Questions'}
              {filter === 'mastered' && 'Mastered Questions'}
              {' '}({stageQuestions.length}
              {stageQuestions.length === 20 ? '+' : ''})
            </Text>

            {stageLoading ? (
              <Text style={styles.emptySubtitle}>Loading…</Text>
            ) : stageQuestions.length === 0 ? (
              <Text style={styles.emptySubtitle}>
                {filter === 'due'
                  ? 'Nothing to show here.'
                  : 'No questions in this category yet.'}
              </Text>
            ) : (
              <FlatList
                data={stageQuestions}
                renderItem={({ item }) => (
                  <View style={styles.dueItem}>
                    <View style={styles.dueInfo}>
                      <Text style={styles.dueTopic}>{item.topic}</Text>
                      <Text style={styles.dueMeta} numberOfLines={2}>{item.question}</Text>
                    </View>
                    <View style={styles.dueInterval}>
                      <Text style={styles.dueIntervalText}>{item.answer.toUpperCase()}</Text>
                    </View>
                  </View>
                )}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  sessionProgress: {
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sessionProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  statValueActive: {
    color: '#6366f1',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statLabelActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionHeader: {
    marginBottom: 16,
  },
  sessionProgressBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sessionProgressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  sessionQuestionNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  showExplanationButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  showExplanationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  nextButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  completeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  completeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  completeSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
  },
  completeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  completeButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  completeButtonPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366f1',
  },
  completeButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  startButton: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  dueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dueInfo: {
    flex: 1,
  },
  dueTopic: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  dueMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dueInterval: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
  },
  dueIntervalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
  },
});