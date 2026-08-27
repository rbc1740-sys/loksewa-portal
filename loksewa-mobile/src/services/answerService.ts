/**
 * Answer Service - Single source of truth for recording MCQ answers.
 *
 * Every screen (practice, exam review, spaced review) must go through
 * recordAnswer() so that correctness is computed exactly once and progress,
 * spaced-repetition state and profile rewards can never disagree
 * (master-prompt rule 30).
 */
import {
  Question,
  getProgress,
  getSRState,
  upsertProgress,
  upsertSRState,
  recordReward,
} from './database';
import { calculateNextInterval, SR_EASE_DEFAULT } from '../utils/spacedRepetition';

export interface AnswerOutcome {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  xpGained: number;
  totalXp: number;
  streakDays: number;
  rankTier: string;
  rankSub: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Records one answer attempt:
 *  1. computes correctness from the canonical question.answer,
 *  2. upserts user_progress (incrementing attempts & accumulated time),
 *  3. advances the SM-2 spaced-repetition state,
 *  4. awards XP / streak / rank via the profile.
 */
export async function recordAnswer(
  userId: string,
  question: Pick<Question, 'id' | 'answer'>,
  selectedAnswer: string,
  timeSpentMs = 0
): Promise<AnswerOutcome> {
  if (!userId || !question?.id) {
    throw new Error('recordAnswer requires userId and a question with an id');
  }

  // 1. Canonical correctness check - never duplicated in UI components.
  const isCorrect = selectedAnswer === question.answer;

  // 2. Progress row (attempts accumulate across repeat visits).
  const previousProgress = await getProgress(userId, question.id);
  await upsertProgress({
    user_id: userId,
    question_id: question.id,
    selected_answer: selectedAnswer,
    is_correct: isCorrect ? 1 : 0,
    attempt_count: (previousProgress?.attempt_count ?? 0) + 1,
    time_spent_ms: (previousProgress?.time_spent_ms ?? 0) + Math.max(0, timeSpentMs),
    last_attempted_at: Date.now(),
  });

  // 3. Spaced repetition state (SM-2).
  const srState = await getSRState(userId, question.id);
  const { interval, ease, attempts } = calculateNextInterval(
    srState?.attempts ?? 0,
    srState?.ease_factor ?? SR_EASE_DEFAULT,
    isCorrect
  );
  await upsertSRState({
    user_id: userId,
    question_id: question.id,
    interval_days: interval,
    ease_factor: ease,
    attempts,
    due_at: Date.now() + interval * DAY_MS, // interval 0 (wrong) → due immediately
    total_attempts: (srState?.total_attempts ?? 0) + 1,
    total_correct: (srState?.total_correct ?? 0) + (isCorrect ? 1 : 0),
    total_wrong: (srState?.total_wrong ?? 0) + (isCorrect ? 0 : 1),
    last_result: isCorrect ? 'correct' : 'wrong',
    last_answered_at: Date.now(),
  });

  // 4. Rewards (XP / streak / rank).
  const reward = await recordReward(userId, isCorrect);

  return {
    questionId: question.id,
    selectedAnswer,
    isCorrect,
    ...reward,
  };
}
