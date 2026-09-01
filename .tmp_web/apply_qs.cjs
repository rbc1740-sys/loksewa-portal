// Temporary helper: multi-try practice edits for questionSession.ts (CRLF).
const fs = require('fs');
const splitLines = (c) => { const arr = c.split(/\r?\n/); if (arr[arr.length - 1] === '') arr.pop(); return arr; };
const contentToLines = (s) => s.split('\n');
const EOLof = (c) => (c.includes('\r\n') ? '\r\n' : '\n');

const FILE = 'd:/loksewa-portal/loksewa-mobile/src/engine/questionSession.ts';
const content = fs.readFileSync(FILE, 'utf8');
const EOL = EOLof(content);
const all = content.split(EOL);

const splices = [];
const add = (start, end, body, expectedFirst) => splices.push({ start, end, lines: contentToLines(body), expectedFirst });

add(55, 56, `  /** questionId → final selected option key (correct in practice; latest in test). */
  answers: Record<string, string>;
  /** questionId → wrong option keys tapped before the final answer (multi-try). */
  wrongAttempts: Record<string, string[]>;`, '/** questionId');
add(69, 69, `  commitAnswer: (
    questionId: string,
    opts?: { choice?: string; xpGainedOverride?: number }
  ) => Promise<void>;
  /** Records a wrong attempt (multi-try practice/review) without clearing the final answer. */
  recordWrongAttempt: (questionId: string, choice: string) => void;`, 'commitAnswer');
add(86, 87, `  answers: {},
  wrongAttempts: {},
  timeSpent: {},`, 'answers: {},');
add(115, 116, `        answers: {},
        wrongAttempts: {},
        timeSpent: {},`, 'answers: {},');
add(128, 150, `  selectAnswer: (questionId, choice) => {
    const { answers, mode, questions } = get();
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;
    // Optimistic local update so the chosen option feels instant.
    set({ answers: { ...answers, [questionId]: choice } });
    if (mode === 'test') {
      get().commitAnswer(questionId);
    }
  },

  recordWrongAttempt: (questionId, choice) => {
    const { wrongAttempts } = get();
    const prev = wrongAttempts[questionId] || [];
    if (prev.includes(choice)) return;
    set({ wrongAttempts: { ...wrongAttempts, [questionId]: [...prev, choice] } });
  },

  commitAnswer: async (questionId, opts) => {
    const { answers, questions, timeSpent, userId } = get();
    const choice = opts?.choice ?? answers[questionId];
    const q = questions.find((x) => x.id === questionId);
    if (!q || !choice || !userId) return;
    const elapsed = timeSpent[questionId] ?? 0;
    try {
      await recordAnswer(userId, q, choice, elapsed, {
        xpGainedOverride: opts?.xpGainedOverride,
      });
    } catch (e) {
      console.error('[Session] commitAnswer failed:', e);
    }
  },`, 'selectAnswer');
add(202, 203, `      answers: {},
      wrongAttempts: {},
      timeSpent: {},`, 'answers: {},');

splices.sort((a, b) => b.start - a.start);
for (const s of splices) {
  const firstLine = all[s.start - 1];
  if (firstLine === undefined || !String(firstLine).includes(s.expectedFirst)) {
    console.error(`MISMATCH @${s.start}: expected contains ${JSON.stringify(s.expectedFirst)}, got ${JSON.stringify(firstLine)}`);
    process.exit(1);
  }
}
for (const s of splices) all.splice(s.start - 1, s.end - s.start + 1, ...s.lines);
fs.writeFileSync(FILE, all.join(EOL), 'utf8');
console.log('Patched questionSession.ts');