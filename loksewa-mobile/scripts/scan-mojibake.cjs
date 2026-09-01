// Scan bundled question files for mojibake / weird characters / control chars.
const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'src', 'data', 'questions');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

// Known mojibake patterns from double-encoding at various layers.
const MOJIBAKE_PATTERNS = [
  /Ã[A-Za-z..]/,
  /â€|âˆ|â„|â„¢|â”|â€œ|â€|â€š|â€¦|âˆš|âˆ´|â€°|â€”|â€“|â€™|â€œ|â€?/,
  /Ã§|Ã©|Ã¨|Ã±|Ã¼|Ã¶|Ã¤|Ã³|Ã­|Ã¡|Ã¯|Ã«|Ã¤/,
  /Â[\u0080-\u00FF]/,
  /âˆ'/, // ⁻
];

// Also flag replacement char and control characters
const MISCELLANEOUS = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    continue;
  }
  if (!Array.isArray(data)) continue;
  data.forEach((q, i) => {
    if (!q || typeof q !== 'object') return;
    const s = JSON.stringify(q);
    let hit = null;
    for (const p of MOJIBAKE_PATTERNS) {
      const m = s.match(p);
      if (m) {
        hit = { pattern: p.source, match: m[0] };
        break;
      }
    }
    if (!hit && MISCELLANEOUS.test(s)) {
      hit = { pattern: 'misc/control', match: s.match(MISCELLANEOUS)[0] };
    }
    if (hit) {
      // find context around the match inside question text if present
      const qText = q.question || '';
      console.log(
        JSON.stringify({ file: f + '#' + (i + 1), pattern: hit.pattern, match: hit.match, question: qText.slice(0, 130) })
      );
    }
  });
}
console.log('DONE');