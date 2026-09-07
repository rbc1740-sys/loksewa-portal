/**
 * Sanity check (Node only): reports how many unique questions the bundler will
 * seed into SQLite, mirroring questionParser's signature-based de-duplication.
 * Run from loksewa-mobile:  node scripts/check-question-count.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'src', 'data', 'questions');

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]+/gu, ' ')
    .trim();
}

function flatten(item) {
  if (Array.isArray(item)) return item.flatMap(flatten);
  return item ? [item] : [];
}

const seen = new Set();
let total = 0;
let perFile = [];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const sourceName = file.replace(/\.json$/, '');
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const items = flatten(raw);
  let kept = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    total++;
    const q = normalize(item.question);
    const opts = Object.values(item.options || {})
      .map(normalize)
      .filter(Boolean)
      .sort()
      .join('|');
    const sig = `${q}::${opts}`;
    if (!sig || sig === '::' || seen.has(sig)) continue;
    seen.add(sig);
    kept++;
  }

  perFile.push(`${sourceName}: ${items.length} raw -> ${kept} unique`);
}

console.log(perFile.join('\n'));
console.log(`\nTotal raw: ${total}`);
console.log(`Unique questions to be seeded: ${seen.size}`);
