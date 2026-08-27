import { describe, it, expect } from 'vitest';
import {
  gradeExam,
  parseExamQuestions,
  serializeProgress,
  deserializeProgress,
  deadlineState,
  formatDuration,
  EngineQuestion,
} from './examEngine';

const Q = (id: string, answer = 'a'): EngineQuestion => ({
  id,
  topic: 't',
  question: `Q ${id}`,
  options: { a: 'A', b: 'B', c: 'C', d: 'D' },
  answer,
});

describe('gradeExam', () => {
  const qs = [Q('q1'), Q('q2'), Q('q3', 'b'), Q('q4')];

  it('happy path: counts correct/wrong/skipped and computes percentages', () => {
    const g = gradeExam(qs, { q1: 'a', q3: 'b', q4: 'c' });
    expect(g.total).toBe(4);
    expect(g.correct).toBe(2);
    expect(g.wrong).toBe(1);
    expect(g.skipped).toBe(1);
    expect(g.attempted).toBe(3);
    expect(g.score).toBe(2);
    expect(g.maxScore).toBe(4);
    expect(g.accuracy).toBe(67);   // 2/3
    expect(g.percentage).toBe(50); // 2/4
    expect(g.passed).toBe(true);   // default pass mark 40
  });

  it('empty data: zero questions is a fail with zero division guards', () => {
    const g = gradeExam([], {});
    expect(g).toMatchObject({ total: 0, correct: 0, accuracy: 0, percentage: 0, passed: false });
  });

  it('negative marking applies per wrong answer and can go below zero', () => {
    const g = gradeExam([Q('a'), Q('b'), Q('c')], { a: 'x', b: 'y' }, { negativeMarks: 0.25 });
    expect(g.correct).toBe(0);
    expect(g.wrong).toBe(2);
    expect(g.skipped).toBe(1);
    expect(g.score).toBe(-0.5);
    expect(g.percentage).toBe(-17); // -0.5/3 → -16.67 rounds to -17
    expect(g.passed).toBe(false);
  });

  it('invalid options are ignored (negative inputs cannot increase penalty)', () => {
    const g = gradeExam([Q('z')], {}, { marksPerQuestion: -5, negativeMarks: -3 });
    expect(g.maxScore).toBe(0);
  });

  it('pass/fail boundary respects custom pass mark and rapid grading stays stable', () => {
    const ten = Array.from({ length: 10 }, (_, i) => Q(`q${i}`));
    const fiveRight = Object.fromEntries(ten.slice(0, 5).map(q => [q.id, q.answer]));
    expect(gradeExam(ten, fiveRight, { passMarkPct: 50 }).passed).toBe(true);
    expect(gradeExam(ten, fiveRight, { passMarkPct: 60 }).passed).toBe(false);
    // Rapid re-grade must be deterministic.
    expect(gradeExam(ten, fiveRight)).toEqual(gradeExam(ten, { ...fiveRight }));
  });
});

describe('parseExamQuestions', () => {
  it('parses DB rows with options_json strings and drops malformed rows', () => {
    const rows = [
      { id: 'ok1', topic: 'T', question: 'Fine?', options_json: '{"a":"1","b":"2"}', answer: 'b' },
      { id: 'bad-no-options', topic: 'T', question: 'X', options_json: '{}', answer: 'a' },
      { id: 'bad-answer-key', question: 'Y', options_json: '{"a":"1","b":"2"}', answer: 'zz' },
      { question: 'no id', options_json: '{"a":"1","b":"2"}', answer: 'a' },
    ];
    const parsed = parseExamQuestions(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: 'ok1', answer: 'b', options: { a: '1', b: '2' } });
  });

  it('handles garbage input without throwing (invalid data rule)', () => {
    expect(parseExamQuestions(null)).toEqual([]);
    expect(parseExamQuestions('nope')).toEqual([]);
    expect(parseExamQuestions([{ id: 42 }])).toEqual([]);
  });
});

describe('progress serialization & resume', () => {
  it('round-trips current-shape state exactly', () => {
    const state = { answers: { q1: 'a' }, flagged: ['q2'], currentIndex: 3, endAt: 1234567 };
    expect(deserializeProgress(serializeProgress(state))).toEqual(state);
  });

  it('reads legacy plain answer maps (backward compatible resume)', () => {
    expect(deserializeProgress(JSON.stringify({ q1: 'a', q9: 'd' }))).toEqual({
      answers: { q1: 'a', q9: 'd' },
      flagged: [],
      currentIndex: 0,
      endAt: 0,
    });
  });

  it('returns null for corrupt/empty payloads instead of crashing', () => {
    expect(deserializeProgress(null)).toBeNull();
    expect(deserializeProgress('{broken')).toBeNull();
    expect(deserializeProgress('"just a string"')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatDuration(65_000)).toBe('01:05');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
    expect(formatDuration(-5)).toBe('00:00');
  });
});

describe('deadlineState (rule 23 auto-submit boundary)', () => {
  const END_AT = 1_000_000;

  it('counts down while time remains', () => {
    expect(deadlineState(END_AT, 999_000)).toMatchObject({ remainingMs: 1000, expired: false });
    expect(deadlineState(END_AT, 950_000)).toMatchObject({ remainingMs: 50_000, expired: false });
  });

  it('flips expired exactly at the deadline', () => {
    // One ms before: still live.
    expect(deadlineState(END_AT, END_AT - 1)).toMatchObject({ expired: false });
    expect(deadlineState(END_AT, END_AT - 1).remainingMs).toBe(1);
    // At and past the deadline: expired, remaining floored to 0.
    expect(deadlineState(END_AT, END_AT)).toMatchObject({ expired: true, remainingMs: 0 });
    expect(deadlineState(END_AT, END_AT + 5_000)).toMatchObject({ expired: true, remainingMs: 0 });
  });

  it('never returns negative remaining time (display safe)', () => {
    const farFutureExpired = deadlineState(END_AT, END_AT + 999_999);
    expect(farFutureExpired.remainingMs).toBeGreaterThanOrEqual(0);
    expect(farFutureExpired.expired).toBe(true);
  });
});
