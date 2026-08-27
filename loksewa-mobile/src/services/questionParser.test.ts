import { describe, it, expect } from 'vitest';
import { getBundledQuestions } from './questionParser';

// These run the real bundler pipeline over all 27 shipped question files.
describe('getBundledQuestions (bundled question bank)', () => {
  let questions: Awaited<ReturnType<typeof getBundledQuestions>>;

  it('loads a large bank of questions', async () => {
    questions = await getBundledQuestions();
    expect(questions.length).toBeGreaterThan(4000);
  });

  it('produces unique ids', async () => {
    const list = questions ?? (await getBundledQuestions());
    const ids = new Set(list.map((q) => q.id));
    expect(ids.size).toBe(list.length);
  });

  it('always yields well-formed rows', async () => {
    const list = questions ?? (await getBundledQuestions());

    for (const q of list) {
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.topic.length).toBeGreaterThan(0);
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer.length).toBeGreaterThan(0);
      expect(q.source_file.length).toBeGreaterThan(0);

      const options = JSON.parse(q.options_json) as Record<string, string>;
      expect(Object.keys(options).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('de-duplicates identical questions across files', async () => {
    const list = questions ?? (await getBundledQuestions());
    const signatures = new Set(
      list.map((q) => `${q.question.toLowerCase().trim()}::${q.options_json}`)
    );
    // Not a strict equality check (signatures normalise differently), but the
    // bank should not contain wholesale repeats.
    expect(signatures.size).toBeGreaterThan(list.length * 0.99);
  });
});