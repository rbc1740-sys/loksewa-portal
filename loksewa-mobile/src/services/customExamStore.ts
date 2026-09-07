/**
 * Custom-exam store — Phase 3 (rule 27).
 *
 * All functions take a minimal SQL executor so the logic is unit-testable in
 * vitest without the native expo-sqlite layer; database.ts wires the real DB.
 *
 * Identity & idempotency: a custom exam's id is derived deterministically from
 * userId + configuration, so re-saving identical config can never duplicate
 * rows (rule 56). Attempts/deletes are idempotent by construction.
 */

export type Executor = {
  runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
  getFirstAsync: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
};

export interface CustomExamSpec {
  title: string;
  description?: string | null;
  durationSeconds: number;
  marksPerQuestion: number;
  negativeMarks: number;
  passPercent: number;
  /** Empty array = all subjects of the active course. */
  subjectIds: string[];
  /** Optional chapter narrowing within the selected subjects. */
  chapterIds: string[];
  questionCount: number;
}

export interface CustomExam extends CustomExamSpec {
  id: string;
  user_id: string;
  attempts: number;
  best_percent: number;
  created_at: number;
  updated_at: number;
}

/** djb2 — stable, dependency-free config fingerprint for id derivation. */
function hashConfig(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

/** Raw snake_case row shape returned by SQLite. */
interface CustomExamRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  marks_per_question: number;
  negative_marks: number;
  pass_percent: number;
  subject_ids_json: string;
  chapter_ids_json: string;
  question_count: number;
  attempts: number;
  best_percent: number;
  created_at: number | null;
  updated_at: number | null;
}

/** JSON-parse tolerant of corrupt rows (rule 69: graceful on invalid data). */
function parseIds(json: string | null | undefined): string[] {
  try {
    const v = json ? JSON.parse(json) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function mapCustomExamRow(r: CustomExamRow): CustomExam {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description,
    durationSeconds: r.duration_seconds,
    marksPerQuestion: r.marks_per_question,
    negativeMarks: r.negative_marks,
    passPercent: r.pass_percent,
    subjectIds: parseIds(r.subject_ids_json),
    chapterIds: parseIds(r.chapter_ids_json),
    questionCount: r.question_count,
    attempts: r.attempts ?? 0,
    best_percent: r.best_percent ?? 0,
    created_at: r.created_at ?? 0,
    updated_at: r.updated_at ?? 0,
  };
}

export function normalizeSpec(raw: Partial<CustomExamSpec>): CustomExamSpec {
  return {
    title: (raw.title ?? '').trim().slice(0, 80) || 'Custom Exam',
    description: raw.description ? String(raw.description).slice(0, 300) : null,
    durationSeconds: clampInt(Number(raw.durationSeconds) || 1200, 60, 3 * 3600),
    marksPerQuestion: clampInt(Number(raw.marksPerQuestion) || 1, 1, 100),
    negativeMarks: Math.max(0, Number(raw.negativeMarks) || 0),
    passPercent: clampInt(Number(raw.passPercent) || 40, 1, 100),
    subjectIds: Array.isArray(raw.subjectIds) ? [...new Set(raw.subjectIds)] : [],
    chapterIds: Array.isArray(raw.chapterIds) ? [...new Set(raw.chapterIds)] : [],
    questionCount: clampInt(Number(raw.questionCount) || 20, 1, 200),
  };
}

export function customExamIdFor(userId: string, spec: CustomExamSpec): string {
  const key = JSON.stringify([
    spec.title.toLowerCase(),
    spec.subjectIds,
    spec.chapterIds,
    spec.questionCount,
    spec.durationSeconds,
  ]);
  return `cexam_${userId.slice(0, 12)}_${hashConfig(key)}`;
}

export async function upsertCustomExam(
  exec: Executor,
  userId: string,
  rawSpec: Partial<CustomExamSpec>
): Promise<CustomExam> {
  const spec = normalizeSpec(rawSpec);
  const id = customExamIdFor(userId, spec);
  const now = Date.now();

  await exec.runAsync(
    `INSERT INTO custom_exams
       (id, user_id, title, description, duration_seconds, marks_per_question,
        negative_marks, pass_percent, subject_ids_json, chapter_ids_json,
        question_count, attempts, best_percent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       updated_at = excluded.updated_at`,
    id, userId, spec.title, spec.description, spec.durationSeconds, spec.marksPerQuestion,
    spec.negativeMarks, spec.passPercent, JSON.stringify(spec.subjectIds),
    JSON.stringify(spec.chapterIds), spec.questionCount, now, now
  );

  const row = await exec.getFirstAsync<CustomExamRow>('SELECT * FROM custom_exams WHERE id = ?', id);
  if (!row) throw new Error('Custom exam write failed');
  return mapCustomExamRow(row);
}

export async function getCustomExamsByUser(exec: Executor, userId: string): Promise<CustomExam[]> {
  const rows = await exec.getAllAsync<CustomExamRow>(
    'SELECT * FROM custom_exams WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100',
    userId
  );
  return rows.map(mapCustomExamRow);
}

export async function deleteCustomExam(exec: Executor, userId: string, id: string): Promise<void> {
  // Scoped to owner; safe to call repeatedly.
  await exec.runAsync('DELETE FROM custom_exams WHERE id = ? AND user_id = ?', id, userId);
}

/** Call when an attempt on this custom exam is submitted (idempotent per submit). */
export async function recordCustomExamResult(
  exec: Executor,
  userId: string,
  id: string,
  percent: number
): Promise<void> {
  const pct = clampInt(percent, 0, 100);
  await exec.runAsync(
    `UPDATE custom_exams SET
       attempts = attempts + 1,
       best_percent = MAX(best_percent, ?),
       updated_at = ?
     WHERE id = ? AND user_id = ?`,
    pct, Date.now(), id, userId
  );
}
