/**
 * Cloud restore tests (Phase 7).
 *
 * `firebase/firestore`, `./auth` and `./database` are mocked; the mocked
 * restoreRow actually mutates the fake local DB so the idempotency contract
 * (second run is a no-op) is exercised for real. `./cloudRestore` itself is
 * imported unmocked — its recency guards are the unit under test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  restoreRow: vi.fn(),
  remoteDocs: new Map<string, Array<{ id: string; data: Row }>>(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, table: string) => ({ table }),
  query: (coll: { table: string }, ...filters: unknown[]) => ({ table: coll.table, filters }),
  where: (_field: string, _op: string, value: unknown) => ({ field: 'user_id', value }),
  getDocs: mocks.getDocs,
}));
vi.mock('./auth', () => ({
  getFirestoreInstance: vi.fn(() => 'db-stub'),
}));

// Fake local SQLite state + writer that mirrors restoreRow's semantics
// (INSERT OR REPLACE) so restore-then-restore-again behaves like production.
const local = vi.hoisted(() => ({
  progress: new Map<string, Row>(),
  sr: new Map<string, Row>(),
  bookmarks: new Map<string, Row>(),
  weakPoints: new Set<string>(),
  profile: null as Row | null,
  history: new Map<string, Row>(),
}));

vi.mock('./database', () => ({
  getProgress: async (_uid: string, qid: string) => local.progress.get(qid) ?? null,
  getSRState: async (_uid: string, qid: string) => local.sr.get(qid) ?? null,
  getBookmark: async (_uid: string, qid: string) => local.bookmarks.get(qid) ?? null,
  isWeakPoint: async (_uid: string, qid: string) => local.weakPoints.has(qid),
  getUserProfile: async () => local.profile,
  restoreRow: async (table: string, row: Row) => {
    await mocks.restoreRow(table, row);
    const qid = String(row.question_id ?? '');
    if (table === 'user_progress') local.progress.set(qid, row);
    else if (table === 'sr_state') local.sr.set(qid, row);
    else if (table === 'bookmarks') local.bookmarks.set(qid, row);
    else if (table === 'weak_points') local.weakPoints.add(qid);
    else if (table === 'user_profile') local.profile = row;
    else if (table === 'exam_history') local.history.set(String(row.id), row);
  },
}));

import { restoreFromCloud } from './cloudRestore';

const UID = 'user-1';
const qid = (n: number) => `${UID}_q${n}`;

/** Seed one remote doc for a table. */
function remote(table: string, id: string, data: Row) {
  if (!mocks.remoteDocs.has(table)) mocks.remoteDocs.set(table, []);
  mocks.remoteDocs.get(table)!.push({ id, data });
}

beforeEach(() => {
  mocks.remoteDocs.clear();
  mocks.restoreRow.mockReset();
  mocks.getDocs.mockReset();
  local.progress.clear();
  local.sr.clear();
  local.bookmarks.clear();
  local.weakPoints.clear();
  local.profile = null;
  local.history.clear();
  mocks.getDocs.mockImplementation(async (q: { table: string }) => ({
    docs: (mocks.remoteDocs.get(q.table) ?? []).map(d => ({ id: d.id, data: () => d.data })),
  }));
});
describe('restoreFromCloud', () => {
  it('restores newer and missing progress rows, skips older ones', async () => {
    local.progress.set('q1', { last_attempted_at: 500 }); // remote newer → restore
    local.progress.set('q2', { last_attempted_at: 2_000 }); // remote older → skip
    remote('user_progress', qid(1), { user_id: UID, question_id: 'q1', last_attempted_at: 1_000 });
    remote('user_progress', qid(2), { user_id: UID, question_id: 'q2', last_attempted_at: 1_000 });
    remote('user_progress', qid(3), { user_id: UID, question_id: 'q3', last_attempted_at: 100 });

    const summary = await restoreFromCloud(UID, { tables: ['user_progress'] });

    expect(summary.restored.user_progress).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toBe(0);
    expect(mocks.restoreRow.mock.calls.map(c => c[0])).toEqual(['user_progress', 'user_progress']);
    expect(mocks.restoreRow.mock.calls[0][1]).toMatchObject({ question_id: 'q1', last_attempted_at: 1_000 });
  });

  it('restores weak points only when absent, profile only when newer, history always', async () => {
    local.weakPoints.add('q1'); // present → skip
    local.profile = { updated_at: 500 }; // remote newer → restore
    remote('weak_points', qid(1), { user_id: UID, question_id: 'q1', created_at: 10 });
    remote('weak_points', qid(2), { user_id: UID, question_id: 'q2', created_at: 10 });
    remote('user_profile', UID, { user_id: UID, updated_at: 1_000 });
    remote('exam_history', `${UID}_eh_s1`, { user_id: UID, session_id: 's1', score: 4 });

    const summary = await restoreFromCloud(UID, {
      tables: ['weak_points', 'user_profile', 'exam_history'],
    });

    expect(summary.restored.weak_points).toBe(1); // q2 only
    expect(summary.restored.user_profile).toBe(1);
    expect(summary.restored.exam_history).toBe(1);
    expect(summary.skipped).toBe(1); // weak point q1
  });

  it('never writes rows belonging to another user (defense in depth)', async () => {
    remote('user_progress', 'other_q9', { user_id: 'someone-else', question_id: 'q9', last_attempted_at: 9_999 });

    const summary = await restoreFromCloud(UID, { tables: ['user_progress'] });

    expect(mocks.restoreRow).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(summary.restored.user_progress).toBeUndefined();
  });

  it('is idempotent: a second run after restore performs no writes', async () => {
    remote('user_progress', qid(1), { user_id: UID, question_id: 'q1', last_attempted_at: 1_000 });

    await restoreFromCloud(UID, { tables: ['user_progress'] });
    expect(mocks.restoreRow).toHaveBeenCalledTimes(1);

    const summary = await restoreFromCloud(UID, { tables: ['user_progress'] });
    expect(mocks.restoreRow).toHaveBeenCalledTimes(1); // no new writes
    expect(summary.restored.user_progress).toBeUndefined();
    expect(summary.skipped).toBe(1);
  });

  it('isolates per-collection failures without aborting the rest', async () => {
    remote('user_progress', qid(1), { user_id: UID, question_id: 'q1', last_attempted_at: 100 });
    remote('exam_history', `${UID}_eh_s1`, { user_id: UID, session_id: 's1', score: 4 });
    mocks.getDocs.mockImplementation(async (q: { table: string }) => {
      if (q.table === 'user_progress') throw new Error('transient read error');
      return {
        docs: (mocks.remoteDocs.get(q.table) ?? []).map(d => ({ id: d.id, data: () => d.data })),
      };
    });

    const summary = await restoreFromCloud(UID, { tables: ['user_progress', 'exam_history'] });

    expect(summary.errors).toBe(1);
    expect(summary.restored.exam_history).toBe(1);
    expect(mocks.restoreRow).toHaveBeenCalledTimes(1);
    expect(mocks.restoreRow.mock.calls[0][0]).toBe('exam_history');
  });

  it('queries each table constrained by owner uid (rules require it)', async () => {
    remote('user_progress', qid(1), { user_id: UID, question_id: 'q1', last_attempted_at: 100 });
    await restoreFromCloud(UID, { tables: ['user_progress'] });

    expect(mocks.getDocs).toHaveBeenCalledTimes(1);
    const q = mocks.getDocs.mock.calls[0][0];
    expect(q.table).toBe('user_progress');
    expect(q.filters).toContainEqual({ field: 'user_id', value: UID });
  });
});