/**
 * QuestionCard Component - Reusable question display component
 *
 * FULLY CONTROLLED: all answer state comes from the `userAnswer` prop and
 * correctness is derived here for display only (the single source of truth
 * lives in services/answerService.ts). This keeps cards stable inside
 * virtualized lists — a re-render or cell recycling can never lose or mutate
 * an answer.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRef, useState } from 'react';
import { Check, X, Bookmark, Flag, ChevronDown, ChevronUp } from 'lucide-react-native';

export interface QuestionCardQuestion {
  id: string;
  topic?: string;
  question?: string;
  options?: Record<string, string>;
  answer?: string;
  explanation?: string;
}

interface QuestionCardProps {
  question: QuestionCardQuestion;
  /** Currently recorded answer for this question ('a' | 'b' | ...), if any. */
  userAnswer?: string | null;
  /** Force-show the explanation block (e.g. review sessions). */
  showExplanation?: boolean;
  onAnswer?: (questionId: string, selectedAnswer: string, timeSpent: number) => void;
  onBookmark?: (questionId: string) => void;
  onFlag?: (questionId: string) => void;
  isBookmarked?: boolean;
  isFlagged?: boolean;
  mode?: 'practice' | 'exam' | 'review' | 'battle';
  /** Show graded result regardless of mode (exam results / review screens). */
  showResult?: boolean;
  timeSpent?: number;
}

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

const MIN_TOUCH_TARGET = 48;

export function QuestionCard({
  question,
  userAnswer = null,
  showExplanation = false,
  onAnswer,
  onBookmark,
  onFlag,
  isBookmarked = false,
  isFlagged = false,
  mode = 'practice',
  showResult = false,
  timeSpent = 0,
}: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Reading-time tracker that resets whenever this card starts showing a
  // different question (lists recycle components — never trust mount time).
  const questionIdRef = useRef(question.id);
  const startTimeRef = useRef(Date.now());
  if (questionIdRef.current !== question.id) {
    questionIdRef.current = question.id;
    startTimeRef.current = Date.now();
  }

  // ---- Data validation: isolate broken rows instead of crashing ----------
  const optionEntries = OPTION_KEYS
    .map(key => ({ key, text: question.options?.[key] }))
    .filter((o): o is { key: string; text: string } => typeof o.text === 'string' && o.text.length > 0);
  const isMalformed =
    !question.id || !question.question || !question.answer || optionEntries.length < 2;

  const hasAnswered = !!userAnswer && optionEntries.some(o => o.key === userAnswer);
  // Feedback (green/red + badge) only ever shows in practice/review modes or
  // explicit result screens — never during a timed exam.
  const showFeedback = !isMalformed && (showResult || ((mode === 'practice' || mode === 'review') && hasAnswered));
  const isCorrect = hasAnswered && userAnswer === question.answer;
  // Answers are locked once graded; exams allow changing until submission.
  const answersLocked = showFeedback;

  const handleOptionPress = (optionKey: string) => {
    if (answersLocked) return;
    const elapsed = Date.now() - startTimeRef.current;
    onAnswer?.(question.id, optionKey, elapsed);
  };
  
  const getOptionStyle = (optionKey: string) => {
    const base = [styles.optionButton];
    if (!showFeedback) {
      return userAnswer === optionKey ? [...base, styles.optionSelected] : base;
    }
    if (optionKey === question.answer) return [...base, styles.optionCorrect];
    if (optionKey === userAnswer) return [...base, styles.optionWrong];
    return base;
  };

  const getOptionTextStyle = (optionKey: string) => {
    const base = [styles.optionText];
    if (!showFeedback) {
      return userAnswer === optionKey ? [...base, styles.optionSelectedText] : base;
    }
    if (optionKey === question.answer) return [...base, styles.optionCorrectText];
    if (optionKey === userAnswer) return [...base, styles.optionWrongText];
    return [...base, styles.optionTextDisabled];
  };

  const getOptionIcon = (optionKey: string) => {
    if (!showFeedback) return null;
    if (optionKey === question.answer) return <Check size={20} color="#10b981" />;
    if (optionKey === userAnswer) return <X size={20} color="#ef4444" />;
    return null;
  };

  // Broken data must not break the whole session — isolate & log it.
  if (isMalformed) {
    console.warn('[QuestionCard] Malformed question skipped:', question.id);
    return (
      <View style={styles.card}>
        <Text style={styles.malformedText}>This question could not be displayed.</Text>
      </View>
    );
  }

  // Collapsed by default; manual reveal only; never shown during exams.
  const explanationVisible =
    (showExplanation || showFeedback) && !!question.explanation && mode !== 'exam';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {!!question.topic && (
          <View style={styles.topicBadge}>
            <Text style={styles.topicText} numberOfLines={1}>{question.topic}</Text>
          </View>
        )}
        <View style={styles.headerActions}>
          {onBookmark && (
            <TouchableOpacity
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => onBookmark(question.id)}
            >
              <Bookmark
                size={20}
                color={isBookmarked ? '#f59e0b' : '#94a3b8'}
                fill={isBookmarked ? '#f59e0b' : 'none'}
              />
            </TouchableOpacity>
          )}
          {onFlag && (
            <TouchableOpacity
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => onFlag(question.id)}
            >
              <Flag
                size={20}
                color={isFlagged ? '#ef4444' : '#94a3b8'}
                fill={isFlagged ? '#ef4444' : 'none'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Question Text */}
      <Text style={styles.questionText}>{question.question}</Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {optionEntries.map(({ key, text }) => (
          <TouchableOpacity
            key={key}
            style={getOptionStyle(key)}
            onPress={() => handleOptionPress(key)}
            disabled={answersLocked}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: hasAnswered && userAnswer === key, disabled: answersLocked }}
          >
            <View style={styles.optionLetterWrapper}>
              <View style={styles.optionLetter}>
                <Text style={getOptionTextStyle(key)}>{key.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={getOptionTextStyle(key)}>{text}</Text>
            {getOptionIcon(key)}
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Explanation - collapsed by default, manual reveal only, never auto-opened */}
      {explanationVisible && (
        <View style={styles.explanationContainer}>
          <TouchableOpacity
            style={styles.explanationHeader}
            onPress={() => setExpanded(prev => !prev)}
          >
            <View style={styles.explanationIcon}>
              <Text style={styles.explanationIconText}>💡</Text>
            </View>
            <Text style={styles.explanationTitle}>Explanation</Text>
            <View style={styles.expandIcon}>
              {expanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </TouchableOpacity>

          {expanded && (
            <View style={styles.explanationContent}>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Result Summary */}
      {showFeedback && (
        <View style={styles.resultSummary}>
          <View style={[
            styles.resultBadge,
            isCorrect ? styles.resultCorrect : styles.resultWrong,
          ]}>
            <Text style={styles.resultBadgeText}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </Text>
          </View>
          {timeSpent > 0 && (
            <Text style={styles.timeSpent}>
              {Math.round(timeSpent / 1000)}s
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topicBadge: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topicText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  malformedText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
  },
  optionCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  optionWrong: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  optionSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  optionSelectedText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    // Wrapped in touch area that meets 48dp minimum
  },
  optionLetterWrapper: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  optionCorrectText: {
    color: '#059669',
    fontWeight: '600',
  },
  optionWrongText: {
    color: '#dc2626',
  },
  optionTextDisabled: {
    color: '#94a3b8',
  },
  explanationContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  explanationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  explanationIconText: {
    fontSize: 14,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  expandIcon: {
    padding: 4,
  },
  explanationContent: {
    paddingTop: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  resultSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  resultBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  resultCorrect: {
    backgroundColor: '#ecfdf5',
  },
  resultWrong: {
    backgroundColor: '#fef2f2',
  },
  resultBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeSpent: {
    fontSize: 13,
    color: '#94a3b8',
    fontVariant: ['tabular-nums'],
  },
});