import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeForComparison,
  getQuestionSignature,
  calculateNextInterval,
  updateSRState,
  getDueQuestions,
  matchesTopicSelection,
  getTopicCategory,
  applyInstantFilter,
  getOverallStats,
  getLastStudiedTopic,
  getMostRecentAttemptTime,
  escapeHtml,
  escapeAttr,
  toggleBookmark,
  addTagToBookmark,
  removeTagFromBookmark,
  updateBookmarkNote,
  getBookmarkedQuestions,
  getQuestionsByTag,
  toggleWeakPoint,
  debounce,
  throttle,
  SR_EASE_MIN,
  SR_EASE_DEFAULT,
  SR_INTERVALS
} from '../../src/core-logic.js';

describe('Core Logic Unit Tests', () => {
  
  describe('normalizeForComparison', () => {
    it('should normalize text correctly', () => {
      expect(normalizeForComparison('Hello World')).toBe('hello world');
      // The function preserves multiple spaces between words
      expect(normalizeForComparison('  EXTRA   SPACES  ')).toBe('extra   spaces');
      expect(normalizeForComparison('Special!@#$Characters')).toBe('special characters');
      expect(normalizeForComparison(null)).toBe('');
      expect(normalizeForComparison(undefined)).toBe('');
    });
  });

  describe('getQuestionSignature', () => {
    it('should generate unique signatures for different questions', () => {
      const q1 = { question: 'What is 2+2?', options: { a: '3', b: '4', c: '5', d: '6' } };
      const q2 = { question: 'What is 2+2?', options: { a: '4', b: '3', c: '5', d: '6' } };
      const q3 = { question: 'What is 3+3?', options: { a: '3', b: '4', c: '5', d: '6' } };
      
      expect(getQuestionSignature(q1)).not.toBe(getQuestionSignature(q3));
      expect(getQuestionSignature(q1)).toBe(getQuestionSignature(q2)); // Same options, different order
    });

    it('should handle empty questions', () => {
      expect(getQuestionSignature({})).toBe('');
      expect(getQuestionSignature(null)).toBe('');
    });
  });

  describe('SM-2 Algorithm - calculateNextInterval', () => {
    it('should reset interval on incorrect answer', () => {
      const result = calculateNextInterval(3, 2.5, false);
      expect(result.interval).toBe(0);
      expect(result.attempts).toBe(0);
      expect(result.ease).toBeCloseTo(2.3, 1);
    });

    it('should set interval to 1 day on first correct answer', () => {
      const result = calculateNextInterval(0, SR_EASE_DEFAULT, true);
      expect(result.interval).toBe(1);
      expect(result.attempts).toBe(1);
    });

    it('should set interval to 6 days on second correct answer', () => {
      const result = calculateNextInterval(1, SR_EASE_DEFAULT, true);
      expect(result.interval).toBe(6);
      expect(result.attempts).toBe(2);
    });

    it('should follow SR_INTERVALS for subsequent correct answers', () => {
      expect(calculateNextInterval(2, SR_EASE_DEFAULT, true).interval).toBe(16);
      expect(calculateNextInterval(3, SR_EASE_DEFAULT, true).interval).toBe(35);
      expect(calculateNextInterval(4, SR_EASE_DEFAULT, true).interval).toBe(75);
      expect(calculateNextInterval(5, SR_EASE_DEFAULT, true).interval).toBe(150);
      expect(calculateNextInterval(6, SR_EASE_DEFAULT, true).interval).toBe(300);
    });

    it('should use exponential formula beyond SR_INTERVALS', () => {
      // 7th attempt should use exponential formula
      const result = calculateNextInterval(7, 2.5, true);
      expect(result.interval).toBeGreaterThan(300);
      expect(result.attempts).toBe(8);
    });

    it('should not let ease factor go below minimum', () => {
      let ease = SR_EASE_MIN;
      for (let i = 0; i < 10; i++) {
        const result = calculateNextInterval(0, ease, false);
        ease = result.ease;
      }
      expect(ease).toBeGreaterThanOrEqual(SR_EASE_MIN);
    });

    it('should not let ease factor exceed 3.0', () => {
      let ease = 2.9;
      for (let i = 0; i < 10; i++) {
        const result = calculateNextInterval(0, ease, true);
        ease = result.ease;
      }
      expect(ease).toBeLessThanOrEqual(3.0);
    });

    it('should decrease ease factor slightly on correct answers with quality=3', () => {
      // SM-2 formula with quality=3: EF' = EF + (0.1 - (5-3)*(0.08 + (5-3)*0.02))
      // = EF + (0.1 - 2*(0.08 + 0.04)) = EF + (0.1 - 0.24) = EF - 0.14
      let ease = 2.5;
      const result = calculateNextInterval(0, ease, true);
      expect(result.ease).toBeCloseTo(2.36, 2);
    });
  });

  describe('updateSRState', () => {
    it('should update SR state correctly for correct answer', () => {
      const srData = {};
      const result = updateSRState(srData, 'q1', true);
      
      expect(result.q1).toBeDefined();
      expect(result.q1.interval).toBe(1);
      expect(result.q1.attempts).toBe(1);
      expect(result.q1.due).toBeGreaterThan(Date.now());
    });

    it('should reset SR state for incorrect answer', () => {
      const srData = { q1: { interval: 30, ease: 2.5, attempts: 5, due: Date.now() + 1000000 } };
      const result = updateSRState(srData, 'q1', false);
      
      expect(result.q1.interval).toBe(0);
      expect(result.q1.attempts).toBe(0);
      expect(result.q1.due).toBeLessThanOrEqual(Date.now() + 1000); // Due immediately
    });

    it('should preserve other questions SR data', () => {
      const srData = { q1: { interval: 10, ease: 2.5, attempts: 2, due: Date.now() + 1000000 } };
      const result = updateSRState(srData, 'q2', true);
      
      expect(result.q1).toEqual(srData.q1);
      expect(result.q2).toBeDefined();
    });
  });

  describe('getDueQuestions', () => {
    it('should return questions due for review', () => {
      const now = Date.now();
      const srData = {
        q1: { due: now - 1000 }, // Past due
        q2: { due: now + 1000 }, // Future
        q3: { due: now }, // Due now
      };
      
      const due = getDueQuestions(srData);
      expect(due).toContain('q1');
      expect(due).toContain('q3');
      expect(due).not.toContain('q2');
    });
  });

  describe('matchesTopicSelection', () => {
    const mockGetTopicCategory = (topic) => {
      const gk = ['Geography of Nepal', 'History of Nepal'];
      return gk.includes(topic) ? 'general' : 'technical';
    };

    it('should match All selection', () => {
      const q = { topic: 'Any Topic' };
      expect(matchesTopicSelection(q, 'All', mockGetTopicCategory)).toBe(true);
    });

    it('should match exact topic', () => {
      const q = { topic: 'Geography of Nepal' };
      expect(matchesTopicSelection(q, 'Geography of Nepal', mockGetTopicCategory)).toBe(true);
      expect(matchesTopicSelection(q, 'History of Nepal', mockGetTopicCategory)).toBe(false);
    });

    it('should match general knowledge category', () => {
      const q = { topic: 'Geography of Nepal' };
      expect(matchesTopicSelection(q, '__GENERAL_KNOWLEDGE__', mockGetTopicCategory)).toBe(true);
    });

    it('should match technical category', () => {
      const q = { topic: 'Structural Engineering' };
      expect(matchesTopicSelection(q, '__TECHNICAL_SUBJECTS__', mockGetTopicCategory)).toBe(true);
    });
  });

  describe('getTopicCategory', () => {
    it('should return category from mapping', () => {
      const mapping = { 'Geography of Nepal': 'general', 'Structural Engineering': 'technical' };
      expect(getTopicCategory('Geography of Nepal', mapping)).toBe('general');
      expect(getTopicCategory('Structural Engineering', mapping)).toBe('technical');
    });

    it('should default to general for unknown topics', () => {
      expect(getTopicCategory('Unknown Topic', {})).toBe('general');
    });
  });

  describe('applyInstantFilter', () => {
    const mcqs = [
      { id: 'q1', answer: 'a' },
      { id: 'q2', answer: 'b' },
      { id: 'q3', answer: 'c' },
    ];

    const userAnswers = { q1: 'a', q2: 'c' }; // q1 correct, q2 incorrect
    const bookmarks = new Map([['q3', { tags: ['important'] }]]);

    it('should return all questions for "all" filter', () => {
      const result = applyInstantFilter(mcqs, userAnswers, bookmarks, 'all');
      expect(result).toHaveLength(3);
    });

    it('should filter unattempted questions', () => {
      const result = applyInstantFilter(mcqs, userAnswers, bookmarks, 'unattempted');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q3');
    });

    it('should filter incorrect questions', () => {
      const result = applyInstantFilter(mcqs, userAnswers, bookmarks, 'incorrect');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q2');
    });

    it('should filter bookmarked questions', () => {
      const result = applyInstantFilter(mcqs, userAnswers, bookmarks, 'bookmarked');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q3');
    });

    it('should filter by custom tag', () => {
      const result = applyInstantFilter(mcqs, userAnswers, bookmarks, 'important');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q3');
    });
  });

  describe('getOverallStats', () => {
    const mcqs = [
      { id: 'q1', topic: 'Geography' },
      { id: 'q2', topic: 'History' },
      { id: 'q3', topic: 'Structural Engineering' },
    ];
    const userAnswers = { q1: 'a', q2: 'b' };
    const getTopicCategory = (t) => t === 'Structural Engineering' ? 'technical' : 'general';
    const getDueQuestions = () => ['q1'];

    it('should calculate stats correctly', () => {
      const stats = getOverallStats(mcqs, userAnswers, getTopicCategory, getDueQuestions);
      
      expect(stats.totalQuestions).toBe(3);
      expect(stats.totalAttempted).toBe(2);
      expect(stats.gkQuestions).toBe(2);
      expect(stats.techQuestions).toBe(1);
      expect(stats.topicsWithProgress).toBe(2);
      expect(stats.dueCount).toBe(1);
    });
  });

  describe('getLastStudiedTopic', () => {
    it('should return most recently studied topic', () => {
      const mcqs = [
        { id: 'q1', topic: 'Geography', lastAttempted: 1000 },
        { id: 'q2', topic: 'History', lastAttempted: 2000 },
        { id: 'q3', topic: 'Structural', lastAttempted: 1500 },
      ];
      
      expect(getLastStudiedTopic(mcqs)).toBe('History');
    });

    it('should return null for no attempts', () => {
      const mcqs = [
        { id: 'q1', topic: 'Geography' },
        { id: 'q2', topic: 'History' },
      ];
      
      expect(getLastStudiedTopic(mcqs)).toBeNull();
    });
  });

  describe('getMostRecentAttemptTime', () => {
    it('should return maximum lastAttempted time', () => {
      const mcqs = [
        { id: 'q1', lastAttempted: 1000 },
        { id: 'q2', lastAttempted: 2000 },
        { id: 'q3', lastAttempted: 1500 },
      ];
      
      expect(getMostRecentAttemptTime(mcqs)).toBe(2000);
    });

    it('should return 0 for no attempts', () => {
      const mcqs = [{ id: 'q1' }, { id: 'q2' }];
      expect(getMostRecentAttemptTime(mcqs)).toBe(0);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom & Jerry');
      expect(escapeHtml('"quoted"')).toBe('"quoted"');
      expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
    });

    it('should handle empty/null', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
    });
  });

  describe('escapeAttr', () => {
    it('should escape for HTML attributes', () => {
      expect(escapeAttr('"quoted"')).toBe('"quoted"');
      expect(escapeAttr("'single'")).toBe('&#039;single&#039;');
    });
  });

  describe('Bookmark functions', () => {
    let bookmarks, userTags;

    beforeEach(() => {
      bookmarks = new Map();
      userTags = new Set();
    });

    it('should add bookmark', () => {
      const result = toggleBookmark(bookmarks, 'q1');
      expect(result.has('q1')).toBe(true);
      expect(result.get('q1')).toEqual({ tags: [], timestamp: expect.any(Number), note: '' });
    });

    it('should remove bookmark', () => {
      bookmarks.set('q1', { tags: [], timestamp: Date.now(), note: '' });
      const result = toggleBookmark(bookmarks, 'q1');
      expect(result.has('q1')).toBe(false);
    });

    it('should add tag to bookmark', () => {
      bookmarks.set('q1', { tags: [], timestamp: Date.now(), note: '' });
      const result = addTagToBookmark(bookmarks, userTags, 'q1', 'important');
      
      expect(result.bookmarks.get('q1').tags).toContain('important');
      expect(result.userTags.has('important')).toBe(true);
    });

    it('should not duplicate tags', () => {
      bookmarks.set('q1', { tags: ['important'], timestamp: Date.now(), note: '' });
      userTags.add('important');
      const result = addTagToBookmark(bookmarks, userTags, 'q1', 'important');
      
      expect(result.bookmarks.get('q1').tags).toHaveLength(1);
    });

    it('should remove tag from bookmark', () => {
      bookmarks.set('q1', { tags: ['important', 'difficult'], timestamp: Date.now(), note: '' });
      userTags.add('important');
      userTags.add('difficult');
      
      const result = removeTagFromBookmark(bookmarks, userTags, 'q1', 'important');
      
      expect(result.bookmarks.get('q1').tags).not.toContain('important');
      expect(result.bookmarks.get('q1').tags).toContain('difficult');
      expect(result.userTags.has('important')).toBe(false);
      expect(result.userTags.has('difficult')).toBe(true);
    });

    it('should remove tag from userTags when no longer used', () => {
      bookmarks.set('q1', { tags: ['unique-tag'], timestamp: Date.now(), note: '' });
      userTags.add('unique-tag');
      
      const result = removeTagFromBookmark(bookmarks, userTags, 'q1', 'unique-tag');
      
      expect(result.userTags.has('unique-tag')).toBe(false);
    });

    it('should update bookmark note', () => {
      bookmarks.set('q1', { tags: [], timestamp: Date.now(), note: '' });
      const result = updateBookmarkNote(bookmarks, 'q1', 'This is a note');
      
      expect(result.get('q1').note).toBe('This is a note');
    });

    it('should get bookmarked questions', () => {
      const mcqs = [
        { id: 'q1', topic: 'Geo' },
        { id: 'q2', topic: 'Hist' },
        { id: 'q3', topic: 'Struct' },
      ];
      bookmarks.set('q1', { tags: [], timestamp: Date.now(), note: '' });
      bookmarks.set('q3', { tags: [], timestamp: Date.now(), note: '' });
      
      const result = getBookmarkedQuestions(mcqs, bookmarks);
      expect(result).toHaveLength(2);
      expect(result.map(q => q.id)).toEqual(['q1', 'q3']);
    });

    it('should get questions by tag', () => {
      const mcqs = [
        { id: 'q1', topic: 'Geo' },
        { id: 'q2', topic: 'Hist' },
        { id: 'q3', topic: 'Struct' },
      ];
      bookmarks.set('q1', { tags: ['important'], timestamp: Date.now(), note: '' });
      bookmarks.set('q2', { tags: ['important', 'difficult'], timestamp: Date.now(), note: '' });
      bookmarks.set('q3', { tags: ['difficult'], timestamp: Date.now(), note: '' });
      
      const result = getQuestionsByTag(mcqs, bookmarks, 'important');
      expect(result).toHaveLength(2);
      expect(result.map(q => q.id)).toEqual(['q1', 'q2']);
    });
  });

  describe('toggleWeakPoint', () => {
    it('should add to weak points', () => {
      const weakPoints = new Set();
      const result = toggleWeakPoint(weakPoints, 'q1');
      expect(result.has('q1')).toBe(true);
    });

    it('should remove from weak points', () => {
      const weakPoints = new Set(['q1']);
      const result = toggleWeakPoint(weakPoints, 'q1');
      expect(result.has('q1')).toBe(false);
    });
  });

  describe('debounce', () => {
    it('should delay function execution', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      debounced();
      debounced();
      
      expect(fn).not.toHaveBeenCalled();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should limit function execution rate', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      
      throttled();
      throttled();
      throttled();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});