/**
 * Fix mojibake (double-encoded UTF-8/CP1252) symbols in the question bank.
 * Only structural_engineering.json is affected — the source file currently
 * contains one-level CP1252-mangled Unicode (e.g. "\u00C2\u00B2" for "²").
 *
 * Run from repo root:  node scripts/fix-question-mojibake.cjs
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'questions', 'structural_engineering.json');

// map: mangled char sequence -> intended unicode char, written with escapes so
// this file itself is never corrupted by any console/transfer encoding.
const REPLACEMENTS = [
  // "Â²" -> ² (superscript two)
  { from: '\u00C2\u00B2', to: '\u00B2' },
  // "Â³" -> ³ (superscript three)
  { from: '\u00C2\u00B3', to: '\u00B3' },
  // "Â°" -> ° (degree)
  { from: '\u00C2\u00B0', to: '\u00B0' },
  // "Â½" -> ½ (one half)
  { from: '\u00C2\u00BD', to: '\u00BD' },
  // "Ã—" -> × (multiplication sign)
  { from: '\u00C3\u2014', to: '\u00D7' },
  // "âˆš" -> √ (square root)
  { from: '\u00E2\u02C6\u0161', to: '\u221A' },
  // "â´" -> ⁴ (superscript four)
  { from: '\u00E2\u0081\u00B4', to: '\u2074' },
  // "Î¸" -> θ (theta)
  { from: '\u00CE\u00B8', to: '\u03B8' },
  // "Î£" -> Σ (capital sigma)
  { from: '\u00CE\u00A3', to: '\u03A3' },
  // "Îµ" -> ε (epsilon)
  { from: '\u00CE\u00B5', to: '\u03B5' },
  // "Î±" -> α (alpha)
  { from: '\u00CE\u00B1', to: '\u03B1' },
  // "Î"" -> Δ (capital delta)
  { from: '\u00CE\u201D', to: '\u0394' },
  // "Ï€" -> π (pi)
  { from: '\u00CF\u20AC', to: '\u03C0' },
  // "Ïƒ" -> σ (sigma)
  { from: '\u00CF\u0192', to: '\u03C3' },
  // "Ï„" -> τ (tau)
  { from: '\u00CF\u201E', to: '\u03C4' },
];

function hex(ch) {
  return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}

let content = fs.readFileSync(FILE, 'utf8');
const original = content;
const stats = new Map();

for (const { from, to } of REPLACEMENTS.sort((a, b) => b.from.length - a.from.length)) {
  const count = content.split(from).length - 1;
  if (count > 0) {
    stats.set(`${hex(from[0])}..` + [...from].map(c => hex(c)).join(''), count);
    content = content.split(from).join(to);
  }
}

if (content === original) {
  console.log('No mojibake sequences found — nothing changed.');
  return;
}

fs.writeFileSync(FILE, content, 'utf8');
console.log('Wrote ' + FILE);
console.log('Total replacements: ' + [...stats.values()].reduce((a, b) => a + b, 0));
for (const [key, count] of stats) console.log('  ' + key + ' x' + count);
