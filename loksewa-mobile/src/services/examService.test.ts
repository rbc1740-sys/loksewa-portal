/**
 * Exam Service lifecycle tests (rules 23, 24, 27, 56).
 *
 * The native `expo-sqlite` module must never load during unit tests, so we mock
 * the entire `./database` surface with an in-memory store. All examService
 * logic (paper sampling, freezing, grading, idempotent submit) is exercised
 * against that mock, exactly as the result page would read it back.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Hoisted shared state — visible to the mock factory (hoisted above imports). */
const state = vi.hoisted(() => ({
  sessions: new Map<string, Record<string, unknown>>(),
  history: new Map<string, Record<string, unknown>>(),
  syncQueue: [] as Array<Record<string, unknown>>,
  questions: [] as Array<Record<string, unknown>>,
  seq: 0,
}));

vi.mock('./database', () => {
  // Defined as bindings first so saveExamHistory can invoke queueSync exactly
  // as the real database.ts does (envelope queued after durable persistence).
  const queueSync = vi.fn(
    async (table: string, recordId: string, operation: string, payload: Record<string, unknown>) => {
      state.syncQueue.push({ table, record_id: recordId, operation, payload });
    }
  );
  const saveExamHistory = vi.fn(async (r: Record<string, unknown>) => {
    const id = (r.id as string | undefined) ?? `${r.user_id}_eh_${r.session_id ?? state.seq++}`;
    state.history.set(id, { id, ...r });
    // Mirror the real database.ts (rule 56): the sync envelope is queued only
    // AFTER the history row is durably persisted locally.
    await queueSync('exam_history', id, 'INSERT', { id, user_id: r.user_id, session_id: r.session_id });
    return id;
  });
  return {
    createExamSession: vi.fn(async (s: Record<string, unknown>) => {
      const id = `exam_${s.user_id}_${Date.now()}_${state.seq++}`;
      state.sessions.set(id, { id, ...s });
      return id;
    }),
    getExamSession: vi.fn(async (id: string) => state.sessions.get(id) ?? null),
    getLatestActiveExamSession: vi.fn(async (uid: string) => {
      let latest: Record<string, unknown> | null = null;
      for (const s of state.sessions.values()) {
        if (s.user_id === uid && !s.submitted_at && (!latest || (s.started_at as number) > (latest.started_at as number))) {
          latest = s;
        }
      }
      return latest;
    }),
    getQuestionsBySubject: vi.fn(async (subjectId: string, limit = 500) =>
      state.questions.filter(q => q.subject_id === subjectId).slice(0, limit)
    ),
    getAllQuestions: vi.fn(async () => state.questions),
    updateExamSession: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const s = state.sessions.get(id);
      if (s) Object.assign(s, updates);
    }),
    saveExamHistory,
    queueSync,
  };
});

import {
  startExam,
  startCustomExamSession,
  submitExamSession,
  loadActiveSession,
  persistExamProgress,
} from './examService';
import type { ExamProgressState } from './examEngine';
import type { CustomExam } from './customExamStore';

/** Candidate rows shaped for parseExamQuestions (options_json string form). */
function makeRows(n: number, subject = 'ce_technical', chapter?: string) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${subject}_${chapter ?? 'all'}_${i}`,
    topic: subject,
    question: `Q${i}?`,
    options_json: JSON.stringify({ a: 'A', b: 'B', c: 'C', d: 'D' }),
    answer: 'a',
    chapter_id: chapter,
    subject_id: subject,
  }));
}

function baseExam(overrides: Partial<CustomExam> = {}): CustomExam {
  return {
    id: 'cex_u1_zzz', user_id: 'u1', title: 'Ch A Only', description: null,
    durationSeconds: 900, marksPerQuestion: 1, negativeMarks: 0, passPercent: 50,
    subjectIds: ['ce_technical'], chapterIds: [], questionCount: 5,
    attempts: 0, best_percent: 0, created_at: 0, updated_at: 0, ...overrides,
  };
}

describe('examService.startExam', () => {
  beforeEach(() => { state.sessions.clear(); state.history.clear(); state.questions = []; state.seq = 0; });

  it('samples a paper, freezes it into the session, and writes a resumable row', async () => {
    const rows = makeRows(25);
    const { sessionId } = await startExam({ userId: 'u1', rows, count: 12, durationMinutes: 15, topicLabel: 'subject:ce_technical' });

    const s = state.sessions.get(sessionId);
    expect(s).toBeTruthy();
    expect(s!.user_id).toBe('u1');
    expect(s!.topic).toBe('subject:ce_technical');
    expect(s!.question_count).toBe(12);
    expect(s!.time_limit_seconds).toBe(15 * 60);
    expect(s!.submitted_at).toBeUndefined();

    const paper = JSON.parse(s!.questions_json as string);
    expect(paper).toHaveLength(12);

    const prog = JSON.parse(s!.answers_json as string);
    expect(prog.v).toBe(1);
    expect(prog.answers).toEqual({});
    expect(prog.endAt).toBeGreaterThan(Date.now());

    const active = await loadActiveSession(sessionId);
    expect(active?.paper).toHaveLength(12);
    expect(active?.session.submitted_at).toBeUndefined();
  });

  it('throws when the candidate pool is exhausted (rule 23 integrity)', async () => {
    await expect(startExam({ userId: 'u1', rows: [], count: 10, durationMinutes: 5, topicLabel: 'x' }))
      .rejects.toThrow(/Not enough questions/);
    expect(state.sessions.size).toBe(0);
  });
});
describe('examService.startCustomExamSession', () => {
  beforeEach(() => { state.sessions.clear(); state.history.clear(); state.questions = []; state.seq = 0; });

  it('narrows the paper by selected chapter and labels the session topic (rule 27)', async () => {
    state.questions = [
      ...makeRows(8, 'ce_technical', 'ch_a'),
      ...makeRows(8, 'ce_technical', 'ch_b'),
      ...makeRows(8, 'ce_gk', 'ch_c'),
    ];

    const { sessionId } = await startCustomExamSession('u1', baseExam({ chapterIds: ['ch_a'] }));
    const s = state.sessions.get(sessionId);
    expect(s!.topic).toBe('custom:cex_u1_zzz');

    const paper = JSON.parse(s!.questions_json as string);
    expect(paper).toHaveLength(5);
    const allFromA = paper.every((q: { id: string }) => {
      const src = state.questions.find(r => r.id === q.id);
      return src?.chapter_id === 'ch_a';
    });
    expect(allFromA).toBe(true);
  });

  it('falls back to all chapters when chapterIds is empty', async () => {
    state.questions = [...makeRows(3, 'ce_technical', 'ch_a'), ...makeRows(3, 'ce_technical', 'ch_b')];
    const { sessionId } = await startCustomExamSession('u1', baseExam({ chapterIds: [] }));
    const paper = JSON.parse((state.sessions.get(sessionId) as any).questions_json);
    expect(paper).toHaveLength(5);
    const chapters = new Set(paper.map((q: { id: string }) => {
      const src = state.questions.find(r => r.id === q.id);
      return src?.chapter_id;
    }));
    expect(chapters).toEqual(new Set(['ch_a', 'ch_b']));
  });
});

describe('examService.submitExamSession (idempotent, rule 56)', () => {
  beforeEach(() => {
    state.sessions.clear();
    state.history.clear();
    state.syncQueue = [];
    state.questions = [];
    state.seq = 0;
  });

  it('grades once, writes one history row with reviewable details, flips submitted_at first', async () => {
    const { sessionId } = await startExam({ userId: 'u1', rows: makeRows(5, 'ce_technical', 'ch_a'), count: 5, durationMinutes: 5, topicLabel: 'model:test' });
    const active = await loadActiveSession(sessionId);
    const paper = active!.paper;
        const answers = Object.fromEntries(paper.slice(0, 4).map(q => [q.id, q.answer]));
    const progress: ExamProgressState = { answers, flagged: [], currentIndex: 4, endAt: active!.progress?.endAt ?? 0 };
    await persistExamProgress(sessionId, progress);

    const res = await submitExamSession(sessionId, { title: 'T', examType: 'model', marksPerQuestion: 1, negativeMarks: 0, passMarkPct: 50 });
    expect(res.graded.correct).toBe(4);
    expect(res.graded.wrong).toBe(0);
    expect(res.graded.skipped).toBe(1);
    expect(res.graded.score).toBe(4);
    expect(res.attemptId).toBeTruthy();

    expect(state.history.size).toBe(1);
    const hist = state.history.values().next().value as Record<string, unknown>;
    expect(hist.exam_type).toBe('model');
    expect(hist.score).toBe(4);
    expect(hist.details_json).toBeTruthy();
    const details = JSON.parse(hist.details_json as string);
    expect(details.paper).toHaveLength(5);
    expect(details.answers).toEqual(answers);
    expect((state.sessions.get(sessionId) as any).submitted_at).toBeTypeOf('number');
    expect((state.sessions.get(sessionId) as any).score).toBe(4);
  });

  it('enqueues the attempt for cloud sync only after the history row is persisted (rule 56 / sync envelope)', async () => {
    const { sessionId } = await startExam({ userId: 'u1', rows: makeRows(5, 'ce_technical', 'ch_a'), count: 5, durationMinutes: 5, topicLabel: 'model:test' });
    const active = await loadActiveSession(sessionId);
    const progress: ExamProgressState = {
      answers: Object.fromEntries(active!.paper.slice(0, 3).map(q => [q.id, q.answer])),
      flagged: [],
      currentIndex: 3,
      endAt: active!.progress?.endAt ?? 0,
    };
    await persistExamProgress(sessionId, progress);

    const { attemptId } = await submitExamSession(sessionId, { title: 'T', examType: 'model', marksPerQuestion: 1, negativeMarks: 0, passMarkPct: 50 });

    // Exactly one history row written first ...
    expect(state.history.size).toBe(1);
    expect((state.history.get(attemptId) as Record<string, unknown>).id).toBe(attemptId);
    // ... and exactly one sync envelope queued for exam_history, carrying the attempt id.
    expect(state.syncQueue).toHaveLength(1);
    const q = state.syncQueue[0];
    expect(q.table).toBe('exam_history');
    expect(q.record_id).toBe(attemptId);
    expect(q.operation).toBe('INSERT');
    expect(q.payload).toMatchObject({ id: attemptId, user_id: 'u1' });
  });

  it('refuses a second submission (idempotent under crash/retry, rule 56)', async () => {
    const { sessionId } = await startExam({ userId: 'u1', rows: makeRows(5, 'ce_technical', 'ch_a'), count: 5, durationMinutes: 5, topicLabel: 'model:test' });
    const opts = { title: 'T', examType: 'model' as const, marksPerQuestion: 1, negativeMarks: 0, passMarkPct: 50 };
    await submitExamSession(sessionId, opts);
    await expect(submitExamSession(sessionId, opts)).rejects.toThrow(/already submitted/);
    expect(state.history.size).toBe(1);
    // Idempotency: the rejected second submit emits no extra sync envelope.
    expect(state.syncQueue.length).toBe(1);
  });
});
