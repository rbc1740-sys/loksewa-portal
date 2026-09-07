/**
 * Cloud restore (Phase 7) — the pull side of the sync loop.
 *
 * On a fresh install (or a second device) SQLite starts empty while the
 * pushed outbox data lives in Firestore. This service hydrates the local
 * tables from the owner's cloud documents, guarded by recency so a restore
 * NEVER clobbers newer local work:
 *
 * - Per-question tables (user_progress, sr_state, bookmarks): remote wins
 *   only when its recency anchor (last_attempted_at / last_answered_at /
 *   created_at) is newer than the local row's.
 * - weak_points: a flag with no recency — restored only when absent locally.
 * - user_profile: remote wins when updated_at is newer.
 * - exam_history: immutable graded attempts (Phase 6 rules forbid updates),
 *   so the remote copy is authoritative and always safe to write.
 *
 * Firestore reads are constrained by `where('user_id', '==', uid)`, which the
 * owner-scoped security rules require for queries. Rows are written through
 * database.restoreRow(), which stamps synced_at and enqueues nothing — a
 * restore must not echo back into the push outbox.
 */
type RestoreTable =
  | 'user_progress'
  | 'sr_state'
  | 'bookmarks'
  | 'weak_points'
  | 'user_profile'
  | 'exam_history';

export interface RestoreSummary {
  restored: Partial<Record<RestoreTable, number>>;
  skipped: number;
  errors: number;
}

/** Per-table recency anchor; rows without one are restored only when absent. */
const RECENCY_ANCHOR: Partial<Record<RestoreTable, string>> = {
  user_progress: 'last_attempted_at',
  sr_state: 'last_answered_at',
  bookmarks: 'created_at',
  user_profile: 'updated_at',
};

function isNewer(remote: Record<string, unknown>, local: Record<string, unknown> | null, anchor: string): boolean {
  if (!local) return true;
  const r = typeof remote[anchor] === 'number' ? (remote[anchor] as number) : 0;
  const l = typeof local[anchor] === 'number' ? (local[anchor] as number) : 0;
  return r > l;
}

/**
 * Restores the signed-in user's cloud data into SQLite. Idempotent — running
 * it again is a no-op once every remote row is older-or-equal to its local
 * counterpart. Returns a per-table summary; cloud failures are thrown to the
 * caller (boot wiring treats restore as non-fatal).
 */
export async function restoreFromCloud(
  userId: string,
  opts: { tables?: RestoreTable[] } = {}
): Promise<RestoreSummary> {
  // Lazy imports: firebase + our auth module must never load in unit tests
  // (same isolation discipline as the sync transport).
  const [{ collection, getDocs, query, where }, { getFirestoreInstance }] = await Promise.all([
    import('firebase/firestore'),
    import('./auth'),
  ]);
  const db = getFirestoreInstance();

  const TABLES: RestoreTable[] = opts.tables ?? [
    'user_progress', 'sr_state', 'bookmarks', 'weak_points', 'user_profile', 'exam_history',
  ];
  const summary: RestoreSummary = { restored: {}, skipped: 0, errors: 0 };

  // Local lookup helpers keyed per table. `unknown` rows compare via anchors.
  const database = await import('./database');
  const localLookup: Record<RestoreTable, (id: string) => Promise<Record<string, unknown> | null>> = {
    user_progress: async id => {
      const qid = id.slice(userId.length + 1); // id = `${uid}_${questionId}`
      return (await database.getProgress(userId, qid)) as unknown as Record<string, unknown> | null;
    },
    sr_state: async id => {
      const qid = id.slice(userId.length + 1);
      return (await database.getSRState(userId, qid)) as unknown as Record<string, unknown> | null;
    },
    bookmarks: async id => {
      const qid = id.slice(userId.length + 1);
      return (await database.getBookmark(userId, qid)) as unknown as Record<string, unknown> | null;
    },
    weak_points: async () => null, // flag table: presence check happens via anchor-less rule
    user_profile: async () =>
      (await database.getUserProfile(userId)) as unknown as Record<string, unknown> | null,
    exam_history: async () => null, // immutable rows: remote always authoritative
  };

  for (const table of TABLES) {
    try {
      const snap = await getDocs(
        query(collection(db, table), where('user_id', '==', userId))
      );
      let count = 0;
      for (const d of snap.docs) {
        const row = d.data() as Record<string, unknown>;
        // Defense in depth: rules already enforce ownership server-side.
        if (row.user_id !== userId) {
          summary.skipped += 1;
          continue;
        }
        if (table === 'weak_points') {
          // Flag table: no recency anchor — restore only when absent locally.
          const qid = typeof row.question_id === 'string' ? row.question_id : null;
          if (!qid || (await database.isWeakPoint(userId, qid))) {
            summary.skipped += 1;
            continue;
          }
        } else if (table !== 'exam_history') {
          // Per-question + profile rows: remote wins only when strictly newer.
          const local = await localLookup[table](d.id);
          if (!isNewer(row, local, RECENCY_ANCHOR[table]!)) {
            summary.skipped += 1;
            continue;
          }
        }
        // exam_history falls through: immutable graded attempts, remote copy
        // is authoritative (Phase 6 rules forbid updates to these documents).
        await database.restoreRow(table, row);
        count += 1;
      }
      if (count > 0) summary.restored[table] = count;
    } catch (error) {
      // One collection failing (e.g. a transient read error) must not abort
      // the others; the next run's recency guards make retrying safe.
      console.error(`[CloudRestore] ${table} restore failed:`, error);
      summary.errors += 1;
    }
  }

  return summary;
}