import { describe, it, expect } from 'vitest';
import {
  computeScore,
  deriveStatus,
  determineWinner,
  generateRoomCode,
  roleFor,
  opponentName,
  BATTLE_QUESTIONS,
  BATTLE_QUESTION_MS,
} from './battleEngine';

describe('computeScore', () => {
  it('rewards correct answers with base + decaying speed bonus', () => {
    expect(computeScore(true, 0)).toBe(150); // instant: full 50 bonus
    expect(computeScore(true, 999)).toBe(150); // still 0 full seconds
    expect(computeScore(true, 1_000)).toBe(140); // 1s → 40 bonus
    expect(computeScore(true, 5_000)).toBe(100); // bonus fully decayed
  });

  it('scores wrong and timed-out answers as zero', () => {
    expect(computeScore(false, 0)).toBe(0);
    expect(computeScore(false, 19_000)).toBe(0);
  });

  it('never returns negative scores for absurd inputs', () => {
    expect(computeScore(true, -5_000)).toBe(150);
  });
});

describe('deriveStatus state machine', () => {
  it('walks waiting → active → first_done → done', () => {
    expect(deriveStatus('active', 'host')).toBe('host_done');
    expect(deriveStatus('host_done', 'guest')).toBe('done');
    expect(deriveStatus('active', 'guest')).toBe('guest_done');
    expect(deriveStatus('guest_done', 'host')).toBe('done');
  });

  it('is idempotent: double-finish and out-of-order calls cannot corrupt the room', () => {
    expect(deriveStatus('host_done', 'host')).toBe('host_done');
    expect(deriveStatus('done', 'host')).toBe('done');
    expect(deriveStatus('waiting', 'guest')).toBe('waiting'); // not started yet
  });
});

describe('determineWinner', () => {
  it('resolves host, guest and tie', () => {
    expect(determineWinner(1200, 900)).toBe('host');
    expect(determineWinner(900, 1200)).toBe('guest');
    expect(determineWinner(1000, 1000)).toBe('tie');
  });
});

describe('generateRoomCode', () => {
  it('produces 8-char LK-prefixed codes from an unambiguous alphabet', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^LK[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(code).not.toMatch(/[01OI]/);
  });

  it('respects the injected rng (deterministic for tests)', () => {
    // rng always < 1/31 → floor(rng * 31) is always 0 → 'LKAAAAAA'
    const code = generateRoomCode(() => 0);
    expect(code).toBe('LKAAAAAA');
  });
});

describe('roleFor / opponentName', () => {
  const room = { hostUid: 'alice', guestUid: 'bob' };
  it('resolves both roles and null for a stranger', () => {
    expect(roleFor(room, 'alice')).toBe('host');
    expect(roleFor(room, 'bob')).toBe('guest');
    expect(roleFor(room, 'eve')).toBeNull();
  });

  it('names the opponent from the right side', () => {
    expect(opponentName({ host: 'Alice', guest: 'Bob' }, 'host')).toBe('Bob');
    expect(opponentName({ host: 'Alice', guest: 'Bob' }, 'guest')).toBe('Alice');
  });
});

describe('constants', () => {
  it('keeps the paper size and per-question budget in sync with the UI', () => {
    expect(BATTLE_QUESTIONS).toBe(10);
    expect(BATTLE_QUESTION_MS).toBe(20_000);
  });
});
