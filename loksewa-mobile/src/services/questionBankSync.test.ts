/**
 * Question bank sync tests (Option C — remote auto-updates).
 *
 * `./database` and `./questionParser` are mocked: the former with an in-memory
 * app_meta store, the latter to return controlled manifest checks + parses.
 * Contracts under test: fresh install applies the remote bank, unchanged hash
 * is a no-op, changed hash re-seeds, offline/unavailable is fail-open, and an
 * empty parse is not applied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  appMeta: new Map<string, string>(),
  replaceCalls: [] as Array<{ count: number }>,
  check: vi.fn(),
  parse: vi.fn(),
}));

vi.mock('./database', () => ({
  getAppMeta: async (key: string) => state.appMeta.get(key) ?? null,
  setAppMeta: async (key: string, value: string) => {
    state.appMeta.set(key, value);
  },
  replaceQuestionBank: async (questions: unknown[]) => {
    state.replaceCalls.push({ count: questions.length });
    return questions.length;
  },
}));

vi.mock('./questionParser', () => ({
  checkForQuestionUpdates: (...args: unknown[]) => state.check(...args),
  parseQuestionBank: (...args: unknown[]) => state.parse(...args),
}));

import { syncQuestionBank } from './questionBankSync';
import { META_KEY_BANK_HASH, META_KEY_LAST_SYNC_AT } from '../constants/remoteConfig';

const BASE_URL = 'https://cdn.example/bank/';

function makeCheck(overrides: Partial<{ hasUpdates: boolean; newHash: string; files: Array<{ path: string; sha256: string }> }> = {}) {
  return {
    hasUpdates: true,
    newHash: 'abcd1234',
    files: [{ path: 'questions/a.json', sha256: 'aaa' }],
    ...overrides,
  };
}

function parsedRows(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    id: `src_${i}`,
    topic: 'Sample',
    question: `Q ${i}`,
    options_json: '{"a":"x","b":"y"}',
    answer: 'a',
    source_file: 'a',
  }));
}

beforeEach(() => {
  state.appMeta.clear();
  state.replaceCalls = [];
  state.check.mockReset();
  state.parse.mockReset();
  state.parse.mockResolvedValue(parsedRows(3));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('syncQuestionBank', () => {
  it('applies the remote bank on a fresh install and stores the hash', async () => {
    state.check.mockResolvedValue(makeCheck());

    const result = await syncQuestionBank({ baseUrl: BASE_URL });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('first_install');
    expect(result.count).toBe(3);
    expect(state.parse).toHaveBeenCalledWith(BASE_URL, ['questions/a.json']);
    expect(state.replaceCalls).toHaveLength(1);
    expect(state.appMeta.get(META_KEY_BANK_HASH)).toBe('abcd1234');
    expect(state.appMeta.has(META_KEY_LAST_SYNC_AT)).toBe(true);
  });

  it('is a no-op when the installed hash already matches the remote', async () => {
    state.appMeta.set(META_KEY_BANK_HASH, 'abcd1234');
    // Faithful mock: when the current hash matches the remote, the real
    // checkForQuestionUpdates reports hasUpdates = false.
    state.check.mockResolvedValue(makeCheck({ hasUpdates: false }));

    const result = await syncQuestionBank({ baseUrl: BASE_URL });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('no_change');
    expect(state.parse).not.toHaveBeenCalled();
    expect(state.replaceCalls).toHaveLength(0);
    expect(state.appMeta.get(META_KEY_BANK_HASH)).toBe('abcd1234');
  });

  it('re-applies when the remote bank changed since the last install', async () => {
    state.appMeta.set(META_KEY_BANK_HASH, 'oldhash');
    state.check.mockResolvedValue(makeCheck({ newHash: 'newhash' }));

    const result = await syncQuestionBank({ baseUrl: BASE_URL });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('updated');
    expect(result.previousHash).toBe('oldhash');
    expect(result.newHash).toBe('newhash');
    expect(state.replaceCalls).toHaveLength(1);
    expect(state.appMeta.get(META_KEY_BANK_HASH)).toBe('newhash');
  });

  it('is fail-open when the remote manifest is unreachable', async () => {
    state.check.mockResolvedValue({ hasUpdates: false });

    const result = await syncQuestionBank({ baseUrl: BASE_URL });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('unavailable');
    expect(state.parse).not.toHaveBeenCalled();
    expect(state.replaceCalls).toHaveLength(0);
  });

  it('does not apply an empty remote bank', async () => {
    state.check.mockResolvedValue(makeCheck());
    state.parse.mockResolvedValue([]);

    const result = await syncQuestionBank({ baseUrl: BASE_URL });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('failed');
    expect(state.replaceCalls).toHaveLength(0);
    expect(state.appMeta.has(META_KEY_BANK_HASH)).toBe(false);
  });

  it('collapses concurrent callers into a single sync', async () => {
    let resolveCheck!: (v: unknown) => void;
    state.check.mockReturnValue(new Promise((r) => { resolveCheck = r; }));

    const first = syncQuestionBank({ baseUrl: BASE_URL });
    const second = syncQuestionBank({ baseUrl: BASE_URL });

    resolveCheck(makeCheck());
    const [a, b] = await Promise.all([first, second]);

    expect(a.applied).toBe(true);
    // Single-flight: both callers receive the SAME invocation's result.
    expect(b).toBe(a);
    expect(state.check).toHaveBeenCalledTimes(1);
    expect(state.replaceCalls).toHaveLength(1);
  });
});