/**
 * Sync worker trigger tests (Phase 5 Step 2).
 *
 * `./sync` and `react-native` are both mocked: the former to control drain
 * outcomes, the latter to capture the AppState listener and drive focus events
 * manually. Contracts: drain on foreground, concurrency dedupe, periodic
 * interval, enabled gate, stop() teardown, and error containment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processSyncQueue: vi.fn(),
  createFirestoreSyncTransport: vi.fn(),
}));

vi.mock('./sync', () => mocks);

vi.mock('react-native', () => {
  let listener: ((status: string) => void) | null = null;
  const remove = vi.fn(() => {
    listener = null;
  });
  return {
    AppState: {
      addEventListener: vi.fn((_event: string, cb: (status: string) => void) => {
        listener = cb;
        return { remove };
      }),
      /** Test seam: simulate an OS app-state change. */
      emit: (status: string) => listener?.(status),
      /** Test seam: the remove fn of the most recent subscription. */
      __remove: remove,
    },
  };
});

import { AppState } from 'react-native';
import { startSyncWorker } from './syncWorker';

const DRAIN_OK = { attempted: 1, succeeded: 1, failed: 0 };
const DRAIN_IDLE = { attempted: 0, succeeded: 0, failed: 0 };

beforeEach(() => {
  vi.mocked(AppState.addEventListener).mockClear();
  vi.mocked((AppState as unknown as { __remove: ReturnType<typeof vi.fn> }).__remove).mockClear();
  mocks.processSyncQueue.mockReset().mockResolvedValue(DRAIN_OK);
  mocks.createFirestoreSyncTransport.mockReset().mockReturnValue('transport-stub');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startSyncWorker', () => {
  it('drains when the app comes to the foreground, not in the background', () => {
    const worker = startSyncWorker({ intervalMs: 60_000 });

    (AppState as unknown as { emit: (s: string) => void }).emit('background');
    expect(mocks.processSyncQueue).not.toHaveBeenCalled();

    (AppState as unknown as { emit: (s: string) => void }).emit('active');
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(1);
    expect(mocks.processSyncQueue).toHaveBeenCalledWith('transport-stub', undefined);

    worker.stop();
  });

  it('collapses overlapping triggers into a single drain (concurrency guard)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.processSyncQueue.mockImplementationOnce(() => gate.then(() => DRAIN_OK));

    const worker = startSyncWorker({ intervalMs: 60_000 });
    const emit = (AppState as unknown as { emit: (s: string) => void }).emit;

    emit('active'); // drain #1 starts, blocked on the gate
    emit('active'); // in-flight → collapsed to a no-op
    emit('active'); // still collapsed

    worker.syncNow(); // manual trigger also collapses

    release();
    // Yield the microtask queue so drain #1's `finally` clears the in-flight
    // flag before we trigger the next drain.
    await new Promise(resolve => setTimeout(resolve, 0));
    await worker.syncNow(); // in-flight cleared → this one runs

    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  it('drains periodically on the configured interval and stops after stop()', async () => {
    vi.useFakeTimers();
    const worker = startSyncWorker({ intervalMs: 5 * 60_000 });

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(1);

    worker.stop();

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(1); // no growth after stop
  });

  it('foreground listener is detached by stop()', () => {
    const worker = startSyncWorker({ intervalMs: 60_000 });
    worker.stop();

    (AppState as unknown as { emit: (s: string) => void }).emit('active');
    expect(mocks.processSyncQueue).not.toHaveBeenCalled();
    expect(
      (AppState as unknown as { __remove: () => void }).__remove
    ).toHaveBeenCalled();
  });

  it('respects the enabled gate (e.g. signed-out mode skips drains)', async () => {
    let signedIn = false;
    const worker = startSyncWorker({ intervalMs: 60_000, enabled: () => signedIn });

    (AppState as unknown as { emit: (s: string) => void }).emit('active');
    expect(mocks.processSyncQueue).not.toHaveBeenCalled();

    signedIn = true;
    await worker.syncNow();
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  it('forwards runOptions to the transport call', async () => {
    const worker = startSyncWorker({
      intervalMs: 60_000,
      runOptions: { batchSize: 7, maxBatches: 2 },
      transport: 'custom-transport' as never,
    });

    await worker.syncNow();
    expect(mocks.processSyncQueue).toHaveBeenCalledWith('custom-transport', { batchSize: 7, maxBatches: 2 });
    worker.stop();
  });

  it('contains infrastructure errors: onError is informed, no unhandled rejection', async () => {
    const onError = vi.fn();
    const boom = new Error('db unavailable');
    mocks.processSyncQueue.mockRejectedValueOnce(boom);

    const worker = startSyncWorker({ intervalMs: 60_000, onError });
    const result = await worker.syncNow();

    expect(result).toEqual(DRAIN_IDLE);
    expect(onError).toHaveBeenCalledWith(boom);

    // A later drain still runs — the error did not poison the worker.
    await worker.syncNow();
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(2);
    worker.stop();
  });
});