/**
 * Battle service (Phase 8) — Firestore room lifecycle.
 *
 * Operates strictly within the pre-existing /battles rules:
 * - create: any signed-in user, requires hostUid == auth.uid (no key limits)
 * - update: only the two participants, ONLY keys {guest, guestUid,
 *   guestScore, hostScore, status} — so joining writes guest fields, and
 *   finishing writes only myScore + status.
 * - read: any signed-in user (rules) — this service only reads rooms the
 *   user participates in or that are openly waiting.
 *
 * Firebase is lazily imported so unit tests never load the native chain.
 */
import {
  BATTLE_QUESTIONS,
  deriveStatus,
  generateRoomCode,
  roleFor,
  type BattleRoom,
  type BattleStatus,
} from './battleEngine';

export interface BattleRoomView extends BattleRoom {
  /** Which side the current user is on; null when spectating. */
  myRole: 'host' | 'guest' | null;
}

/** Shape of the Firestore room doc as read back. */
export type RoomDoc = {
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
};

const fs = () => import('firebase/firestore');
const auth = () => import('./auth');

function view(room: RoomDoc, uid: string | null): BattleRoomView {
  return { ...room, myRole: roleFor(room, uid ?? '') };
}

async function roomRef(roomCode: string) {
  const { doc } = await fs();
  const { getFirestoreInstance } = await auth();
  return doc(getFirestoreInstance(), 'battles', roomCode.trim().toUpperCase());
}

/** Creates a battle room with a frozen 10-question paper. */
export async function createBattleRoom(
  displayName: string,
  topic: string,
  questionIds: string[]
): Promise<{ roomCode: string; questionIds: string[] }> {
  const { setDoc } = await fs();
  const { getCurrentUser } = await auth();
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to host a battle.');
  if (questionIds.length < BATTLE_QUESTIONS) {
    throw new Error(`Need at least ${BATTLE_QUESTIONS} questions in this topic.`);
  }

  // Codes can collide: an overwrite of an existing doc fails the
  // rules (create-time invariants don't apply to an update), so regenerate
  // and retry instead of surfacing a confusing permission error.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const roomCode = generateRoomCode();
    const room: RoomDoc = {
      roomCode,
      hostUid: user.uid,
      host: displayName || 'Host',
      guestUid: null,
      guest: null,
      hostScore: 0,
      guestScore: 0,
      status: 'waiting',
      // Frozen paper: exactly BATTLE_QUESTIONS ids, decided once at create so
      // both clients answer identical questions without extra round-trips.
      question_ids: questionIds.slice(0, BATTLE_QUESTIONS),
      created_at: Date.now(),
    };
    try {
      await setDoc(await roomRef(roomCode), room);
      return { roomCode, questionIds: room.question_ids };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not create the battle.');
}

/** Joins an existing room as guest; the seat claim also flips status to
 *  'active' (rules allow ['guest','guestUid','status']), starting the match. */
export async function joinBattleRoom(
  roomCode: string,
  displayName: string
): Promise<BattleRoomView> {
  const { getDoc, updateDoc } = await fs();
  const { getCurrentUser } = await auth();
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to join a battle.');

  const ref = await roomRef(roomCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Room not found. Check the code.');
  const room = snap.data() as RoomDoc;
  const role = roleFor(room, user.uid);
  if (role === 'guest') return view(room, user.uid); // idempotent rejoin
  if (role === 'host') return view(room, user.uid); // host re-entering own room

  if (room.status !== 'waiting' || room.guestUid != null) {
    throw new Error('That battle is already full or underway.');
  }
  const guest = displayName || 'Guest';
  // Rules' seat-claim branch permits ['guest','guestUid','status'] — flipping
  // status to 'active' here starts the match on BOTH clients at once (the
  // host learns via the room subscription; no second round-trip needed).
  await updateDoc(ref, { guest, guestUid: user.uid, status: 'active' });
  return view({ ...room, guest, guestUid: user.uid, status: 'active' }, user.uid);
}

/** Reads one room and resolves the caller's role. */
export async function fetchRoom(roomCode: string): Promise<BattleRoomView | null> {
  const { getDoc } = await fs();
  const { getCurrentUser } = await auth();
  const snap = await getDoc(await roomRef(roomCode));
  if (!snap.exists()) return null;
  const uid = getCurrentUser()?.uid ?? null;
  return view(snap.data() as RoomDoc, uid);
}

/**
 * Saves my paper result and advances the status machine. Idempotent:
 * a retry after a successful write is a no-op (deriveStatus is stable).
 * Also serves as the RACE REPAIR write: if both papers finished nearly
 * simultaneously, the loser of the status write-off sees the other side's
 * finish recorded with a non-done status and re-writes {myScore, 'done'} —
 * exactly the missing transition, and idempotent under the rules.
 * Transient network failures are retried (fresh read each attempt, so a
 * concurrent legitimate write can never be clobbered by a stale one).
 */
export async function finishMyPaper(
  roomCode: string,
  role: 'host' | 'guest',
  score: number
): Promise<void> {
  const { getDoc, updateDoc } = await fs();
  const ref = await roomRef(roomCode);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Room not found.');
      const room = snap.data() as RoomDoc;

      const next = deriveStatus(room.status, role);
      if (next === room.status) return; // already recorded my result — retry no-op

      await updateDoc(ref, {
        [role === 'host' ? 'hostScore' : 'guestScore']: score,
        status: next,
      });
      return;
    } catch (e) {
      if (e instanceof Error && e.message === 'Room not found.') throw e;
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not save your result.');
}

/**
 * Host cancels a still-waiting room before anyone joined. Deleting an
 * active/finished match would destroy the opponent's view, so the service
 * only ever deletes rooms that are still in 'waiting' and hosted by the
 * caller (the rules additionally scope deletes to the host).
 */
export async function cancelOpenRoom(roomCode: string): Promise<void> {
  const { deleteDoc, getDoc } = await fs();
  const { getCurrentUser } = await auth();
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in first.');
  const ref = await roomRef(roomCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) return; // already gone — nothing to cancel
  const room = snap.data() as RoomDoc;
  if (room.hostUid !== user.uid || room.status !== 'waiting') return; // not cancellable
  await deleteDoc(ref);
}

/** Open rooms waiting for an opponent (most recent first). */
export async function listOpenRooms(): Promise<BattleRoomView[]> {
  const { collection, query, where, orderBy, limit, getDocs } = await fs();
  const { getFirestoreInstance, getCurrentUser } = await auth();
  const db = getFirestoreInstance();
  const q = query(
    collection(db, 'battles'),
    where('status', '==', 'waiting'),
    where('guestUid', '==', null),
    orderBy('created_at', 'desc'),
    limit(20)
  );
  const uid = getCurrentUser()?.uid ?? null;
  const out: BattleRoomView[] = [];
  (await getDocs(q)).forEach(d => out.push(view(d.data() as RoomDoc, uid)));
  return out;
}

/** Live subscription to a room; returns unsubscribe. Errors (permission
 *  denied, dropped stream) surface through onError instead of vanishing. */
export async function subscribeRoom(
  roomCode: string,
  onUpdate: (room: BattleRoomView) => void,
  onError?: (e: Error) => void
): Promise<() => void> {
  const { onSnapshot } = await fs();
  const { getCurrentUser } = await auth();
  const ref = await roomRef(roomCode);
  return onSnapshot(
    ref,
    snap => {
      if (!snap.exists()) return;
      const uid = getCurrentUser()?.uid ?? null;
      onUpdate(view(snap.data() as RoomDoc, uid));
    },
    onError
  );
}

/** A pool of question ids for the given topic (host freezes them at create). */
export async function pickBattleQuestions(topic: string): Promise<string[]> {
  const { getQuestionsByTopic } = await import('./database');
  const qs = await getQuestionsByTopic(topic, 30);
  return qs.map(q => q.id);
}
