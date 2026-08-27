/**
 * Mistakes summarizer — pure grouping logic for the Mistakes system (rule 18).
 *
 * Takes a user's wrong-answer question rows and groups them through the course
 * catalog so subject/chapter counts come from real attempts, never static
 * values (rule 70-bug-13). Keeping this pure lets vitest cover it without
 * needing the native SQLite layer.
 */
import { getTopicPath } from '../constants/courses';

/** Minimal shape needed from a question row — keeps callers flexible. */
export interface MistakeSourceQuestion {
  id: string;
  topic?: string | null;
}

export interface MistakeGroup {
  /** Stable group id: subject/chapter catalog id, or 'other'. */
  key: string;
  display: string;
  count: number;
  /** The wrong questions belonging to this group — enables true drill-down. */
  questionIds: string[];
}

export interface MistakeSummary {
  total: number;
  bySubject: MistakeGroup[];
  byChapter: MistakeGroup[];
  /** Questions whose topic is not in the catalog yet (should stay 0 in prod). */
  unmapped: number;
}

function increment(
  map: Map<string, MistakeGroup>,
  key: string,
  display: string,
  questionId: string
): void {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    existing.questionIds.push(questionId);
  } else {
    map.set(key, { key, display, count: 1, questionIds: [questionId] });
  }
}

/** Count-desc, then name-asc so ordering is deterministic across renders. */
function sortedGroups(map: Map<string, MistakeGroup>): MistakeGroup[] {
  return [...map.values()].sort((a, b) =>
    b.count - a.count || a.display.localeCompare(b.display)
  );
}

export function summarizeMistakes(questions: MistakeSourceQuestion[]): MistakeSummary {
  const subjects = new Map<string, MistakeGroup>();
  const chapters = new Map<string, MistakeGroup>();
  let unmapped = 0;

  for (const q of questions ?? []) {
    if (!q?.id) continue;
    const path = q.topic ? getTopicPath(q.topic) : null;
    if (!path) {
      unmapped += 1;
      increment(subjects, 'other', 'Other', q.id);
      increment(chapters, 'other', 'Unmapped topics', q.id);
      continue;
    }
    increment(subjects, path.subjectId, path.subjectName, q.id);
    increment(chapters, path.chapterId, path.chapterName, q.id);
  }

  return {
    total: questions?.length ?? 0,
    bySubject: sortedGroups(subjects),
    byChapter: sortedGroups(chapters),
    unmapped,
  };
}
