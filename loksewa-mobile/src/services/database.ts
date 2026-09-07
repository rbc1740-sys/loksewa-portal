/**
 * Database Service - SQLite wrapper with migration support
 */
import * as SQLite from 'expo-sqlite';
import { MIGRATIONS, MIGRATION_ORDER, MigrationName } from '../db/migrations';
import { getBundledQuestions } from './questionParser';
import { XP_PER_CORRECT, XP_PER_WRONG, rankFromXp, nextStreakDays, localDateString } from '../utils/gamification';
import { COURSES, getTopicPath, DEFAULT_COURSE_ID } from '../constants/courses';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('loksewa.db');
  
  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  
  // Run migrations
  await runMigrations(db);
  
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create migration tracking table if not exists
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);
  
  // Get applied migrations
  const applied = await database.getAllAsync<{ version: string }>(
    'SELECT version FROM schema_migrations'
  );
  const appliedVersions = new Set(applied.map(r => r.version));
  
  // Run pending migrations in order
  for (const migrationName of MIGRATION_ORDER) {
    if (!appliedVersions.has(migrationName)) {
      console.log(`[DB] Running migration: ${migrationName}`);
      const sql = MIGRATIONS[migrationName];
      await database.execAsync(sql);
      await database.runAsync(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        migrationName
      );
      console.log(`[DB] Migration ${migrationName} completed`);
    }
  }
}

// Question types
export interface Question {
  id: string;
  topic: string;
  question: string;
  options_json: string; // JSON string
  answer: string;
  explanation?: string;
  source_file?: string;
  // New hierarchy fields (nullable on existing rows)
  course_id?: string;
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  marks?: number;
  negative_marks?: number;
  language?: string;
  reference?: string;
  status?: 'active' | 'draft' | 'disabled';
  created_at?: number;
  updated_at?: number;
}

export interface UserProgress {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer?: string;
  is_correct?: number; // 0, 1, null
  attempt_count: number;
  time_spent_ms: number;
  last_attempted_at: number;
  synced_at?: number;
}

export interface SRState {
  id: string;
  user_id: string;
  question_id: string;
  interval_days: number;
  ease_factor: number;
  attempts: number;
  due_at: number;
  total_attempts: number;
  total_correct: number;
  total_wrong: number;
  last_result?: 'correct' | 'wrong';
  last_answered_at: number;
  synced_at?: number;
}

export interface Bookmark {
  id: string;
  user_id: string;
  question_id: string;
  tags_json: string; // JSON array
  note: string;
  created_at: number;
  synced_at?: number;
}

export interface WeakPoint {
  id: string;
  user_id: string;
  question_id: string;
  created_at: number;
  synced_at?: number;
}

export interface UserProfile {
  user_id: string;
  xp: number;
  streak_days: number;
  last_active_date?: string;
  rank_tier: string;
  rank_sub: string;
  sound_enabled: number;
  theme: 'light' | 'dark' | 'system';
  accent_color: string;
  exam_target_date?: number;
  daily_goal_minutes: number;
  notification_token?: string;
  created_at: number;
  updated_at: number;
    db_version?: string;
  active_course_id?: string;
}

export interface ExamSession {
  id: string;
  user_id: string;
  topic?: string;
  question_count: number;
  time_limit_seconds: number;
  questions_json: string;
  answers_json: string;
  started_at: number;
  submitted_at?: number;
  score?: number;
  synced_at?: number;
}

export interface BattleSession {
  id: string;
  user_id: string;
  room_id?: string;
  opponent_id?: string;
  opponent_name?: string;
  settings_json: string;
  questions_json: string;
  current_question_index: number;
  my_score: number;
  opp_score: number;
  my_answers_json: string;
  opp_answers_json: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  created_at: number;
  updated_at: number;
}

export interface SyncQueueItem {
  id?: number;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload_json: string;
  retry_count: number;
  created_at: number;
  last_attempt_at?: number;
}

// Question operations
// Shared INSERT statement — keep this exact string in sync with
// src/db/migrations/schema-parity.test.ts (it statically greps for it).
const QUESTIONS_INSERT_COLUMNS = `id, topic, question, options_json, answer, explanation, source_file, course_id, subject_id, chapter_id, topic_id, difficulty, marks, negative_marks`;

async function insertQuestionRow(
  database: SQLite.SQLiteDatabase,
  q: Question,
  h: { course_id?: string; subject_id?: string; chapter_id?: string; topic_id?: string; difficulty?: string; marks?: number; negative_marks?: number } = {}
): Promise<void> {
  await database.runAsync(
    `INSERT OR REPLACE INTO questions (${QUESTIONS_INSERT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    q.id, q.topic, q.question, q.options_json, q.answer, q.explanation || null, q.source_file || null,
    h.course_id || null, h.subject_id || null, h.chapter_id || null, h.topic_id || null,
    h.difficulty || null, h.marks || null, h.negative_marks || null
  );
}

export async function bulkInsertQuestions(questions: Question[], hierarchyOverrides?: Record<string, { course_id?: string; subject_id?: string; chapter_id?: string; topic_id?: string; difficulty?: string; marks?: number; negative_marks?: number }>): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    for (const q of questions) {
      const h = hierarchyOverrides?.[q.id] || {};
      await insertQuestionRow(database, q, h);
    }
  });
}

export async function getQuestionsByTopic(topic: string, limit = 50, offset = 0): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    'SELECT * FROM questions WHERE topic = ? ORDER BY id LIMIT ? OFFSET ?',
    topic, limit, offset
  );
}

/** Stable, deterministic paged access to every question (topic = "All"). */
export async function getAllQuestions(limit = 20, offset = 0): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    'SELECT * FROM questions ORDER BY topic, id LIMIT ? OFFSET ?',
    limit, offset
  );
}

export async function searchQuestions(query: string, limit = 20): Promise<Question[]> {
  const database = await getDatabase();
  const searchTerm = `%${query.toLowerCase()}%`;
  return database.getAllAsync<Question>(
    `SELECT * FROM questions 
     WHERE LOWER(question) LIKE ? OR LOWER(topic) LIKE ? OR id LIKE ?
     ORDER BY topic, id LIMIT ?`,
    searchTerm, searchTerm, searchTerm, limit
  );
}

export async function getRandomQuestions(
  topic: string | 'all',
  count: number,
  excludeIds: string[] = []
): Promise<Question[]> {
  const database = await getDatabase();
  
  let sql = 'SELECT * FROM questions';
  const params: (string | number)[] = [];
  
  if (topic !== 'all') {
    sql += ' WHERE topic = ?';
    params.push(topic);
  }
  
  if (excludeIds.length > 0) {
    const placeholders = excludeIds.map(() => '?').join(',');
    sql += topic !== 'all' ? ' AND' : ' WHERE';
    sql += ` id NOT IN (${placeholders})`;
    params.push(...excludeIds);
  }
  
  sql += ' ORDER BY RANDOM() LIMIT ?';
  params.push(count);
  
  return database.getAllAsync<Question>(sql, ...params);
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Question>('SELECT * FROM questions WHERE id = ?', id);
}

export async function getAllTopics(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ topic: string }>(
    'SELECT DISTINCT topic FROM questions ORDER BY topic'
  );
  return rows.map(r => r.topic);
}

export async function getQuestionCountByTopic(): Promise<Record<string, number>> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ topic: string; count: number }>(
    'SELECT topic, COUNT(*) as count FROM questions GROUP BY topic'
  );
  const result: Record<string, number> = {};
  rows.forEach(r => { result[r.topic] = r.count; });
  return result;
}

// ==================== Course Catalog Seeding ====================

let courseSeedPromise: Promise<void> | null = null;

/**
 * Seeds the course hierarchy (courses, subjects, chapters, topics) from the
 * static catalog. Also backfills the question_hierarchy table.
 * Safe to call repeatedly — idempotent.
 */
export function ensureCoursesSeeded(): Promise<void> {
  if (!courseSeedPromise) {
    courseSeedPromise = seedCourseCatalog().catch(error => {
      courseSeedPromise = null;
      throw error;
    });
  }
  return courseSeedPromise;
}

async function seedCourseCatalog(): Promise<void> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM courses');

  if ((row?.count ?? 0) > 0) {
    await linkQuestionsToHierarchy();
    await refreshHierarchyCounts();
    return;
  }

  console.log('[DB] Seeding course catalog...');
  await database.withTransactionAsync(async () => {
    for (const course of COURSES) {
      await database.runAsync(
        'INSERT OR IGNORE INTO courses (id, name, code, description, icon, color, question_count) VALUES (?, ?, ?, ?, ?, ?, 0)',
        course.id, course.name, course.code, course.description, course.icon, course.color
      );
      for (let si = 0; si < course.subjects.length; si++) {
        const subject = course.subjects[si];
        await database.runAsync(
          'INSERT OR IGNORE INTO subjects (id, course_id, name, description, icon, color, question_count, order_index) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
          subject.id, course.id, subject.name, subject.description, subject.icon, subject.color, si
        );
        for (let ci = 0; ci < subject.chapters.length; ci++) {
          const chapter = subject.chapters[ci];
          await database.runAsync(
            'INSERT OR IGNORE INTO chapters (id, subject_id, name, description, question_count, order_index) VALUES (?, ?, ?, ?, 0, ?)',
            chapter.id, subject.id, chapter.name, chapter.description || null, ci
          );
          for (let ti = 0; ti < chapter.topics.length; ti++) {
            const topic = chapter.topics[ti];
            await database.runAsync(
              'INSERT OR IGNORE INTO topics_table (id, chapter_id, name, question_count, order_index) VALUES (?, ?, ?, 0, ?)',
              `${chapter.id}_${ti}`, chapter.id, topic.name, ti
            );
          }
        }
      }
    }
  });

  await linkQuestionsToHierarchy();
  await refreshHierarchyCounts();
  console.log('[DB] Course catalog seeded');
}

/**
 * Populates question_hierarchy for every question based on its `topic` field
 * using the static topic to chapter map. Idempotent.
 */
async function linkQuestionsToHierarchy(): Promise<void> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: string; topic: string }>('SELECT id, topic FROM questions');
  if (rows.length === 0) return;

  const inserts: { qid: string; course_id: string; subject_id: string; chapter_id: string; topic_id: string }[] = [];
  for (const row of rows) {
    const path = getTopicPath(row.topic);
    if (!path) continue;
    const topicId = `${path.chapterId}_0`;
    inserts.push({
      qid: row.id,
      course_id: path.courseId,
      subject_id: path.subjectId,
      chapter_id: path.chapterId,
      topic_id: topicId,
    });
  }

  if (inserts.length === 0) return;

  await database.withTransactionAsync(async () => {
    for (const ins of inserts) {
      await database.runAsync(
        `INSERT OR REPLACE INTO question_hierarchy (question_id, course_id, subject_id, chapter_id, topic_id)
         VALUES (?, ?, ?, ?, ?)`,
        ins.qid, ins.course_id, ins.subject_id, ins.chapter_id, ins.topic_id
      );
    }
  });
  console.log(`[DB] Linked ${inserts.length} questions to hierarchy`);
}

/**
 * Recalculates question_count on courses/subjects/chapters/topics from
 * the actual questions table. Idempotent.
 */
async function refreshHierarchyCounts(): Promise<void> {
  const database = await getDatabase();

  const chapterCounts = await database.getAllAsync<{ chapter_id: string; count: number }>(
    `SELECT qh.chapter_id, COUNT(*) as count FROM question_hierarchy qh GROUP BY qh.chapter_id`
  );
  for (const row of chapterCounts) {
    await database.runAsync('UPDATE chapters SET question_count = ? WHERE id = ?', row.count, row.chapter_id || '');
  }

  const topicCounts = await database.getAllAsync<{ topic_id: string; count: number }>(
    `SELECT qh.topic_id, COUNT(*) as count FROM question_hierarchy qh GROUP BY qh.topic_id`
  );
  for (const row of topicCounts) {
    await database.runAsync('UPDATE topics_table SET question_count = ? WHERE id = ?', row.count, row.topic_id || '');
  }

  const subjectCounts = await database.getAllAsync<{ subject_id: string; count: number }>(
    `SELECT qh.subject_id, COUNT(*) as count FROM question_hierarchy qh GROUP BY qh.subject_id`
  );
  for (const row of subjectCounts) {
    await database.runAsync('UPDATE subjects SET question_count = ? WHERE id = ?', row.count, row.subject_id || '');
  }

  const courseCounts = await database.getAllAsync<{ course_id: string; count: number }>(
    `SELECT qh.course_id, COUNT(*) as count FROM question_hierarchy qh GROUP BY qh.course_id`
  );
  for (const row of courseCounts) {
    await database.runAsync('UPDATE courses SET question_count = ? WHERE id = ?', row.count, row.course_id || '');
  }
}

// ==================== Active Course ====================

/**
 * Persists the user's active course on their profile row.
 * Upsert semantics: creates a minimal profile row if one does not exist yet,
 * so this never fails just because gamification hasn't started.
 */
export async function setActiveCourse(userId: string, courseId: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO user_profile (user_id, xp, streak_days, rank_tier, rank_sub, sound_enabled, theme, accent_color, daily_goal_minutes, active_course_id, created_at, updated_at)
     VALUES (?, 0, 0, 'Bronze', 'V', 1, 'system', 'indigo', 30, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET active_course_id = excluded.active_course_id, updated_at = excluded.updated_at`,
    userId, courseId, now, now
  );
}

/** Returns the persisted active course id, or null when not recorded. */
export async function getActiveCourse(userId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ active_course_id: string | null }>(
    'SELECT active_course_id FROM user_profile WHERE user_id = ?',
    userId
  );
  return row?.active_course_id ?? null;
}

// ==================== Course Enrollments ====================

export interface CourseEnrollment {
  user_id: string;
  course_id: string;
  enrolled_at: number;
  is_active: number;
}

/** Enroll user in a course (idempotent). */
export async function enrollInCourse(userId: string, courseId: string): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT OR REPLACE INTO course_enrollments (user_id, course_id, enrolled_at, is_active)
     VALUES (?, ?, ?, 1)`,
    userId, courseId, now
  );
  // Also set as active course
  await setActiveCourse(userId, courseId);
}

/** Get all enrolled courses for a user. */
export async function getEnrolledCourses(userId: string): Promise<CourseEnrollment[]> {
  const database = await getDatabase();
  return database.getAllAsync<CourseEnrollment>(
    'SELECT * FROM course_enrollments WHERE user_id = ? ORDER BY enrolled_at DESC',
    userId
  );
}

/** Get the user's active enrollment. */
export async function getActiveEnrollment(userId: string): Promise<CourseEnrollment | null> {
  const database = await getDatabase();
  return database.getFirstAsync<CourseEnrollment>(
    'SELECT * FROM course_enrollments WHERE user_id = ? AND is_active = 1 LIMIT 1',
    userId
  );
}

/** Set a course as the active enrollment (deactivates others). */
export async function setActiveEnrollment(userId: string, courseId: string): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE course_enrollments SET is_active = 0 WHERE user_id = ?',
      userId
    );
    await database.runAsync(
      `INSERT OR REPLACE INTO course_enrollments (user_id, course_id, enrolled_at, is_active)
       VALUES (?, ?, ?, 1)`,
      userId, courseId, Date.now()
    );
    await setActiveCourse(userId, courseId);
  });
}

// ==================== Hierarchy Progress ====================
// All statistics are computed from user_progress joined through
// question_hierarchy — never hardcoded or estimated on the UI side.

export interface SubjectStats {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  questionCount: number;
  chapterCount: number;
  attemptedCount: number;
  correctCount: number;
  completionPercent: number;
  accuracyPercent: number;
}

export interface ChapterStats {
  id: string;
  name: string;
  questionCount: number;
  attemptedCount: number;
  correctCount: number;
  completionPercent: number;
  accuracyPercent: number;
}

interface SubjectRowAgg {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  question_count: number;
  chapter_count: number;
  attempted: number;
  correct: number;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** All subjects of a course with real per-user attempt/accuracy stats. */
export async function getSubjectsWithProgress(
  userId: string,
  courseId?: string
): Promise<SubjectStats[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SubjectRowAgg>(
    `SELECT s.id, s.name, s.description, s.color, s.icon,
            COALESCE(sc.question_count, 0) AS question_count,
            COALESCE(ch.chapter_count, 0) AS chapter_count,
            COUNT(DISTINCT CASE WHEN up.id IS NOT NULL THEN qh.question_id END) AS attempted,
            COUNT(DISTINCT CASE WHEN up.is_correct = 1 THEN qh.question_id END) AS correct
       FROM subjects s
       LEFT JOIN (
         SELECT subject_id, COUNT(*) AS question_count FROM question_hierarchy GROUP BY subject_id
       ) sc ON sc.subject_id = s.id
       LEFT JOIN (
         SELECT subject_id, COUNT(DISTINCT id) AS chapter_count FROM chapters GROUP BY subject_id
       ) ch ON ch.subject_id = s.id
       LEFT JOIN question_hierarchy qh ON qh.subject_id = s.id
       LEFT JOIN user_progress up ON up.question_id = qh.question_id AND up.user_id = ?
      WHERE (? IS NULL OR s.course_id = ?)
      GROUP BY s.id, s.name, s.description, s.color, s.icon
      ORDER BY s.order_index`,
    userId, courseId ?? null, courseId ?? null
  );

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    questionCount: r.question_count,
    chapterCount: r.chapter_count,
    attemptedCount: r.attempted,
    correctCount: r.correct,
    completionPercent: pct(r.attempted, r.question_count),
    accuracyPercent: pct(r.correct, r.attempted),
  }));
}

/** Chapters of one subject with real per-user attempt/accuracy stats. */
export async function getChaptersWithProgress(
  userId: string,
  subjectId: string
): Promise<ChapterStats[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    question_count: number;
    attempted: number;
    correct: number;
  }>(
    `SELECT c.id, c.name,
            COUNT(DISTINCT qh.question_id) AS question_count,
            COUNT(DISTINCT CASE WHEN up.id IS NOT NULL THEN qh.question_id END) AS attempted,
            COUNT(DISTINCT CASE WHEN up.is_correct = 1 THEN qh.question_id END) AS correct
       FROM chapters c
       LEFT JOIN question_hierarchy qh ON qh.chapter_id = c.id
       LEFT JOIN user_progress up ON up.question_id = qh.question_id AND up.user_id = ?
      WHERE c.subject_id = ?
      GROUP BY c.id, c.name
      ORDER BY c.order_index`,
    userId, subjectId
  );

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    questionCount: r.question_count,
    attemptedCount: r.attempted,
    correctCount: r.correct,
    completionPercent: pct(r.attempted, r.question_count),
    accuracyPercent: pct(r.correct, r.attempted),
  }));
}

// ==================== Question Reports ====================

export const REPORT_REASONS = [
  'incorrect_question',
  'incorrect_answer',
  'poor_image_quality',
  'missing_information',
  'duplicate_question',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface QuestionReport {
  id: string;
  user_id: string;
  question_id: string;
  reason: ReportReason;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  created_at: number;
}

/**
 * Files a report. Idempotent per (user, question, reason): an identical open
 * report is not duplicated on double-taps or offline replays (rule 56).
 * @returns true when a new report row was created.
 */
export async function submitQuestionReport(input: {
  userId: string;
  questionId: string;
  reason: ReportReason;
  description?: string;
}): Promise<boolean> {
  if (!REPORT_REASONS.includes(input.reason)) {
    throw new Error(`Invalid report reason: ${input.reason}`);
  }
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM question_reports
      WHERE user_id = ? AND question_id = ? AND reason = ? AND status = 'pending'`,
    input.userId, input.questionId, input.reason
  );
  if (existing) return false;

  const id = `${input.userId}_${input.questionId}_${input.reason}`;
  await database.runAsync(
    `INSERT OR IGNORE INTO question_reports (id, user_id, question_id, reason, description)
     VALUES (?, ?, ?, ?, ?)`,
    id, input.userId, input.questionId, input.reason, input.description ?? null
  );
  return true;
}

/** All reports filed by a user, newest first. */
export async function getUserQuestionReports(userId: string): Promise<QuestionReport[]> {
  const database = await getDatabase();
  return database.getAllAsync<QuestionReport>(
    'SELECT * FROM question_reports WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
}

// ==================== Achievements ====================

export interface Achievement {
  id: string;
  user_id: string;
  type: string;
  name: string;
  description?: string;
  icon?: string;
  earned_at: number;
}

/**
 * Awards an achievement exactly once. Idempotent by (user, type):
 * repeated triggers are safe no-ops (rule 56).
 * @returns true when the badge was newly earned.
 */
export async function awardAchievement(input: {
  userId: string;
  type: string;
  name: string;
  description?: string;
  icon?: string;
}): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT OR IGNORE INTO achievements (id, user_id, type, name, description, icon)
     VALUES (?, ?, ?, ?, ?, ?)`,
    `${input.userId}_${input.type}`,
    input.userId,
    input.type,
    input.name,
    input.description ?? null,
    input.icon ?? null
  );
  return result.changes > 0;
}

export async function getAchievements(userId: string): Promise<Achievement[]> {
  const database = await getDatabase();
  return database.getAllAsync<Achievement>(
    'SELECT * FROM achievements WHERE user_id = ? ORDER BY earned_at DESC',
    userId
  );
}

// ==================== Question of the Day ====================
// Date-driven (rule 6): the daily question is derived from the calendar date
// and pinned in `daily_questions`, so it can never change on re-navigation,
// app restarts, or Home re-renders.

/** Deterministic 31-bit hash — stable across launches. */
function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface DailyQuestion {
  dateString: string;
  question: Question;
}

/**
 * Returns today's Question of the Day, allocating + persisting it once.
 * Uses date-based logic; safe to call repeatedly from any screen.
 */
export async function getQuestionOfTheDay(now: number = Date.now()): Promise<DailyQuestion | null> {
  const database = await getDatabase();
  const dateString = localDateString(now);

  // Already allocated for this date? Return the exact same question.
  const existing = await database.getFirstAsync<{ question_id: string }>(
    'SELECT question_id FROM daily_questions WHERE date_string = ?',
    dateString
  );
  if (existing) {
    const q = await database.getFirstAsync<Question>(
      'SELECT * FROM questions WHERE id = ?',
      existing.question_id
    );
    if (q) return { dateString, question: q };
    // Pinned row points at a deleted question — fall through to re-allocate.
  }

  const countRow = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM questions'
  );
  const total = countRow?.count ?? 0;
  if (total === 0) return null;

  const offset = hashSeed(dateString) % total;
  const picked = await database.getFirstAsync<Question>(
    'SELECT * FROM questions ORDER BY id LIMIT 1 OFFSET ?',
    offset
  );
  if (!picked) return null;

  await database.runAsync(
    `INSERT OR IGNORE INTO daily_questions (date_string, question_id) VALUES (?, ?)`,
    dateString, picked.id
  );

  // Someone else may have raced us to insert for this date; honor their row.
  if (picked.id !== existing?.question_id && existing) {
    const winner = await database.getFirstAsync<Question>(
      'SELECT * FROM questions WHERE id = ?', existing.question_id
    );
    if (winner) return { dateString, question: winner };
  }

  return { dateString, question: picked };
}

/** History of past daily questions the user can revisit. */
export async function getDailyQuestionHistory(limit = 30): Promise<
  { dateString: string; question: Question }[]
> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ date_string: string }>(
    `SELECT dq.date_string
       FROM daily_questions dq
      WHERE dq.date_string != ?
      ORDER BY dq.date_string DESC
      LIMIT ?`,
    localDateString(), limit
  );
  const out: { dateString: string; question: Question }[] = [];
  for (const row of rows) {
    const pin = await database.getFirstAsync<{ question_id: string }>(
      'SELECT question_id FROM daily_questions WHERE date_string = ?',
      row.date_string
    );
    if (!pin) continue;
    const q = await database.getFirstAsync<Question>(
      'SELECT * FROM questions WHERE id = ?',
      pin.question_id
    );
    if (q) out.push({ dateString: row.date_string, question: q });
  }
  return out;
}

// ==================== Exam History ====================

export interface ExamHistoryRecord {
  id?: string;
  user_id: string;
  exam_type: string;          // 'model' | 'subject' | 'custom' | 'past_paper' | ...
  exam_id?: string;           // catalog/creator id when applicable
  session_id?: string;        // exam_sessions.id for resume/review linking
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  time_spent_ms: number;
  percentage: number;
  pass_mark?: number;
  started_at?: number;
  completed_at?: number;
  details_json?: string;
}

/**
 * Persists a completed attempt. Idempotent per explicit id:
 * callers that pass session-scoped ids cannot double-submit.
 */
export async function saveExamHistory(rec: ExamHistoryRecord): Promise<string> {
  const database = await getDatabase();
  const id = rec.id ?? `${rec.user_id}_eh_${rec.session_id ?? Date.now()}`;
  await database.runAsync(
    `INSERT OR REPLACE INTO exam_history
       (id, user_id, exam_type, exam_id, session_id, score, correct, wrong, skipped,
        total, time_spent_ms, percentage, pass_mark, started_at, completed_at, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, rec.user_id, rec.exam_type, rec.exam_id ?? null, rec.session_id ?? null,
    rec.score, rec.correct, rec.wrong, rec.skipped, rec.total,
    rec.time_spent_ms, rec.percentage, rec.pass_mark ?? null,
    rec.started_at ?? null, rec.completed_at ?? Date.now(), rec.details_json ?? null
  );
  // Sync envelope (rule 56 / Phase 4 item D): enqueue the attempt for cloud upload
  // only AFTER the history row is durably persisted locally. No cloud calls here —
  // a future sync worker drains `sync_queue` via getPendingSync()/markSyncSuccess().
  await queueSync('exam_history', id, 'INSERT', { id, user_id: rec.user_id, session_id: rec.session_id });
  return id;
}

export async function getExamHistory(
  userId: string,
  opts?: { examType?: string; examId?: string; limit?: number }
): Promise<ExamHistoryRecord[]> {
  const database = await getDatabase();
  const clauses: string[] = ['user_id = ?'];
  const params: (string | number)[] = [userId];
  if (opts?.examType) { clauses.push('exam_type = ?'); params.push(opts.examType); }
  if (opts?.examId) { clauses.push('exam_id = ?'); params.push(opts.examId); }
  params.push(opts?.limit ?? 50);
  return database.getAllAsync<ExamHistoryRecord>(
    `SELECT * FROM exam_history WHERE ${clauses.join(' AND ')}
      ORDER BY completed_at DESC LIMIT ?`,
    ...params
  );
}





// ==================== App metadata (key/value) ====================
// Device-wide (not user-scoped) metadata. Used to persist the installed
// question-bank version hash so remote updates can be detected across launches.
const APP_META_TABLE = 'app_meta';

export async function getAppMeta(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    `SELECT value FROM ${APP_META_TABLE} WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

export async function setAppMeta(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO ${APP_META_TABLE} (key, value, updated_at)
     VALUES (?, ?, ?)`,
    key, value, Date.now()
  );
}

// ==================== Question bank re-seed ====================
// Replaces the questions table with a freshly-parsed bank (e.g. after a remote
// update was detected). User-owned tables (user_progress, sr_state, bookmarks,
// weak_points, exam history) reference question_id but are NOT deleted or
// rewritten, so a bank update never destroys a user's study history.
//
// IMPORTANT: those child tables declare `FOREIGN KEY (question_id) REFERENCES
// questions(id)` and the connection runs with `PRAGMA foreign_keys = ON`, so a
// plain DELETE would violate the constraint on any device that has progress.
// We therefore disable FK enforcement for the duration of the atomic swap and
// re-enable it right after (PRAGMA foreign_keys cannot change inside a
// transaction, so it wraps the transaction).
export async function replaceQuestionBank(questions: Question[]): Promise<number> {
  const database = await getDatabase();

  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM question_hierarchy;');
      await database.runAsync('DELETE FROM questions;');
      // NOTE: insert rows directly here instead of calling bulkInsertQuestions,
      // which opens its own transaction (nested transactions are invalid).
      for (const q of questions) {
        await insertQuestionRow(database, q);
      }
    });
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }

  // Hierarchy link + count refresh must run AFTER the transaction above so it
  // sees the new rows. linkQuestionsToHierarchy / refreshHierarchyCounts are
  // private in this module, but they are idempotent and safe to call here.
  await linkQuestionsToHierarchy();
  await refreshHierarchyCounts();

  console.log(`[DB] Replaced question bank with ${questions.length} questions`);
  return questions.length;
}

// ==================== Question bank seeding ====================
// The full question bank ships inside the app bundle (see
// src/data/questions), so on first launch we copy it into SQLite and the app
// works fully offline from then on.

let seedPromise: Promise<number> | null = null;

/**
 * Seeds the local question database from the bundled bank if it is empty.
 * Safe to call repeatedly — the work happens at most once per app session,
 * and repeated launches are no-ops because the table already has rows.
 *
 * @returns the number of questions available in the database afterwards.
 */
export function ensureQuestionBankSeeded(): Promise<number> {
  if (!seedPromise) {
    seedPromise = seedQuestionBank().catch(error => {
      // Reset so a later call can retry (e.g. after a transient failure).
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seedQuestionBank(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM questions'
  );

  const existing = row?.count ?? 0;
  if (existing > 0) return existing;

  console.log('[DB] Seeding question bank from bundle...');
  const questions = await getBundledQuestions();

  if (questions.length === 0) {
    console.warn('[DB] Bundled question bank was empty');
    return 0;
  }

  await bulkInsertQuestions(questions);
  console.log(`[DB] Seeded ${questions.length} questions`);
  return questions.length;
}

// User Progress operations
const PROGRESS_TABLE = 'user_progress';
const SR_TABLE = 'sr_state';
const BOOKMARK_TABLE = 'bookmarks';
const WEAK_TABLE = 'weak_points';
const PROFILE_TABLE = 'user_profile';
const EXAM_TABLE = 'exam_sessions';
const BATTLE_TABLE = 'battle_sessions';
const SYNC_TABLE = 'sync_queue';

function makeProgressId(userId: string, questionId: string): string {
  return `${userId}_${questionId}`;
}

export async function upsertProgress(progress: Omit<UserProgress, 'id' | 'synced_at'>): Promise<void> {
  const database = await getDatabase();
  const id = makeProgressId(progress.user_id, progress.question_id);
  const now = Date.now();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO ${PROGRESS_TABLE} 
     (id, user_id, question_id, selected_answer, is_correct, attempt_count, time_spent_ms, last_attempted_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id, progress.user_id, progress.question_id, progress.selected_answer ?? null, progress.is_correct ?? null,
    progress.attempt_count, progress.time_spent_ms, now
  );
  
  // Queue for sync
  await queueSync(PROGRESS_TABLE, id, 'UPDATE', progress);
}

export async function getProgress(userId: string, questionId: string): Promise<UserProgress | null> {
  const database = await getDatabase();
  const id = makeProgressId(userId, questionId);
  return database.getFirstAsync<UserProgress>('SELECT * FROM user_progress WHERE id = ?', id);
}

export async function getAllProgress(userId: string): Promise<UserProgress[]> {
  const database = await getDatabase();
  return database.getAllAsync<UserProgress>('SELECT * FROM user_progress WHERE user_id = ?', userId);
}

// SR State operations
function makeSRId(userId: string, questionId: string): string {
  return `${userId}_${questionId}`;
}

export async function upsertSRState(sr: Omit<SRState, 'id' | 'synced_at'>): Promise<void> {
  const database = await getDatabase();
  const id = makeSRId(sr.user_id, sr.question_id);
  
  await database.runAsync(
    `INSERT OR REPLACE INTO ${SR_TABLE}
     (id, user_id, question_id, interval_days, ease_factor, attempts, due_at,
      total_attempts, total_correct, total_wrong, last_result, last_answered_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id, sr.user_id, sr.question_id, sr.interval_days, sr.ease_factor, sr.attempts,
    sr.due_at, sr.total_attempts, sr.total_correct, sr.total_wrong,
    sr.last_result ?? null, sr.last_answered_at
  );
  
  await queueSync(SR_TABLE, id, 'UPDATE', sr);
}

export async function getSRState(userId: string, questionId: string): Promise<SRState | null> {
  const database = await getDatabase();
  const id = makeSRId(userId, questionId);
  return database.getFirstAsync<SRState>('SELECT * FROM sr_state WHERE id = ?', id);
}

export async function getDueQuestions(userId: string, limit = 50): Promise<SRState[]> {
  const database = await getDatabase();
  const now = Date.now();
  return database.getAllAsync<SRState>(
    'SELECT * FROM sr_state WHERE user_id = ? AND due_at <= ? ORDER BY due_at LIMIT ?',
    userId, now, limit
  );
}

export async function getSRStats(userId: string): Promise<{ due: number; learning: number; review: number; mastered: number }> {
  const database = await getDatabase();
  const now = Date.now();
  
  const rows = await database.getAllAsync<{ 
    due: number; learning: number; review: number; mastered: number 
  }>(`
    SELECT 
      SUM(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) as due,
      SUM(CASE WHEN due_at > ? AND attempts = 0 THEN 1 ELSE 0 END) as learning,
      SUM(CASE WHEN due_at > ? AND attempts > 0 AND attempts < 3 THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN due_at > ? AND attempts >= 3 THEN 1 ELSE 0 END) as mastered
    FROM sr_state WHERE user_id = ?
  `, now, now, now, now, userId);
  
  return rows[0] || { due: 0, learning: 0, review: 0, mastered: 0 };
}

// Bookmark operations
function makeBookmarkId(userId: string, questionId: string): string {
  return `${userId}_${questionId}`;
}

export async function toggleBookmark(userId: string, questionId: string, tags: string[] = [], note: string = ''): Promise<Bookmark | null> {
  const database = await getDatabase();
  const id = makeBookmarkId(userId, questionId);
  const existing = await database.getFirstAsync<Bookmark>('SELECT * FROM bookmarks WHERE id = ?', id);
  
  if (existing) {
    await database.runAsync('DELETE FROM bookmarks WHERE id = ?', id);
    await queueSync(BOOKMARK_TABLE, id, 'DELETE', { id });
    return null;
  } else {
    const now = Date.now();
    const bookmark: Bookmark = {
      id, user_id: userId, question_id: questionId,
      tags_json: JSON.stringify(tags), note, created_at: now, synced_at: undefined
    };
    await database.runAsync(
      'INSERT INTO bookmarks (id, user_id, question_id, tags_json, note, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      id, userId, questionId, JSON.stringify(tags), note, now
    );
    await queueSync(BOOKMARK_TABLE, id, 'INSERT', bookmark as unknown as Record<string, unknown>);
    return bookmark;
  }
}

export async function getBookmark(userId: string, questionId: string): Promise<Bookmark | null> {
  const database = await getDatabase();
  const id = makeBookmarkId(userId, questionId);
  return database.getFirstAsync<Bookmark>('SELECT * FROM bookmarks WHERE id = ?', id);
}

export async function getAllBookmarks(userId: string): Promise<Bookmark[]> {
  const database = await getDatabase();
  return database.getAllAsync<Bookmark>('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC', userId);
}

export async function updateBookmarkTags(userId: string, questionId: string, tags: string[]): Promise<void> {
  const database = await getDatabase();
  const id = makeBookmarkId(userId, questionId);
  await database.runAsync(
    'UPDATE bookmarks SET tags_json = ?, synced_at = NULL WHERE id = ?',
    JSON.stringify(tags), id
  );
  await queueSync(BOOKMARK_TABLE, id, 'UPDATE', { id, tags_json: JSON.stringify(tags) });
}

// Weak points
function makeWeakId(userId: string, questionId: string): string {
  return `${userId}_${questionId}`;
}

export async function toggleWeakPoint(userId: string, questionId: string): Promise<boolean> {
  const database = await getDatabase();
  const id = makeWeakId(userId, questionId);
  const existing = await database.getFirstAsync<WeakPoint>('SELECT * FROM weak_points WHERE id = ?', id);
  
  if (existing) {
    await database.runAsync('DELETE FROM weak_points WHERE id = ?', id);
    await queueSync(WEAK_TABLE, id, 'DELETE', { id });
    return false;
  } else {
    const now = Date.now();
    await database.runAsync(
      'INSERT INTO weak_points (id, user_id, question_id, created_at, synced_at) VALUES (?, ?, ?, ?, NULL)',
      id, userId, questionId, now
    );
    await queueSync(WEAK_TABLE, id, 'INSERT', { id, user_id: userId, question_id: questionId, created_at: now });
    return true;
  }
}

export async function getWeakPoints(userId: string): Promise<WeakPoint[]> {
  const database = await getDatabase();
  return database.getAllAsync<WeakPoint>('SELECT * FROM weak_points WHERE user_id = ?', userId);
}

export async function isWeakPoint(userId: string, questionId: string): Promise<boolean> {
  const database = await getDatabase();
  const id = makeWeakId(userId, questionId);
  const row = await database.getFirstAsync<{ id: string }>('SELECT id FROM weak_points WHERE id = ?', id);
  return !!row;
}

// User Profile
export async function upsertUserProfile(profile: Partial<UserProfile> & { user_id: string }): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  
  const existing = await database.getFirstAsync<UserProfile>('SELECT * FROM user_profile WHERE user_id = ?', profile.user_id);
  
  if (existing) {
    const updates: string[] = [];
    const values: (string | number)[] = [];
    
    Object.entries(profile).forEach(([key, value]) => {
      if (key !== 'user_id' && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(profile.user_id);
      
      await database.runAsync(
        `UPDATE user_profile SET ${updates.join(', ')} WHERE user_id = ?`,
        ...values
      );
    }
  } else {
    await database.runAsync(
      `INSERT INTO user_profile (user_id, xp, streak_days, rank_tier, rank_sub, sound_enabled, theme, accent_color, daily_goal_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      profile.user_id,
      profile.xp || 0,
      profile.streak_days || 0,
      profile.rank_tier || 'Bronze',
      profile.rank_sub || 'V',
      profile.sound_enabled ?? 1,
      profile.theme || 'system',
      profile.accent_color || 'indigo',
      profile.daily_goal_minutes || 30,
      now, now
    );
  }
  
  await queueSync(PROFILE_TABLE, profile.user_id, 'UPDATE', profile);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const database = await getDatabase();
  return database.getFirstAsync<UserProfile>('SELECT * FROM user_profile WHERE user_id = ?', userId);
}
// ==================== Answer rewards & aggregate stats ====================

/**
 * Awards XP for an answer, rolls the day-streak forward and re-derives the
 * rank from the new XP total. Creates the profile row with defaults if the
 * user has none yet (prevents "undefined undefined" on the dashboard).
 */
export async function recordReward(
  userId: string,
  isCorrect: boolean,
  xpGainedOverride?: number
): Promise<{
  xpGained: number;
  totalXp: number;
  streakDays: number;
  rankTier: string;
  rankSub: string;
}> {
  const database = await getDatabase();
  const now = Date.now();

  const existing = await getUserProfile(userId);
  const xpGained = xpGainedOverride ?? (isCorrect ? XP_PER_CORRECT : XP_PER_WRONG);
  const totalXp = Math.max(0, (existing?.xp ?? 0) + xpGained);
  const streakDays = nextStreakDays(existing?.last_active_date, existing?.streak_days ?? 0, now);
  const { tier, sub } = rankFromXp(totalXp);

  await database.runAsync(
    `INSERT INTO user_profile
       (user_id, xp, streak_days, last_active_date, rank_tier, rank_sub, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       xp = excluded.xp,
       streak_days = excluded.streak_days,
       last_active_date = excluded.last_active_date,
       rank_tier = excluded.rank_tier,
       rank_sub = excluded.rank_sub,
       updated_at = excluded.updated_at`,
    userId, totalXp, streakDays, localDateString(now), tier, sub, now, now
  );

  return { xpGained, totalXp, streakDays, rankTier: tier, rankSub: sub };
}

/** Aggregate attempt statistics for a user (dashboard "Attempted"/"Accuracy"). */
export async function getAttemptStats(
  userId: string
): Promise<{ attempted: number; correct: number; wrong: number }> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ attempted: number; correct: number }>(
    `SELECT COUNT(*) as attempted,
            COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) as correct
     FROM ${PROGRESS_TABLE} WHERE user_id = ?`,
    userId
  );
  const attempted = row?.attempted ?? 0;
  const correct = row?.correct ?? 0;
  return { attempted, correct, wrong: Math.max(0, attempted - correct) };
}

/**
 * Attempts made today (local calendar), for the Home daily-goal ring.
 * Reads the same central progress table as getAttemptStats so no screen ever
 * keeps its own separate tally (master-prompt rule 31).
 */
export async function getAttemptsToday(userId: string): Promise<{ attempted: number; correct: number }> {
  const database = await getDatabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const row = await database.getFirstAsync<{ attempted: number; correct: number }>(
    `SELECT COUNT(*) as attempted,
            COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) as correct
     FROM ${PROGRESS_TABLE}
     WHERE user_id = ? AND last_attempted_at >= ?`,
    userId, startOfDay.getTime()
  );
  return { attempted: row?.attempted ?? 0, correct: row?.correct ?? 0 };
}

export interface LastStudiedTopic {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  questionCount: number;
  attemptedCount: number;
  lastAttemptedAt: number;
}

/**
 * Most recently attempted topic, for the Home "Continue Learning" card.
 * Reads only the central progress + hierarchy tables (rule 31) — no
 * screen-local bookkeeping. Returns null when the user has no attempts yet.
 */
export async function getLastStudiedTopic(userId: string): Promise<LastStudiedTopic | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    topic_id: string;
    topic_name: string | null;
    chapter_id: string | null;
    chapter_name: string | null;
    subject_id: string | null;
    subject_name: string | null;
    question_count: number;
    attempted_count: number;
    last_attempted_at: number;
  }>(
    `WITH last_q AS (
       SELECT question_id, MAX(last_attempted_at) AS last_attempted_at
         FROM user_progress WHERE user_id = ? GROUP BY question_id
     ), latest AS (
       SELECT question_id, last_attempted_at FROM last_q
        ORDER BY last_attempted_at DESC LIMIT 1
     )
     SELECT qh.topic_id,
            tp.name AS topic_name,
            qh.chapter_id, ch.name AS chapter_name,
            qh.subject_id, s.name AS subject_name,
            (SELECT COUNT(*) FROM question_hierarchy qh2
              WHERE qh2.topic_id = qh.topic_id) AS question_count,
            (SELECT COUNT(*) FROM user_progress up2
              JOIN question_hierarchy qh3 ON qh3.question_id = up2.question_id
              WHERE up2.user_id = ? AND qh3.topic_id = qh.topic_id) AS attempted_count,
            latest.last_attempted_at
       FROM latest
       JOIN question_hierarchy qh ON qh.question_id = latest.question_id
       LEFT JOIN topics_table tp ON tp.id = qh.topic_id
       LEFT JOIN chapters ch ON ch.id = qh.chapter_id
       LEFT JOIN subjects s ON s.id = qh.subject_id`,
    userId, userId
  );

  if (!row?.topic_id) return null;
  return {
    topicId: row.topic_id,
    topicName: row.topic_name ?? 'Practice',
    chapterId: row.chapter_id ?? '',
    chapterName: row.chapter_name ?? '',
    subjectId: row.subject_id ?? '',
    subjectName: row.subject_name ?? '',
    questionCount: row.question_count ?? 0,
    attemptedCount: row.attempted_count ?? 0,
    lastAttemptedAt: row.last_attempted_at,
  };
}

// ==================== SR stage / bookmark / flag question lists ====================
// ==================== SR stage / bookmark / flag question lists ====================

export type SRStageFilter = 'due' | 'learning' | 'review' | 'mastered';

/**
 * Returns full question rows whose SR state falls into the given stage.
 * The predicates intentionally mirror getSRStats() so card counts and list
 * contents can never disagree.
 */
export async function getQuestionsByStage(
  userId: string,
  stage: SRStageFilter,
  limit = 50
): Promise<Question[]> {
  const database = await getDatabase();
  const now = Date.now();

  let predicate = '';
  const params: (string | number)[] = [userId];

  switch (stage) {
    case 'due':
      predicate = 'AND s.due_at <= ?';
      params.push(now);
      break;
    case 'learning': // seen at least once recently, still early in the ladder
      predicate = 'AND s.due_at > ? AND s.attempts BETWEEN 1 AND 2';
      params.push(now);
      break;
    case 'review': // progressing through intervals, not yet mastered
      predicate = 'AND s.due_at > ? AND s.attempts >= 3 AND s.interval_days < 30';
      params.push(now);
      break;
    case 'mastered':
      predicate = 'AND s.due_at > ? AND s.attempts >= 3 AND s.interval_days >= 30';
      params.push(now);
      break;
  }

  return database.getAllAsync<Question>(
    `SELECT q.* FROM questions q
     INNER JOIN sr_state s ON s.question_id = q.id
     WHERE s.user_id = ? ${predicate}
     ORDER BY s.due_at ASC
     LIMIT ?`,
    ...params, limit
  );
}

/** Bookmarked questions joined with their full question rows. */
export async function getBookmarkedQuestions(userId: string, limit = 100): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    `SELECT q.* FROM bookmarks b
     INNER JOIN questions q ON q.id = b.question_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC
     LIMIT ?`,
    userId, limit
  );
}

/** IDs of a user's bookmarked questions (for building lookup Sets). */
export async function getBookmarkQuestionIds(userId: string): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ question_id: string }>(
    `SELECT question_id FROM bookmarks WHERE user_id = ?`,
    userId
  );
  return rows.map(r => r.question_id);
}

/** IDs of a user's flagged ("weak point") questions. */
export async function getFlaggedQuestionIds(userId: string): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ question_id: string }>(
    `SELECT question_id FROM weak_points WHERE user_id = ?`,
    userId
  );
  return rows.map(r => r.question_id);
}

/** Flagged ("weak point") questions joined with their full question rows. */
export async function getFlaggedQuestions(userId: string, limit = 50): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    `SELECT q.* FROM weak_points w
     INNER JOIN questions q ON q.id = w.question_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC
     LIMIT ?`,
    userId, limit
  );
}

/**
 * Mistake pool — questions whose LATEST attempt was wrong.
 *
 * Because upsertProgress() overwrites is_correct on every attempt, this query
 * is self-healing: a question leaves the pool as soon as the user answers it
 * correctly again (master-prompt rule 18), without any extra bookkeeping.
 * Ordered most-recently-wrong first so "recently incorrect" surfaces on top.
 */
export async function getWrongQuestions(userId: string, limit = 200): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    `SELECT q.* FROM user_progress p
     INNER JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ? AND p.is_correct = 0
     ORDER BY p.last_attempted_at DESC
     LIMIT ?`,
    userId, limit
  );
}

/**
 * All questions of a subject through the seeded hierarchy table — used for
 * "practice whole subject" sessions where a chapter has not been chosen yet.
 */
export async function getQuestionsBySubject(
  subjectId: string,
  limit = 500,
  offset = 0
): Promise<Question[]> {
  const database = await getDatabase();
  return database.getAllAsync<Question>(
    `SELECT q.* FROM questions q
     INNER JOIN question_hierarchy qh ON qh.question_id = q.id
     WHERE qh.subject_id = ?
     ORDER BY q.topic, q.id
     LIMIT ? OFFSET ?`,
    subjectId, limit, offset
  );
}

/**
 * Explicit question set (mistakes drill-down, bookmarks review, single
 * question deep-link). Preserves caller-supplied order so groups open in a
 * deterministic sequence. Unknown ids are skipped silently.
 */
export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  const database = await getDatabase();
  const rows = await database.getAllAsync<Question & { _ord: number }>(
    `WITH wanted(order_num, id) AS (
       VALUES ${ids.map((_, i) => `(${i}, ?)`).join(',')}
     )
     SELECT q.*, w.order_num AS _ord
       FROM questions q
       INNER JOIN wanted w ON w.id = q.id
      ORDER BY w.order_num`,
    ...ids
  );
  return rows;
}

// ---- Custom Exams (Phase 3) -------------------------------------------------
import {
  CustomExam, CustomExamSpec, Executor,
  upsertCustomExam as upsertImpl,
  getCustomExamsByUser as listImpl,
  deleteCustomExam as deleteImpl,
  recordCustomExamResult as recordResultImpl,
} from './customExamStore';

function asExecutor(database: SQLite.SQLiteDatabase): Executor {
  return {
    runAsync: (sql, ...params) => database.runAsync(sql, ...(params as never[])),
    getFirstAsync: <T,>(sql: string, ...params: unknown[]) =>
      database.getFirstAsync<T>(sql, ...(params as never[])) as Promise<T | null>,
    getAllAsync: <T,>(sql: string, ...params: unknown[]) =>
      database.getAllAsync<T>(sql, ...(params as never[])),
  };
}

export async function upsertCustomExam(userId: string, spec: Partial<CustomExamSpec>): Promise<CustomExam> {
  const database = await getDatabase();
  return upsertImpl(asExecutor(database), userId, spec);
}

export async function getCustomExamsByUser(userId: string): Promise<CustomExam[]> {
  const database = await getDatabase();
  return listImpl(asExecutor(database), userId);
}

export async function deleteCustomExam(userId: string, id: string): Promise<void> {
  const database = await getDatabase();
  return deleteImpl(asExecutor(database), userId, id);
}

export async function recordCustomExamResult(
  userId: string, id: string, percent: number
): Promise<void> {
  const database = await getDatabase();
  return recordResultImpl(asExecutor(database), userId, id, percent);
}

// Exam Sessions
export async function createExamSession(session: Omit<ExamSession, 'id' | 'synced_at'>): Promise<string> {
  const database = await getDatabase();
  const id = `exam_${session.user_id}_${Date.now()}`;
  
  await database.runAsync(
    `INSERT INTO ${EXAM_TABLE} (id, user_id, topic, question_count, time_limit_seconds, questions_json, answers_json, started_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id, session.user_id, session.topic || null, session.question_count, session.time_limit_seconds,
    session.questions_json, session.answers_json, session.started_at
  );
  
  await queueSync(EXAM_TABLE, id, 'INSERT', session);
  return id;
}

export async function updateExamSession(id: string, updates: Partial<ExamSession>): Promise<void> {
  const database = await getDatabase();
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  
  await database.runAsync(`UPDATE ${EXAM_TABLE} SET ${setClause} WHERE id = ?`, ...values);
  await queueSync(EXAM_TABLE, id, 'UPDATE', updates);
}

export async function getExamSession(id: string): Promise<ExamSession | null> {
  const database = await getDatabase();
  return database.getFirstAsync<ExamSession>('SELECT * FROM exam_sessions WHERE id = ?', id);
}

/** Newest not-yet-submitted session — powers "continue exam" resume (rule 24). */
export async function getLatestActiveExamSession(userId: string): Promise<ExamSession | null> {
  const database = await getDatabase();
  return database.getFirstAsync<ExamSession>(
    `SELECT * FROM exam_sessions
      WHERE user_id = ? AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    userId
  );
}

/** Single stored attempt by its exam_history id — used by the Result screen. */
export async function getExamHistoryEntry(id: string): Promise<ExamHistoryRecord | null> {
  const database = await getDatabase();
  return database.getFirstAsync<ExamHistoryRecord>(
    'SELECT * FROM exam_history WHERE id = ?',
    id
  );
}

/** Latest unfinished session for the user — powers exam resume (rule 24). */
export async function getActiveExamSession(userId: string): Promise<ExamSession | null> {
  const database = await getDatabase();
  return database.getFirstAsync<ExamSession>(
    `SELECT * FROM exam_sessions
      WHERE user_id = ? AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    userId
  );
}

// Battle Sessions
export async function upsertBattleSession(session: Omit<BattleSession, 'id' | 'synced_at'> & { id: string }): Promise<void> {
  const database = await getDatabase();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO ${BATTLE_TABLE}
     (id, user_id, room_id, opponent_id, opponent_name, settings_json, questions_json,
      current_question_index, my_score, opp_score, my_answers_json, opp_answers_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id, session.user_id, session.room_id ?? null, session.opponent_id ?? null, session.opponent_name ?? null,
    session.settings_json, session.questions_json, session.current_question_index,
    session.my_score, session.opp_score, session.my_answers_json, session.opp_answers_json,
    session.status, session.created_at, Date.now()
  );
  
  await queueSync(BATTLE_TABLE, session.id, 'UPDATE', session);
}

export async function getBattleSession(id: string): Promise<BattleSession | null> {
  const database = await getDatabase();
  return database.getFirstAsync<BattleSession>('SELECT * FROM battle_sessions WHERE id = ?', id);
}

// Cloud restore (Phase 7): pull-side writer. Mirrors the push upserts but
// stamps synced_at so restored rows are never re-enqueued by queueSync —
// otherwise a restore would echo every row back into the outbox.
const RESTORE_COLUMNS: Record<string, readonly string[]> = {
  user_progress: ['id', 'user_id', 'question_id', 'selected_answer', 'is_correct',
    'attempt_count', 'time_spent_ms', 'last_attempted_at'],
  sr_state: ['id', 'user_id', 'question_id', 'interval_days', 'ease_factor', 'attempts',
    'due_at', 'total_attempts', 'total_correct', 'total_wrong', 'last_result', 'last_answered_at'],
  bookmarks: ['id', 'user_id', 'question_id', 'tags_json', 'note', 'created_at'],
  weak_points: ['id', 'user_id', 'question_id', 'created_at'],
  user_profile: ['user_id', 'xp', 'streak_days', 'rank_tier', 'rank_sub', 'sound_enabled',
    'theme', 'accent_color', 'daily_goal_minutes', 'created_at', 'updated_at'],
  exam_history: ['id', 'user_id', 'exam_type', 'exam_id', 'session_id', 'score', 'correct',
    'wrong', 'skipped', 'total', 'time_spent_ms', 'percentage', 'pass_mark', 'started_at',
    'completed_at', 'details_json'],
};

/**
 * Writes one cloud-sourced row into SQLite WITHOUT queueing a sync envelope.
 * Only whitelisted columns are accepted (keys come from Firestore docs, so
 * this is also injection-safe); `synced_at` is stamped with the local time so
 * the restored row is invisible to getPendingSync().
 */
export async function restoreRow(
  table: keyof typeof RESTORE_COLUMNS,
  row: Record<string, unknown>
): Promise<void> {
  const database = await getDatabase();
  const columns = RESTORE_COLUMNS[table];
  const cols: string[] = [];
  const values: (string | number | null)[] = [];
  for (const col of columns) {
    const v = row[col];
    if (v !== undefined) {
      cols.push(col);
      values.push(v === null || v === undefined ? null : (v as string | number));
    }
  }
  if (table !== 'user_profile' && !cols.includes('id')) {
    throw new Error(`[DB] restoreRow(${table}): row is missing the id column`);
  }
  cols.push('synced_at');
  values.push(Date.now());
  const placeholders = cols.map(() => '?').join(', ');
  await database.runAsync(
    `INSERT OR REPLACE INTO ${String(table)} (${cols.join(', ')}) VALUES (${placeholders})`,
    ...values
  );
}

// Sync Queue
async function queueSync(
  tableName: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO ${SYNC_TABLE} (table_name, record_id, operation, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    tableName, recordId, operation, JSON.stringify(payload), Date.now()
  );
}

export async function getPendingSync(limit = 100): Promise<SyncQueueItem[]> {
  const database = await getDatabase();
  return database.getAllAsync<SyncQueueItem>(
    `SELECT * FROM ${SYNC_TABLE} 
     WHERE retry_count < 3 
     ORDER BY created_at 
     LIMIT ?`,
    limit
  );
}

export async function markSyncSuccess(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
}

export async function markSyncFailure(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempt_at = ? WHERE id = ?',
    Date.now(), id
  );
}

// Utility
export async function clearAllData(): Promise<void> {
  const database = await getDatabase();
  const tables = [PROGRESS_TABLE, SR_TABLE, BOOKMARK_TABLE, WEAK_TABLE, PROFILE_TABLE, EXAM_TABLE, BATTLE_TABLE, SYNC_TABLE];
  await database.withTransactionAsync(async () => {
    for (const table of tables) {
      await database.runAsync(`DELETE FROM ${table}`);
    }
  });
}

export async function getDatabaseStats(): Promise<Record<string, number>> {
  const database = await getDatabase();
  const tables = ['questions', PROGRESS_TABLE, SR_TABLE, BOOKMARK_TABLE, WEAK_TABLE, PROFILE_TABLE, EXAM_TABLE, BATTLE_TABLE, SYNC_TABLE];
  const stats: Record<string, number> = {};
  
  for (const table of tables) {
    const row = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
    stats[table] = row?.count || 0;
  }
  
  return stats;
}