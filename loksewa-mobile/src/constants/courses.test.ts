/**
 * Course-catalog integrity tests (Phase 1).
 *
 * Guards the invariant everything else depends on: every bundled question
 * topic maps into the Course→Subject→Chapter hierarchy exactly once with the
 * right counts — so seeding can never silently strand questions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHAPTERS_TOTAL,
  DEFAULT_COURSE_ID,
  COURSES,
  TOPIC_TO_CHAPTER,
  getTopicPath,
} from './courses';
import { getBundledQuestions } from '../services/questionParser';

const QUESTIONS_DIR = join(process.cwd(), 'src', 'data', 'questions');

function topicsFromBundle(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of readdirSync(QUESTIONS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const raw = JSON.parse(readFileSync(join(QUESTIONS_DIR, file), 'utf8'));
    const arr: Array<{ topic?: string }> = Array.isArray(raw) ? raw : raw.questions ?? [];
    for (const q of arr) {
      const t = q.topic ?? '(missing)';
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  return counts;
}

describe('course catalog', () => {
  it('has a default course with two subjects covering all chapters', () => {
    expect(DEFAULT_COURSE_ID).toBe('ce_7th');
    const course = COURSES.find(c => c.id === DEFAULT_COURSE_ID);
    expect(course).toBeDefined();

    const subjects = course!.subjects;
    expect(subjects.map(s => s.id)).toEqual(['ce_technical', 'ce_gk']);

    const totalChapters = subjects.reduce((n, s) => n + s.chapters.length, 0);
    expect(totalChapters).toBe(CHAPTERS_TOTAL);
    expect(totalChapters).toBe(Object.keys(TOPIC_TO_CHAPTER).length);
  });

  it('maps every bundled question topic and matches its real count', async () => {
    const bundled = await getBundledQuestions();
    const counts: Record<string, number> = {};
    for (const q of bundled) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
    expect(Object.keys(counts).length).toBeGreaterThan(0);

    for (const [topic, count] of Object.entries(counts)) {
      const mapping = TOPIC_TO_CHAPTER[topic];
      expect(mapping, `unmapped topic: ${topic}`).toBeDefined();

      const defChapter = COURSES.flatMap(c => c.subjects)
        .flatMap(s => s.chapters)
        .find(ch => ch.id === mapping!.chapterId)!;
      expect(defChapter, `chapter missing in catalog: ${mapping!.chapterId}`).toBeDefined();
      expect(defChapter.topics[0].name).toBe(topic);
      expect(defChapter.topics[0].questionCount).toBe(count);
    }
  }, 30000);

  it('never invents a chapter that has no bundled questions', () => {
    const bundleTopics = new Set(Object.keys(topicsFromBundle()));
    for (const subject of COURSES[0].subjects) {
      for (const ch of subject.chapters) {
        expect(bundleTopics.has(ch.name)).toBe(true);
      }
    }
  });

  it('getTopicPath round-trips every topic to a consistent hierarchy', () => {
    for (const [topic, mapping] of Object.entries(TOPIC_TO_CHAPTER)) {
      const path = getTopicPath(topic);
      expect(path, topic).not.toBeNull();
      expect(path!.chapterId).toBe(mapping.chapterId);
      expect(path!.subjectId).toBe(mapping.subjectId);
      expect(path!.courseId).toBe(DEFAULT_COURSE_ID);

      // the mapped chapter really lives under the mapped subject
      const subject = COURSES[0].subjects.find(s => s.id === mapping.subjectId)!;
      expect(subject.chapters.some(c => c.id === mapping.chapterId)).toBe(true);
    }
    expect(getTopicPath('No Such Topic Ever')).toBeNull();
  });
});
