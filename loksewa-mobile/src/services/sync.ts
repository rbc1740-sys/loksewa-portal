/**
 * Sync worker — drains the offline outbox (`sync_queue`) to the cloud.
 *
 * Phase 5 Step 1. The database layer only *enqueues* envelopes (`queueSync`,
 * called after each durable local write — rule 56); this module owns the drain
 * side: read pending rows via getPendingSync(), hand each to an injectable
 * transport, then either markSyncSuccess() (row deleted) or markSyncFailure()
 * (retry_count++). Retries are bounded because getPendingSync() stops returning
 * rows once retry_count reaches 3.
 *
 * No Firebase module is imported at module load — the Firestore transport is
 * built lazily on first call, so unit tests (and offline-only runs) never load
 * the native Firebase/RN chain.
 */
import {
  getPendingSync,
  markSyncSuccess,
  markSyncFailure,
  type SyncQueueItem,
} from './database';
import { resolvePayload, strategyForTable } from './conflictResolution';

/**
 * Delivers one envelope to the cloud. Implementations MUST be idempotent —
 * the outbox provides at-least-once delivery, so a redelivered envelope may
 * arrive after a crash between transport success and markSyncSuccess().
 */
export type SyncTransport = (
  item: SyncQueueItem,
  payload: Record<string, unknown>
) => Promise<void>;

export interface SyncRunResult {
  /** Envelopes pulled from the queue this run. */
  attempted: number;
  /** Envelopes delivered and removed from the queue. */
  succeeded: number;
  /** Envelopes that failed (row retained, retry_count incremented). */
  failed: number;
}

export interface SyncRunOptions {
  /** Max envelopes fetched per page (default 25). */
  batchSize?: number;
  /** Max pages per run — bounds a single drain so a caller can yield (default 10). */
  maxBatches?: number;
}

/**
 * Drains pending envelopes page by page. A failing envelope never blocks its
 * neighbours: the error is logged, retry_count is incremented, and the loop
 * continues with the next item. Malformed (poison) payloads are counted as
 * failures without invoking the transport, so they age out via retry bound.
 */
export async function processSyncQueue(
  transport: SyncTransport,
  opts: SyncRunOptions = {}
): Promise<SyncRunResult> {
  const batchSize = opts.batchSize ?? 25;
  const maxBatches = opts.maxBatches ?? 10;
  const result: SyncRunResult = { attempted: 0, succeeded: 0, failed: 0 };

  for (let batch = 0; batch < maxBatches; batch++) {
    const pending = await getPendingSync(batchSize);
    if (!pending.length) break;

    for (const item of pending) {
      result.attempted++;
      try {
        const payload = JSON.parse(item.payload_json) as unknown;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('payload_json is not a JSON object');
        }
        await transport(item, payload as Record<string, unknown>);
        if (item.id !== undefined) await markSyncSuccess(item.id);
        result.succeeded++;
      } catch (e) {
        // Keep the row and bump retry_count — getPendingSync() drops the row
        // once retry_count reaches 3, so retries are bounded.
        console.warn(
          `[Sync] ${item.table_name}/${item.record_id} failed (retry ${item.retry_count + 1})`,
          e
        );
        if (item.id !== undefined) await markSyncFailure(item.id);
        result.failed++;
      }
    }

    // Partial page => the queue is drained; no need to ask again.
    if (pending.length < batchSize) break;
  }

  return result;
}

/**
 * Firestore-backed transport. Envelopes map 1:1 to documents:
 * `INSERT`/`UPDATE` → setDoc(merge:true), `DELETE` → deleteDoc. merge:true
 * keeps redelivery idempotent under at-least-once semantics.
 */
export function createFirestoreSyncTransport(): SyncTransport {
  return async (item, payload) => {
    // Lazy imports: firebase + our auth module must never load in unit tests.
    const [
      { doc, setDoc, deleteDoc, getDoc, serverTimestamp },
      { getFirestoreInstance },
    ] = await Promise.all([import('firebase/firestore'), import('./auth')]);
    const db = getFirestoreInstance();
    const ref = doc(db, item.table_name, item.record_id);
    if (item.operation === 'DELETE') {
      await deleteDoc(ref);
      return;
    }
    if (strategyForTable(item.table_name) === 'progress_merge') {
      // Per-question progress/state races across devices: read the remote copy
      // and let resolvePayload merge counters + newest-wins state (Phase 5.3).
      const snap = await getDoc(ref);
      const remote = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      const merged = resolvePayload(item.table_name, item.operation, payload, remote);
      await setDoc(ref, { ...merged, synced_at: serverTimestamp() }, { merge: true });
      return;
    }
    // Last-write-wins tables: field-wise merge upsert, idempotent under
    // at-least-once redelivery.
    await setDoc(ref, { ...payload, synced_at: serverTimestamp() }, { merge: true });
  };
}

/** Convenience: drain the outbox using the default Firestore transport. */
export async function syncNow(opts?: SyncRunOptions): Promise<SyncRunResult> {
  return processSyncQueue(createFirestoreSyncTransport(), opts);
}