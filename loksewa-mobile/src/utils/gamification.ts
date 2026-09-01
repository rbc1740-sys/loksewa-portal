/**
 * Gamification helpers (pure functions)
 *
 * Single source of truth for XP rewards, day-streak calculation and the
 * Bronze → Diamond rank ladder. Kept free of any React Native / SQLite
 * imports so it can be unit-tested in plain node (see gamification.test.ts).
 */

export const XP_PER_CORRECT = 10;
export const XP_PER_WRONG = 2;

/**
 * Scaled reward for a correct answer in multi-try practice — accuracy pays:
 * 1st try = full XP, then 5/2/1. Wrong picks apply XP_PER_WRONG as a penalty
 * instead of the participation XP granted in the single-try flow.
 */
export const CORRECT_REWARD_SCALE = [XP_PER_CORRECT, 5, 2, 1];

export function correctRewardForTry(tryNumber: number): number {
  const n = Math.max(1, Math.floor(tryNumber || 1));
  return CORRECT_REWARD_SCALE[Math.min(n, CORRECT_REWARD_SCALE.length) - 1] ?? XP_PER_CORRECT;
}

export interface Rank {
  tier: string;
  sub: string;
}

/** Rank ladder thresholds. A tier spans [threshold, nextThreshold). */
const RANK_TIERS: { name: string; threshold: number }[] = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 500 },
  { name: 'Gold', threshold: 1_500 },
  { name: 'Platinum', threshold: 3_000 },
  { name: 'Diamond', threshold: 6_000 },
];

const SUB_LADDER = ['V', 'IV', 'III', 'II', 'I'];

/** Local-calendar date string (YYYY-MM-DD) for a timestamp. */
export function localDateString(ts: number = Date.now()): string {
  const d = new Date(ts);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Derives the full rank (tier + sub-tier) from total XP.
 * Top tier shows sub "I"; otherwise progress inside the tier maps to V..I.
 */
export function rankFromXp(xp: number): Rank {
  const safeXp = Math.max(0, Math.floor(xp || 0));

  let index = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (safeXp >= RANK_TIERS[i].threshold) index = i;
  }

  const current = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1];

  if (!next) return { tier: current.name, sub: 'I' };

  const span = next.threshold - current.threshold;
  const progress = Math.min(0.9999, (safeXp - current.threshold) / span);
  const step = Math.floor(progress * SUB_LADDER.length);

  return { tier: current.name, sub: SUB_LADDER[step] };
}

/**
 * Computes the new streak value after activity at time `now`.
 * - Same local day as last activity → unchanged (min 1 once active).
 * - Exactly the previous local day → streak + 1.
 * - Anything older → reset to 1.
 */
export function nextStreakDays(
  lastActiveDate: string | null | undefined,
  currentStreak: number,
  now: number = Date.now()
): number {
  const today = localDateString(now);

  if (!lastActiveDate) return 1;
  if (lastActiveDate === today) return Math.max(1, currentStreak || 0);

  const yesterday = localDateString(now - 24 * 60 * 60 * 1000);
  if (lastActiveDate === yesterday) return (currentStreak || 0) + 1;

  return 1;
}
