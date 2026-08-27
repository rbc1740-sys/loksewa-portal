/**
 * Conflict resolution (Phase 5 Step 3).
 *
 * The outbox delivers envelopes at-least-once across devices, so pushing a
 * local row can race with remote changes. Two strategies, dispatched by table:
 *
 * - `progress_merge` (user_progress, sr_state): these rows are per-question
 *   cumulative state. Counters (attempt_count, time_spent_ms, total_*) merge
 *   with max() — monotonic, never loses attempts, never double-counts on
 *   redelivery. Timestamps take the newer value. Everything else (SM-2 state,
 *   last answer) travels with whichever row answered most recently.
 *
 * - `lww` (everything else): last-write-wins. Exam attempts are immutable
 *   (one INSERT per session), bookmarks/weak-points/profile are single-owner
 *   documents — merge:true field-wise upsert is the correct resolution.
 *
 * Pure module: no Firebase, no React Native — fully unit-testable.
 */
export type MergeStrategy = 'progress_merge' | 'lww';

const MERGE_TABLES = new Set(['user_progress', 'sr_state']);

/** Which conflict strategy applies to a synced table. */
export function strategyForTable(tableName: string): MergeStrategy {
  return MERGE_TABLES.has(tableName) ? 'progress_merge' : 'lww';
}

/** Cumulative counters — max-merged so redelivery never double-counts. */
const COUNTER_FIELDS = [
  'attempt_count',
  'attempts',
  'time_spent_ms',
  'total_attempts',
  'total_correct',
  'total_wrong',
] as const;

/** Recency anchors — max-merged; drive the newest-wins decision. */
const TIMESTAMP_FIELDS = ['last_attempted_at', 'last_answered_at'] as const;

/** Identity fields — identical in both rows by construction; keep non-null. */
const IDENTITY_FIELDS = ['id', 'user_id', 'question_id'] as const;

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Merges a local per-question progress/state row against its remote copy.
 * Counters and timestamps: max(local, remote). State fields (SM-2 ease,
 * due_at, last answer/result): taken from the row that answered most
 * recently. Equal timestamps → local wins (the row being pushed).
 */
export function mergeProgress(
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): Record<string, unknown> {
  const localAt = Math.max(...TIMESTAMP_FIELDS.map(f => num(local[f])));
  const remoteAt = Math.max(...TIMESTAMP_FIELDS.map(f => num(remote[f])));
  const newest = localAt >= remoteAt ? local : remote;

  const out: Record<string, unknown> = { ...newest };
  for (const f of COUNTER_FIELDS) out[f] = Math.max(num(local[f]), num(remote[f]));
  for (const f of TIMESTAMP_FIELDS) out[f] = Math.max(num(local[f]), num(remote[f]));
  for (const k of IDENTITY_FIELDS) out[k] = local[k] ?? remote[k];
  return out;
}

/**
 * Computes the payload that should be persisted for one envelope.
 * Returns null only for DELETE (the caller removes the remote document).
 */
export function resolvePayload(
  tableName: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  local: Record<string, unknown>,
  remote: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (operation === 'DELETE') return null;
  if (strategyForTable(tableName) === 'progress_merge' && remote) {
    return mergeProgress(local, remote);
  }
  return local;
}