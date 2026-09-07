// Diagnostic script: scan all bundled question JSON files for problems.
const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'src', 'data', 'questions');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const issues = [];
let total = 0;

const MQ = /match\s*the\s*follow/i;

for (const f of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch (e) {
    issues.push({ file: f, issue: 'JSON PARSE ERROR: ' + e.message });
    continue;
  }
  if (!Array.isArray(data)) {
    issues.push({ file: f, issue: 'Not an array, type=' + typeof data });
    continue;
  }
  total += data.length;
  data.forEach((q, i) => {
    const loc = f + ' #' + (i + 1);
    if (!q || typeof q !== 'object') {
      issues.push({ file: loc, issue: 'null/non-object question' });
      return;
    }
    const question = (q.question || '').trim();
    if (!question) {
      issues.push({ file: loc, issue: 'MISSING question text' });
    }
    const opts = q.options || {};
    const optKeys = Object.keys(opts);
    if (optKeys.length === 0) {
      issues.push({ file: loc, issue: 'MISSING/empty options :: ' + question.slice(0, 90) });
    } else if (optKeys.length < 2) {
      issues.push({ file: loc, issue: 'only ' + optKeys.length + ' option(s) :: ' + question.slice(0, 90) });
    }
    Object.entries(opts).forEach(([k, v]) => {
      if (v === null || v === undefined || String(v).trim() === '') {
        issues.push({ file: loc, issue: 'EMPTY option value for key "' + k + '" :: ' + question.slice(0, 90) });
      }
    });
    if (!q.answer || typeof q.answer !== 'string' || !q.answer.trim()) {
      issues.push({ file: loc, issue: 'MISSING answer :: ' + question.slice(0, 90) });
      // skip key check when answer is missing
    } else {
      const answerKey = q.answer.trim().toLowerCase().split(' ')[0];
      if (optKeys.length && !optKeys.map((x) => x.toLowerCase()).includes(answerKey)) {
        issues.push({
          file: loc,
          issue: 'ANSWER KEY "' + q.answer + '" NOT in options [' + optKeys.join(',') + '] :: ' + question.slice(0, 90),
        });
      }
    }
    if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
      issues.push({ file: loc, issue: 'MISSING explanation :: ' + question.slice(0, 80) });
    }

    // Detect match-the-following questions rendered as MCQ and flag possible truncation
    if (MQ.test(question)) {
      const hasListData = !!(q.match_lists || q.list_i || q.list_ii);
      const hasInlineGroups = /Group\s*A:/i.test(question) && /Group\s*B:/i.test(question);
      const trailing = /(?:\.\.\.|…|\s*$)$/.test(question);
      const lineBreak = /[\n\r]/.test(question);
      if (!hasListData && !hasInlineGroups && (trailing || lineBreak)) {
        issues.push({ file: loc, issue: 'MATCH Qn without list data (possible truncation) :: ' + question.slice(0, 160) });
      }
      if (/\.\.\.|…/.test(question) && !hasInlineGroups) {
        issues.push({ file: loc, issue: 'MATCH Qn contains literal ellipsis "..." :: ' + question.slice(0, 160) });
      }
    }

    // Flag likely mojibake / encoding garbage characters
    if (/[\uFFFD]|Ã|Â[^\u00B0-Â³]/.test(JSON.stringify(q))) {
      const bad = JSON.stringify(q);
      issues.push({ file: loc, issue: 'MOJIBAKE detected :: ' + question.slice(0, 100) });
    }
  });
}

console.log('Total files:', files.length, 'Total questions:', total, 'Total issues:', issues.length);
console.log('---');
issues.forEach((x) => console.log(x.file + ' => ' + x.issue));