/**
 * Profile — account center with grouped settings (rule 27/28).
 * Real persisted stats (SQLite), a theme-mode control driven by the central
 * settings store, navigation to feature screens, and sign-out.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart2, Bookmark, Flame, HelpCircle, LogOut, Moon, Shield, Sun, Target, Trophy, User, Monitor } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { getUserProfile, getAttemptStats } from '../../src/services/database';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, radius, typography } from '../../src/constants/theme';
import { AppCard, AppButton } from '../../src/components/ui';
import type { ThemeMode } from '../../src/constants/theme';

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'system', label: 'System', icon: Monitor },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const setDailyGoal = useSettingsStore((s) => s.setDailyGoal);

  const [stats, setStats] = useState<{ xp: number; streak: number; rank: string; attempted: number; correct: number } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const [profile, attempts] = await Promise.all([
          getUserProfile(user.uid),
          getAttemptStats(user.uid),
        ]);
        if (cancelled) return;
        setStats({
          xp: profile?.xp ?? 0,
          streak: profile?.streak_days ?? 0,
          rank: profile ? (profile.rank_sub ? `${profile.rank_tier} ${profile.rank_sub}` : profile.rank_tier) : 'Unranked',
          attempted: attempts.attempted ?? 0,
          correct: attempts.correct ?? 0,
        });
      } catch (e) {
        console.error('[Profile] load failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  const accuracy = stats && stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : null;

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/(auth)/auth-choice' as never);
          } catch (e) {
            setSigningOut(false);
            if (Platform.OS === 'android') ToastAndroid.show('Sign out failed', ToastAndroid.SHORT);
            else Alert.alert('Sign out failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  const navRow = (icon: React.ReactNode, label: string, onPress: () => void, danger = false) => (
    <TouchableOpacity style={styles.row} onPress={onPress} accessible accessibilityRole="button">
      {icon}
      <Text style={[styles.rowLabel, { color: danger ? t.error : t.textPrimary }]}>{label}</Text>
      <Text style={styles.chevron}>{'>'}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: t.primaryLight }]}>
            <User size={32} color={t.primaryDark} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: t.textPrimary }]} numberOfLines={1}>
              {user.displayName || 'Learner'}
            </Text>
            <Text style={[styles.rank, { color: t.textSecondary }]} numberOfLines={1}>
              {stats?.rank ?? 'Unranked'}
            </Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: t.surfaceAlt }]}>
            <Trophy size={18} color={t.warning} />
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{stats?.xp ?? 0}</Text>
            <Text style={[styles.statLabel, { color: t.textSecondary }]}>XP</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surfaceAlt }]}>
            <Flame size={18} color={t.error} />
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{stats?.streak ?? 0}</Text>
            <Text style={[styles.statLabel, { color: t.textSecondary }]}>Streak</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surfaceAlt }]}>
            <Target size={18} color={t.success} />
            <Text style={[styles.statValue, { color: t.textPrimary }]}>{accuracy ?? '—'}{accuracy != null ? '%' : ''}</Text>
            <Text style={[styles.statLabel, { color: t.textSecondary }]}>Accuracy</Text>
          </View>
        </View>

        {/* Learning section */}
        <Text style={[styles.groupLabel, { color: t.textSecondary }]}>Learning</Text>
        <AppCard padded={false} elevated style={styles.group}>
          {navRow(<BarChart2 size={20} color={t.secondary} />, 'Analytics', () => router.push('/analytics' as never))}
          {navRow(<Bookmark size={20} color={t.info} />, 'Bookmarks', () => router.push('/bookmarks' as never))}
        </AppCard>

        {/* Preferences section */}
        <Text style={[styles.groupLabel, { color: t.textSecondary }]}>Preferences</Text>
        <AppCard padded style={styles.group}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: t.textPrimary }]}>Theme</Text>
              <Text style={[styles.settingHint, { color: t.textSecondary }]}>Appearance mode</Text>
            </View>
            <View style={styles.themeToggle}>
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = themeMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setThemeMode(opt.key)}
                    style={[styles.themeBtn, active && { backgroundColor: t.secondary }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt.label} theme`}
                    accessibilityState={{ selected: active }}
                  >
                    <Icon size={16} color={active ? t.textOnPrimary : t.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: t.textPrimary }]}>Daily goal</Text>
              <Text style={[styles.settingHint, { color: t.textSecondary }]}>{dailyGoal} questions / day</Text>
            </View>
            <View style={styles.goalToggle}>
              {[10, 20, 50].map((g) => {
                const active = dailyGoal === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setDailyGoal(g)}
                    style={[styles.goalBtn, active && { backgroundColor: t.secondary }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${g} questions daily goal`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.goalText, { color: active ? t.textOnPrimary : t.textSecondary }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </AppCard>

        {/* About section */}
        <Text style={[styles.groupLabel, { color: t.textSecondary }]}>About</Text>
        <AppCard padded={false} elevated style={styles.group}>
          {navRow(<Shield size={20} color={t.textSecondary} />, 'Privacy & Terms', () => {})}
          {navRow(<HelpCircle size={20} color={t.textSecondary} />, 'Help & Support', () => {})}
        </AppCard>

        {/* Sign out */}
        <AppButton
          label="Sign Out"
          variant="danger"
          fullWidth
          loading={signingOut}
          onPress={handleSignOut}
          icon={<LogOut size={18} color={t.error} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  name: { ...typography.sectionTitle, fontWeight: '700' },
  rank: { ...typography.bodySmall, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  statValue: { ...typography.cardTitle, fontWeight: '800', marginTop: 2 },
  statLabel: { ...typography.micro, marginTop: 1 },
  groupLabel: { ...typography.bodySmall, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.xxs },
  group: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minHeight: 48 },
  rowLabel: { ...typography.body, flex: 1 },
  chevron: { fontSize: 16, color: '#94a3b8' as string },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  settingLeft: { flex: 1 },
  settingLabel: { ...typography.body, fontWeight: '600' },
  settingHint: { ...typography.caption, marginTop: 2 },
  themeToggle: { flexDirection: 'row', gap: spacing.xxs },
  themeBtn: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  goalToggle: { flexDirection: 'row', gap: spacing.xxs },
  goalBtn: { paddingHorizontal: spacing.sm, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  goalText: { ...typography.bodySmall, fontWeight: '700' },
});
