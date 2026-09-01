// Temporary helper: apply the multi-try practice edits to app.html.
// Splices by 1-based inclusive line ranges (from ORIGINAL file) after applying
// the two small whole-file string replacements.
const fs = require('fs');

const APP = 'd:/loksewa-portal/app.html';
const read = (p) => {
  const c = fs.readFileSync(p, 'utf8');
  const arr = c.split(/\r?\n/);
  if (arr[arr.length - 1] === '') arr.pop();
  return arr;
};

let content = fs.readFileSync(APP, 'utf8');
const EOL = content.includes('\r\n') ? '\r\n' : '\n';

// --- Whole-file string replacements (small, unique) -------------------------
const b4a = content;
content = content
  .split('isEvaluated && q.explanation').join('isCorrect && q.explanation')
  .split('isEvaluated && mode === \'practice\'').join('isCorrect && mode === \'practice\'');
if (content === b4a) {
  console.error('ERROR: string replacements did not change anything');
  process.exit(1);
}
console.log('String replacements applied (isEvaluated -> isCorrect for explanation & next button).');

let lines = content.split(EOL);

const regionA = read('d:/loksewa-portal/.tmp_web/region_a.txt');
const regionB = read('d:/loksewa-portal/.tmp_web/region_b.txt');
const regionC = read('d:/loksewa-portal/.tmp_web/region_c.txt');

// Verify boundary markers before splicing (1-based inclusive ranges).
function checkRange(start, end, hint) {
  const first = lines[start - 1];
  const last = lines[end - 1];
  if (first === undefined || last === undefined) {
    console.error(`ERROR: out of range for ${hint}`, { start, end, first, last });
    process.exit(1);
  }
  console.log(`[ok] ${hint} boundary: ${JSON.stringify(first)} ... ${JSON.stringify(last)}`);
}

// Region B: header block (lines 4282-4310)
checkRange(4282, 4310, 'region B header');
// Region C: options grid (lines 4338-4382)
checkRange(4338, 4382, 'region C options grid');
// Region A: three functions (lines 4885-5017)
checkRange(4885, 5017, 'region A functions');

// Apply from bottom to top so earlier line numbers stay valid.
const splice = (start, end, newLines) => {
  lines.splice(start - 1, end - start + 1, ...newLines);
};
splice(4885, 5017, regionA);
splice(4338, 4382, regionC);
splice(4282, 4310, regionB);

const out = lines.join(EOL);
fs.writeFileSync(APP, out, 'utf8');

// ---- Verification ------------------------------------------------------------
console.log('--- verification counts ---');
const check = (label, re) => {
  const n = (out.match(re) || []).length;
  console.log(`${n}\t${label}`);
  return n;
};
check('wrongSelections usages', /wrongSelections/g);
check('KEEP TRYING header', /KEEP TRYING/g);
check('rewardTable (web 100,50,25,10)', /\[100, 50, 25, 10\]/g);
check('-20 penalty', /addXP\(-20,/g);
check('isCorrect && q.explanation', /isCorrect && q\.explanation/g);
check('isCorrect && mode ===', /isCorrect && mode === 'practice'/g);
check('old comment "backward compatibility" (expect 0)', /For backward compatibility/g);
check('old INCORRECT banner (expect 0)', /INCORRECT<\/p>/g);
check('pointer-events-none opacity-80 (locked styles)', /pointer-events-none opacity-80/g);
check('selectAndEvaluatePracticeAnswer defs+uses', /selectAndEvaluatePracticeAnswer/g);