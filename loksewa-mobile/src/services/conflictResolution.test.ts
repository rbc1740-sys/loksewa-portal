/**
 * Conflict resolution tests (Phase 5 Step 3) — pure merge contracts for the
 * per-question progress tables, plus the strategy dispatch.
 */
import { describe, it, expect } from 'vitest';
import { mergeProgress, resolvePayload, strategyForTable } from './conflictResolution';

describe('strategyForTable', () => {
  it('routes per-question progress tables to progress_merge, everything else to lww', () => {
    expect(strategyForTable('user_progress')).toBe('progress_merge');
    expect(strategyForTable('sr_state')).toBe('progress_merge');
    for (const t of ['exam_history', 'exam_sessions', 'bookmarks', 'weak_points', 'user_profile', 'battle_sessions']) {
      expect(strategyForTable(t)).toBe('lww');
    }
  });
});

describe('mergeProgress (user_progress shape)', () => {
  const local = {
    id: 'u1_q1', user_id: 'u1', question_id: 'q1',
    selected_answer: 'B', is_correct: 1,
    attempt_count: 3, time_spent_ms: 45_000, last_attempted_at: 2_000,
  };
  const remote = {
    id: 'u1_q1', user_id: 'u1', question_id: 'q1',
    selected_answer: 'A', is_correct: 0,
    attempt_count: 5, time_spent_ms: 20_000, last_attempted_at: 3_000,
  };

  it('max-merges cumulative counters (never loses attempts, never double-counts)', () => {
    const merged = mergeProgress(local, remote);
    expect(merged.attempt_count).toBe(5); // max(3, 5)
    expect(merged.time_spent_ms).toBe(45_000); // max(45k, 20k)
  });

  it('takes state fields (last answer) from the most recent row', () => {
    // remote answered later (3000 > 2000) → its answer wins
    const merged = mergeProgress(local, remote);
    expect(merged.selected_answer).toBe('A');
    expect(merged.is_correct).toBe(0);
  });

  it('prefers the local row for state on equal timestamps (pushed row wins)', () => {
    const merged = mergeProgress(
      { ...local, last_attempted_at: 3_000 },
      { ...remote, last_attempted_at: 3_000 }
    );
    expect(merged.selected_answer).toBe('B');
  });

  it('treats missing/non-numeric fields as zero and keeps identity fields', () => {
    const merged = mergeProgress(
      { id: 'u1_q2', user_id: 'u1', question_id: 'q2', attempt_count: 2, last_attempted_at: 500 },
      {}
    );
    expect(merged.attempt_count).toBe(2);
    expect(merged.time_spent_ms).toBe(0);
    expect(merged.last_attempted_at).toBe(500);
    expect(merged.id).toBe('u1_q2');
    expect(merged.user_id).toBe('u1');
  });

  it('max-merges the later of both recency anchors', () => {
    const merged = mergeProgress(
      { ...local, last_attempted_at: 1_000, last_answered_at: 9_000 },
      { ...remote, last_answered_at: 4_000 }
    );
    expect(merged.last_attempted_at).toBe(3_000); // max(1000, 3000)
    expect(merged.last_answered_at).toBe(9_000);
  });
});

describe('mergeProgress (sr_state shape)', () => {
  it('uses last_answered_at as the recency anchor and max-merges totals', () => {
    const merged = mergeProgress(
      {
        id: 'u1_q3', question_id: 'q3', interval_days: 4, ease_factor: 2.5,
        attempts: 1, total_attempts: 6, total_correct: 4, total_wrong: 2,
        last_result: 'good', last_answered_at: 100,
      },
      {
        id: 'u1_q3', question_id: 'q3', interval_days: 8, ease_factor: 2.6,
        attempts: 1, total_attempts: 4, total_correct: 2, total_wrong: 2,
        last_result: 'again', last_answered_at: 200,
      }
    );
    expect(merged.total_attempts).toBe(6);
    expect(merged.total_correct).toBe(4);
    expect(merged.total_wrong).toBe(2);
    // remote answered most recently → its SM-2 state wins wholesale
    expect(merged.interval_days).toBe(8);
    expect(merged.ease_factor).toBe(2.6);
    expect(merged.last_result).toBe('again');
  });
});

describe('resolvePayload', () => {
  it('returns null for DELETE regardless of table', () => {
    expect(resolvePayload('user_progress', 'DELETE', { a: 1 }, { a: 2 })).toBeNull();
    expect(resolvePayload('bookmarks', 'DELETE', { a: 1 }, null)).toBeNull();
  });

  it('merges only when the table is a merge table AND a remote row exists', () => {
    const local = { attempt_count: 3, last_attempted_at: 2_000 };
    const remote = { attempt_count: 5, last_attempted_at: 3_000 };
    expect(resolvePayload('user_progress', 'UPDATE', local, remote)).toMatchObject({ attempt_count: 5 });

    // No remote copy → local passthrough
    expect(resolvePayload('user_progress', 'UPDATE', local, null)).toBe(local);
    // LWW table with a remote row → local wins untouched
    const lww = { id: 'a1', score: 4 };
    expect(resolvePayload('exam_history', 'INSERT', lww, { id: 'a1', score: 99 })).toBe(lww);
  });
});