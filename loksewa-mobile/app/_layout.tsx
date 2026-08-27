import { Slot } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { ensureQuestionBankSeeded } from '../src/services/database';
import { useCourseStore } from '../src/stores/courseStore';
import { startSyncWorker, type SyncWorkerHandle } from '../src/services/syncWorker';
import { restoreFromCloud } from '../src/services/cloudRestore';

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const initialized = useAuthStore((state) => state.initialized);
  const [seeded, setSeeded] = useState(false);

  // Subscribe to Firebase auth state once; `hydrate` returns the unsubscribe.
  useEffect(() => hydrate(), [hydrate]);

  // Copy the bundled question bank into SQLite on first launch (offline-first).
  useEffect(() => {
    let cancelled = false;
    ensureQuestionBankSeeded()
      .catch((error) => console.error('[Boot] Failed to seed question bank:', error))
      .finally(() => {
        if (!cancelled) setSeeded(true);
      });

    // Seed the course catalog + hierarchy and restore the active course.
    // Failures are non-fatal (screens re-seed defensively on first query).
    useCourseStore.getState().hydrate().catch((e) =>
      console.warn('[Boot] Course store hydration skipped:', e)
    );

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Don't flash the wrong route while the session is restored and the local
  // question database is prepared.
  if (!initialized || !seeded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.splashText}>Loksewa Prep Pro</Text>
        <Text style={styles.splashSub}>Preparing your study material…</Text>
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  splashText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
  },
  splashSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
});