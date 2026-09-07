/**
 * Sync worker tests — outbox drain contracts (Phase 5 Step 1, rules 23/56).
 *
 * The native `expo-sqlite` module must never load during unit tests, so the
 * entire `./database` surface is mocked with an in-memory queue mirroring the
 * real semantics: getPendingSync() returns rows with retry_count < 3 in FIFO
 * order, markSyncSuccess() deletes, markSyncFailure() increments retry_count.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SyncQueueItem } from './database';

/** Hoisted shared state — visible to the mock factory (hoisted above imports). */
const state = vi.hoisted(() => ({
  queue: [] as Array<SyncQueueItem & { id: number }>,
  seq: 1,
}));

vi.mock('./database', () => ({
  getPendingSync: vi.fn(async (limit = 100): Promise<SyncQueueItem[]> =>
    state.queue
      .filter(r => r.retry_count < 3)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(0, limit)
      .map(r => ({ ...r }))
  ),
  markSyncSuccess: vi.fn(async (id: number) => {
    state.queue = state.queue.filter(r => r.id !== id);
  }),
  markSyncFailure: vi.fn(async (id: number) => {
    const row = state.queue.find(r => r.id === id);
    if (row) {
      row.retry_count += 1;
      row.last_attempt_at = Date.now();
    }
  }),
}));

import { processSyncQueue, type SyncTransport } from './sync';

function envelope(
  recordId: string,
  payload: Record<string, unknown>,
  overrides: Partial<SyncQueueItem> = {}
): void {
  state.queue.push({
    id: state.seq++,
    table_name: 'exam_history',
    record_id: recordId,
    operation: 'INSERT',
    payload_json: JSON.stringify(payload),
    retry_count: 0,
    created_at: state.seq * 1000,
    ...overrides,
  });
}

const okTransport: SyncTransport = vi.fn(async () => {});

beforeEach(() => {
  state.queue = [];
  state.seq = 1;
  vi.mocked(okTransport).mockClear();
});

describe('processSyncQueue (outbox drain)', () => {
  it('drains pending envelopes in FIFO order and deletes them on success', async () => {
    envelope('a1', { id: 'a1', user_id: 'u1' });
    envelope('a2', { id: 'a2', user_id: 'u1' }, { operation: 'UPDATE' });
    envelope('a3', { id: 'a3' }, { table_name: 'bookmarks', operation: 'DELETE' });

    const result = await processSyncQueue(okTransport);

    expect(result).toEqual({ attempted: 3, succeeded: 3, failed: 0 });
    expect(state.queue).toHaveLength(0);
    // FIFO: created_at ordering, with operation and payload passed through.
    const ids = vi.mocked(okTransport).mock.calls.map(c => c[0].record_id);
    expect(ids).toEqual(['a1', 'a2', 'a3']);
    expect(vi.mocked(okTransport).mock.calls[2][0].operation).toBe('DELETE');
    expect(vi.mocked(okTransport).mock.calls[0][1]).toEqual({ id: 'a1', user_id: 'u1' });
  });

  it('isolates failures: a rejected envelope is retained for retry, neighbours still sync', async () => {
    envelope('good1', { id: 'good1' });
    envelope('bad', { id: 'bad' });
    envelope('good2', { id: 'good2' });

    const transport: SyncTransport = vi.fn(async (_item, payload) => {
      if (payload.id === 'bad') throw new Error('network down');
    });

    const result = await processSyncQueue(transport);

    expect(result).toEqual({ attempted: 3, succeeded: 2, failed: 1 });
    expect(state.queue.map(r => r.record_id)).toEqual(['bad']);
    expect(state.queue[0].retry_count).toBe(1);
    expect(state.queue[0].last_attempt_at).toBeTypeOf('number');
  });

  it('bounds retries: envelopes at retry_count >= 3 are no longer visible', async () => {
    envelope('dead', { id: 'dead' }, { retry_count: 3 });
    envelope('alive', { id: 'alive' });

    const result = await processSyncQueue(okTransport);

    expect(result).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(okTransport).toHaveBeenCalledTimes(1);
    expect(vi.mocked(okTransport).mock.calls[0][0].record_id).toBe('alive');
    expect(state.queue.map(r => r.record_id)).toContain('dead');
  });

  it('drains across multiple pages and respects the maxBatches bound', async () => {
    envelope('r1', { id: 'r1' });
    envelope('r2', { id: 'r2' });
    envelope('r3', { id: 'r3' });

    // One page of 2 → only the first two envelopes are attempted this run.
    const bounded = await processSyncQueue(okTransport, { batchSize: 2, maxBatches: 1 });
    expect(bounded).toEqual({ attempted: 2, succeeded: 2, failed: 0 });

    // Continue draining: the remaining envelope goes out on the next page.
    const rest = await processSyncQueue(okTransport, { batchSize: 2 });
    expect(rest).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
    expect(state.queue).toHaveLength(0);
  });

  it('treats a malformed payload as poison: transport is not called, row ages out via retries', async () => {
    state.queue.push({
      id: state.seq++,
      table_name: 'exam_history',
      record_id: 'poison',
      operation: 'INSERT',
      payload_json: '{not-valid-json',
      retry_count: 0,
      created_at: 1,
    });
    envelope('healthy', { id: 'healthy' });

    const result = await processSyncQueue(okTransport);

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(vi.mocked(okTransport).mock.calls.map(c => c[0].record_id)).toEqual(['healthy']);
    expect(state.queue.map(r => r.record_id)).toEqual(['poison']);
    expect(state.queue[0].retry_count).toBe(1);
  });
});