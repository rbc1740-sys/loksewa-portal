import { describe, it, expect } from 'vitest';
import { summarizeMistakes } from './mistakes';

describe('summarizeMistakes', () => {
  it('returns zeros for empty and null inputs (empty state)', () => {
    expect(summarizeMistakes([])).toEqual({
      total: 0,
      bySubject: [],
      byChapter: [],
      unmapped: 0,
    });
    expect(summarizeMistakes(null as unknown as never[]).total).toBe(0);
  });

  it('groups wrong answers by catalog subject and chapter', () => {
    const summary = summarizeMistakes([
      { id: 'q1', topic: 'Surveying Engineering' },
      { id: 'q2', topic: 'Surveying Engineering' },
      { id: 'q3', topic: 'Concrete Technology' },
      { id: 'q4', topic: 'UNO, SAARC & BIMSTEC' },
    ]);

    expect(summary.total).toBe(4);
    expect(summary.unmapped).toBe(0);

    expect(summary.bySubject[0]).toMatchObject({ key: 'ce_technical', count: 3 });
    expect(summary.bySubject[1]).toMatchObject({ key: 'ce_gk', count: 1 });

    const chapters = Object.fromEntries(summary.byChapter.map(c => [c.key, c.count]));
    expect(chapters['ce_surveying']).toBe(2);
    expect(chapters['ce_concrete']).toBe(1);
    expect(chapters['gk_uno_saarc']).toBe(1);
  });

  it('sorts groups by count desc then name asc (deterministic order)', () => {
    const summary = summarizeMistakes([
      { id: 'a', topic: 'Current Affairs' },
      { id: 'b', topic: 'Geography of Nepal' },
      { id: 'c', topic: 'Public Policy' },
    ]);
    // All three are ce_gk → subject group stable; chapter ties sort by name.
    const names = summary.byChapter.map(c => c.display);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));
  });

  it('counts unmapped topics separately without throwing (invalid data)', () => {
    const summary = summarizeMistakes([
      { id: 'x', topic: 'Definitely Not A Real Topic' },
      { id: 'y' },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.unmapped).toBe(2);
    expect(summary.bySubject[0]).toMatchObject({ key: 'other', count: 2 });
  });
});
