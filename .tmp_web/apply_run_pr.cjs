// Temporary helper: multi-try practice edits for question-runner.tsx + practice-result.tsx (CRLF).
const fs = require('fs');
const splitLines = c => {
  const arr = c.split(/\r?\n/);
  if (arr[arr.length - 1] === '') arr.pop();
  return arr;
};
const contentToLines = s => s.split('\n');
const EOLof = c => (c.includes('\r\n') ? '\r\n' : '\n');

const RUN = 'd:/loksewa-portal/loksewa-mobile/app/(app)/question-runner.tsx';
const PR = 'd:/loksewa-portal/loksewa-mobile/app/(app)/practice-result.tsx';

function patch(file, splices, label) {
  const content = fs.readFileSync(file, 'utf8');
  const EOL = EOLof(content);
  const all = content.split(EOL);
  splices.sort((a, b) => b.start - a.start);
  for (const s of splices) {
    const firstLine = all[s.start - 1];
    if (firstLine === undefined || !String(firstLine).includes(s.expectedFirst)) {
      console.error(
        `MISMATCH ${label} @${s.start}: expected contains ${JSON.stringify(s.expectedFirst)}, got ${JSON.stringify(firstLine)}`
      );
      process.exit(1);
    }
  }
  for (const s of splices) all.splice(s.start - 1, s.end - s.start + 1, ...s.lines);
  fs.writeFileSync(file, all.join(EOL), 'utf8');
  console.log(`Patched ${label}`);
}

// ------------------------- question-runner.tsx -------------------------
const runSplices = [];
const addRun = (start, end, body, expectedFirst) =>
  runSplices.push({ start, end, lines: contentToLines(body), expectedFirst });

addRun(
  19,
  19,
  `import { useSessionStore } from '../../src/engine/questionSession';
import { XP_PER_WRONG, correctRewardForTry } from '../../src/utils/gamification';`,
  'useSessionStore'
);
addRun(
  39,
  39,
  `  const answers = useSessionStore((s) => s.answers);
  const wrongAttempts = useSessionStore((s) => s.wrongAttempts);`,
  'answers'
);
addRun(
  47,
  47,
  `  const commitAnswer = useSessionStore((s) => s.commitAnswer);
  const recordWrongAttempt = useSessionStore((s) => s.recordWrongAttempt);`,
  'commitAnswer'
);
addRun(
  58,
  70,
  `  const selectedChoice = current ? answers[current.id] : undefined;
  const wrongPicks = current ? wrongAttempts[current.id] || [] : [];
  const hasWrongPicks = wrongPicks.length > 0;
  const answeredCorrect =
    !!selectedChoice && selectedChoice.toLowerCase() === (current?.answer || '').toLowerCase();
  const isBookmarked = current ? bookmarkIds.has(current.id) : false;
  // Feedback (green/red + explanation) shows only after the question is solved; while
  // guessing, only eliminated (red) wrong options are marked. Exams stay open.
  const showFeedback = mode !== 'test' && answeredCorrect;
  const isCorrect = answeredCorrect;
  const handleSelect = useCallback(
    (key: string) => {
      if (!current) return;
      const qAns = (current.answer || '').toLowerCase();
      const k = (key || '').toLowerCase();
      if (mode === 'test') {
        selectAnswer(current.id, k);
        return;
      }
      if (answeredCorrect || wrongPicks.includes(k)) return;
      const tryNumber = wrongPicks.length + 1; // 1st/2nd/3rd/4th+ try
      if (k === qAns) {
        selectAnswer(current.id, k);
        commitAnswer(current.id, { xpGainedOverride: correctRewardForTry(tryNumber) });
      } else {
        recordWrongAttempt(current.id, k);
        commitAnswer(current.id, { choice: k, xpGainedOverride: -XP_PER_WRONG });
      }
    },
    [current, mode, answeredCorrect, wrongPicks, selectAnswer, commitAnswer, recordWrongAttempt]
  );`,
  'selectedChoice'
);
addRun(
  81,
  89,
  `  function optionState(key: string): OptionState {
    const k = (key || '').toLowerCase();
    if (showFeedback) {
      if (k === (current?.answer || '').toLowerCase()) return 'correct';
      if (wrongPicks.includes(k)) return 'wrong';
      return 'disabled';
    }
    if (wrongPicks.includes(k)) return 'wrong';
    if (selectedChoice === k) return 'selected';
    return 'idle';
  }`,
  'function optionState'
);
addRun(
  118,
  118,
  `        </View>
        {hasWrongPicks && !answeredCorrect && mode !== 'test' ? (
          <View style={[styles.hintBox, { backgroundColor: t.surface, borderColor: t.warning }]}>
            <Text style={[styles.hintText, { color: t.warning }]}>
              ✗ {wrongPicks.length} wrong {wrongPicks.length === 1 ? 'attempt' : 'attempts'} (−2 XP each) — red options are eliminated, keep trying!
            </Text>
          </View>
        ) : null}`,
  '</View>'
);
addRun(
  213,
  213,
  `  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  hintText: {
    ...typography.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  actions: {`,
  'actions'
);
patch(RUN, runSplices, 'question-runner.tsx');

// ------------------------- practice-result.tsx -------------------------
const prSplices = [];
const addPr = (start, end, body, expectedFirst) =>
  prSplices.push({ start, end, lines: contentToLines(body), expectedFirst });
addPr(
  25,
  25,
  `  const answers = useSessionStore((s) => s.answers);
  const wrongAttempts = useSessionStore((s) => s.wrongAttempts);`,
  'answers'
);
addPr(
  37,
  40,
  `      const sel = answers[q.id];
      const triedWrong = (wrongAttempts[q.id] || []).length > 0;
      if (!sel && !triedWrong) skipped += 1;
      else if (sel) correct += 1;
      else incorrect += 1;`,
  'sel'
);
addPr(53, 53, `  }, [questions, answers, timeSpent, wrongAttempts]);`, 'timeSpent');
addPr(
  55,
  58,
  `  const wrongIds = useMemo(
    () =>
      questions
        .filter((q) => (wrongAttempts[q.id] || []).length > 0)
        .map((q) => q.id),
    [questions, wrongAttempts]
  );`,
  'wrongIds'
);
patch(PR, prSplices, 'practice-result.tsx');

console.log('All mobile splices applied.');
