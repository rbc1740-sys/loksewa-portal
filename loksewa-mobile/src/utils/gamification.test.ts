import { describe, it, expect } from 'vitest';
import {
  XP_PER_CORRECT,
  XP_PER_WRONG,
  rankFromXp,
  nextStreakDays,
  localDateString,
  correctRewardForTry,
} from './gamification';

describe('rankFromXp', () => {
  it('starts at Bronze V for zero/negative/garbage XP', () => {
    expect(rankFromXp(0)).toEqual({ tier: 'Bronze', sub: 'V' });
    expect(rankFromXp(-10)).toEqual({ tier: 'Bronze', sub: 'V' });
  });

  it('walks the sub-ladder V → I inside a tier', () => {
    // Silver starts at 500, Gold at 1500 → span = 1000, steps of 200.
    expect(rankFromXp(500).tier).toBe('Silver');
    expect(rankFromXp(500).sub).toBe('V');
    expect(rankFromXp(699).sub).toBe('V');
    expect(rankFromXp(700).sub).toBe('IV');
    expect(rankFromXp(1499).sub).toBe('I');
  });

  it('promotes across tiers at exact thresholds', () => {
    expect(rankFromXp(499).tier).toBe('Bronze');
    expect(rankFromXp(500).tier).toBe('Silver');
    expect(rankFromXp(1_500).tier).toBe('Gold');
    expect(rankFromXp(3_000).tier).toBe('Platinum');
  });

  it('caps at Diamond I and never returns undefined parts', () => {
    const rank = rankFromXp(999_999);
    expect(rank.tier).toBe('Diamond');
    expect(rank.sub).toBe('I');
  });
});

describe('nextStreakDays', () => {
  const now = new Date('2026-08-26T15:00:00').getTime();
  const todayStr = localDateString(now);
  const yesterdayStr = localDateString(now - 24 * 60 * 60 * 1000);
  const twoDaysAgoStr = localDateString(now - 48 * 60 * 60 * 1000);

  it('starts a streak of 1 for a first-time user', () => {
    expect(nextStreakDays(null, 0, now)).toBe(1);
    expect(nextStreakDays(undefined, 0, now)).toBe(1);
  });

  it('keeps the streak when already active today', () => {
    expect(nextStreakDays(todayStr, 7, now)).toBe(7);
    expect(nextStreakDays(todayStr, 0, now)).toBe(1);
  });

  it('increments when the last active day was yesterday', () => {
    expect(nextStreakDays(yesterdayStr, 7, now)).toBe(8);
  });

  it('resets to 1 after a gap of two or more days', () => {
    expect(nextStreakDays(twoDaysAgoStr, 30, now)).toBe(1);
  });
});

describe('XP constants', () => {
  it('correct answers reward more than wrong answers (multi-try practice)', () => {
    expect(XP_PER_CORRECT).toBeGreaterThan(0);
    expect(XP_PER_WRONG).toBeGreaterThan(0); // base value; wrong picks negate it (-XP_PER_WRONG)
    expect(XP_PER_CORRECT).toBeGreaterThan(XP_PER_WRONG); // correct pays more
  });

  it('scales correct-answer reward by try number (multi-try practice)', () => {
    expect(correctRewardForTry(1)).toBe(10); // full XP first try
    expect(correctRewardForTry(2)).toBe(5);
    expect(correctRewardForTry(3)).toBe(2);
    expect(correctRewardForTry(4)).toBe(1);
    expect(correctRewardForTry(7)).toBe(1); // 4th+ try floors at 1
    // Safe inputs:
    expect(correctRewardForTry(0)).toBe(10);
    expect(correctRewardForTry(-3)).toBe(10);
    expect(correctRewardForTry(1.9)).toBe(10); // floored
  });
});
