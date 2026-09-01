/**
 * One-off: add the missing explanation to the Modern History "Nepal Prajaparishad"
 * question and fix its factually wrong option (1990 B.S. -> 1993 B.S.).
 */
const fs = require('fs');
const path = require('path');

const abs = path.resolve(__dirname, '..', 'questions', 'modern_history_of_nepal.json');
let content = fs.readFileSync(abs, 'utf8');

const pairs = [
  { from: '"b":  "1990 B.S."', to: '"b":  "1993 B.S."' },
  {
    from: '"explanation":  ""',
    to:
      '"explanation":  "The Nepal Prajaparishad (Praja Parishad), regarded as the first political party of Nepal, was founded on 2 June 1936 AD (= Jestha 1993 B.S.) by Dashrath Chand and Tanka Prasad Acharya."',
  },
];

let changed = 0;
for (const { from, to } of pairs) {
  const idx = content.indexOf(from);
  if (idx === -1) {
    if (content.includes(to)) {
      console.log('[ok] already fixed: ' + from.slice(0, 60));
      continue;
    }
    throw new Error('NOT FOUND in modern_history_of_nepal.json: ' + from.slice(0, 80));
  }
  content = content.slice(0, idx) + to + content.slice(idx + from.length);
  changed++;
}

fs.writeFileSync(abs, content, 'utf8');
console.log('[ok] modern_history_of_nepal.json: applied ' + changed + ' replacement(s)');

// quick verification parse
JSON.parse(content);
console.log('[ok] modern_history_of_nepal.json still valid JSON');