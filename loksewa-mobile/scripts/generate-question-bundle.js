/**
 * One-off generator: copies ../questions/*.json into src/data/questions and
 * emits an index.ts that statically requires each file so Metro bundles them.
 * Run from loksewa-mobile:  node scripts/generate-question-bundle.js
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', '..', 'questions');
const outDir = path.resolve(__dirname, '..', 'src', 'data', 'questions');

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const lines = [
  '// AUTO-GENERATED from the repository questions/ directory - do not edit by hand.',
  '// Regenerate with: node scripts/generate-question-bundle.js',
  '',
];

const entries = [];
files.forEach((file, i) => {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
  const key = file.replace(/\.json$/, '');
  entries.push({ key, file, symbol: `q${i}` });
});

// ESM imports (not require) so this module works under Metro *and* Node/vitest.
for (const e of entries) {
  lines.push(`import ${e.symbol} from './${e.file}';`);
}

lines.push('', 'export const BUNDLED_QUESTION_FILES: Record<string, unknown> = {');
for (const e of entries) {
  lines.push(`  ${JSON.stringify(e.key)}: ${e.symbol},`);
}
lines.push('};', '');
lines.push('export type BundledQuestionFile = keyof typeof BUNDLED_QUESTION_FILES;');

fs.writeFileSync(path.join(outDir, 'index.ts'), lines.join('\n') + '\n');
console.log(`Copied ${files.length} question files and wrote index.ts`);
