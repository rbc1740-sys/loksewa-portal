/**
 * Static schema-parity guard for the `questions` table.
 *
 * Unit tests mock the SQLite layer, so a column written by a service but never
 * created by a migration only fails ON DEVICE (e.g. bulkInsertQuestions wrote
 * course_id while no migration added it -> "no such column: course_id").
 * This test statically cross-checks the INSERT column list in database.ts
 * against the schema produced by all migrations.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MIGRATIONS, MIGRATION_ORDER } from './index';

function questionsColumnsFromMigrations(): Set<string> {
  const cols = new Set<string>();
  for (const name of MIGRATION_ORDER) {
    const sql = MIGRATIONS[name];

    // Columns declared in CREATE TABLE IF NOT EXISTS questions (...)
    const create = sql.match(/CREATE TABLE IF NOT EXISTS questions \(([\s\S]*?)\);/);
    if (create) {
      for (const line of create[1].split(',')) {
        const col = line.trim().split(/\s+/)[0];
        // Skip SQL keywords, expression fragments, and constraint clauses.
        if (col && /^[a-zA-Z_]\w*$/.test(col) && !/^(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)$/i.test(col)) {
          cols.add(col);
        }
      }
    }

    // Columns added by ALTER TABLE questions ADD COLUMN <name>
    for (const m of sql.matchAll(/ALTER TABLE questions ADD COLUMN (\w+)/gi)) {
      cols.add(m[1]);
    }
  }
  return cols;
}

function insertColumnsFromDatabaseService(): string[] {
  // Read database.ts as text — importing it would pull in expo-sqlite and
  // other native modules that must never load during unit tests.
  const databaseTs = readFileSync(
    new URL('../../services/database.ts', import.meta.url),
    'utf8'
  );
  const insert = databaseTs.match(/INSERT OR REPLACE INTO questions \(([^)]*)\)/);
  if (!insert) throw new Error('questions INSERT statement not found in database.ts');
  return insert[1].split(',').map((c) => c.trim());
}

describe('questions schema parity', () => {
  it('covers every column the database service inserts', () => {
    const schema = questionsColumnsFromMigrations();
    expect(schema.size).toBeGreaterThan(0);

    const inserted = insertColumnsFromDatabaseService();
    expect(inserted).toContain('id');
    expect(inserted).toContain('course_id');

    for (const col of inserted) {
      expect(
        schema.has(col),
        `column "${col}" is written by database.ts but no migration creates it`
      ).toBe(true);
    }
  });

  it('runs migrations in declaration order with no gaps', () => {
    expect(MIGRATION_ORDER.length).toBe(Object.keys(MIGRATIONS).length);
    for (const name of MIGRATION_ORDER) {
      expect(MIGRATIONS[name], `migration ${name} has no SQL`).toBeTruthy();
    }
  });
});

