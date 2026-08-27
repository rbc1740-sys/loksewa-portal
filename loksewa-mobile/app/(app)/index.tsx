/**
 * Home Screen - Dashboard with stats, quick actions, and progress
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BookOpen, Timer, Zap, Brain, Target, Flame, Trophy, TrendingUp,
  Award, Calendar, Clock, ArrowRight, Plus, BarChart2, ListChecks, Bookmark
} from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useTypedPush } from '../../src/utils/navigation';
import { getUserProfile, getQuestionCountByTopic, getSRStats, getAttemptStats, getQuestionOfTheDay, getWeakPoints } from '../../src/services/database';

export default function HomeScreen() {
  const router = useRouter();
  const pushRoute = useTypedPush();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<{
    xp: number;
    streak_days: number;
    rank_tier: string;
    rank_sub: string;
    daily_goal_minutes: number;
    exam_target_date?: number;
  } | null>(null);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [srStats, setSrStats] = useState({ due: 0, learning: 0, review: 0, mastered: 0 });
  const [attemptStats, setAttemptStats] = useState({ attempted: 0, correct: 0, wrong: 0 });
  const [qotd, setQotd] = useState<{ question: any; dateString: string } | null>(null);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [profileData, counts, sr, attempts, daily, weak] = await Promise.all([
        getUserProfile(user.uid),
        getQuestionCountByTopic(),
        getSRStats(user.uid),
        getAttemptStats(user.uid),
        getQuestionOfTheDay(),
        getWeakPoints(user.uid),
      ]);
      setProfile(profileData);
      setTopicCounts(counts);
      setSrStats(sr ?? { due: 0, learning: 0, review: 0, mastered: 0 });
      setAttemptStats(attempts ?? { attempted: 0, correct: 0, wrong: 0 });
      if (daily) setQotd({ question: daily.question, dateString: daily.dateString });
      setWeakPoints(weak.map(w => w.question_id));
    } catch (error) {
      console.error('Failed to load home data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  
  const totalQuestions = Object.values(topicCounts).reduce((a, b) => a + b, 0);
  // Never render undefined — fall back to meaningful placeholders while the
  // profile row is missing or partially initialized (rule 7/40).
  const rankTier = profile?.rank_tier ?? 'Unranked';
  const rankSub = profile?.rank_sub ?? '';
  const rankName = rankSub ? `${rankTier} ${rankSub}` : rankTier;
  const accuracy = attemptStats.attempted > 0
    ? Math.round((attemptStats.correct / attemptStats.attempted) * 100)
    : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  })();
  
  const quickActions: {
    icon: typeof BookOpen;
    label: string;
    desc: string;
    color: string;
    screen: '/practice' | '/exam' | '/battle' | '/spaced' | '/subjects' | '/mistakes' | '/bookmarks';
  }[] = [
    { icon: BookOpen, label: 'Practice', desc: 'Objective MCQs', color: '#6366f1', screen: '/practice' },
    { icon: Timer, label: 'Timed Exam', desc: 'Full mock tests', color: '#3b82f6', screen: '/exam' },
    { icon: Zap, label: 'Battle', desc: '1v1 real-time', color: '#f59e0b', screen: '/battle' },
    { icon: Brain, label: 'Spaced Review', desc: `${srStats.due} due now`, color: '#10b981', screen: '/spaced' },
    { icon: ListChecks, label: 'Subjects', desc: 'Browse chapters', color: '#8b5cf6', screen: '/subjects' },
    { icon: Target, label: 'Mistakes', desc: `${attemptStats.wrong} to fix`, color: '#ef4444', screen: '/mistakes' },
    { icon: Bookmark, label: 'Bookmarks', desc: 'Saved questions', color: '#0ea5e9', screen: '/bookmarks' },
  ];
  
  const statCards = [
    { icon: Trophy, value: rankName, label: 'Current Rank', color: '#f59e0b' },
    { icon: Flame, value: `${profile?.streak_days ?? 0}`, label: 'Day Streak', color: '#ef4444' },
    { icon: Target, value: `${profile?.xp ?? 0} XP`, label: 'Total XP', color: '#6366f1' },
    { icon: BookOpen, value: totalQuestions.toLocaleString(), label: 'Bank Questions', color: '#8b5cf6' },
    { icon: BarChart2, value: attemptStats.attempted.toLocaleString(), label: 'Attempted', color: '#3b82f6' },
    { icon: TrendingUp, value: accuracy === null ? '—' : `${accuracy}%`, label: 'Accuracy', color: '#10b981' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { marginBottom: 16 }]}>Could not load your dashboard.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.userName}>{user?.displayName || 'Student'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.displayName?.charAt(0).toUpperCase() || 'S'}</Text>
        </View>
      </View>
      
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <TouchableOpacity key={index} style={styles.statCard} onPress={() => router.push('/profile')}>
            <View style={[{ backgroundColor: `${stat.color}15` }, styles.statIcon]}>
              <stat.icon size={22} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={() => pushRoute(action.screen)}
            >
              <View style={[{ backgroundColor: `${action.color}15` }, styles.actionIcon]}>
                <action.icon size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionDesc}>{action.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Question of the Day */}
      {qotd && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Question of the Day</Text>
          </View>
          <View style={styles.qotdCard}>
            <View style={styles.qotdHeader}>
              <View style={styles.qotdIcon}>
                <Calendar size={20} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.qotdDate}>Today, {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </View>
            </View>
            <Text style={styles.qotdQuestion}>{qotd.question.question}</Text>
            <TouchableOpacity
              style={styles.qotdButton}
              onPress={() => pushRoute('/practice')}
            >
              <Text style={styles.qotdButtonText}>Answer Now</Text>
              <ArrowRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Spaced Repetition Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spaced Review Status</Text>
        </View>
        <View style={styles.srCards}>
          <View style={[styles.srCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={styles.srCount}>{srStats.due}</Text>
            <Text style={styles.srLabel}>Due Now</Text>
            <Text style={styles.srSubtext}>Needs immediate review</Text>
          </View>
          <View style={[styles.srCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.srCount}>{srStats.learning}</Text>
            <Text style={styles.srLabel}>Learning</Text>
            <Text style={styles.srSubtext}>New questions</Text>
          </View>
          <View style={[styles.srCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={styles.srCount}>{srStats.review}</Text>
            <Text style={styles.srLabel}>Reviewing</Text>
            <Text style={styles.srSubtext}>Strengthening memory</Text>
          </View>
          <View style={[styles.srCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.srCount}>{srStats.mastered}</Text>
            <Text style={styles.srLabel}>Mastered</Text>
            <Text style={styles.srSubtext}>Long-term retention</Text>
          </View>
        </View>
        {srStats.due > 0 && (
          <TouchableOpacity style={styles.startReviewButton} onPress={() => router.push('/spaced')}>
            <Text style={styles.startReviewButtonText}>Start Smart Review ({srStats.due} questions)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Weak Areas & Recommendations */}
      {weakPoints.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Focus Areas</Text>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/practice?filter=weak')}>
              <Text style={styles.viewAllText}>View All</Text>
              <ArrowRight size={16} color="#6366f1" />
            </TouchableOpacity>
          </View>
          <View style={styles.topicList}>
            <View style={styles.recommendCard}>
              <View style={styles.recommendIcon}>
                <Target size={20} color="#ef4444" />
              </View>
              <View style={styles.recommendContent}>
                <Text style={styles.recommendTitle}>Weak areas detected</Text>
                <Text style={styles.recommendDesc}>
                  You have {weakPoints.length} flagged question{weakPoints.length > 1 ? 's' : ''}. Practice them to improve.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.recommendAction}
                onPress={() => router.push('/practice?filter=weak')}
              >
                <Text style={styles.recommendActionText}>Practice Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Topic Progress */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Topic Progress</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/practice')}>
            <Text style={styles.viewAllText}>View All</Text>
            <ArrowRight size={16} color="#6366f1" />
          </TouchableOpacity>
        </View>
        <View style={styles.topicList}>
          {Object.entries(topicCounts).slice(0, 6).map(([topic, count]) => (
            <View key={topic} style={styles.topicRow}>
              <Text style={styles.topicName}>{topic}</Text>
              <Text style={styles.topicCount}>{count} questions</Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* Exam Countdown */}
      {profile?.exam_target_date && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Exam Countdown</Text>
          </View>
          <View style={styles.countdownCard}>
            <View style={styles.countdownInfo}>
              <Calendar size={20} color="#6366f1" />
              <Text style={styles.countdownDate}>
                {new Date(profile.exam_target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.countdownTimer}>
              <Text style={styles.countdownDays}>{getDaysUntilExam(profile.exam_target_date)}</Text>
              <Text style={styles.countdownLabel}>Days Left</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function getDaysUntilExam(targetDate: number): number {
  const now = Date.now();
  const diff = targetDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  retryBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  srCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  srCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  srCount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  srLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  srSubtext: {
    fontSize: 11,
    color: '#94a3b8',
  },
  startReviewButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startReviewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  qotdCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qotdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  qotdIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qotdDate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  qotdQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 16,
  },
  qotdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
  },
  qotdButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  topicList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recommendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  recommendIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendContent: {
    flex: 1,
  },
  recommendTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 4,
  },
  recommendDesc: {
    fontSize: 13,
    color: '#dc2626',
  },
  recommendAction: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recommendActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topicName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  topicCount: {
    fontSize: 13,
    color: '#94a3b8',
  },
  countdownCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
  },
  countdownInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countdownDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  countdownTimer: {
    alignItems: 'flex-end',
  },
  countdownDays: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 40,
  },
  countdownLabel: {
    fontSize: 13,
    color: '#c7d2fe',
    textAlign: 'right',
  },
});