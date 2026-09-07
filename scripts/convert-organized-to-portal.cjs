/**
 * Converts the mobile app's organized question bank
 * (loksewa-mobile/organized/) into the web portal's question JSON format.
 *
 * Source format (per chapter/exam file):
 *   { category, subject, chapter, question_count,
 *     questions: [{ id, question, options: ["a) ...", ...], correct_option_index, svg }] }
 *
 * Target format (flat array, one object per question):
 *   [{ question, topic, options: {a,b,c,d}, answer: "c", explanation: "", qn, chapter }]
 *
 * Key rules:
 *  - Option letters are parsed FROM the option string prefix ("a) ", "b.", "(c)") —
 *    never from array position (observed shuffled arrays in mock data).
 *  - answer = prefix letter of options[correct_option_index].
 *  - Questions with an inline `svg` figure are SKIPPED (not renderable in the
 *    portal) and counted in the report.
 *  - Duplicate questions (same normalized question+options signature, matching
 *    the app's core-logic dedup) are skipped against the existing bank and
 *    within the import itself.
 *
 * Usage (from repo root):
 *   node scripts/convert-organized-to-portal.cjs
 *
 * Outputs:
 *   - Merged/new files under questions/
 *   - mocks/<exam>.json          (one flat array per exam paper)
 *   - mock-tests.json            (index for the Mock Tests tab)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORG = path.join(ROOT, 'loksewa-mobile', 'organized');
const QUESTIONS_DIR = path.join(ROOT, 'questions');
const MOCKS_DIR = path.join(ROOT, 'mocks');
const MANIFEST = path.join(ROOT, 'manifest.json');

// ---------------------------------------------------------------------------
// Subject-folder code -> target questions file (without .json) + topic name
// (topic name is used only when the target file does not exist yet; existing
// files keep their own topic, taken from their most frequent topic value).
// Codes are the numeric prefixes of the organized/ subject folders.
// ---------------------------------------------------------------------------
const CODE_MAP = {
  // Surveying (Basic 001, Advance 014, Engineering Survey 074)
  '001': ['surveying', null],
  '014': ['surveying', null],
  '074': ['surveying', null],
  '084': ['surveying', null],
  // Construction Materials (075, 085)
  '075': ['construction_materials', null],
  '085': ['construction_materials', null],
  // Mechanics of materials and structures (003, 016) — NEW
  '003': ['mechanics_of_materials_and_structures', 'Mechanics of Materials & Structures'],
  '016': ['mechanics_of_materials_and_structures', 'Mechanics of Materials & Structures'],
  // Hydraulics (004, 017) — NEW
  '004': ['hydraulics', 'Hydraulics'],
  '017': ['hydraulics', 'Hydraulics'],
  // Soil Mechanics -> Geotechnical (005, 018)
  '005': ['geotechnical', null],
  '018': ['geotechnical', null],
  // Structural Design -> Structural Engineering (006, 019)
  '006': ['structural_engineering', null],
  '019': ['structural_engineering', null],
  // Building construction technology (007, 020) — NEW
  '007': ['building_construction_technology', 'Building Construction Technology'],
  '020': ['building_construction_technology', 'Building Construction Technology'],
  // Water supply and sanitation (008, 021) — NEW
  '008': ['water_supply_and_sanitation_engineering', 'Water Supply & Sanitation Engineering'],
  '021': ['water_supply_and_sanitation_engineering', 'Water Supply & Sanitation Engineering'],
  // Irrigation (009, 022) — NEW
  '009': ['irrigation_engineering', 'Irrigation Engineering'],
  '022': ['irrigation_engineering', 'Irrigation Engineering'],
  // Highway (010, 023) — NEW
  '010': ['highway_engineering', 'Highway Engineering'],
  '023': ['highway_engineering', 'Highway Engineering'],
  // Estimating and costing -> Estimation (079, 089)
  '079': ['estimation', null],
  '089': ['estimation', null],
  // Construction Management incl. "Contruction" typo (012, 025, 078, 088)
  '012': ['construction_management', null],
  '025': ['construction_management', null],
  '078': ['construction_management', null],
  '088': ['construction_management', null],
  // Airport (013, 026) — NEW
  '013': ['airport_engineering', 'Airport Engineering'],
  '026': ['airport_engineering', 'Airport Engineering'],
  // Drawing (065)
  '065': ['engineering_drawing', null],
  // General Information and Legislation (067) — NEW
  '067': ['general_information_and_legislation', 'General Information & Legislation'],
  // Engineering Economics (081, 091)
  '081': ['engineering_economics', null],
  '091': ['engineering_economics', null],
  // Gk subjects
  '027': ['geography_of_nepal', null],
  '028': ['modern_history_of_nepal', null],
  '029': ['economic_aspects_of_nepal', null],
  '030': ['sustainable_development_science_and_technology', null],
  '031': ['sustainable_development_science_and_technology', null],
  '032': ['public_health_nutrition', 'Public Health, Disease & Nutrition'],
  '033': ['constitution_of_nepal', null],
  '034': ['uno_saarc_and_bimstec', null],
  '035': ['uno_saarc_and_bimstec', null],
  '053': ['current_affairs', null],
  // IQ subjects -> one new topic
  '043': ['iq_reasoning', 'IQ & Reasoning'],
  '044': ['iq_reasoning', 'IQ & Reasoning'],
  '045': ['iq_reasoning', 'IQ & Reasoning'],
  '046': ['iq_reasoning', 'IQ & Reasoning'],
  '047': ['iq_reasoning', 'IQ & Reasoning'],
  '048': ['iq_reasoning', 'IQ & Reasoning'],
  '049': ['iq_reasoning', 'IQ & Reasoning'],
  '050': ['iq_reasoning', 'IQ & Reasoning'],
  '051': ['iq_reasoning', 'IQ & Reasoning'],
  '052': ['iq_reasoning', 'IQ & Reasoning'],
  // PM subjects
  '055': ['office_management', 'Office Management'],
  '056': ['civil_service_act_and_regulation', null],
  '057': ['federal_affairs_and_general_administration', 'Federal Affairs & General Administration'],
  '058': ['governance_system_and_government', null],
  '059': ['government_budgeting_and_accounting', null],
  '060': ['functional_scope_of_public_services', null],
  '061': ['human_rights_good_governance', 'Human Rights, Good Governance & RTI'],
  '062': ['public_service_charter', null],
  '063': ['fundamentals_of_management', null],
  '064': ['human_values_and_civic_duties', 'Human Values & Civic Duties'],
};

// ---------------------------------------------------------------------------
// Normalization + signature (mirrors app.html / core-logic.js dedup logic)
// ---------------------------------------------------------------------------
function normalizeText(value) {
  return String(value == null ? '' : value)
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForComparison(value) {
  return normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]+/gu, ' ')
    .trim();
}

function getQuestionSignature(q) {
  const nq = normalizeForComparison(q.question);
  const no = Object.entries(q.options || {})
    .map(([, v]) => normalizeForComparison(v))
    .filter(Boolean)
    .sort()
    .join('|');
  if (!nq && !no) return '';
  return nq + '::' + no;
}

// ---------------------------------------------------------------------------
// Option / answer parsing
// ---------------------------------------------------------------------------
const OPT_PREFIX_RE = /^\(?\s*([a-dA-D])\s*[\)\.\:]\s*([\s\S]+)$/;

function parseOptions(rawOptions) {
  const map = {};
  const lettersInOrder = [];
  for (const raw of rawOptions) {
    const text = normalizeText(raw);
    const m = OPT_PREFIX_RE.exec(text);
    if (m) {
      const letter = m[1].toLowerCase();
      map[letter] = normalizeText(m[2]);
      lettersInOrder.push(letter);
    } else {
      // No letter prefix — fall back to positional letter (flagged later if shuffled)
      const letter = 'abcd'[Object.keys(map).length];
      if (!letter) return { map: null, lettersInOrder: [] };
      map[letter] = text;
      lettersInOrder.push(letter);
    }
  }
  const letters = Object.keys(map);
  if (letters.length < 2 || letters.length > 4) return { map: null, lettersInOrder: [] };
  for (const l of letters) if (!map[l]) return { map: null, lettersInOrder: [] };
  return { map, lettersInOrder };
}

function convertQuestion(raw, topic, chapterName, stats) {
  if (!raw || typeof raw !== 'object') {
    stats.invalid++;
    return null;
  }
  if (raw.svg != null) {
    stats.svg++;
    return null;
  }

  const rawOptions = Array.isArray(raw.options) ? raw.options : null;
  if (!rawOptions) {
    stats.invalid++;
    return null;
  }

  const { map, lettersInOrder } = parseOptions(rawOptions);
  if (!map) {
    stats.invalid++;
    return null;
  }

  const idx = raw.correct_option_index;
  if (typeof idx !== 'number' || idx < 0 || idx >= rawOptions.length) {
    stats.invalid++;
    return null;
  }

  // Extract the answer letter from the prefix of the chosen option string
  const chosenText = normalizeText(rawOptions[idx]);
  const m = OPT_PREFIX_RE.exec(chosenText);
  const answer = m ? m[1].toLowerCase() : 'abcd'[idx];
  if (!Object.prototype.hasOwnProperty.call(map, answer)) {
    stats.invalid++;
    return null;
  }

  // Detect shuffled arrays: prefix letter differs from positional expectation
  if (lettersInOrder[idx] !== 'abcd'[idx]) stats.shuffled++;

  const questionText = normalizeText(raw.question);
  if (!questionText) {
    stats.invalid++;
    return null;
  }

  return {
    question: questionText,
    topic,
    options: map,
    answer,
    explanation: '',
    qn: String(raw.id != null ? raw.id : ''),
    chapter: chapterName || '',
  };
}

// ---------------------------------------------------------------------------
// Existing bank: signatures + per-file dominant topic
// ---------------------------------------------------------------------------
function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function loadExistingBank() {
  const bank = new Map(); // baseName -> { questions, topic }
  const signatures = new Set();
  const manifest = readJsonSafe(MANIFEST);
  const files = Array.isArray(manifest) ? manifest : [];
  for (const rel of files) {
    const data = readJsonSafe(path.join(ROOT, rel));
    if (!Array.isArray(data)) continue;
    const topicCount = new Map();
    for (const q of data) {
      const sig = getQuestionSignature(q);
      if (sig) signatures.add(sig);
      if (q && q.topic) topicCount.set(q.topic, (topicCount.get(q.topic) || 0) + 1);
    }
    let topic = null;
    let best = 0;
    topicCount.forEach((n, t) => {
      if (n > best) {
        best = n;
        topic = t;
      }
    });
    bank.set(path.basename(rel, '.json'), { questions: data, topic });
  }
  return { bank, signatures };
}

// ---------------------------------------------------------------------------
// Main bank conversion
// ---------------------------------------------------------------------------
function subjectCode(folder) {
  const m = /(\d{3})_/.exec(folder || '');
  return m ? m[1] : null;
}

function convertMainBank(index, existing) {
  const perFile = new Map(); // outBase -> bucket
  const report = [];

  const mainBank = (index && index.main_bank) || {};
  for (const category of Object.keys(mainBank)) {
    const subjects = mainBank[category] || {};
    for (const subjectName of Object.keys(subjects)) {
      const subj = subjects[subjectName] || {};
      const code = subjectCode(subj.folder || '');
      const target = CODE_MAP[code];
      if (!target) {
        report.push(
          `[WARN] Unmapped subject code ${code}: ${category} / ${subjectName} (${subj.folder}) — SKIPPED`
        );
        continue;
      }
      const [outBase, defaultTopic] = target;
      const existingEntry = existing.bank.get(outBase);
      const topic = (existingEntry && existingEntry.topic) || defaultTopic || subjectName;

      if (!perFile.has(outBase)) {
        perFile.set(outBase, {
          topic,
          questions: existingEntry ? existingEntry.questions.slice() : [],
          added: 0,
          dup: 0,
          invalid: 0,
          svg: 0,
          shuffled: 0,
          expected: 0,
          categories: new Set(),
        });
      }
      const bucket = perFile.get(outBase);
      bucket.categories.add(category);

      for (const ch of subj.chapters || []) {
        const data = readJsonSafe(path.join(ORG, ch.file));
        if (!data || !Array.isArray(data.questions)) {
          report.push(`[WARN] Could not read chapter file: ${ch.file}`);
          continue;
        }
        bucket.expected += data.questions.length;
        for (const raw of data.questions) {
          const converted = convertQuestion(raw, topic, ch.chapter, bucket);
          if (!converted) continue;
          const sig = getQuestionSignature(converted);
          if (sig && existing.signatures.has(sig)) {
            bucket.dup++;
            continue;
          }
          if (sig) existing.signatures.add(sig); // dedups within the import too
          bucket.questions.push(converted);
          bucket.added++;
        }
      }
    }
  }
  return { perFile, report };
}

// ---------------------------------------------------------------------------
// Mock tests + weekly mocks
// ---------------------------------------------------------------------------
function asciiSlug(name) {
  return (
    String(name)
      .replace(/\.[^.]+$/, '')
      .split('')
      .filter(c => c.charCodeAt(0) < 128)
      .join('')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'exam'
  );
}

function convertExams(entries, province) {
  if (!fs.existsSync(MOCKS_DIR)) fs.mkdirSync(MOCKS_DIR, { recursive: true });
  const usedSlugs = new Set(fs.readdirSync(MOCKS_DIR).filter(f => f.endsWith('.json')));
  const outIndex = [];
  const stats = { added: 0, dup: 0, invalid: 0, svg: 0, shuffled: 0, files: 0 };

  for (const entry of entries || []) {
    const data = readJsonSafe(path.join(ORG, entry.file));
    if (!data || !Array.isArray(data.questions)) {
      console.warn(`[WARN] Could not read exam file: ${entry.file}`);
      continue;
    }
    const title = entry.exam || data.exam_title || path.basename(entry.file, '.json');
    let slug = asciiSlug(entry.file.split('/').pop());
    while (usedSlugs.has(slug + '.json')) slug += '_x';
    usedSlugs.add(slug + '.json');

    // NOTE: exam papers are fixed sets — questions are NOT deduped against the
    // practice bank (overlap is expected); only unrenderable ones are skipped.
    const questions = [];
    for (const raw of data.questions) {
      const converted = convertQuestion(raw, title, '', stats);
      if (!converted) continue;
      questions.push(converted);
      stats.added++;
    }

    const outRel = 'mocks/' + slug + '.json';
    fs.writeFileSync(path.join(ROOT, outRel), JSON.stringify(questions, null, 2) + '\n', 'utf8');
    stats.files++;
    outIndex.push({
      id: slug,
      title: normalizeText(title),
      province: normalizeText(province || ''),
      file: outRel,
      count: questions.length,
      expected: data.questions.length,
    });
  }
  return { outIndex, stats };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function main() {
  const index = readJsonSafe(path.join(ORG, '_INDEX.json'));
  if (!index) {
    console.error('FATAL: cannot read _INDEX.json at ' + ORG);
    process.exit(1);
  }
  const existing = loadExistingBank();
  console.log(
    `Existing bank: ${existing.bank.size} files, ${existing.signatures.size} signatures\n`
  );

  const { perFile, report } = convertMainBank(index, existing);
  report.forEach(r => console.log(r));

  console.log('=== MAIN BANK CONVERSION ===');
  const newQuestionFiles = [];
  let totals = { added: 0, dup: 0, invalid: 0, svg: 0, shuffled: 0 };
  for (const [outBase, bucket] of [...perFile.entries()].sort()) {
    const outRel = `questions/${outBase}.json`;
    const existed = existing.bank.has(outBase);
    fs.writeFileSync(
      path.join(ROOT, outRel),
      JSON.stringify(bucket.questions, null, 2) + '\n',
      'utf8'
    );
    if (!existed) newQuestionFiles.push(outRel);
    totals.added += bucket.added;
    totals.dup += bucket.dup;
    totals.invalid += bucket.invalid;
    totals.svg += bucket.svg;
    totals.shuffled += bucket.shuffled;
    console.log(
      `${existed ? 'MERGE' : 'NEW  '} ${outRel}  topic="${bucket.topic}"  ` +
        `total=${bucket.questions.length} added=${bucket.added} dup=${bucket.dup} ` +
        `invalid=${bucket.invalid} svg=${bucket.svg} shuffled=${bucket.shuffled} ` +
        `src=${[...bucket.categories].join('+')}`
    );
  }
  console.log(
    `MAIN BANK TOTALS: added=${totals.added} dup=${totals.dup} invalid=${totals.invalid} svg=${totals.svg} shuffled=${totals.shuffled}`
  );

  console.log('\n=== MOCK EXAMS ===');
  // Start exams from a clean slate so re-runs keep stable slugs (no _x drift)
  fs.rmSync(MOCKS_DIR, { recursive: true, force: true });
  const mockGroups = [];
  let mockTotals = { added: 0, dup: 0, invalid: 0, svg: 0, shuffled: 0 };
  const convertGroup = (entries, province) => {
    const { outIndex, stats } = convertExams(entries, province);
    Object.keys(mockTotals).forEach(k => {
      mockTotals[k] += stats[k] || 0;
    });
    return outIndex;
  };
  for (const [group, entries] of Object.entries(index.mock_tests || {})) {
    const outIndex = convertGroup(entries, group.trim());
    mockGroups.push({ group: group.trim(), exams: outIndex });
    console.log(`Group "${group.trim()}": ${outIndex.length} exams`);
  }
  const weeklyIndex = convertGroup(index.weekly_mocks || [], 'Weekly Mock');
  console.log(`Weekly mocks: ${weeklyIndex.length} exams`);

  fs.writeFileSync(
    path.join(ROOT, 'mock-tests.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), groups: mockGroups, weekly: weeklyIndex },
      null,
      2
    ) + '\n',
    'utf8'
  );
  console.log(
    `Wrote mock-tests.json | MOCK TOTALS: added=${mockTotals.added} dup=${mockTotals.dup} ` +
      `invalid=${mockTotals.invalid} svg=${mockTotals.svg} shuffled=${mockTotals.shuffled}`
  );

  console.log('\n=== NEW QUESTION FILES (add to manifest.json) ===');
  newQuestionFiles.forEach(f => console.log('  ' + f));
  console.log('DONE');
}

main();
