/**
 * Database Migration System
 * Versioned SQL migrations for expo-sqlite
 */

export const MIGRATIONS = {
  '001_init': `
-- Questions table (immutable, synced from JSON)
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  source_file TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

-- User progress (synced to Firestore)
CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_answer TEXT,
  is_correct INTEGER,
  attempt_count INTEGER DEFAULT 0,
  time_spent_ms INTEGER DEFAULT 0,
  last_attempted_at INTEGER,
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_sync ON user_progress(synced_at) WHERE synced_at IS NULL;

-- Spaced Repetition state (SM-2)
CREATE TABLE IF NOT EXISTS sr_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  interval_days INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  attempts INTEGER DEFAULT 0,
  due_at INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_result TEXT,
  last_answered_at INTEGER,
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX IF NOT EXISTS idx_sr_user_due ON sr_state(user_id, due_at);

-- Bookmarks & Tags
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  tags_json TEXT DEFAULT '[]',
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Weak points
CREATE TABLE IF NOT EXISTS weak_points (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Gamification
CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date TEXT,
  rank_tier TEXT DEFAULT 'Bronze',
  rank_sub TEXT DEFAULT 'V',
  sound_enabled INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'system',
  accent_color TEXT DEFAULT 'indigo',
  exam_target_date INTEGER,
  daily_goal_minutes INTEGER DEFAULT 30,
  notification_token TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- Exam sessions
CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT,
  question_count INTEGER,
  time_limit_seconds INTEGER,
  questions_json TEXT NOT NULL,
  answers_json TEXT DEFAULT '{}',
  started_at INTEGER,
  submitted_at INTEGER,
  score INTEGER,
  synced_at INTEGER
);

-- Battle state (local backup for Realtime DB)
CREATE TABLE IF NOT EXISTS battle_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  room_id TEXT,
  opponent_id TEXT,
  opponent_name TEXT,
  settings_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  current_question_index INTEGER DEFAULT 0,
  my_score INTEGER DEFAULT 0,
  opp_score INTEGER DEFAULT 0,
  my_answers_json TEXT DEFAULT '[]',
  opp_answers_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'waiting',
  created_at INTEGER,
  updated_at INTEGER
);

-- Sync queue (outbox pattern)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  last_attempt_at INTEGER
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
`,

  '002_add_db_version': `
-- Add db_version to user_profile for question bank version tracking
ALTER TABLE user_profile ADD COLUMN db_version TEXT;
`,

  '003_add_question_difficulty': `
-- Add difficulty, marks, negative_marks, language columns to questions
ALTER TABLE questions ADD COLUMN difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE questions ADD COLUMN marks INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN negative_marks INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN language TEXT DEFAULT 'english' CHECK(language IN ('english', 'nepali'));
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
  `,

  '004_courses_subjects_chapters': `
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  question_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  question_count INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON subjects(course_id);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  question_count INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);

CREATE TABLE IF NOT EXISTS topics_table (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON topics_table(chapter_id);
`,

  '005_reports_daily_achievements': `
CREATE TABLE IF NOT EXISTS course_enrollments (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enrolled_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  is_active INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS question_hierarchy (
  question_id TEXT PRIMARY KEY,
  course_id TEXT,
  subject_id TEXT,
  chapter_id TEXT,
  topic_id TEXT,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (topic_id) REFERENCES topics_table(id)
);
CREATE INDEX idx_qh_subject ON question_hierarchy(subject_id);
CREATE INDEX idx_qh_chapter ON question_hierarchy(chapter_id);
CREATE INDEX idx_qh_topic ON question_hierarchy(topic_id);

CREATE TABLE IF NOT EXISTS question_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  reviewed_at INTEGER,
  admin_notes TEXT,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX idx_reports_user ON question_reports(user_id);
CREATE INDEX idx_reports_status ON question_reports(status);

CREATE TABLE IF NOT EXISTS daily_questions (
  date_string TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  earned_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_achievements_type ON achievements(user_id, type);

CREATE TABLE IF NOT EXISTS exam_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  exam_id TEXT,
  session_id TEXT,
  score REAL,
  correct INTEGER DEFAULT 0,
  wrong INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  time_spent_ms INTEGER DEFAULT 0,
  percentage REAL,
  pass_mark REAL,
  started_at INTEGER,
  completed_at INTEGER,
  details_json TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_exam_history_user ON exam_history(user_id);
CREATE INDEX idx_exam_history_type ON exam_history(user_id, exam_type);

ALTER TABLE user_profile ADD COLUMN active_course_id TEXT DEFAULT 'ce_7th';
`,
  '006_custom_exams': `
CREATE TABLE IF NOT EXISTS custom_exams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER NOT NULL,
  marks_per_question REAL DEFAULT 1,
  negative_marks REAL DEFAULT 0,
  pass_percent REAL DEFAULT 40,
  subject_ids_json TEXT NOT NULL,
  chapter_ids_json TEXT NOT NULL DEFAULT '[]',
  question_count INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_percent REAL NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  synced_at TEXT
);
CREATE INDEX idx_custom_exams_user ON custom_exams(user_id);
`,

  '007_study_materials_videos': `
-- Study materials: theory notes, formula sheets, books, pdfs, past papers
CREATE TABLE IF NOT EXISTS study_materials (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  subject_id TEXT,
  chapter_id TEXT,
  topic_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('theory', 'notes', 'formula_sheet', 'book', 'pdf', 'past_paper', 'video')),
  title TEXT NOT NULL,
  description TEXT,
  content_json TEXT, -- for structured content (definitions, formulas, examples)
  file_url TEXT, -- for PDFs, videos
  thumbnail_url TEXT,
  duration_seconds INTEGER, -- for videos
  order_index INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (topic_id) REFERENCES topics_table(id)
);
CREATE INDEX idx_sm_topic ON study_materials(topic_id);
CREATE INDEX idx_sm_chapter ON study_materials(chapter_id);
CREATE INDEX idx_sm_type ON study_materials(type);
CREATE INDEX idx_sm_course ON study_materials(course_id);
CREATE INDEX idx_sm_premium ON study_materials(is_premium);

-- Video progress tracking
CREATE TABLE IF NOT EXISTS video_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  last_watched_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (video_id) REFERENCES study_materials(id)
);
CREATE INDEX idx_vp_user ON video_progress(user_id);
CREATE INDEX idx_vp_video ON video_progress(video_id);
`,

  '008_notifications': `
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('daily_challenge', 'review_due', 'streak_reminder', 'exam_reminder', 'weekly_report', 'achievement', 'community', 'system')),
  title TEXT NOT NULL,
  body TEXT,
  data_json TEXT,
  read_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(user_id, read_at);
CREATE INDEX idx_notif_created ON notifications(created_at);
`,
};

export type MigrationName = keyof typeof MIGRATIONS;
export const MIGRATION_ORDER: MigrationName[] = ['001_init', '002_add_db_version', '003_add_question_difficulty', '004_courses_subjects_chapters', '005_reports_daily_achievements', '006_custom_exams', '007_study_materials_videos', '008_notifications'];