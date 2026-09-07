import { describe, it, expect } from 'vitest';
import {
  Executor, CustomExam, normalizeSpec, customExamIdFor,
  upsertCustomExam, getCustomExamsByUser, deleteCustomExam, recordCustomExamResult,
} from './customExamStore';

/** In-memory executor mimicking the sqlite subset we use — for logic tests only. */
function fakeDb(): Executor & { rows: Map<string, CustomExam> } {
  const rows = new Map<string, CustomExam>();
  const matchId = (sql: string, params: unknown[]): string => {
    // The id is always the first parameter in our queries.
    return String(params[0]);
  };
  return {
    rows,
    async runAsync(sql, ...params) {
      const id = sql.includes('attempts + 1') ? String(params[2]) : matchId(sql, params);
      if (sql.startsWith('INSERT')) {
        const existing = rows.get(id);
        if (existing) {
          Object.assign(existing, { title: params[2], description: params[3], updated_at: params[13] });
        } else {
          rows.set(id, {
            id, user_id: String(params[1]), title: String(params[2]), description: params[3] as string | null,
            durationSeconds: Number(params[4]), marksPerQuestion: Number(params[5]),
            negativeMarks: Number(params[6]), passPercent: Number(params[7]),
            subjectIds: JSON.parse(String(params[8])), chapterIds: JSON.parse(String(params[9])),
            questionCount: Number(params[10]), attempts: 0, best_percent: 0,
            created_at: Number(params[12]), updated_at: Number(params[13]),
          });
        }
      } else if (sql.startsWith('UPDATE custom_exams SET\n       attempts') || sql.includes('attempts + 1')) {
        const rec = rows.get(id);
        // Respect the WHERE user_id = ? guard like real sqlite would.
        if (rec && rec.user_id === String(params[3])) {
          rec.attempts += 1;
          rec.best_percent = Math.max(rec.best_percent, Number(params[0]));
        }
      } else if (sql.startsWith('DELETE')) {
        const rec = rows.get(id);
        // Respect the WHERE user_id = ? guard here too.
        if (rec && rec.user_id === String(params[1])) rows.delete(id);
      }
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      return (rows.get(matchId(sql, params)) as unknown as T) ?? null;
    },
    async getAllAsync<T>(): Promise<T[]> {
      return [...rows.values()].sort((a, b) => b.updated_at - a.updated_at) as unknown as T[];
    },
  };
}

const spec = {
  title: 'Rapid Concrete Drill',
  durationSeconds: 900,
  marksPerQuestion: 2,
  negativeMarks: 0.5,
  passPercent: 50,
  subjectIds: ['ce_technical'],
  chapterIds: [],
  questionCount: 25,
};

describe('customExamStore', () => {
  it('creates once and re-saving identical config never duplicates (rule 56)', async () => {
    const db = fakeDb();
    const a = await upsertCustomExam(db, 'user1', spec);
    const b = await upsertCustomExam(db, 'user1', spec);
    expect(a.id).toBe(b.id);
    expect(db.rows.size).toBe(1);
  });

  it('same config for different users yields distinct exams', async () => {
    const db = fakeDb();
    const a = await upsertCustomExam(db, 'alice', spec);
    const b = await upsertCustomExam(db, 'bob', spec);
    expect(a.id).not.toBe(b.id);
    expect(db.rows.size).toBe(2);
  });

  it('normalizes invalid/unbounded values into safe ranges', () => {
    const n = normalizeSpec({
      title: '   ', durationSeconds: 99999, questionCount: 10_000,
      marksPerQuestion: -3, passPercent: 400, subjectIds: ['a', 'a'],
    });
    expect(n.title).toBe('Custom Exam');
    expect(n.durationSeconds).toBeLessThanOrEqual(3 * 3600);
    expect(n.questionCount).toBe(200);
    expect(n.marksPerQuestion).toBe(1);
    expect(n.passPercent).toBe(100);
    expect(n.subjectIds).toEqual(['a']);
  });

  it('records attempts with best-score retention, scoped to owner', async () => {
    const db = fakeDb();
    const exam = await upsertCustomExam(db, 'user1', spec);
    await recordCustomExamResult(db, 'user1', exam.id, 62);
    await recordCustomExamResult(db, 'user1', exam.id, 40);
    let stored = (await getCustomExamsByUser(db, 'user1'))[0];
    expect(stored.attempts).toBe(2);
    expect(stored.best_percent).toBe(62);

    // A different user cannot affect user1's exam.
    await recordCustomExamResult(db, 'intruder', exam.id, 99);
    stored = (await getCustomExamsByUser(db, 'user1'))[0];
    expect(stored.attempts).toBe(2);
    expect(stored.best_percent).toBe(62);

    // Delete is owner-scoped and idempotent.
    await deleteCustomExam(db, 'intruder', exam.id);
    expect(db.rows.size).toBe(1);
    await deleteCustomExam(db, 'user1', exam.id);
    await deleteCustomExam(db, 'user1', exam.id);
    expect(await getCustomExamsByUser(db, 'user1')).toHaveLength(0);
  });

  it('derives stable ids from config via customExamIdFor', () => {
    const s = normalizeSpec(spec);
    expect(customExamIdFor('u1', s)).toBe(customExamIdFor('u1', normalizeSpec(spec)));
    expect(customExamIdFor('u1', { ...s, questionCount: 30 }))
      .not.toBe(customExamIdFor('u1', s));
  });
});
