import { describe, it, expect } from 'vitest';
import { parseDetails } from './examDetails';

const OK = (over: Record<string, unknown> = {}) => JSON.stringify(over);

describe('parseDetails (rule 69: tolerant, never crash)', () => {
  it('returns null for empty / absent payloads', () => {
    expect(parseDetails(undefined)).toBeNull();
    expect(parseDetails(null)).toBeNull();
    expect(parseDetails('')).toBeNull();
  });

  it('returns null for malformed / wrong-type JSON', () => {
    expect(parseDetails('{broken')).toBeNull();
    expect(parseDetails('"just a string"')).toBeNull(); // primitive, not object
    expect(parseDetails('42')).toBeNull();
    expect(parseDetails('[1, 2, 3]')).toBeNull(); // array is not an attempt object
  });

  it('yields a populated record with safe defaults when fields are well-typed', () => {
    const d = parseDetails(OK({ title: 'Full Mock', topic: 'model', timeLimitSeconds: 3600 }))!;
    expect(d).not.toBeNull();
    expect(d.title).toBe('Full Mock');
    expect(d.topic).toBe('model');
    expect(d.timeLimitSeconds).toBe(3600);
    expect(d.answers).toEqual({}); // defaults to empty answer map
    expect(d.paper).toBeUndefined();
  });

  it('preserves paper and answers when present', () => {
    const paper = [{ id: 'q1', topic: 't', question: 'Q?', options: { a: 'A', b: 'B' }, answer: 'a' }];
    const d = parseDetails(OK({ title: 'T', paper, answers: { q1: 'a' }, timeLimitSeconds: 900 }))!;
    expect(d.paper).toHaveLength(1);
    expect(d.answers).toEqual({ q1: 'a' });
    expect(d.timeLimitSeconds).toBe(900);
  });

  it('ignores wrong-typed fields instead of crashing (graceful degradation)', () => {
    const d = parseDetails(OK({ title: 123, timeLimitSeconds: '300', paper: 'x', answers: 'y' }))!;
    expect(d.title).toBeUndefined(); // number rejected
    expect(d.timeLimitSeconds).toBeUndefined(); // string rejected
    expect(d.paper).toBeUndefined(); // non-array rejected
    expect(d.answers).toEqual({}); // non-object rejected -> default empty
  });

  it('still parses when extra unknown keys are present (forward compatible)', () => {
    const d = parseDetails(OK({ v: 1, title: 'T', mystery: { a: 1 } }))!;
    expect(d.title).toBe('T');
  });
});
