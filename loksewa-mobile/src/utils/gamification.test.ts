import { describe, it, expect } from 'vitest';
import {
  XP_PER_CORRECT,
  XP_PER_WRONG,
  rankFromXp,
  nextStreakDays,
  localDateString,
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
  it('reward correct answers more than wrong ones', () => {
    expect(XP_PER_CORRECT).toBeGreaterThan(XP_PER_WRONG);
    expect(XP_PER_WRONG).toBeGreaterThan(0); // participation XP
  });
});
