/**
 * Battle engine (Phase 8) — pure 1v1 match logic.
 *
 * Constraint: the pre-existing /battles security rules only allow updates
 * affecting { guest, guestUid, guestScore, hostScore, status }, so the room
 * document carries everything (question ids, players, scores) from create,
 * and each player writes ONLY their own score plus a status transition.
 * This module defines the score formula and the status state machine both
 * clients must agree on deterministically — no server authority needed.
 */

/** Number of questions per battle. */
export const BATTLE_QUESTIONS = 10;

/** Time budget per question in ms (client-side; scores reward speed). */
export const BATTLE_QUESTION_MS = 20_000;

/** Base points for a correct answer. */
const CORRECT_BASE = 100;
/** Max speed bonus for an instant answer. */
const SPEED_BONUS_MAX = 50;
/** Points lost per full second spent (bonus decays to 0 at 5s). */
const SPEED_DECAY_PER_SEC = 10;

/**
 * Points for one answer. Correct answers earn the base plus a decaying speed
 * bonus; wrong or timed-out answers score nothing. Pure + integer-only so
 * both clients compute identical numbers.
 */
export function computeScore(isCorrect: boolean, msTaken: number): number {
  if (!isCorrect) return 0;
  const seconds = Math.floor(Math.max(0, msTaken) / 1000);
  return CORRECT_BASE + bonus(seconds, SPEED_BONUS_MAX, SPEED_DECAY_PER_SEC);
}

// Small helper kept separate so the formula is trivially testable.
function bonus(seconds: number, max: number, decayPerSec: number): number {
  return Math.max(0, max - seconds * decayPerSec);
}

/** All transitions keep the room doc inside the rules' allowed key set. */
export type BattleStatus = 'waiting' | 'active' | 'host_done' | 'guest_done' | 'done';

/**
 * Status transition when one participant finishes their paper.
 * Idempotent: a player finishing twice (retry, race) cannot corrupt the room.
 */
export function deriveStatus(current: BattleStatus, who: 'host' | 'guest'): BattleStatus {
  if (current === 'waiting' || current === 'done') return current;
  if (who === 'host') {
    return current === 'guest_done' ? 'done' : 'host_done';
  }
  return current === 'host_done' ? 'done' : 'guest_done';
}

export type BattleWinner = 'host' | 'guest' | 'tie';

/** Winner once both papers are in. Higher score wins; equal is a tie. */
export function determineWinner(hostScore: number, guestScore: number): BattleWinner {
  if (hostScore > guestScore) return 'host';
  if (guestScore > hostScore) return 'guest';
  return 'tie';
}

/**
 * The room document written at create time (the ONLY unrestricted write).
 * Everything both players need — the frozen paper, the players, the stakes —
 * is baked in here, because later updates may touch only the five allowed keys.
 */
export interface BattleRoom {
  roomCode: string;
  hostUid: string;
  host: string;
  guestUid: string | null;
  guest: string | null;
  hostScore: number;
  guestScore: number;
  status: BattleStatus;
  question_ids: string[];
  created_at: number;
}

/** Rooms are identified by a 6-char unambiguous code (no 0/O, 1/I). */
export function generateRoomCode(rand: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(rand() * alphabet.length)];
  return code;
}

/** Role of a participant in a room, resolved from the two uid fields. */
export function roleFor(room: Pick<BattleRoom, 'hostUid' | 'guestUid'>, uid: string): 'host' | 'guest' | null {
  if (uid === room.hostUid) return 'host';
  if (uid != null && uid === room.guestUid) return 'guest';
  return null;
}

/** The opponent's display name for the local UI. */
export function opponentName(room: Pick<BattleRoom, 'host' | 'guest'>, role: 'host' | 'guest'): string | null {
  return role === 'host' ? room.guest : room.host;
}