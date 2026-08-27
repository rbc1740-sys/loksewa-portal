/**
 * Profile Screen - User account & settings
 *
 * Shows the user's real persisted statistics (from SQLite) plus account
 * actions. No placeholder controls — every row either works or isn't shown.
 */
import { View, Text, StyleSheet, TouchableOpacity, ToastAndroid, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LogOut, User, Trophy, Flame, Target, TrendingUp, BarChart2 } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getUserProfile, getAttemptStats, getAchievements,
  type Achievement,
} from '../../src/services/database';

interface ProfileStats {
  xp: number;
  streakDays: number;
  rankTier: string;
  rankSub: string;
  attempted: number;
  correct: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const [profile, attempts, badges] = await Promise.all([
          getUserProfile(user.uid),
          getAttemptStats(user.uid),
          getAchievements(user.uid),
        ]);
        if (cancelled) return;
        setStats({
          xp: profile?.xp ?? 0,
          streakDays: profile?.streak_days ?? 0,
          rankTier: profile?.rank_tier ?? 'Unranked',
          rankSub: profile?.rank_sub ?? '',
          attempted: attempts.attempted ?? 0,
          correct: attempts.correct ?? 0,
        });
        setAchievements(badges);
      } catch (error) {
        console.error('Failed to load profile stats:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/(auth)/auth-choice');
          } catch (error) {
            setSigningOut(false);
            if (Platform.OS === 'android') {
              ToastAndroid.show('Sign out failed. Please try again.', ToastAndroid.SHORT);
            } else {
              Alert.alert('Sign out failed', 'Please try again.');
            }
          }
        },
      },
    ]);
  };

  const accuracy = stats && stats.attempted > 0
    ? Math.round((stats.correct / stats.attempted) * 100)
    : null;
  const rankLabel = stats
    ? (stats.rankSub ? `${stats.rankTier} ${stats.rankSub}` : stats.rankTier)
    : '—';

  const statRows = [
    { icon: Trophy, color: '#f59e0b', label: 'Current Rank', value: rankLabel },
    { icon: Flame, color: '#ef4444', label: 'Day Streak', value: `${stats?.streakDays ?? 0}` },
    { icon: Target, color: '#6366f1', label: 'Total XP', value: `${stats?.xp ?? 0}` },
    { icon: BarChart2, color: '#3b82f6', label: 'Questions Attempted', value: `${stats?.attempted ?? 0}` },
    { icon: TrendingUp, color: '#10b981', label: 'Accuracy', value: accuracy === null ? '—' : `${accuracy}%` },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <User size={28} color="#fff" />
        </View>
        <Text style={styles.name}>{user?.displayName || 'Student'}</Text>
        <Text style={styles.email}>{user?.email || 'Signed in'}</Text>
      </View>

      <View style={[styles.section, styles.statsSection]}>
        <Text style={styles.sectionTitle}>Your Statistics</Text>
        {statRows.map(({ icon: Icon, color, label, value }) => (
          <View key={label} style={styles.statRow}>
            <Icon size={20} color={color} />
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Achievements / Badges */}
      {achievements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.badgesGrid}>
            {achievements.map((badge, index) => (
              <View key={index} style={styles.badgeCard}>
                <Text style={styles.badgeIcon}>{badge.icon || '🏅'}</Text>
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={handleSignOut} disabled={signingOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.dangerText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>Loksewa Prep Pro • v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  email: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  content: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  statsSection: {
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statLabel: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 24,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  badgeCard: {
    width: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDesc: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
});