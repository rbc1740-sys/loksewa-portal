/**
 * Exam Service — orchestrates the exam lifecycle on top of the pure engine
 * (examEngine.ts) and the DB layer (rules 23–26). The UI never computes
 * scores: it starts sessions, persists progress and asks THIS service to
 * submit/grade. Grading runs once inside one function, guarded against
 * double submission via submitted_at.
 */
import {
  createExamSession,
  getExamSession,
  getLatestActiveExamSession,
  getQuestionsBySubject,
  saveExamHistory,
  updateExamSession,
  type ExamSession,
  type Question,
} from './database';
import { DEFAULT_SUBJECT_IDS } from '../constants/courses';
import type { CustomExam } from './customExamStore';
import {
  AnswerMap,
  EngineQuestion,
  ExamProgressState,
  GradedExam,
  deserializeProgress,
  gradeExam,
  parseExamQuestions,
  sampleQuestions,
  serializeProgress,
} from './examEngine';

/** Raw question row straight from database.ts queries. */
export interface RawQuestionRow {
  id: string;
  topic?: string;
  question?: string;
  options_json?: string;
  answer?: string;
  explanation?: string;
}

export type ExamType = 'model' | 'subject' | 'custom';
export interface StartExamInput {
  userId: string;
  /** Candidate rows; paper is sampled/parsed from these. */
  rows: RawQuestionRow[];
  count: number;
  durationMinutes: number;
  topicLabel: string;
}

export interface ActiveSession {
  session: ExamSession;
  paper: EngineQuestion[];
  progress: ExamProgressState | null;
}

// ---------------------------------------------------------------------------
// Start / load / persist
// ---------------------------------------------------------------------------

/** Deterministic-shuffle paper sampler; caller checks emptiness before use. */
export function buildPaper(rows: RawQuestionRow[], count: number): EngineQuestion[] {
  const parsed = parseExamQuestions(rows);
  return sampleQuestions(parsed, count);
}

export async function startExam(input: StartExamInput): Promise<{ sessionId: string }> {
  const paper = buildPaper(input.rows, input.count);
  if (paper.length === 0) {
    throw new Error('Not enough questions available for this selection.');
  }
  const durationSec = Math.max(1, input.durationMinutes) * 60;
  const endAt = Date.now() + durationSec * 1000;

  const sessionId = await createExamSession({
    user_id: input.userId,
    topic: input.topicLabel,
    question_count: paper.length,
    time_limit_seconds: durationSec,
    questions_json: JSON.stringify(paper),
    answers_json: serializeProgress({ answers: {}, flagged: [], currentIndex: 0, endAt }),
    started_at: Date.now(),
  });
  return { sessionId };
}

/**
 * Launch helper for custom exams (rule 27). Resolves the configured subject
 * scope (falling back to the default course's subjects) and optional chapter
 * narrowing, then starts a session. Throws when no questions match so callers
 * can show an honest error instead of an empty exam.
 */
export async function startCustomExamSession(
  userId: string,
  exam: CustomExam
): Promise<{ sessionId: string }> {
  const scoped = exam.subjectIds.length ? exam.subjectIds : DEFAULT_SUBJECT_IDS;
  let rows: Question[] = [];
  for (const subjectId of scoped) {
    rows = rows.concat(await getQuestionsBySubject(subjectId, 1000));
  }
  if (exam.chapterIds.length) {
    const allow = new Set(exam.chapterIds);
    rows = rows.filter(q => q.chapter_id && allow.has(q.chapter_id));
  }
  return startExam({
    userId,
    rows,
    count: exam.questionCount,
    durationMinutes: Math.max(1, Math.round(exam.durationSeconds / 60)),
    topicLabel: `custom:${exam.id}`,
  });
}

/** Load a session together with its parsed paper + restored progress. */
export async function loadActiveSession(sessionId: string): Promise<ActiveSession | null> {
  const session = await getExamSession(sessionId);
  if (!session || session.submitted_at) return null;
  let paper: EngineQuestion[] = [];
  try {
    paper = parseExamQuestions(JSON.parse(session.questions_json));
  } catch {
    paper = [];
  }
  return { session, paper, progress: deserializeProgress(session.answers_json) };
}

/** Persist in-progress state — called on every answer/flag/navigation change. */
export async function persistExamProgress(
  sessionId: string,
  state: ExamProgressState
): Promise<void> {
  await updateExamSession(sessionId, { answers_json: serializeProgress(state) });
}

// ---------------------------------------------------------------------------
// Submit + grade (idempotent)
// ---------------------------------------------------------------------------

export interface SubmitOptions {
  marksPerQuestion?: number;
  negativeMarks?: number;
  passMarkPct?: number;
  title: string;
  /** Persisted to exam_history.exam_type; defaults to 'custom' when the
   *  session topic carries a custom reference, else 'model'. */
  examType?: ExamType;
}

export interface SubmitResult {
  attemptId: string;
  graded: GradedExam;
  timeSpentMs: number;
}

export async function submitExamSession(
  sessionId: string,
  opts: SubmitOptions
): Promise<SubmitResult> {
  const session = await getExamSession(sessionId);
  if (!session) throw new Error('Exam session not found.');
  if (session.submitted_at) throw new Error('This exam was already submitted.');

  const active = await loadActiveSession(sessionId);
  if (!active) throw new Error('Exam session is no longer available.');
  const { paper, progress } = active;
  const answers: AnswerMap = progress?.answers ?? {};

  const graded = gradeExam(paper, answers, {
    marksPerQuestion: opts.marksPerQuestion,
    negativeMarks: opts.negativeMarks,
    passMarkPct: opts.passMarkPct,
  });

  const now = Date.now();
  const elapsedMs = Math.min(
    Math.max(now - session.started_at, 0),
    session.time_limit_seconds * 1000
  );

  const details = JSON.stringify({
    v: 1,
    title: opts.title,
    topic: session.topic ?? '',
    paper,
    answers,
    flagged: progress?.flagged ?? [],
    marksPerQuestion: opts.marksPerQuestion ?? 1,
    negativeMarks: opts.negativeMarks ?? 0,
    // Enables an identical-config retry from the result screen (rule 25).
    timeLimitSeconds: session.time_limit_seconds,
  });

  // Idempotency guard: flip submitted_at FIRST so a crash between steps can
  // never produce two history rows for one attempt (rule 56).
  await updateExamSession(sessionId, { submitted_at: now, score: graded.score });

  const attemptId = await saveExamHistory({
    user_id: session.user_id,
    exam_type: opts.examType ?? (session.topic?.startsWith('custom:') ? 'custom' : 'model'),
    session_id: sessionId,
    score: graded.score,
    correct: graded.correct,
    wrong: graded.wrong,
    skipped: graded.skipped,
    total: graded.total,
    time_spent_ms: elapsedMs,
    percentage: graded.percentage,
    pass_mark: graded.passMarkPct,
    started_at: session.started_at,
    completed_at: now,
    details_json: details,
  });

  return { attemptId, graded, timeSpentMs: elapsedMs };
}

/** Convenience wrapper for hub screens checking resumable work (rule 24). */
export function findResumableSession(userId: string) {
  return getLatestActiveExamSession(userId);
}

