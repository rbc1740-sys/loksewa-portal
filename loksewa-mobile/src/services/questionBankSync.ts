/**
 * Question Bank Sync (Option C — remote auto-updates)
 *
 * On boot the app knows which bank it has locally (a SHA-256 of the last
 * applied manifest, stored in `app_meta`). This service checks the remotely
 * hosted `question-bank.json` (per-file SHA-256 content hashes) at
 * QUESTION_BANK_BASE_URL; when its hash differs it re-fetches every listed
 * question file (cache-busted), replaces the local `questions` table and
 * refreshes the hierarchy counts. User-owned data (progress, SR state,
 * bookmarks, weak points, exam history) is untouched.
 *
 * Design decisions:
 * - Fail-open: networking/parse errors NEVER block the app. The bundled bank
 *   already works offline, so a failed check is just a no-op.
 * - Single-flight: concurrent callers share one in-progress sync.
 * - Hash-only comparison keeps the common "no change" path to a single HTTP
 *   fetch (the manifest).
 */
import { getAppMeta, setAppMeta, replaceQuestionBank } from './database';
import { parseQuestionBank, checkForQuestionUpdates } from './questionParser';
import {
  QUESTION_BANK_BASE_URL,
  META_KEY_BANK_HASH,
  META_KEY_LAST_SYNC_AT,
} from '../constants/remoteConfig';

export interface QuestionBankSyncResult {
  applied: boolean;
  reason:
    | 'first_install' // remote applied over the bundled bank (no prior hash)
    | 'updated'       // remote applied over an older installed bank
    | 'no_change'     // installed hash already matches remote
    | 'unavailable'   // remote manifest unreachable/offline
    | 'failed';       // something unexpected went wrong
  count?: number;
  previousHash?: string | null;
  newHash?: string;
}

let syncInFlight: Promise<QuestionBankSyncResult> | null = null;

/**
 * Checks the remote bank and applies it if newer. Returns a summary; never
 * throws. Safe to call on every launch.
 */
export function syncQuestionBank(opts?: { baseUrl?: string }): Promise<QuestionBankSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = performSync(opts?.baseUrl ?? QUESTION_BANK_BASE_URL).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function performSync(baseUrl: string): Promise<QuestionBankSyncResult> {
  try {
    const previousHash = await getAppMeta(META_KEY_BANK_HASH);
    const check = await checkForQuestionUpdates(previousHash ?? '', baseUrl);

    // No update available (offline, remote unreachable, or hash unchanged).
    if (!check.hasUpdates || !check.newHash || !check.files) {
      return {
        applied: false,
        reason: previousHash ? 'no_change' : 'unavailable',
        previousHash,
      };
    }

    const paths = check.files.map((f) => f.path);
    const questions = await parseQuestionBank(baseUrl, paths);
    if (questions.length === 0) {
      console.warn('[BankSync] Remote manifest changed but no questions parsed; skipping');
      return { applied: false, reason: 'failed', previousHash, newHash: check.newHash };
    }

    const count = await replaceQuestionBank(questions);
    await setAppMeta(META_KEY_BANK_HASH, check.newHash);
    await setAppMeta(META_KEY_LAST_SYNC_AT, String(Date.now()));

    console.log(
      `[BankSync] Question bank ${previousHash ? 'updated' : 'installed'} (${count} questions)`
    );

    return {
      applied: true,
      reason: previousHash ? 'updated' : 'first_install',
      count,
      previousHash,
      newHash: check.newHash,
    };
  } catch (error) {
    console.warn('[BankSync] Remote update check failed:', error);
    return { applied: false, reason: 'failed' };
  }
}