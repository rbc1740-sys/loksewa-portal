import { Slot } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useTheme } from '../src/hooks/useTheme';
import { ensureQuestionBankSeeded } from '../src/services/database';
import { useCourseStore } from '../src/stores/courseStore';
import { startSyncWorker, type SyncWorkerHandle } from '../src/services/syncWorker';
import { ErrorState } from '../src/components/ui';
import { restoreFromCloud } from '../src/services/cloudRestore';

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const initialized = useAuthStore((state) => state.initialized);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedAttempt, setSeedAttempt] = useState(0);
  const t = useTheme();

  // Subscribe to Firebase auth state once; `hydrate` returns the unsubscribe.
  useEffect(() => hydrate(), [hydrate]);

  // Load persisted user preferences (theme mode, daily goal) before screens
  // render so the first frame already has the correct theme.
  useEffect(() => {
    hydrateSettings().catch((e) => console.warn('[Boot] Settings hydration skipped:', e));
  }, [hydrateSettings]);

  // Copy the bundled question bank into SQLite on first launch (offline-first).
  // A failure must NOT silently continue into an empty app - surface it with
  // a retry button so on-device problems are diagnosable.
  useEffect(() => {
    let cancelled = false;
    ensureQuestionBankSeeded()
      .then(() => {
        if (cancelled) return;
        setSeedError(null);
        // Seed the course catalog + hierarchy only AFTER the question bank is
        // in SQLite, so question-to-hierarchy linking cannot race an empty
        // questions table on first launch.
        useCourseStore.getState().hydrate().catch((e) =>
          console.warn('[Boot] Course store hydration skipped:', e)
        );
      })
      .catch((error) => {
        console.error('[Boot] Failed to seed question bank:', error);
        if (!cancelled) setSeedError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setSeeded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [seedAttempt]);

  // Outbox sync worker (Phase 5): drain sync_queue on app focus + every 5 min
  // once boot completes. Failures are retained in the outbox with bounded
  // retries, so offline drains are harmless. Stopped on unmount.
  const syncWorkerRef = useRef<SyncWorkerHandle | null>(null);
  useEffect(() => {
    if (!initialized || !seeded) return;
    syncWorkerRef.current = startSyncWorker();
    return () => {
      syncWorkerRef.current?.stop();
      syncWorkerRef.current = null;
    };
  }, [initialized, seeded]);

  // Cloud restore (Phase 7): hydrate SQLite from Firestore once per user per
  // session. Recency guards inside restoreFromCloud make reruns no-ops, and
  // any failure is non-fatal — the app stays fully usable from local data.
  const user = useAuthStore((state) => state.user);
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.uid;
    if (!initialized || !seeded || !uid || restoredForRef.current === uid) return;
    restoredForRef.current = uid;
    restoreFromCloud(uid)
      .then((summary) => {
        const total = Object.values(summary.restored).reduce((a, b) => a + (b ?? 0), 0);
        if (total > 0 || summary.errors > 0) {
          console.log(`[Boot] Cloud restore: ${total} row(s), ${summary.errors} error(s)`);
        }
      })
      .catch((error) => console.warn('[Boot] Cloud restore skipped:', error));
  }, [initialized, seeded, user]);

  // Question-bank seeding failed - show a retryable error instead of an
  // unusable app with zero questions (the previous silent-continue behavior).
  if (seedError) {
    return (
      <View style={[styles.splash, { backgroundColor: t.background }]}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <ErrorState
          message={`Couldn't load the question bank: ${seedError}`}
          onRetry={() => setSeedAttempt((a) => a + 1)}
        />
      </View>
    );
  }
  // Don't flash the wrong route while the session is restored and the local
  // question database is prepared.
  if (!initialized || !seeded) {
    return (
      <View style={[styles.splash, { backgroundColor: t.background }]}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={t.secondary} />
        <Text style={[styles.splashText, { color: t.secondary }]}>Loksewa Prep Pro</Text>
        <Text style={[styles.splashSub, { color: t.textTertiary }]}>
          Preparing your study material…
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  splashText: {
    fontSize: 18,
    fontWeight: '700',
  },
  splashSub: {
    fontSize: 13,
    textAlign: 'center',
  },
});