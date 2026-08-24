// Loksewa Prep Pro - Core Types & Interfaces
// TypeScript-style JSDoc types for better IDE support

/**
 * @typedef {Object} Question
 * @property {string} id - Unique question identifier
 * @property {string} topic - Topic/category name
 * @property {string} question - Question text
 * @property {Object.<string, string>} options - Options map (a, b, c, d -> text)
 * @property {string} answer - Correct answer key (a, b, c, or d)
 * @property {string} [explanation] - Optional explanation text
 */

/**
 * @typedef {Object} SRData
 * @property {number} interval - Days until next review
 * @property {number} ease - Ease factor (1.3-3.0)
 * @property {number} attempts - Number of successful attempts
 * @property {number} due - Timestamp when due for review
 */

/**
 * @typedef {Object} UserProgress
 * @property {Object.<string, string>} userAnswers - questionId -> selected option
 * @property {Set<string>} weakPoints - Set of question IDs marked as weak
 * @property {Object.<string, SRData>} srData - Spaced repetition data
 * @property {number} userXP - Total experience points
 * @property {number} userStreak - Current day streak
 */

/**
 * @typedef {Object} Comment
 * @property {string} id - Comment ID
 * @property {string} questionId - Associated question ID
 * @property {string} userId - Author user ID
 * @property {string} user - Author display name
 * @property {string} text - Comment text
 * @property {string} time - Formatted timestamp
 * @property {number} ts - Unix timestamp
 * @property {Object[]} [replies] - Array of reply objects
 * @property {number} [helpful] - Helpful count
 * @property {Object} [helpfulBy] - Map of userId -> true
 */

/**
 * @typedef {Object} VoteData
 * @property {Object.<string, number>} counts - option -> vote count
 * @property {Object.<string, string>} voters - userId -> voted option
 * @property {Object.<string, Object>} reasons - userId -> {option, text, name, time, up, upVoters}
 */

/**
 * @typedef {Object} BattleRoom
 * @property {string} code - Room code
 * @property {string} host - Host username
 * @property {string} hostUid - Host user ID
 * @property {number} hostScore - Host score
 * @property {string|null} guest - Guest username
 * @property {string|null} guestUid - Guest user ID
 * @property {number} guestScore - Guest score
 * @property {string} status - 'waiting' | 'active' | 'finished'
 * @property {Array<{id, question, options}>} questions - Battle questions
 * @property {number} created - Creation timestamp
 */

/**
 * @typedef {Object} ExamState
 * @property {Question[]} activeExamQuestions - Current exam questions
 * @property {Object.<string, string>} examUserAnswers - questionId -> selected option
 * @property {number} examTimerState.totalSeconds - Remaining seconds
 * @property {number} examTimerState.lastTick - Last update timestamp
 * @property {boolean} examTimerState.paused - Whether timer is paused
 */

// Export types for module consumers (no-op in browser, for JSDoc only)
export const Types = {};