/**
 * Exam Engine — single source of truth for exam grading & session state
 * (master-prompt rules 23–26). Pure functions only: the UI renders results,
 * it never computes them. Fully covered by vitest (examEngine.test.ts).
 */

export interface EngineQuestion {
  id: string;
  topic: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string;
}

export interface GradeOptions {
  /** Marks per correct answer (default 1). */
  marksPerQuestion?: number;
  /** Marks subtracted per wrong answer (default 0 = no negative marking). */
  negativeMarks?: number;
  /** Percentage required to pass (default 40). */
  passMarkPct?: number;
}

export interface GradedExam {
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Raw score after negative marking (can be < 0 when enabled). */
  score: number;
  maxScore: number;
  /** percentage of questions answered correctly */
  accuracy: number;
  /** percentage of max score achieved */
  percentage: number;
  passMarkPct: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Session question (de)serialization
// ---------------------------------------------------------------------------

interface RawQuestionRow {
  id?: unknown;
  topic?: unknown;
  question?: unknown;
  options?: unknown;      // pre-parsed map OR JSON string
  options_json?: unknown; // raw DB column form
  answer?: unknown;
  explanation?: unknown;
}

function toOptionsMap(raw: unknown): Record<string, string> {
  if (!raw) return {};
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  return out;
}

/** Turn stored session rows into engine questions; malformed rows are dropped, not fatal. */
export function parseExamQuestions(rows: unknown): EngineQuestion[] {
  if (!Array.isArray(rows)) return [];
  const out: EngineQuestion[] = [];
  for (const r of rows as RawQuestionRow[]) {
    const options = toOptionsMap(r?.options ?? r?.options_json);
    if (
      typeof r?.id === 'string' && r.id &&
      typeof r?.question === 'string' && r.question &&
      typeof r?.answer === 'string' && r.answer &&
      Object.keys(options).length >= 2 &&
      options[r.answer] // correct key must exist among options
    ) {
      out.push({
        id: r.id,
        topic: typeof r.topic === 'string' ? r.topic : '',
        question: r.question,
        options,
        answer: r.answer,
        explanation: typeof r.explanation === 'string' ? r.explanation : undefined,
      });
    }
  }
  return out;
}

/** Answers map {questionId: 'a'|...} persisted for a session's answers_json. */
export type AnswerMap = Record<string, string>;

// ---------------------------------------------------------------------------
// In-progress state (answers + flags + position + deadline)
// ---------------------------------------------------------------------------

export interface ExamProgressState {
  answers: AnswerMap;
  flagged: string[];
  currentIndex: number;
  /** epoch ms when the timer expires */
  endAt: number;
}

/** Serialize progress into the session's answers_json (one atomic blob). */
export function serializeProgress(state: ExamProgressState): string {
  return JSON.stringify({ v: 1, ...state });
}

/**
 * Deserialize progress. Accepts:
 *  - current {v:1,...} blobs written by this engine
 *  - legacy plain maps `{qid:'a', ...}` written by older app versions
 */
export function deserializeProgress(json: string | null | undefined): ExamProgressState | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    // Legacy shape: plain answer map (all values are option letters).
    const record = parsed as Record<string, unknown>;
    const isLegacyMap =
      !('v' in record) && Object.values(record).every(v => typeof v === 'string');
    if (isLegacyMap) {
      return { answers: parsed as AnswerMap, flagged: [], currentIndex: 0, endAt: 0 };
    }

    if (record.v !== 1 || typeof record.answers !== 'object' || record.answers === null) return null;
    return {
      answers: record.answers as AnswerMap,
      flagged: Array.isArray(record.flagged)
        ? (record.flagged as unknown[]).filter((f): f is string => typeof f === 'string')
        : [],
      currentIndex:
        typeof record.currentIndex === 'number' && Number.isFinite(record.currentIndex)
          ? record.currentIndex
          : 0,
      endAt: typeof record.endAt === 'number' ? record.endAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Deterministic-order random sample: shuffles a copy (Fisher–Yates) and takes
 * the first `count`. Injected RNG keeps unit tests reproducible. Used by exam
 * starts, custom exams and later by game modes (rule 35) so every feature
 * samples through one audited implementation.
 */
export function sampleQuestions<T>(items: T[], count: number, rng: () => number = Math.random): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, count));
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function gradeExam(
  questions: EngineQuestion[],
  answers: AnswerMap,
  opts: GradeOptions = {}
): GradedExam {
  const m = Math.max(opts.marksPerQuestion ?? 1, 0);
  const neg = Math.max(opts.negativeMarks ?? 0, 0);
  const passMarkPct = Math.min(Math.max(opts.passMarkPct ?? 40, 0), 100);

  let correct = 0;
  let wrong = 0;
  for (const q of questions) {
    const given = answers[q.id];
    if (!given) continue; // skipped/unanswered never penalized
    if (given === q.answer) correct += 1;
    else wrong += 1;
  }
  const total = questions.length;
  const attempted = correct + wrong;
  const skipped = total - attempted;

  const score = correct * m - wrong * neg;
  const maxScore = total * m;
  const pctOf = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const percentage = pctOf(score, maxScore);
  return {
    total,
    attempted,
    correct,
    wrong,
    skipped,
    score,
    maxScore,
    accuracy: pctOf(correct, attempted),
    percentage,
    passMarkPct,
    passed: percentage >= passMarkPct && total > 0,
  };
}

/** Duration label like "12:05" or "1:02:03" for timers/results. */
export function formatDuration(ms: number): string {
  const safe = Math.max(Math.round(ms / 1000), 0);
  const s = safe % 60;
  const min = Math.floor(safe / 60) % 60;
  const h = Math.floor(safe / 3600);
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(min)}:${two(s)}` : `${two(min)}:${two(s)}`;
}

/**
 * Deadline helpers for the rule-23 auto-submit boundary (quiz.tsx countdown).
 *
 * `endAt` is the absolute epoch-ms deadline stored on the exam session. The
 * countdown tick must (a) floor remaining time at 0 so the display never goes
 * negative, and (b) trigger a single auto-submit exactly when the deadline
 * has elapsed — never before, never past it, and never twice.
 */
export interface DeadlineState {
  /** ms left until the deadline, floored at 0 (safe for display). */
  remainingMs: number;
  /** true only when the deadline has elapsed and the session is not yet submitted. */
  expired: boolean;
}

/**
 * Pure decision function for the deadline boundary. Returns the remaining
 * time (≥0) and whether the deadline has been reached. `now` is injected so
 * the boundary is fully unit-testable without mocking Date.
 */
export function deadlineState(endAt: number, now: number): DeadlineState {
  const left = endAt - now;
  return {
    remainingMs: left > 0 ? left : 0,
    expired: left <= 0,
  };
}

