/**
 * Firestore transport integration tests (Phase 5 Step 3).
 *
 * `firebase/firestore` and `./auth` are mocked so the lazily-imported cloud
 * chain never loads; `./conflictResolution` stays REAL to prove the transport
 * actually dispatches merge vs LWW per table.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SyncQueueItem } from './database';

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  remoteData: new Map<string, Record<string, unknown>>(),
}));

vi.mock('./database', () => ({}));
vi.mock('./auth', () => ({
  getFirestoreInstance: vi.fn(() => 'db-stub'),
}));
vi.mock('firebase/firestore', () => {
  const doc = vi.fn((_db: unknown, table: string, id: string) => ({ table, id }));
  const serverTimestamp = vi.fn(() => 'SERVER_TIMESTAMP_SENTINEL');
  return {
    doc,
    serverTimestamp,
    getDoc: mocks.getDoc,
    setDoc: mocks.setDoc,
    deleteDoc: mocks.deleteDoc,
  };
});

import { createFirestoreSyncTransport, type SyncTransport } from './sync';

function envelope(
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>,
  overrides: Partial<SyncQueueItem> = {}
): SyncQueueItem {
  return {
    id: 1,
    table_name: tableName,
    record_id: recordId,
    operation: 'UPDATE',
    payload_json: JSON.stringify(payload),
    retry_count: 0,
    created_at: 1,
    ...overrides,
  };
}

const transport = createFirestoreSyncTransport();
/** Push an envelope the way processSyncQueue does: payload parsed from the row. */
const push: SyncTransport = (item, payload) => transport(item, payload);
const pushEnvelope = async (item: SyncQueueItem): Promise<void> => {
  await push(item, JSON.parse(item.payload_json) as Record<string, unknown>);
};

beforeEach(() => {
  mocks.remoteData.clear();
  mocks.setDoc.mockReset().mockResolvedValue(undefined);
  mocks.deleteDoc.mockReset().mockResolvedValue(undefined);
  mocks.getDoc.mockReset().mockImplementation(async (ref: { table: string; id: string }) => {
    const data = mocks.remoteData.get(`${ref.table}/${ref.id}`);
    return { exists: () => data !== undefined, data: () => data };
  });
});

describe('createFirestoreSyncTransport', () => {
  it('pushes LWW tables straight through (no remote read) with synced_at stamp', async () => {
    await pushEnvelope(envelope('exam_history', 'a1', { id: 'a1', user_id: 'u1', score: 4 }));

    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [ref, written, opts] = mocks.setDoc.mock.calls[0];
    expect(ref).toEqual({ table: 'exam_history', id: 'a1' });
    expect(written).toEqual({ id: 'a1', user_id: 'u1', score: 4, synced_at: 'SERVER_TIMESTAMP_SENTINEL' });
    expect(opts).toEqual({ merge: true });
  });

  it('merges user_progress against the remote copy before writing', async () => {
    mocks.remoteData.set('user_progress/u1_q1', {
      id: 'u1_q1', attempt_count: 5, time_spent_ms: 20_000,
      selected_answer: 'A', last_attempted_at: 3_000,
    });
    await pushEnvelope(
      envelope('user_progress', 'u1_q1', {
        id: 'u1_q1', user_id: 'u1', question_id: 'q1',
        attempt_count: 3, time_spent_ms: 45_000,
        selected_answer: 'B', last_attempted_at: 2_000,
      })
    );

    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    const [, written] = mocks.setDoc.mock.calls[0];
    // Counters max-merged; state from the newer remote row.
    expect(written.attempt_count).toBe(5);
    expect(written.time_spent_ms).toBe(45_000);
    expect(written.selected_answer).toBe('A');
    expect(written.synced_at).toBe('SERVER_TIMESTAMP_SENTINEL');
  });

  it('writes the local row untouched for a merge table with no remote copy', async () => {
    await pushEnvelope(
      envelope('user_progress', 'u1_q9', { id: 'u1_q9', attempt_count: 1, last_attempted_at: 100 })
    );

    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    const [, written] = mocks.setDoc.mock.calls[0];
    expect(written.attempt_count).toBe(1);
    expect(written.selected_answer).toBeUndefined();
  });

  it('executes DELETE via deleteDoc and never writes', async () => {
    await pushEnvelope(envelope('bookmarks', 'b1', { id: 'b1' }, { operation: 'DELETE' }));

    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDoc.mock.calls[0][0]).toEqual({ table: 'bookmarks', id: 'b1' });
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.getDoc).not.toHaveBeenCalled();
  });
});