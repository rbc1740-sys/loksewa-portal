/**
 * Custom Exam Store — Zustand cache over the DB-backed custom-exam service
 * (rule 27). Definitions are idempotent by derived id (see services layer);
 * this store only adds instant-list updates and per-user caching.
 */
import { create } from 'zustand';
import { deleteCustomExam, getCustomExamsByUser, recordCustomExamResult, upsertCustomExam } from '../services/database';
import type { CustomExam, CustomExamSpec } from '../services/customExamStore';

interface CustomExamState {
  exams: CustomExam[];
  loading: boolean;
  error: string | null;

  refresh: (userId: string) => Promise<void>;
  save: (userId: string, spec: Partial<CustomExamSpec>) => Promise<CustomExam>;
  remove: (userId: string, id: string) => Promise<void>;
  recordAttempt: (userId: string, id: string, percent: number) => Promise<void>;
}

export const useCustomExamStore = create<CustomExamState>((set, get) => ({
  exams: [],
  loading: false,
  error: null,

  refresh: async userId => {
    if (!userId) return;
    set({ loading: true, error: null });
    try {
      const exams = await getCustomExamsByUser(userId);
      set({ exams, loading: false });
    } catch (e) {
      console.error('[CustomExams] refresh failed', e);
      set({ loading: false, error: 'Could not load your custom exams.' });
    }
  },

  save: async (userId, spec) => {
    const created = await upsertCustomExam(userId, spec);
    // Re-sync the row (upsert may have kept existing attempts/best score).
    set(state => {
      const rest = state.exams.filter(e => e.id !== created.id);
      return { exams: [created, ...rest] };
    });
    return created;
  },

  remove: async (userId, id) => {
    const previous = get().exams;
    set({ exams: previous.filter(e => e.id !== id) });
    try {
      await deleteCustomExam(userId, id);
    } catch (e) {
      console.error('[CustomExams] delete failed — restoring', e);
      set({ exams: previous });
    }
  },

  recordAttempt: async (userId, id, percent) => {
    try {
      await recordCustomExamResult(userId, id, percent);
      set(state => ({
        exams: state.exams.map(e =>
          e.id === id
            ? { ...e, attempts: e.attempts + 1, best_percent: Math.max(e.best_percent, percent) }
            : e
        ),
      }));
    } catch (e) {
      console.error('[CustomExams] recording attempt failed', e);
    }
  },
}));
