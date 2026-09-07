/**
 * Sync worker triggers — owns WHEN the outbox drains (Phase 5 Step 2).
 *
 * `processSyncQueue()` in ./sync owns the HOW (drain semantics); this module
 * adds the trigger loop from the implementation plan: drain on app focus,
 * periodically while running, and on demand. No connectivity SDK is used —
 * offline drains fail harmlessly (outbox rows are retained with bounded
 * retries), so network detection is an optimization, not a correctness need.
 * Only core React Native primitives (AppState, setInterval) are required.
 */
import { AppState, type AppStateStatus } from 'react-native';
import {
  createFirestoreSyncTransport,
  processSyncQueue,
  type SyncRunOptions,
  type SyncRunResult,
  type SyncTransport,
} from './sync';

export interface SyncWorkerOptions {
  /** Options forwarded to every processSyncQueue call. */
  runOptions?: SyncRunOptions;
  /** Periodic drain interval in ms (default 5 minutes, per plan). */
  intervalMs?: number;
  /** Transport override (tests inject a stub; default is Firestore). */
  transport?: SyncTransport;
  /** Gate — return false to skip a drain cycle entirely (e.g. signed out). */
  enabled?: () => boolean;
  /** Error sink for unexpected drain failures (default: console.warn). */
  onError?: (e: unknown) => void;
}

export interface SyncWorkerHandle {
  /** Trigger a drain immediately (deduped with any in-flight cycle). */
  syncNow(): Promise<SyncRunResult>;
  /** Detach listeners and clear the periodic timer. */
  stop(): void;
}

export function startSyncWorker(opts: SyncWorkerOptions = {}): SyncWorkerHandle {
  const intervalMs = opts.intervalMs ?? 5 * 60_000;
  const enabled = opts.enabled ?? (() => true);
  const onError = opts.onError ?? ((e: unknown) => console.warn('[SyncWorker] drain failed:', e));

  // At most one drain in flight — focus + timer can overlap; extra triggers
  // collapse into a no-op rather than double-delivering envelopes.
  let inFlight = false;

  const drain = async (): Promise<SyncRunResult> => {
    if (inFlight || !enabled()) return { attempted: 0, succeeded: 0, failed: 0 };
    inFlight = true;
    try {
      const transport = opts.transport ?? createFirestoreSyncTransport();
      return await processSyncQueue(transport, opts.runOptions);
    } catch (e) {
      // processSyncQueue already isolates per-envelope failures; this only
      // guards unexpected infrastructure errors (transport construction, DB).
      onError(e);
      return { attempted: 0, succeeded: 0, failed: 0 };
    } finally {
      inFlight = false;
    }
  };

  const onAppStateChange = (status: AppStateStatus): void => {
    if (status === 'active') void drain();
  };
  const subscription = AppState.addEventListener('change', onAppStateChange);
  const timer = setInterval(() => void drain(), intervalMs);

  return {
    syncNow: drain,
    stop: () => {
      subscription.remove();
      clearInterval(timer);
    },
  };
}