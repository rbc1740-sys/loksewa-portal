import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../constants/theme';

/**
 * Settings Store — Zustand
 *
 * User-level presentation preferences (theme mode, daily goal). Persisted to
 * AsyncStorage so they survive restart. Deliberately separate from auth so
 * preferences apply pre-sign-in, and separate from courseStore so a theme
 * change never re-renders course-scoped screens.
 */

const STORAGE_KEY = 'loksewa:settings';

interface PersistedSettings {
  themeMode?: ThemeMode;
  dailyGoal?: number;
}

interface SettingsState {
  themeMode: ThemeMode;
  /** Questions per day the user aims for (drives the Home goal ring). */
  dailyGoal: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'system',
  dailyGoal: 20,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedSettings;
        set({
          themeMode: saved.themeMode ?? 'system',
          dailyGoal: saved.dailyGoal ?? 20,
        });
      }
    } catch (e) {
      console.warn('[SettingsStore] hydrate skipped:', e);
    } finally {
      set({ hydrated: true });
    }
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    try {
      const current = get();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ themeMode: current.themeMode, dailyGoal: current.dailyGoal })
      );
    } catch (e) {
      console.warn('[SettingsStore] persist failed:', e);
    }
  },

  setDailyGoal: async (goal) => {
    const clamped = Math.max(1, Math.min(200, Math.round(goal) || 20));
    set({ dailyGoal: clamped });
    try {
      const current = get();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ themeMode: current.themeMode, dailyGoal: current.dailyGoal })
      );
    } catch (e) {
      console.warn('[SettingsStore] persist failed:', e);
    }
  },
}));
