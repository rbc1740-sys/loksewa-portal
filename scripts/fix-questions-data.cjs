/**
 * Fix content bugs in the question bank:
 *  1. Incomplete "match the following" questions (missing Group A/B lists).
 *  2. Truncated "Ninth Schedule - ..." item in a constitution match question.
 *  3. Invalid answer key ("e") in concrete_technology "Quality control means".
 *
 * Run from repo root:  node scripts/fix-questions-data.cjs
 */
const fs = require('fs');
const path = require('path');

function patch(file, pairs, description) {
  const abs = path.resolve(__dirname, '..', 'questions', file);
  let content = fs.readFileSync(abs, 'utf8');
  let changed = 0;
  const skipped = [];
  for (const { from, to } of pairs) {
    if (content.includes(to)) {
      skipped.push(from.slice(0, 60));
      continue; // already applied
    }
    const idx = content.indexOf(from);
    if (idx === -1) {
      throw new Error(`NOT FOUND in ${file}: ${from.slice(0, 80)}`);
    }
    const idx2 = content.indexOf(from, idx + 1);
    if (idx2 !== -1) {
      throw new Error(`AMBIGUOUS (found twice) in ${file}: ${from.slice(0, 80)}`);
    }
    content = content.slice(0, idx) + to + content.slice(idx + from.length);
    changed++;
  }
  if (changed) fs.writeFileSync(abs, content, 'utf8');
  console.log(`[ok] ${file}: ${description} (${changed} applied, ${skipped.length} already-patched)`);
}

// 1. Civil Service Act — match question missing the actual lists.
patch(
  'civil_service_act_and_regulation.json',
  [
    {
      from:
        '"Match the following as per the provision of Civil Service Act, 2049 (reservation incorporated in the second amendment)."',
      to:
        '"Match the following as per the provision of Civil Service Act, 2049 (reservation incorporated in the second amendment).\\nGroup A: a. Backward region, b. Disabled, c. Dalits, d. Madhesi | Group B: 1. 9.0%, 2. 4.0%, 3. 22.0%, 4. 5.0%"',
    },
  ],
  'added Group A/B lists to match-the-following question'
);

// 2a. Constitution — Article-based match question missing the lists.
patch(
  'constitution_of_nepal.json',
  [
    {
      from: '"Match the following and choose the correct answer."',
      to:
        '"Match the following and choose the correct answer.\\nGroup A: a. Article 56, b. Article 58, c. Article 60, d. Article 61 | Group B: 1. Structure of state, 2. Distribution of sources of revenue, 3. President, 4. Residual Power"',
    },
  ],
  'added Group A/B lists to Article match question'
);

// 2b. Constitution — truncated "Ninth Schedule - ..."; complete item 4 and fix item 1.
patch(
  'constitution_of_nepal.json',
  [
    {
      from:
        '"Which of the following pair(s) is/are correctly matched?\\n1. Seventh schedule - concurrent powers of Federation, Province and local level\\n2. Fifth schedule - Federal list\\n3. Sixth Schedule - Province List\\n4. Ninth Schedule - ..."',
      to:
        '"Which of the following pair(s) is/are correctly matched?\\n1. Seventh schedule - concurrent powers of Federation and Province \\n2. Fifth schedule - Federal list\\n3. Sixth Schedule - Province List\\n4. Ninth Schedule - concurrent powers of Federation, Province and Local Level"',
    },
  ],
  'completed truncated Ninth Schedule item (kept answer d="all of above")'
);

// 3. Concrete technology — "Quality control means" has answer "e" but only options a–d.
patch(
  'concrete_technology.json',
  [
    {
      from: '"Per the answer key mapping in the text, option e is correct."',
      to:
        '"Quality control in construction means the rational use of available materials, manpower, equipment and resources so that the finished work conforms to the specified quality standards without wasting resources."',
    },
  ],
  'rewrote bogus explanation for "Quality control means"'
);

// Fix the answer key itself (e -> b) with a dedicated patch
{
  const abs = path.resolve(__dirname, '..', 'questions', 'concrete_technology.json');
  let content = fs.readFileSync(abs, 'utf8');
  const needle =
    '"question":  "Quality control means",' +
    '\r\n        "topic":  "Concrete Technology",' +
    '\r\n        "options":  {' +
    '\r\n                        "a":  "extra cost",' +
    '\r\n                        "b":  "a rational use of available resources",' +
    '\r\n                        "c":  "adequate design to minimize cost",' +
    '\r\n                        "d":  "all of the above"' +
    '\r\n                    },' +
    '\r\n        "answer":  "e",';
  const idx = content.indexOf(needle);
  if (idx === -1) {
    const already =
      '"question":  "Quality control means",' +
      '\r\n        "topic":  "Concrete Technology",' +
      '\r\n        "options":  {' +
      '\r\n                        "a":  "extra cost",' +
      '\r\n                        "b":  "a rational use of available resources",' +
      '\r\n                        "c":  "adequate design to minimize cost",' +
      '\r\n                        "d":  "all of the above"' +
      '\r\n                    },' +
      '\r\n        "answer":  "b",';
    if (content.includes(already)) {
      console.log('[ok] concrete_technology.json: answer key already fixed to "b"');
    } else {
      throw new Error('NOT FOUND: Quality control means answer block');
    }
  } else {
  content =
    content.slice(0, idx) +
    needle.replace('\r\n        "answer":  "e",', '\r\n        "answer":  "b",') +
    content.slice(idx + needle.length);
  fs.writeFileSync(abs, content, 'utf8');
  console.log('[ok] concrete_technology.json: answer key fixed e -> b for "Quality control means"');
  }
}

// Sanity: all edited files must still parse as valid JSON and every answer key must exist.
for (const file of ['civil_service_act_and_regulation.json', 'constitution_of_nepal.json', 'concrete_technology.json']) {
  const abs = path.resolve(__dirname, '..', 'questions', file);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  for (let i = 0; i < data.length; i++) {
    const q = data[i];
    if (!q.answer) continue;
    const keys = Object.keys(q.options || {});
    const ak = String(q.answer).trim().toLowerCase().split(' ')[0];
    if (keys.length && !keys.map((k) => k.toLowerCase()).includes(ak)) {
      throw new Error(`BAD ANSWER KEY ${file} #${i + 1}: "${q.answer}" not in [${keys.join(',')}]`);
    }
  }
  console.log(`[ok] ${file}: JSON parses and all answers reference existing options`);
}
console.log('DONE');