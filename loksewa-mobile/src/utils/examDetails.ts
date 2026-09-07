/**
 * AttemptDetails + tolerant parser for exam_history.details_json.
 *
 * Extracted from app/(app)/result.tsx into a pure utility so the parsing
 * contract can be unit-tested in a node environment (no React Native import
 * chain). The contract (rule 69): corrupt/stale details degrade to "no review",
 * never crash the result screen.
 */
import type { EngineQuestion } from '../services/examEngine';

export interface AttemptDetails {
  title?: string;
  topic?: string;
  paper?: EngineQuestion[];
  answers?: Record<string, string>;
  timeLimitSeconds?: number;
}

/** Tolerant parser: corrupt/stale details degrade to 'no review', never crash. */
export function parseDetails(json?: string | null): AttemptDetails | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const out: AttemptDetails = {};
    if (typeof v.title === 'string') out.title = v.title;
    if (typeof v.topic === 'string') out.topic = v.topic;
    if (Array.isArray(v.paper)) out.paper = v.paper as EngineQuestion[];
    out.answers =
      v.answers && typeof v.answers === 'object' && !Array.isArray(v.answers)
        ? (v.answers as Record<string, string>)
        : {};
    if (typeof v.timeLimitSeconds === 'number' && Number.isFinite(v.timeLimitSeconds)) {
      out.timeLimitSeconds = v.timeLimitSeconds;
    }
    return out;
  } catch {
    return null;
  }
}
