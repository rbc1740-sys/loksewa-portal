/**
 * Battle service tests (Phase 8) — mocked firebase/firestore + ./auth.
 * Proves every write stays inside the /battles rules contract: joining writes
 * ONLY guest fields; finishing writes ONLY my score + status.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateDoc: vi.fn(),
  store: new Map<string, Record<string, unknown>>(),
  user: null as { uid: string } | null,
}));

vi.mock('./auth', () => ({
  getFirestoreInstance: vi.fn(() => 'db-stub'),
  getCurrentUser: vi.fn(() => mocks.user),
}));
vi.mock('firebase/firestore', () => {
  const keyOf = (ref: { code: string }) => ref.code;
  return {
    doc: vi.fn((_db: unknown, _table: string, code: string) => ({ code })),
    setDoc: vi.fn(async (ref, data) => void mocks.store.set(keyOf(ref), { ...data })),
    getDoc: vi.fn(async ref => {
      const data = mocks.store.get(keyOf(ref));
      return { exists: () => data !== undefined, data: () => data };
    }),
    updateDoc: mocks.updateDoc,
    collection: vi.fn(() => ({ name: 'battles' })),
    query: vi.fn((...args) => ({ parts: args })),
    where: vi.fn((f, op, v) => ({ f, op, v })),
    orderBy: vi.fn((f, dir) => ({ f, dir })),
    limit: vi.fn(n => ({ n })),
    getDocs: vi.fn(async () => ({ forEach: () => {} })),
    onSnapshot: vi.fn((_ref, cb) => {
      const cur = [...mocks.store.values()][0];
      if (cur) cb({ exists: () => true, data: () => cur });
      return () => {};
    }),
  };
});

import {
  createBattleRoom,
  joinBattleRoom,
  finishMyPaper,
  fetchRoom,
} from './battleService';

const ROOM = 'ABC234';
function seedRoom(extra: Record<string, unknown> = {}) {
  mocks.store.set(ROOM, {
    roomCode: ROOM,
    hostUid: 'alice',
    host: 'Alice',
    guestUid: null,
    guest: null,
    hostScore: 0,
    guestScore: 0,
    status: 'waiting',
    question_ids: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
    created_at: 1,
    ...extra,
  });
}

beforeEach(() => {
  mocks.store.clear();
  mocks.updateDoc
    .mockReset()
    .mockImplementation(async (ref: { code: string }, data: Record<string, unknown>) => {
      const cur = mocks.store.get(ref.code);
      if (cur) mocks.store.set(ref.code, { ...cur, ...data });
    });
  mocks.user = { uid: 'alice' };
});

describe('createBattleRoom', () => {
  it('bakes host, scores and a 10-question frozen paper into one create', async () => {
    const ids = Array.from({ length: 14 }, (_, i) => `q${i + 1}`);
    const res = await createBattleRoom('Alice', 'Constitution', ids);

    expect(res.questionIds).toHaveLength(10);
    const written = mocks.store.get(res.roomCode)!;
    expect(written.hostUid).toBe('alice');
    expect(written.status).toBe('waiting');
    expect(written.question_ids).toEqual(ids.slice(0, 10));
    expect(written.guestUid).toBeNull();
  });

  it('rejects topics with too few questions', async () => {
    await expect(createBattleRoom('A', 't', ['q1'])).rejects.toThrow(/at least 10/);
    expect([...mocks.store.keys()]).toHaveLength(0);
  });
});

describe('joinBattleRoom', () => {
  it('writes ONLY guest fields when joining a waiting room', async () => {
    seedRoom();
    mocks.user = { uid: 'bob' };
    const room = await joinBattleRoom(ROOM, 'Bob');

    expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks.updateDoc.mock.calls[0][1]).sort()).toEqual(['guest', 'guestUid']);
    expect(room.myRole).toBe('guest');
    expect(room.guest).toBe('Bob');
  });

  it('is idempotent for rejoin and does not write', async () => {
    seedRoom({ guestUid: 'bob', guest: 'Bob', status: 'active' });
    mocks.user = { uid: 'bob' };
    const room = await joinBattleRoom(ROOM, 'Bob');
    expect(room.myRole).toBe('guest');
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('refuses to join a full or already-active room', async () => {
    seedRoom({ guestUid: 'carol', guest: 'Carol', status: 'active' });
    mocks.user = { uid: 'bob' };
    await expect(joinBattleRoom(ROOM, 'Bob')).rejects.toThrow(/full or underway/);
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});

describe('finishMyPaper', () => {
  it('writes only my score + status transition', async () => {
    seedRoom({ guestUid: 'bob', guest: 'Bob', status: 'active' });
    await finishMyPaper(ROOM, 'host', 930);

    expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    const payload = mocks.updateDoc.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['hostScore', 'status']);
    expect(payload.hostScore).toBe(930);
    expect(payload.status).toBe('host_done');
  });

  it('second finish by the same role is a retry no-op', async () => {
    seedRoom({ status: 'host_done', hostScore: 930 });
    await finishMyPaper(ROOM, 'host', 930);
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});

describe('fetchRoom', () => {
  it('resolves myRole from uid; null for a stranger', async () => {
    seedRoom({ guestUid: 'bob', guest: 'Bob', status: 'active' });
    expect((await fetchRoom(ROOM))?.myRole).toBe('host');
    mocks.user = { uid: 'eve' };
    expect((await fetchRoom(ROOM))?.myRole).toBeNull();
  });

  it('returns null for a missing room', async () => {
    expect(await fetchRoom('ZZZZ99')).toBeNull();
  });
});
