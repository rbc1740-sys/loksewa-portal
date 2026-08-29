import { create } from 'zustand';
import {
  Question,
  getAllQuestions,
  getQuestionsByTopic,
  getQuestionsBySubject,
  getQuestionsByIds,
  getBookmarkedQuestions,
  getWrongQuestions,
  getQuestionsByStage,
  getBookmarkQuestionIds,
  toggleBookmark as dbToggleBookmark,
} from '../services/database';
import { recordAnswer } from '../services/answerService';

/**
 * QuestionSession Store — the ONE central question engine (master-prompt rule 30).
 *
 * Every answering workflow (Practice, Daily Challenge, Mistakes drill-down,
 * Bookmarks drill-down, Smart Review, Custom Exams, Battle practice legs)
 * flows through this single store + the runner screen.
 *
 * STATE STABILITY (rule 9) is the non-negotiable contract: the question array
 * is built once in `start()` from a frozen `SessionSource`; answering,
 * bookmarking, flagging or re-rendering NEVER recreates, reshuffles or
 * reorders it. Selecting an option only mutates the `answers` map — no
 * auto-scroll, no auto-advance, no layout jump.
 */

export type SessionMode = 'practice' | 'test' | 'review';

export interface SessionSource {
  /** Human-readable label for the runner header. */
  title: string;
  subtitle?: string;
  kind: 'topic' | 'subject' | 'ids' | 'bookmarked' | 'mistakes' | 'due' | 'stage';
  topic?: string;
  subjectId?: string;
  ids?: string[];
  /** SM-2 stage for `kind: 'stage'` — 'due' | 'learning' | 'review' | 'mastered'. */
  stage?: string;
  /** Optional hard cap on questions (daily challenge = 10, etc.). */
  limit?: number;
}

interface SessionState {
  active: boolean;
  mode: SessionMode;
  title: string;
  subtitle?: string;
  /** UserId captured at session start so all ops can persist without re-passing. */
  userId: string;
  /** Frozen question array — identity is stable for the session lifetime. */
  questions: Question[];
  /** questionId → selected option key. */
  answers: Record<string, string>;
  /** questionId → elapsed ms when answered (for the footer timer). */
  timeSpent: Record<string, number>;
  /** Session-local optimistic bookmark set (persisted via dbToggleBookmark). */
  bookmarkIds: Set<string>;
  index: number;
  startedAt: number;
  finished: boolean;
  loading: boolean;
  error: string | null;

  start: (source: SessionSource, mode: SessionMode, userId: string) => Promise<void>;
  selectAnswer: (questionId: string, choice: string) => void;
  commitAnswer: (questionId: string) => Promise<void>;
  toggleBookmark: (questionId: string) => Promise<void>;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  finish: () => void;
  reset: () => void;
}


export const useSessionStore = create<SessionState>((set, get) => ({
  active: false,
  mode: 'practice',
  title: '',
  subtitle: undefined,
  userId: '',
  questions: [],
  answers: {},
  timeSpent: {},
  bookmarkIds: new Set<string>(),
  index: 0,
  startedAt: 0,
  finished: false,
  loading: false,
  error: null,

  start: async (source, mode, userId) => {
    set({ loading: true, error: null, finished: false });
    try {
      const qs = await resolveQuestions(source, userId);
      if (!qs.length) {
        set({ loading: false, error: 'No questions available for this selection.' });
        return;
      }
      let initialBookmarks = new Set<string>();
      if (source.kind !== 'bookmarked') {
        const bmIds = await getBookmarkQuestionIds(userId);
        initialBookmarks = new Set(bmIds);
      }
      set({
        active: true,
        mode,
        userId,
        title: source.title,
        subtitle: source.subtitle,
        questions: qs,
        answers: {},
        timeSpent: {},
        bookmarkIds: initialBookmarks,
        index: 0,
        startedAt: Date.now(),
        loading: false,
      });
    } catch (e) {
      console.error('[Session] start failed:', e);
      set({ loading: false, error: 'Could not start. Please try again.' });
    }
  },

  selectAnswer: (questionId, choice) => {
    const { answers, mode, questions } = get();
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;
    // Optimistic local update so the chosen option feels instant.
    set({ answers: { ...answers, [questionId]: choice } });
    if (mode === 'test') {
      get().commitAnswer(questionId);
    }
  },

  commitAnswer: async (questionId) => {
    const { answers, questions, timeSpent, userId } = get();
    const choice = answers[questionId];
    const q = questions.find((x) => x.id === questionId);
    if (!q || !choice || !userId) return;
    const elapsed = timeSpent[questionId] ?? 0;
    try {
      await recordAnswer(userId, q, choice, elapsed);
    } catch (e) {
      console.error('[Session] commitAnswer failed:', e);
    }
  },

  toggleBookmark: async (questionId) => {
    const { bookmarkIds, userId } = get();
    const wasSaved = bookmarkIds.has(questionId);
    set({
      bookmarkIds: wasSaved
        ? new Set([...bookmarkIds].filter((id) => id !== questionId))
        : new Set([...bookmarkIds, questionId]),
    });
    try {
      await dbToggleBookmark(userId, questionId);
    } catch (e) {
      console.error('[Session] bookmark failed:', e);
      set({
        bookmarkIds: wasSaved
          ? new Set([...bookmarkIds, questionId])
          : new Set([...bookmarkIds].filter((id) => id !== questionId)),
      });
    }
  },

  goTo: (index) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) set({ index });
  },

  next: () => {
    const { index, questions, finished } = get();
    if (finished) return;
    if (index < questions.length - 1) {
      set({ index: index + 1 });
    } else {
      get().finish();
    }
  },

  prev: () => {
    const { index } = get();
    if (index > 0) set({ index: index - 1 });
  },

  finish: () => set({ finished: true }),

  reset: () =>
    set({
      active: false,
      mode: 'practice',
      title: '',
      subtitle: undefined,
      userId: '',
      questions: [],
      answers: {},
      timeSpent: {},
      bookmarkIds: new Set<string>(),
      index: 0,
      startedAt: 0,
      finished: false,
      loading: false,
      error: null,
    }),
}));

/** Picks questions from the DB according to the source descriptor. */
async function resolveQuestions(source: SessionSource, userId: string): Promise<Question[]> {
  let qs: Question[];
  switch (source.kind) {
    case 'topic':
      qs = await getQuestionsByTopic(source.topic ?? '');
      break;
    case 'subject':
      qs = await getQuestionsBySubject(source.subjectId ?? '');
      break;
    case 'ids':
      qs = await getQuestionsByIds(source.ids ?? []);
      break;
    case 'bookmarked':
      qs = await getBookmarkedQuestions(userId);
      break;
    case 'mistakes':
      qs = await getWrongQuestions(userId);
      break;
    case 'due':
      qs = await getQuestionsByStage(userId, 'due');
      break;
    case 'stage':
      qs = await getQuestionsByStage(userId, (source.stage ?? 'due') as never);
      break;
    default:
      qs = await getAllQuestions();
  }
  // Shuffle ONCE at session creation so each run feels fresh; frozen after.
  const shuffled = qs.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return typeof source.limit === 'number' ? shuffled.slice(0, source.limit) : shuffled;
}
