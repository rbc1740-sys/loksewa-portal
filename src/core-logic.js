// Testable core logic extracted from index.html
// This file contains the pure functions that can be unit tested

/**
 * Normalizes text for comparison
 */
export function normalizeForComparison(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]+/gu, " ")
    .trim();
}

/**
 * Generates a signature for question deduplication
 */
export function getQuestionSignature(question) {
  const normalizedQuestion = normalizeForComparison(question?.question);
  const normalizedOptions = Object.entries(question?.options || {})
    .map(([key, value]) => normalizeForComparison(value))
    .filter(Boolean)
    .sort()
    .join("|");
  if (!normalizedQuestion && !normalizedOptions) return "";
  return `${normalizedQuestion}::${normalizedOptions}`;
}

/**
 * Spaced Repetition (SM-2) Algorithm constants
 */
export const SR_EASE_MIN = 1.3;
export const SR_EASE_DEFAULT = 2.5;
export const SR_INTERVALS = [1, 6, 16, 35, 75, 150, 300]; // days

/**
 * Calculates next interval using SM-2 algorithm
 */
export function calculateNextInterval(attempts, easeFactor, wasCorrect) {
  if (!wasCorrect) {
    return { 
      interval: 0, 
      ease: Math.max(SR_EASE_MIN, easeFactor - 0.2), 
      attempts: 0 
    };
  }
  
  let newAttempts = attempts + 1;
  let newInterval;
  
  if (newAttempts === 1) newInterval = SR_INTERVALS[0];
  else if (newAttempts === 2) newInterval = SR_INTERVALS[1];
  else if (newAttempts <= SR_INTERVALS.length) newInterval = SR_INTERVALS[newAttempts - 1];
  else newInterval = Math.round(SR_INTERVALS[SR_INTERVALS.length - 1] * Math.pow(easeFactor, newAttempts - SR_INTERVALS.length));
  
  // SM-2 formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)) where q is quality (0-5)
  // For correct answers, assume quality=3 (moderate difficulty recalled correctly)
  const quality = 3;
  let newEase = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEase = Math.max(SR_EASE_MIN, Math.min(3.0, newEase));
  
  return { interval: newInterval, ease: newEase, attempts: newAttempts };
}

/**
 * Updates Spaced Repetition state for a question
 */
export function updateSRState(srData, questionId, wasCorrect) {
  const existing = srData[questionId] || { interval: 0, ease: SR_EASE_DEFAULT, attempts: 0, due: 0 };
  const { interval, ease, attempts } = calculateNextInterval(existing.attempts, existing.ease, wasCorrect);
  const due = interval === 0 ? Date.now() : Date.now() + interval * 24 * 60 * 60 * 1000;
  
  return {
    ...srData,
    [questionId]: { interval, ease, attempts, due }
  };
}

/**
 * Gets questions due for review
 */
export function getDueQuestions(srData) {
  const now = Date.now();
  return Object.entries(srData)
    .filter(([, data]) => data.due <= now)
    .map(([id]) => id);
}

/**
 * Matches topic selection
 */
export function matchesTopicSelection(question, selection, getTopicCategory) {
  if (selection === "All") return true;
  if (selection === "__SPACED_REVIEW__") return getDueQuestions({}).includes(question.id); // Simplified
  if (selection === "__GENERAL_KNOWLEDGE__") return getTopicCategory(question.topic) === "general";
  if (selection === "__TECHNICAL_SUBJECTS__") return getTopicCategory(question.topic) === "technical";
  return question.topic === selection;
}

/**
 * Gets topic category
 */
export function getTopicCategory(topic, TOPIC_TO_CATEGORY = {}) {
  return TOPIC_TO_CATEGORY[topic] || "general";
}

/**
 * Filters questions by instant filter
 */
export function applyInstantFilter(questions, userAnswers, bookmarks, currentInstantFilter) {
  let filtered = [...questions];
  
  if (currentInstantFilter === 'unattempted') {
    filtered = filtered.filter(q => !userAnswers[q.id]);
  } else if (currentInstantFilter === 'incorrect') {
    filtered = filtered.filter(q => {
      const ans = userAnswers[q.id];
      return ans && ans.toLowerCase() !== (q.answer || '').toLowerCase();
    });
  } else if (currentInstantFilter === 'bookmarked') {
    filtered = filtered.filter(q => bookmarks.has(q.id));
  } else if (currentInstantFilter && currentInstantFilter !== 'all') {
    filtered = filtered.filter(q => {
      const bm = bookmarks.get(q.id);
      return bm && bm.tags.includes(currentInstantFilter);
    });
  }
  
  return filtered;
}

/**
 * Calculates overall stats
 */
export function getOverallStats(mcqs, userAnswers, getTopicCategory, getDueQuestions) {
  let totalQuestions = 0;
  let totalAttempted = 0;
  let gkQuestions = 0;
  let techQuestions = 0;
  let topicsWithProgress = 0;
  
  mcqs.forEach(q => {
    totalQuestions++;
    if (getTopicCategory(q.topic) === 'general') gkQuestions++;
    else techQuestions++;
    if (userAnswers[q.id]) totalAttempted++;
  });
  
  const topicProgress = new Set();
  mcqs.forEach(q => {
    if (userAnswers[q.id]) topicProgress.add(q.topic);
  });
  topicsWithProgress = topicProgress.size;
  
  const dueCount = getDueQuestions().length;
  
  return { totalQuestions, totalAttempted, gkQuestions, techQuestions, topicsWithProgress, dueCount };
}

/**
 * Gets last studied topic
 */
export function getLastStudiedTopic(mcqs) {
  let maxTime = 0;
  let lastTopic = null;
  mcqs.forEach(q => {
    if (q.lastAttempted && q.lastAttempted > maxTime) {
      maxTime = q.lastAttempted;
      lastTopic = q.topic;
    }
  });
  return lastTopic;
}

/**
 * Gets most recent attempt time
 */
export function getMostRecentAttemptTime(mcqs) {
  let maxTime = 0;
  mcqs.forEach(q => {
    if (q.lastAttempted) maxTime = Math.max(maxTime, q.lastAttempted);
  });
  return maxTime;
}

/**
 * Escapes HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\"")
    .replace(/'/g, "&#039;");
}

/**
 * Escapes attribute
 */
export function escapeAttr(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/"/g, "\"");
}

/**
 * Bookmark functions
 */
export function toggleBookmark(bookmarks, qId) {
  const newBookmarks = new Map(bookmarks);
  if (newBookmarks.has(qId)) {
    newBookmarks.delete(qId);
  } else {
    newBookmarks.set(qId, { tags: [], timestamp: Date.now(), note: '' });
  }
  return newBookmarks;
}

export function addTagToBookmark(bookmarks, userTags, qId, tag) {
  const newBookmarks = new Map(bookmarks);
  const newUserTags = new Set(userTags);
  
  const bookmark = newBookmarks.get(qId);
  if (!bookmark) return { bookmarks: newBookmarks, userTags: newUserTags };
  
  const cleanTag = tag.trim().toLowerCase();
  if (!cleanTag) return { bookmarks: newBookmarks, userTags: newUserTags };
  
  if (!bookmark.tags.includes(cleanTag)) {
    bookmark.tags.push(cleanTag);
    newUserTags.add(cleanTag);
  }
  
  return { bookmarks: newBookmarks, userTags: newUserTags };
}

export function removeTagFromBookmark(bookmarks, userTags, qId, tag) {
  const newBookmarks = new Map(bookmarks);
  const newUserTags = new Set(userTags);
  
  const bookmark = newBookmarks.get(qId);
  if (!bookmark) return { bookmarks: newBookmarks, userTags: newUserTags };
  
  bookmark.tags = bookmark.tags.filter(t => t !== tag);
  
  // Check if tag is still used elsewhere
  let tagUsed = false;
  newBookmarks.forEach(v => {
    if (v.tags.includes(tag)) tagUsed = true;
  });
  if (!tagUsed) newUserTags.delete(tag);
  
  return { bookmarks: newBookmarks, userTags: newUserTags };
}

export function updateBookmarkNote(bookmarks, qId, note) {
  const newBookmarks = new Map(bookmarks);
  const bookmark = newBookmarks.get(qId);
  if (!bookmark) return newBookmarks;
  bookmark.note = note;
  return newBookmarks;
}

export function getBookmarkedQuestions(mcqs, bookmarks) {
  return mcqs.filter(q => bookmarks.has(q.id));
}

export function getQuestionsByTag(mcqs, bookmarks, tag) {
  const taggedIds = new Set();
  bookmarks.forEach((v, k) => {
    if (v.tags.includes(tag)) taggedIds.add(k);
  });
  return mcqs.filter(q => taggedIds.has(q.id));
}

/**
 * Weak points functions
 */
export function toggleWeakPoint(weakPoints, id) {
  const newWeakPoints = new Set(weakPoints);
  if (newWeakPoints.has(id)) newWeakPoints.delete(id);
  else newWeakPoints.add(id);
  return newWeakPoints;
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}