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
const RULES = readFileSync(
  fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  'utf8'
);

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
    await assertSucceeds(
      ref.set({ user_id: ALICE, question_id: 'q1', attempt_count: 1 })
    );
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
    await assertSucceeds(
      asAlice().collection('user_progress').where('user_id', '==', ALICE).get()
    );
    await assertFails(
      asBob().collection('user_progress').where('user_id', '==', ALICE).get()
    );
  });
});

describe('bookmarks / weak_points (owner via payload or inherited from existing doc)', () => {
  it('allows a full owner create and a partial tag-only update (merged doc keeps ownership)', async () => {
    const ref = asAlice().collection('bookmarks').doc(`${ALICE}_q1`);
    await assertSucceeds(
      ref.set({ user_id: ALICE, question_id: 'q1', tags_json: '[]' })
    );
    // The outbox's tag-edit envelope carries only { id, tags_json }: the
    // post-merge document inherits user_id from the stored row.
    await assertSucceeds(ref.update({ tags_json: '["hard"]' }));
  });

  it('rejects an ownerless create and a foreign-user write to the same doc id', async () => {
    const ref = asAlice().collection('bookmarks').doc(`${ALICE}_q1`);
    await assertSucceeds(
      ref.set({ user_id: ALICE, question_id: 'q1', tags_json: '[]' })
    );
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
    await assertSucceeds(
      ref.set({ user_id: ALICE, paper_id: 'model_1', status: 'active' })
    );
    await assertSucceeds(ref.update({ status: 'submitted' }));
    await assertFails(
      asAnon().collection('exam_sessions').doc('sess2').set({ user_id: 'x' })
    );
  });
});

describe('exam_history (immutable graded attempts: create-only)', () => {
  const attemptId = `${ALICE}_eh_sess1`;
  const row = { user_id: ALICE, session_id: 'sess1', percentage: 80 };

  it('allows the owner create with the idempotent id scheme', async () => {
    await assertSucceeds(
      asAlice().collection('exam_history').doc(attemptId).set(row)
    );
  });

  it('rejects a create whose doc id breaks the user_eh_session scheme', async () => {
    await assertFails(
      asAlice().collection('exam_history').doc('forged-id').set(row)
    );
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