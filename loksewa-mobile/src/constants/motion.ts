/**
 * Motion tokens — subtle, professional motion only (master-prompt rule 22).
 * Screen transitions, feedback and progress use these durations/easings so
 * nothing bounces, flashes or jumps. Pair with `useReducedMotion` where the
 * platform exposes it.
 */
export const motion = {
  /** Micro feedback (option press, icon tap). */
  fast: 120,
  /** Answer-state color transitions, progress movement. */
  base: 180,
  /** Progress bars, sheet enter/exit. */
  slow: 320,
  easing: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)' as const,
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)' as const,
  },
} as const;
