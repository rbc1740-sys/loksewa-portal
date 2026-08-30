/**
 * Question Bank Parser & Initial Sync
 * Ports logic from web app's core-logic.js and app.html loadState()
 */

import { BUNDLED_QUESTION_FILES } from '../data/questions';
import { sha256Hex } from '../utils/hash';
import { REMOTE_BANK_MANIFEST_NAME } from '../constants/remoteConfig';

// Question structure from JSON files
interface RawQuestion {
  qn?: string;
  topic?: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation?: string;
  id?: string;
  qnNumber?: string;
  questionId?: string;
}

// Normalization functions (ported from core-logic.js)
function normalizeText(value: string): string {
  if (typeof value !== 'string') return value;
  
  const replacements: Record<string, string> = {
    'ÃŽÂµ': 'Îµ',
    'ÃŽÂ²': 'Â²',
    'ÃŽÂ³': 'Â³',
    'ÃŽâ€': 'Î”',
    'Ã‚Â°C': 'Â°C',
    'Ãƒâ€”': 'Ã—',
    'Ã¢â‚¬Â°': 'Â°',
    'Ã¢â‚¬â€œ': 'â€“',
    'Ã¢â‚¬â€': 'â€”',
    'Ã¢â‚¬Ëœ': 'â€˜',
    'Ã¢â‚¬â„¢': 'â€™',
    'Ã¢â‚¬Å“': 'â€œ',
    'Ã¢â‚¬ ': 'â€',
    'Ã¢â‚¬Â¢': 'â€¢',
    'Ã¢Ë†Å¡': 'âˆš',
    'Ã¢ Â´': 'â´',
    'ÃŽÂ¸': 'Î¸',
    'ÃŽÂ£': 'Î£',
    'ÃŽÂ¼': 'Î¼',
    'ÃŽÂ±': 'Î±',
    'ÃŽÂ·': 'Î·',
    'ÃŽÂ»': 'Î»',
    'ÃŽÂ´': 'Î´',
    'ÃŽÂº': 'Îº',
    'ÃŽÂ¾': 'Î¾',
    'ÃŽÂ¶': 'Î¶',
    'Ãâ€°': 'Ï‰',
    'Ã ': 'Ï',
    'Ãâ‚¬': 'Ï€',
    'Ãâ€ž': 'Ï„',
    'ÃÆ’': 'Ïƒ',
  };
  
  let text = value;
  Object.entries(replacements).forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text;
}

function normalizeQuestionData(question: RawQuestion): RawQuestion {
  if (!question || typeof question !== 'object') return question;
  
  const normalized: RawQuestion = { ...question };
  
  Object.entries(question).forEach(([key, value]) => {
    // Prototype pollution guard
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    if (typeof value === 'string') {
      (normalized as unknown as Record<string, string>)[key] = normalizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      (normalized as unknown as Record<string, unknown>)[key] = normalizeQuestionData(value as DedupItem);
    }
  });
  
  return normalized;
}

function normalizeForComparison(value: string): string {
  return normalizeText(String(value || ''))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]+/gu, ' ')
    .trim();
}

function getQuestionSignature(question: RawQuestion): string {
  const normalizedQuestion = normalizeForComparison(question?.question);
  const normalizedOptions = Object.entries(question?.options || {})
    .map(([key, value]) => normalizeForComparison(value))
    .filter(Boolean)
    .sort()
    .join('|');
  
  if (!normalizedQuestion && !normalizedOptions) return '';
  return `${normalizedQuestion}::${normalizedOptions}`;
}

function flattenQuestionItems(items: RawQuestion | RawQuestion[]): RawQuestion[] {
  if (!Array.isArray(items)) return items ? [items] : [];
  return items.flatMap(item => flattenQuestionItems(item));
}

function deduplicateQuestions(items: DedupItem[]): DedupItem[] {
  const seen = new Set<string>();
  const uniqueItems: DedupItem[] = [];
  
  flattenQuestionItems(items).forEach(rawItem => {
    const normalizedItem = normalizeQuestionData(rawItem);
    if (!normalizedItem || typeof normalizedItem !== 'object') return;
    
    const signature = getQuestionSignature(normalizedItem);
    if (!signature || seen.has(signature)) return;
    
    seen.add(signature);
    uniqueItems.push(normalizedItem);
  });
  
  return uniqueItems;
}

// Generate deterministic ID matching web app
function generateQuestionId(normalizedItem: RawQuestion, sourceName: string, index: number): string {
  const baseId = normalizedItem.id || 
    normalizedItem.qn || 
    normalizedItem.qnNumber || 
    normalizedItem.questionId || 
    `${sourceName}-${index + 1}`;
  
  const topicHash = sourceName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  const cleanBaseId = String(baseId)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  
  return `${topicHash}_${cleanBaseId}`;
}

// Manifest file list (from manifest.json)
const MANIFEST_FILES = [
  'questions/civil_service_act_and_regulation.json',
  'questions/concrete_technology.json',
  'questions/constitution_of_nepal.json',
  'questions/construction_management.json',
  'questions/construction_materials.json',
  'questions/current_affairs.json',
  'questions/current_periodical_plan_of_nepal.json',
  'questions/economic_aspects_of_nepal.json',
  'questions/engineering_drawing.json',
  'questions/engineering_economics.json',
  'questions/engineering_professional_practice.json',
  'questions/estimation.json',
  'questions/functional_scope_of_public_services.json',
  'questions/fundamentals_of_management.json',
  'questions/geographical_diversity_climatic_condition_and_cultures.json',
  'questions/geography_of_nepal.json',
  'questions/geotechnical.json',
  'questions/governance_system_and_government.json',
  'questions/government_budgeting_and_accounting.json',
  'questions/major_natural_resources.json',
  'questions/modern_history_of_nepal.json',
  'questions/public_policy.json',
  'questions/public_service_charter.json',
  'questions/structural_engineering.json',
  'questions/surveying.json',
  'questions/sustainable_development_science_and_technology.json',
  'questions/uno_saarc_and_bimstec.json',
];

interface ParsedQuestion {
  id: string;
  topic: string;
  question: string;
  options_json: string;
  answer: string;
  explanation?: string;
  source_file: string;
}

// Items flowing through deduplication carry both the raw question fields and
// the parsed/scalarized fields (options_json, source_file, id). Widened type so
// TS can track the extra properties the parser relies on later.
type DedupItem = RawQuestion & Partial<ParsedQuestion> & { options?: Record<string, string> };

let parseProgressCallback: ((progress: { current: number; total: number; file: string }) => void) | null = null;

export function setParseProgressCallback(
  callback: (progress: { current: number; total: number; file: string }) => void
): void {
  parseProgressCallback = callback;
}

export async function parseQuestionBank(
  baseUrl: string = '',
  manifestFiles: string[] = MANIFEST_FILES
): Promise<ParsedQuestion[]> {
  const allQuestions: ParsedQuestion[] = [];
  
  for (let i = 0; i < manifestFiles.length; i++) {
    const filePath = manifestFiles[i];
    const sourceName = filePath
      .split('/')
      .pop()!
      .replace(/\.json$/i, '')
      .replace(/\s+/g, '_');
    
    parseProgressCallback?.({ current: i + 1, total: manifestFiles.length, file: sourceName });
    
    try {
      const url = `${baseUrl}${filePath}?v=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      
      if (!response.ok) {
        console.warn(`[Parser] Failed to fetch ${filePath}: ${response.status}`);
        continue;
      }
      
      const rawData = await response.json();
      const items = flattenQuestionItems(rawData);
      
      items.forEach((item, index) => {
        const normalizedItem = normalizeQuestionData(item);
        if (!normalizedItem || typeof normalizedItem !== 'object') return;
        
        const question: ParsedQuestion = {
          id: generateQuestionId(normalizedItem, sourceName, index),
          topic: normalizedItem.topic || sourceName,
          question: normalizedItem.question || '',
          options_json: JSON.stringify(normalizedItem.options || {}),
          answer: normalizedItem.answer || '',
          explanation: normalizedItem.explanation,
          source_file: sourceName,
        };
        
        allQuestions.push(question);
      });
    } catch (error) {
      console.error(`[Parser] Error parsing ${filePath}:`, error);
    }
  }
  
  // Deduplicate across all files
  return finalizeParsed(allQuestions);
}

// Bundled questions for offline-first (embedded in app at build time)
export async function getBundledQuestions(): Promise<ParsedQuestion[]> {
  const allQuestions: ParsedQuestion[] = [];

  const entries = Object.entries(BUNDLED_QUESTION_FILES) as [string, unknown][];

  for (let i = 0; i < entries.length; i++) {
    const [sourceName, rawData] = entries[i];
    parseProgressCallback?.({ current: i + 1, total: entries.length, file: sourceName });

    const items = flattenQuestionItems(rawData as RawQuestion | RawQuestion[]);
    items.forEach((item, index) => {
      const normalizedItem = normalizeQuestionData(item);
      if (!normalizedItem || typeof normalizedItem !== 'object') return;

      allQuestions.push({
        id: generateQuestionId(normalizedItem, sourceName, index),
        topic: normalizedItem.topic || sourceName,
        question: normalizedItem.question || '',
        options_json: JSON.stringify(normalizedItem.options || {}),
        answer: normalizedItem.answer || '',
        explanation: normalizedItem.explanation,
        source_file: sourceName,
      });
    });
  }

  // Deduplicate across all bundled files
  return finalizeParsed(allQuestions);
}

// Shared tail of the pipeline: de-duplicate and normalise back to rows.
function finalizeParsed(allQuestions: ParsedQuestion[]): ParsedQuestion[] {
  const deduplicated = deduplicateQuestions(
    allQuestions.map((q): DedupItem => ({
      ...q,
      options: JSON.parse(q.options_json),
    }))
  );

  return deduplicated.map((q): ParsedQuestion => ({
    id: q.id || '',
    topic: q.topic || 'General',
    question: q.question || '',
    options_json: JSON.stringify(q.options || {}),
    answer: q.answer || '',
    explanation: q.explanation,
    source_file: q.source_file || '',
  }));
}

export async function loadQuestionBank(
  onProgress?: (progress: { current: number; total: number; file: string }) => void
): Promise<ParsedQuestion[]> {
  if (onProgress) setParseProgressCallback(onProgress);

  // Offline-first: the full bank ships inside the app bundle.
  const bundled = await getBundledQuestions();
  console.log(`[Parser] Loaded ${bundled.length} questions from bundle`);
  return bundled;
}

// Remote bank manifest: an array of { path, sha256 } records so same-path
// content edits (e.g. an answer change) change the bank hash. Generated by
// scripts/generate-question-bank-manifest.js at the repo root.
export interface RemoteBankFile {
  path: string;
  sha256: string;
}

// Accepts the generated object format ({ files: [...] }) and, for backwards
// compatibility, a plain array of path strings (no content-hash detection).
export function normalizeRemoteBank(payload: unknown): RemoteBankFile[] | null {
  if (payload && typeof payload === 'object' && Array.isArray((payload as { files?: unknown[] }).files)) {
    const files = ((payload as { files: unknown[] }).files).filter(
      (f): f is RemoteBankFile =>
        !!f &&
        typeof f === 'object' &&
        typeof (f as RemoteBankFile).path === 'string' &&
        typeof (f as RemoteBankFile).sha256 === 'string'
    );
    return files.length > 0 ? files : null;
  }
  if (Array.isArray(payload)) {
    const paths = payload.filter((p): p is string => typeof p === 'string');
    return paths.length > 0 ? paths.map((p) => ({ path: p, sha256: '' })) : null;
  }
  return null;
}

// Check for updates by comparing the remotely-hosted bank manifest hash.
// The bank hash is computed over path+sha256 pairs, so a same-path content
// edit (the "changed an answer" case) changes the hash and triggers a re-sync.
export async function checkForQuestionUpdates(
  currentManifestHash: string,
  baseUrl: string = '',
  manifestName: string = REMOTE_BANK_MANIFEST_NAME
): Promise<{ hasUpdates: boolean; newHash?: string; files?: RemoteBankFile[] }> {
  try {
    const response = await fetch(`${baseUrl}${manifestName}?v=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return { hasUpdates: false };
    const payload = await response.json();
    const files = normalizeRemoteBank(payload);
    if (!files) return { hasUpdates: false };
    const newHash = await hashManifest(files);

    return {
      hasUpdates: newHash !== currentManifestHash,
      newHash,
      files,
    };
  } catch {
    return { hasUpdates: false };
  }
}

export async function hashManifest(manifest: Array<string | RemoteBankFile>): Promise<string> {
  const normalized = manifest.map((entry) =>
    typeof entry === 'string' ? entry : `${entry.path}:${entry.sha256}`
  );
  return sha256Hex(JSON.stringify(normalized));
}