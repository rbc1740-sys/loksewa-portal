/**
 * Generates `question-bank.json` — the mobile app's remote bank manifest.
 *
 * Format:
 *   {
 *     "files": [
 *       { "path": "questions/xxx.json", "sha256": "<hex>" },
 *       ...
 *     ]
 *   }
 *
 * The web app keeps using `manifest.json` (plain array of paths, unchanged); the
 * mobile app (src/services/questionBankSync.ts + checkForQuestionUpdates) reads
 * THIS file so it can detect same-path content edits (e.g. an answer change) by
 * comparing per-file SHA-256 hashes.
 *
 * Regenerate whenever `questions/*.json` changes:
 *   node scripts/generate-question-bank-manifest.js
 * CI also runs this right before publishing to GitHub Pages, so deployed
 * manifests are always fresh even if the generated file was not committed.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const QUESTIONS_DIR = join(ROOT, 'questions');
const OUT_FILE = join(ROOT, 'question-bank.json');

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

const files = readdirSync(QUESTIONS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => {
    const path = `questions/${f}`;
    return { path, sha256: sha256File(join(QUESTIONS_DIR, f)) };
  });

const manifest = { files };
writeFileSync(OUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[bank-manifest] Wrote ${OUT_FILE} with ${files.length} question files`);
