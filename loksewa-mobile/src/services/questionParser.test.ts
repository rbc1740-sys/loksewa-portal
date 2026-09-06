import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getBundledQuestions,
  checkForQuestionUpdates,
  hashManifest,
  normalizeRemoteBank,
  type RemoteBankFile,
} from './questionParser';

// These run the real bundler pipeline over all 41 shipped question files.
describe('getBundledQuestions (bundled question bank)', () => {
  let questions: Awaited<ReturnType<typeof getBundledQuestions>>;

  it('loads a large bank of questions', async () => {
    questions = await getBundledQuestions();
    expect(questions.length).toBeGreaterThan(4000);
  }, 30000);

  it('produces unique ids', async () => {
    const list = questions ?? (await getBundledQuestions());
    const ids = new Set(list.map((q) => q.id));
    expect(ids.size).toBe(list.length);
  });

  it('always yields well-formed rows', async () => {
    const list = questions ?? (await getBundledQuestions());

    for (const q of list) {
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.topic.length).toBeGreaterThan(0);
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer.length).toBeGreaterThan(0);
      expect(q.source_file.length).toBeGreaterThan(0);

      const options = JSON.parse(q.options_json) as Record<string, string>;
      expect(Object.keys(options).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('de-duplicates identical questions across files', async () => {
    const list = questions ?? (await getBundledQuestions());
    const signatures = new Set(
      list.map((q) => `${q.question.toLowerCase().trim()}::${q.options_json}`)
    );
    // Not a strict equality check (signatures normalise differently), but the
    // bank should not contain wholesale repeats.
    expect(signatures.size).toBeGreaterThan(list.length * 0.99);
  });
});

describe('hashManifest', () => {
  const FILES: RemoteBankFile[] = [
    { path: 'questions/a.json', sha256: 'abc' },
    { path: 'questions/b.json', sha256: 'def' },
  ];

  it('is deterministic and content-sensitive', async () => {
    const hash = await hashManifest(FILES);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashManifest(FILES)).toBe(hash);
    // Same paths but different content hashes -> different bank hash.
    expect(
      await hashManifest([{ path: 'questions/a.json', sha256: 'cba' }])
    ).not.toBe(hash);
    expect(await hashManifest(FILES.slice().reverse())).not.toBe(hash);
  });

  it('hashes plain path arrays for backwards compatibility', async () => {
    const hash = await hashManifest(['questions/a.json', 'questions/b.json']);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizeRemoteBank', () => {
  it('parses the generated { files: [...] } shape', () => {
    const files = normalizeRemoteBank({
      files: [
        { path: 'questions/a.json', sha256: 'aaa' },
        { path: 'questions/b.json', sha256: 'bbb' },
      ],
    });
    expect(files).toEqual([
      { path: 'questions/a.json', sha256: 'aaa' },
      { path: 'questions/b.json', sha256: 'bbb' },
    ]);
  });

  it('rejects malformed payloads', () => {
    expect(normalizeRemoteBank(null)).toBeNull();
    expect(normalizeRemoteBank('nope')).toBeNull();
    expect(normalizeRemoteBank({ not: 'files' })).toBeNull();
    expect(normalizeRemoteBank({ files: [] })).toBeNull();
    expect(normalizeRemoteBank({ files: [{ path: 'x.json' }] })).toBeNull();
  });

  it('accepts a legacy plain array of path strings', () => {
    expect(normalizeRemoteBank(['questions/a.json'])).toEqual([
      { path: 'questions/a.json', sha256: '' },
    ]);
    expect(normalizeRemoteBank([])).toBeNull();
  });
});

describe('checkForQuestionUpdates', () => {
  const FILES: RemoteBankFile[] = [
    { path: 'questions/a.json', sha256: 'aaa' },
    { path: 'questions/b.json', sha256: 'bbb' },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: FILES }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns hasUpdates=false when the current hash already matches', async () => {
    const current = await hashManifest(FILES);
    const result = await checkForQuestionUpdates(current, 'https://cdn.example/');

    expect(result.hasUpdates).toBe(false);
    expect(result.newHash).toBe(current);
    expect(result.files).toEqual(FILES);
  });

  it('returns hasUpdates=true on a fresh install (no current hash)', async () => {
    const result = await checkForQuestionUpdates('', 'https://cdn.example/');

    expect(result.hasUpdates).toBe(true);
    expect(result.newHash).toBe(await hashManifest(FILES));
    expect(result.files).toEqual(FILES);
  });

  it('returns hasUpdates=true when a fileʼs content hash changed', async () => {
    const stale = await hashManifest([
      { path: 'questions/a.json', sha256: 'OLD' },
      { path: 'questions/b.json', sha256: 'bbb' },
    ]);
    const result = await checkForQuestionUpdates(stale, 'https://cdn.example/');

    expect(result.hasUpdates).toBe(true);
    expect(result.files).toEqual(FILES);
  });

  it('is fail-open on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const result = await checkForQuestionUpdates('', 'https://cdn.example/');

    expect(result.hasUpdates).toBe(false);
  });

  it('ignores a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const result = await checkForQuestionUpdates('', 'https://cdn.example/');
    expect(result.hasUpdates).toBe(false);
  });

  it('ignores a malformed manifest payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ not: 'the right shape' }),
    })));
    const result = await checkForQuestionUpdates('', 'https://cdn.example/');
    expect(result.hasUpdates).toBe(false);
  });
});