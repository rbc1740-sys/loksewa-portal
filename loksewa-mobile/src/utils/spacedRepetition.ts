/**
 * Spaced Repetition (SM-2) Algorithm
 * Ported from web app's core-logic.js
 */

export const SR_EASE_MIN = 1.3;
export const SR_EASE_DEFAULT = 2.5;
export const SR_INTERVALS = [1, 6, 16, 35, 75, 150, 300]; // days

export interface SRResult {
  interval: number;
  ease: number;
  attempts: number;
}

/**
 * Calculates next interval using SM-2 algorithm
 * @param attempts - Current successful attempts count
 * @param easeFactor - Current ease factor (default 2.5, min 1.3)
 * @param wasCorrect - Whether the answer was correct
 */
export function calculateNextInterval(
  attempts: number,
  easeFactor: number,
  wasCorrect: boolean
): SRResult {
  if (!wasCorrect) {
    return {
      interval: 0,
      ease: Math.max(SR_EASE_MIN, easeFactor - 0.2),
      attempts: 0,
    };
  }

  let newAttempts = attempts + 1;
  let newInterval: number;

  if (newAttempts === 1) newInterval = SR_INTERVALS[0];
  else if (newAttempts === 2) newInterval = SR_INTERVALS[1];
  else if (newAttempts <= SR_INTERVALS.length) newInterval = SR_INTERVALS[newAttempts - 1];
  else newInterval = Math.round(SR_INTERVALS[SR_INTERVALS.length - 1] * Math.pow(easeFactor, newAttempts - SR_INTERVALS.length));

  // Add small random jitter (±5%) to prevent synchronization
  const jitter = 1 + (Math.random() - 0.5) * 0.1;
  newInterval = Math.max(1, Math.round(newInterval * jitter));

  return {
    interval: newInterval,
    ease: easeFactor,
    attempts: newAttempts,
  };
}

/**
 * Gets human-readable interval description
 */
export function getIntervalDescription(intervalDays: number): string {
  if (intervalDays === 0) return 'Again';
  if (intervalDays === 1) return '1 day';
  if (intervalDays < 7) return `${intervalDays} days`;
  if (intervalDays < 30) return `${Math.round(intervalDays / 7)} weeks`;
  if (intervalDays < 365) return `${Math.round(intervalDays / 30)} months`;
  return `${Math.round(intervalDays / 365)} years`;
}

/**
 * Calculates next review date
 */
export function getNextReviewDate(intervalDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + intervalDays);
  return date;
}

/**
 * Determines SR stage based on attempts and interval
 */
export function getSRStage(attempts: number, intervalDays: number): 'new' | 'learning' | 'review' | 'mastered' {
  if (attempts === 0) return 'new';
  if (attempts < 3) return 'learning';
  if (intervalDays < 30) return 'review';
  return 'mastered';
}

/**
 * Gets color for SR stage
 */
export function getSRStageColor(stage: string): string {
  switch (stage) {
    case 'new': return '#ef4444';
    case 'learning': return '#f59e0b';
    case 'review': return '#3b82f6';
    case 'mastered': return '#10b981';
    default: return '#64748b';
  }
}