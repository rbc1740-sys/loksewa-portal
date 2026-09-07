/**
 * Firestore security-rules tests (Phase 6 verification).
 *
 * Executes the REAL firestore.rules against the Firestore emulator, pinning
 * the ownership contracts the mobile outbox pipeline relies on.
 * Run via: firebase emulators:exec --only firestore "npm test"
 * (from the repo root, where firebase.json lives).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-loksewa';
const RULES = readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

const asAlice = () => testEnv.authenticatedContext(ALICE).firestore();
const asBob = () => testEnv.authenticatedContext(BOB).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

describe('user_progress / sr_state (doc-id pinned per-question rows)', () => {
  it('owner may create their own progress row with the matching doc id', async () => {
    await assertSucceeds(
      asAlice()
        .collection('user_progress')
        .doc(`${ALICE}_q1`)
        .set({ user_id: ALICE, question_id: 'q1', attempt_count: 1 })
    );
  });

  it('rejects a doc id forged for another user', async () => {
    // Alice writing to a doc id derived from BOB's uid — cross-user takeover.
    await assertFails(
      asAlice()
        .collection('user_progress')
        .doc(`${BOB}_q1`)
        .set({ user_id: ALICE, question_id: 'q1', attempt_count: 1 })
    );
  });

  it('rejects a payload whose user_id differs from auth.uid', async () => {
    await assertFails(
      asAlice()
        .collection('user_progress')
        .doc(`${ALICE}_q1`)
        .set({ user_id: BOB, question_id: 'q1', attempt_count: 1 })
    );
  });

  it('rejects unauthenticated writes and other users reading the row', async () => {
    const ref = asAlice().collection('user_progress').doc(`${ALICE}_q1`);
    await assertSucceeds(ref.set({ user_id: ALICE, question_id: 'q1', attempt_count: 1 }));
    await assertFails(asAnon().collection('user_progress').doc(`${ALICE}_q1`).get());
    await assertFails(asBob().collection('user_progress').doc(`${ALICE}_q1`).get());
  });
});
describe('sr_state id scheme', () => {
  it('rejects writes that break the id scheme, allows the correct one', async () => {
    await assertFails(
      asAlice()
        .collection('sr_state')
        .doc('wrong-id')
        .set({ user_id: ALICE, question_id: 'q1', ease_factor: 2.5 })
    );
    await assertSucceeds(
      asAlice()
        .collection('sr_state')
        .doc(`${ALICE}_q1`)
        .set({ user_id: ALICE, question_id: 'q1', ease_factor: 2.5 })
    );
  });
});

describe('restore query contract (owner-scoped where user_id == uid)', () => {
  it('allows the owner query and rejects the same query by another user', async () => {
    await assertSucceeds(asAlice().collection('user_progress').where('user_id', '==', ALICE).get());
    await assertFails(asBob().collection('user_progress').where('user_id', '==', ALICE).get());
  });
});

describe('bookmarks / weak_points (owner via payload or inherited from existing doc)', () => {
  it('allows a full owner create and a partial tag-only update (merged doc keeps ownership)', async () => {
    const ref = asAlice().collection('bookmarks').doc(`${ALICE}_q1`);
    await assertSucceeds(ref.set({ user_id: ALICE, question_id: 'q1', tags_json: '[]' }));
    // The outbox's tag-edit envelope carries only { id, tags_json }: the
    // post-merge document inherits user_id from the stored row.
    await assertSucceeds(ref.update({ tags_json: '["hard"]' }));
  });

  it('rejects an ownerless create and a foreign-user write to the same doc id', async () => {
    const ref = asAlice().collection('bookmarks').doc(`${ALICE}_q1`);
    await assertSucceeds(ref.set({ user_id: ALICE, question_id: 'q1', tags_json: '[]' }));
    await assertFails(
      asBob()
        .collection('bookmarks')
        .doc(`${ALICE}_q1`)
        .set({ user_id: BOB, question_id: 'q1', tags_json: '[]' })
    );
    await assertFails(
      asAnon()
        .collection('bookmarks')
        .doc(`${ALICE}_q1`)
        .set({ question_id: 'q1', tags_json: '[]' })
    );
  });
});

describe('user_profile (doc id must equal auth.uid)', () => {
  it('allows the owner doc and rejects a doc id spoofing another uid', async () => {
    await assertSucceeds(
      asAlice().collection('user_profile').doc(ALICE).set({ user_id: ALICE, xp: 10 })
    );
    await assertFails(
      asAlice().collection('user_profile').doc(BOB).set({ user_id: ALICE, xp: 10 })
    );
  });
});

describe('exam_sessions (owner-scoped start/submit)', () => {
  it('allows owner create + update, rejects unauthenticated create', async () => {
    const ref = asAlice().collection('exam_sessions').doc('sess1');
    await assertSucceeds(ref.set({ user_id: ALICE, paper_id: 'model_1', status: 'active' }));
    await assertSucceeds(ref.update({ status: 'submitted' }));
    await assertFails(asAnon().collection('exam_sessions').doc('sess2').set({ user_id: 'x' }));
  });
});

describe('exam_history (immutable graded attempts: create-only)', () => {
  const attemptId = `${ALICE}_eh_sess1`;
  const row = { user_id: ALICE, session_id: 'sess1', percentage: 80 };

  it('allows the owner create with the idempotent id scheme', async () => {
    await assertSucceeds(asAlice().collection('exam_history').doc(attemptId).set(row));
  });

  it('rejects a create whose doc id breaks the user_eh_session scheme', async () => {
    await assertFails(asAlice().collection('exam_history').doc('forged-id').set(row));
  });

  it('enforces immutability: no update, no delete — even for the owner', async () => {
    const ref = asAlice().collection('exam_history').doc(attemptId);
    await assertSucceeds(ref.set(row));
    await assertFails(ref.update({ percentage: 99 }));
    await assertFails(ref.delete());
  });
});

describe('battle_sessions (owner-scoped stats)', () => {
  it('allows owner write and denies cross-user read', async () => {
    const ref = asAlice().collection('battle_sessions').doc('b1');
    await assertSucceeds(ref.set({ user_id: ALICE, wins: 3 }));
    await assertFails(asBob().collection('battle_sessions').doc('b1').get());
  });
});

describe('/battles rooms (1v1 real-time match docs)', () => {
  const ROOM = 'LKABC123';
  // Matches the RoomDoc shape battleService.ts actually writes: a frozen
  // 10-question paper (BATTLE_QUESTIONS == 10) instead of inline questions.
  const baseRoom = () => ({
    roomCode: ROOM,
    host: 'Alice',
    hostUid: ALICE,
    hostScore: 0,
    guest: null,
    guestUid: null,
    guestScore: 0,
    status: 'waiting',
    question_ids: Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
    created_at: Date.now(),
  });
  const asCarol = () => testEnv.authenticatedContext('carol-uid').firestore();

  it('allows the host to create a room with their own hostUid', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
  });

  it('rejects a create whose frozen paper is not exactly 10 question ids', async () => {
    await assertFails(
      asAlice()
        .collection('battles')
        .doc('LKSHORT')
        .set({
          ...baseRoom(),
          roomCode: 'LKSHORT',
          question_ids: ['q1', 'q2'],
        })
    );
    await assertFails(
      asAlice()
        .collection('battles')
        .doc('LKNOQ')
        .set({
          ...baseRoom(),
          roomCode: 'LKNOQ',
          question_ids: 'q1,q2,q3,q4,q5,q6,q7,q8,q9,q10',
        })
    );
  });

  it('rejects a hostUid forged by another user', async () => {
    await assertFails(
      asBob()
        .collection('battles')
        .doc('LKFORGED')
        .set({ ...baseRoom(), roomCode: 'LKFORGED', hostUid: ALICE })
    );
  });

  it('rejects unauthenticated create and read, allows signed-in read (join flow)', async () => {
    await assertFails(asAnon().collection('battles').doc(ROOM).set(baseRoom()));
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    await assertFails(asAnon().collection('battles').doc(ROOM).get());
    await assertSucceeds(asBob().collection('battles').doc(ROOM).get());
  });

  it('allows the guest to claim the seat with only the permitted keys', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    // Seat claim starts the match: rules require the status flip to 'active'.
    await assertSucceeds(
      asBob().collection('battles').doc(ROOM).update({
        guest: 'Bob',
        guestUid: BOB,
        status: 'active',
      })
    );
  });

  it('rejects a seat claim that does not start the match', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    await assertFails(
      asBob().collection('battles').doc(ROOM).update({ guest: 'Bob', guestUid: BOB })
    );
  });

  it('rejects an update touching keys outside the role-scoped set', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    await asBob().collection('battles').doc(ROOM).update({
      guest: 'Bob',
      guestUid: BOB,
      status: 'active',
    });
    // The guest may not forge the host's score or rewrite the frozen paper.
    await assertFails(asBob().collection('battles').doc(ROOM).update({ hostScore: 999 }));
    await assertFails(asBob().collection('battles').doc(ROOM).update({ question_ids: [] }));
    // The host may not write the guest's identity/score either.
    await assertFails(asAlice().collection('battles').doc(ROOM).update({ guestScore: 50 }));
  });

  it('lets each participant publish only their own final score via the state machine', async () => {
    const ref = asAlice().collection('battles').doc(ROOM);
    await assertSucceeds(ref.set(baseRoom()));
    await assertSucceeds(
      asBob().collection('battles').doc(ROOM).update({
        guest: 'Bob',
        guestUid: BOB,
        status: 'active',
      })
    );
    // Neither side may jump straight from 'active' to 'done'.
    await assertFails(
      asAlice().collection('battles').doc(ROOM).update({ hostScore: 120, status: 'done' })
    );
    await assertSucceeds(
      asAlice().collection('battles').doc(ROOM).update({ hostScore: 120, status: 'host_done' })
    );
    // With the host done, the guest's legal transition is host_done -> done.
    await assertSucceeds(
      asBob().collection('battles').doc(ROOM).update({ guestScore: 90, status: 'done' })
    );
  });

  it('rejects updates from non-participants', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    await assertFails(asCarol().collection('battles').doc(ROOM).update({ guestScore: 1 }));
  });

  it('allows only the host to delete their own room', async () => {
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).set(baseRoom()));
    await assertFails(asBob().collection('battles').doc(ROOM).delete());
    await assertFails(asAnon().collection('battles').doc(ROOM).delete());
    await assertSucceeds(asAlice().collection('battles').doc(ROOM).delete());
  });
});
