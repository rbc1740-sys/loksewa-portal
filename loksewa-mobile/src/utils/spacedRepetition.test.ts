import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SR_EASE_MIN,
  SR_EASE_DEFAULT,
  SR_INTERVALS,
  calculateNextInterval,
  getIntervalDescription,
  getSRStage,
  getSRStageColor,
  getNextReviewDate,
} from './spacedRepetition';

// The algorithm adds ±5% jitter; pin Math.random so intervals are exact.
describe('calculateNextInterval', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter factor = exactly 1
  });

  it('resets the card when the answer is wrong', () => {
    const result = calculateNextInterval(4, 2.5, false);
    expect(result).toEqual({ interval: 0, ease: 2.3, attempts: 0 });
  });

  it('never drops ease below SR_EASE_MIN', () => {
    expect(calculateNextInterval(3, 1.35, false).ease).toBe(SR_EASE_MIN);
    expect(calculateNextInterval(3, 1.0, false).ease).toBe(SR_EASE_MIN);
  });

  it('walks the fixed interval ladder on early successes', () => {
    let attempts = 0;
    const seen: number[] = [];

    for (let i = 0; i < SR_INTERVALS.length; i++) {
      const r = calculateNextInterval(attempts, SR_EASE_DEFAULT, true);
      seen.push(r.interval);
      attempts = r.attempts;
      expect(r.ease).toBe(SR_EASE_DEFAULT); // correct answers don't change ease
    }

    expect(seen).toEqual([...SR_INTERVALS]);
    expect(attempts).toBe(SR_INTERVALS.length);
  });

  it('grows past the table using the ease factor', () => {
    // newAttempts = 8 is one step beyond the table -> 300 * 2.5^1
    const result = calculateNextInterval(SR_INTERVALS.length + 0, SR_EASE_DEFAULT, true);
    expect(result.attempts).toBe(SR_INTERVALS.length + 1);
    expect(result.interval).toBe(Math.round(SR_INTERVALS[SR_INTERVALS.length - 1] * 2.5));
  });

  it('never returns an interval below 1 day even with heavy jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // jitter = 0.95 (lowest)
    expect(calculateNextInterval(0, SR_EASE_DEFAULT, true).interval).toBeGreaterThanOrEqual(1);
  });
});

describe('getIntervalDescription', () => {
  it('maps day counts to friendly labels', () => {
    expect(getIntervalDescription(0)).toBe('Again');
    expect(getIntervalDescription(1)).toBe('1 day');
    expect(getIntervalDescription(6)).toBe('6 days');
    expect(getIntervalDescription(14)).toBe('2 weeks');
    expect(getIntervalDescription(60)).toBe('2 months');
    expect(getIntervalDescription(400)).toBe('1 years'); // existing behaviour
  });
});

describe('getSRStage', () => {
  it('classifies by attempt count and interval', () => {
    expect(getSRStage(0, 0)).toBe('new');
    expect(getSRStage(1, 1)).toBe('learning');
    expect(getSRStage(2, 6)).toBe('learning');
    expect(getSRStage(3, 16)).toBe('review');
    expect(getSRStage(5, 75)).toBe('mastered');
  });
});

describe('getSRStageColor', () => {
  it('has a colour for every stage and a fallback', () => {
    for (const stage of ['new', 'learning', 'review', 'mastered']) {
      expect(getSRStageColor(stage)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(getSRStageColor('unknown')).toBe('#64748b');
  });
});

describe('getNextReviewDate', () => {
  it('adds the interval in days to today', () => {
    const before = new Date();
    const date = getNextReviewDate(6);
    const expected = new Date(before);
    expected.setDate(expected.getDate() + 6);
    expect(date.toDateString()).toBe(expected.toDateString());
  });
});