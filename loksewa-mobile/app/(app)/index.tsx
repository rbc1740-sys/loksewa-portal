/**
 * Home — personalized learning dashboard (Phase 2 rebuild).
 *
 * Architecture (master-prompt rule 6):
 *   HEADER          → identity, streak, course switcher
 *   ACTIVE LEARNING → Continue Learning (resumable exam OR last topic)
 *   DAILY           → daily goal + Question of the Day
 *   DISCOVERY       → subjects with live progress, weak areas
 *   QUICK ACTIONS   → bookmarks / mistakes / smart review / history / battle
 *
 * Every number is read from the central data layer (rule 31) — nothing is
 * estimated or cached on the UI side. Focus-driven reload keeps stats fresh
 * after practice without global state churn (rule 24).
 */
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Flame,
  ChevronRight,
  ChevronDown,
  Play,
  BookOpen,
  Bookmark,
  AlertTriangle,
  Brain,
  History,
  Layers,
  CheckCircle2,
  Timer,
  Swords,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useCourseStore } from '../../src/stores/courseStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
  getSubjectsWithProgress,
  getAttemptsToday,
  getLastStudiedTopic,
  getLatestActiveExamSession,
  getQuestionOfTheDay,
  getSRStats,
  getWeakPoints,
  getUserProfile,
  type SubjectStats,
  type LastStudiedTopic,
  type ExamSession,
  type DailyQuestion,
} from '../../src/services/database';
import {
  AppCard,
  SectionHeader,
  ProgressBar,
  SubjectCard,
  BottomSheet,
  SkeletonCard,
  ErrorState,
} from '../../src/components/ui';
import { radius, spacing, typography } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';

interface HomeData {
  subjects: SubjectStats[];
  today: { attempted: number; correct: number };
  lastTopic: LastStudiedTopic | null;
  activeExam: ExamSession | null;
  qotd: DailyQuestion | null;
  dueCount: number;
  weakCount: number;
  streak: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ courseSwitched?: string }>();
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const courses = useCourseStore((s) => s.courses);
  const setCourse = useCourseStore((s) => s.setCourse);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [courseSheetOpen, setCourseSheetOpen] = useState(false);

  const userId = user?.uid ?? 'device-user';
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0];

  const load = useCallback(async () => {
    setError(null);
    try {
      const [subjects, today, lastTopic, activeExam, qotd, srStats, weakPoints, profile] =
        await Promise.all([
          getSubjectsWithProgress(userId, activeCourseId ?? undefined),
          getAttemptsToday(userId),
          getLastStudiedTopic(userId),
          getLatestActiveExamSession(userId),
          getQuestionOfTheDay(),
          getSRStats(userId),
          getWeakPoints(userId),
          getUserProfile(userId),
        ]);
      setData({
        subjects,
        today,
        lastTopic,
        activeExam,
        qotd,
        dueCount: srStats.due,
        weakCount: weakPoints.length,
        streak: profile?.streak_days ?? 0,
      });
    } catch (e) {
      console.warn('[Home] load failed:', e);
      setError('Could not load your dashboard. Your data is safe — try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, activeCourseId]);

  // Reload on every focus so returning from practice/exam reflects fresh
  // progress without keeping listeners alive (screen-scoped, rule 24).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const firstName = (user?.displayName ?? 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const goalProgress = data ? Math.min(1, data.today.attempted / Math.max(1, dailyGoal)) : 0;

  if (loading && !data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top']}>
        <View style={styles.loadWrap}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top']}>
        <ErrorState message={error} onRetry={load} variant="server" />
      </SafeAreaView>
    );
  }

  const examAnswered = data?.activeExam
    ? Object.keys(JSON.parse(data.activeExam.answers_json || '{}')).length
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.secondary} />
        }
      >
        {/* ------------------------------ HEADER ------------------------------ */}
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={[styles.greeting, { color: t.textSecondary }]}>{greeting},</Text>
            <Text numberOfLines={1} style={[styles.name, { color: t.textPrimary }]}>
              {firstName}
            </Text>
          </View>
          <View style={[styles.streakChip, { backgroundColor: t.warningSoft }]}>
            <Flame size={16} color={t.warning} />
            <Text style={[styles.streakText, { color: t.warning }]}>{data?.streak ?? 0}</Text>
          </View>
        </View>

        {/* Course selector — progressive disclosure via bottom sheet (rule 26). */}
        <Pressable
          onPress={() => setCourseSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Active course: ${activeCourse?.name ?? 'Select course'}. Tap to change.`}
          style={({ pressed }) => [
            styles.courseChip,
            { backgroundColor: t.surface, borderColor: t.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Layers size={16} color={t.secondary} />
          <Text numberOfLines={1} style={[styles.courseChipText, { color: t.textPrimary }]}>
            {activeCourse?.name ?? 'Select course'}
          </Text>
          <ChevronDown size={16} color={t.textTertiary} />
        </Pressable>

        {/* -------------------------- ACTIVE LEARNING -------------------------- */}
        {data?.activeExam ? (
          <AppCard style={styles.section}>
            <View style={styles.continueRow}>
              <View style={[styles.continueIcon, { backgroundColor: t.primaryLight }]}>
                <Timer size={22} color={t.secondary} />
              </View>
              <View style={styles.continueBody}>
                <Text style={[styles.continueKicker, { color: t.secondary }]}>
                  EXAM IN PROGRESS
                </Text>
                <Text numberOfLines={1} style={[styles.continueTitle, { color: t.textPrimary }]}>
                  {data.activeExam.topic ?? 'Practice exam'}
                </Text>
                <Text style={[styles.continueMeta, { color: t.textSecondary }]}>
                  {examAnswered}/{data.activeExam.question_count} answered · resume anytime
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(app)/quiz',
                    params: {
                      sessionId: data.activeExam!.id,
                      title: data.activeExam!.topic ?? 'Exam',
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Resume exam"
                style={[styles.continueCta, { backgroundColor: t.primary }]}
              >
                <Play size={16} color={t.textOnPrimary} />
              </Pressable>
            </View>
          </AppCard>
        ) : data?.lastTopic ? (
          <AppCard style={styles.section}>
            <View style={styles.continueRow}>
              <View style={[styles.continueIcon, { backgroundColor: t.primaryLight }]}>
                <BookOpen size={22} color={t.secondary} />
              </View>
              <View style={styles.continueBody}>
                <Text style={[styles.continueKicker, { color: t.secondary }]}>
                  CONTINUE LEARNING
                </Text>
                <Text numberOfLines={1} style={[styles.continueTitle, { color: t.textPrimary }]}>
                  {data.lastTopic.topicName}
                </Text>
                <Text style={[styles.continueMeta, { color: t.textSecondary }]}>
                  {data.lastTopic.subjectName} · {data.lastTopic.attemptedCount}/
                  {data.lastTopic.questionCount} attempted
                </Text>
                <View style={styles.continueProgress}>
                  <ProgressBar
                    progress={
                      data.lastTopic.questionCount
                        ? data.lastTopic.attemptedCount / data.lastTopic.questionCount
                        : 0
                    }
                    height={5}
                  />
                </View>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(app)/practice',
                    params: { topic: data.lastTopic!.topicName },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Continue studying this topic"
                style={[styles.continueCta, { backgroundColor: t.primary }]}
              >
                <Play size={16} color={t.textOnPrimary} />
              </Pressable>
            </View>
          </AppCard>
        ) : (
          <AppCard style={styles.section}>
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
              Start your first topic 🎯
            </Text>
            <Text style={[styles.emptyBody, { color: t.textSecondary }]}>
              Pick a subject below and practice a few questions — your progress will show up here.
            </Text>
          </AppCard>
        )}

        {/* -------------------------- DAILY ENGAGEMENT -------------------------- */}
        <View style={styles.dailyRow}>
          <AppCard style={[styles.goalCard, styles.section]}>
            <Text style={[styles.goalValue, { color: t.secondary }]}>
              {data?.today.attempted ?? 0}
              <Text style={{ color: t.textTertiary }}>/{dailyGoal}</Text>
            </Text>
            <Text style={[styles.goalLabel, { color: t.textSecondary }]}>
              questions today
            </Text>
            <View style={styles.goalProgress}>
              <ProgressBar progress={goalProgress} height={5} />
            </View>
            {data && data.today.attempted >= dailyGoal ? (
              <View style={styles.goalDone}>
                <CheckCircle2 size={13} color={t.success} />
                <Text style={[styles.goalDoneText, { color: t.success }]}>Goal reached</Text>
              </View>
            ) : null}
          </AppCard>

          {data?.qotd ? (
            <AppCard
              onPress={() =>
                router.push({
                  pathname: '/(app)/practice',
                  params: {
                    reviewIds: data.qotd!.question.id,
                    reviewTitle: 'Question of the Day',
                  },
                })
              }
              style={[styles.qotdCard, styles.section]}
            >
              <Text style={[styles.qotdKicker, { color: t.secondary }]}>QUESTION OF THE DAY</Text>
              <Text numberOfLines={3} style={[styles.qotdText, { color: t.textPrimary }]}>
                {data.qotd.question.question}
              </Text>
              <View style={styles.qotdCta}>
                <Text style={[styles.qotdCtaText, { color: t.secondary }]}>Answer now</Text>
                <ChevronRight size={14} color={t.secondary} />
              </View>
            </AppCard>
          ) : (
            <AppCard style={[styles.qotdCard, styles.section]}>
              <Text style={[styles.qotdKicker, { color: t.secondary }]}>QUESTION OF THE DAY</Text>
              <Text style={[styles.emptyBody, { color: t.textSecondary }]}>
                No questions available yet.
              </Text>
            </AppCard>
          )}
        </View>

        {/* ------------------------------ DISCOVERY ------------------------------ */}
        <SectionHeader
          title="Subjects"
          subtitle={activeCourse ? `${activeCourse.name} syllabus` : undefined}
          actionLabel="See all"
          onActionPress={() => router.push('/(app)/subjects')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectRow}
        >
          {(data?.subjects ?? []).map((s) => (
            <SubjectCard
              key={s.id}
              name={s.name}
              questionCount={s.questionCount}
              attempted={s.attemptedCount}
              accuracy={s.accuracyPercent / 100}
              completion={s.completionPercent / 100}
              onPress={() =>
                router.push({
                  pathname: '/(app)/chapters',
                  params: { subjectId: s.id, title: s.name },
                })
              }
            />
          ))}
          {data && data.subjects.length === 0 ? (
            <AppCard style={styles.subjectEmptyCard}>
              <Text style={[styles.emptyBody, { color: t.textSecondary }]}>
                No subjects yet for this course.
              </Text>
            </AppCard>
          ) : null}
        </ScrollView>

        {/* Weak areas — only surfaces when there is something to act on. */}
        {data && data.weakCount > 0 ? (
          <AppCard
            onPress={() => router.push('/(app)/mistakes')}
            style={styles.section}
          >
            <View style={styles.weakRow}>
              <View style={[styles.continueIcon, { backgroundColor: t.errorSoft }]}>
                <AlertTriangle size={20} color={t.error} />
              </View>
              <View style={styles.weakBody}>
                <Text style={[styles.weakTitle, { color: t.textPrimary }]}>Weak areas</Text>
                <Text style={[styles.continueMeta, { color: t.textSecondary }]}>
                  {data.weakCount} question{data.weakCount === 1 ? '' : 's'} need your attention
                </Text>
              </View>
              <ChevronRight size={20} color={t.textTertiary} />
            </View>
          </AppCard>
        ) : null}

        {/* ---------------------------- QUICK ACTIONS ---------------------------- */}
        <SectionHeader title="Quick actions" />
        <View style={styles.actionsGrid}>
          <QuickAction
            icon={<Bookmark size={20} color={t.secondary} />}
            label="Bookmarks"
            bg={t.primaryLight}
            onPress={() => router.push('/(app)/bookmarks')}
          />
          <QuickAction
            icon={<AlertTriangle size={20} color={t.error} />}
            label="Mistakes"
            bg={t.errorSoft}
            onPress={() => router.push('/(app)/mistakes')}
          />
          <QuickAction
            icon={<Brain size={20} color={t.success} />}
            label={data && data.dueCount > 0 ? `Review · ${data.dueCount} due` : 'Smart Review'}
            bg={t.successSoft}
            onPress={() => router.push('/(app)/spaced')}
          />
          <QuickAction
            icon={<History size={20} color={t.warning} />}
            label="History"
            bg={t.warningSoft}
            onPress={() => router.push('/(app)/history')}
          />
          <QuickAction
            icon={<Swords size={20} color="#f59e0b" />}
            label="Battle Arena"
            bg={t.warningSoft}
            onPress={() => router.push('/(app)/battle')}
          />
        </View>
      </ScrollView>

      {/* Course switcher */}
      <BottomSheet
        visible={courseSheetOpen}
        onClose={() => setCourseSheetOpen(false)}
        title="Choose course"
        subtitle="Your progress is tracked per course"
      >
        {courses.map((c) => {
          const active = c.id === activeCourse?.id;
          return (
            <Pressable
              key={c.id}
              onPress={async () => {
                setCourseSheetOpen(false);
                if (!active) {
                  await setCourse(c.id);
                  router.setParams({ courseSwitched: String(Date.now()) });
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.courseRow,
                { backgroundColor: active ? t.primaryLight : 'transparent' },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.courseRowText}>
                <Text style={[styles.courseRowName, { color: t.textPrimary }]}>{c.name}</Text>
                {c.description ? (
                  <Text numberOfLines={1} style={[styles.courseRowMeta, { color: t.textSecondary }]}>
                    {c.description}
                  </Text>
                ) : null}
              </View>
              {active ? <CheckCircle2 size={18} color={t.secondary} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </SafeAreaView>
  );
}

/* ------------------------------ QuickAction ------------------------------ */

function QuickAction({
  icon,
  label,
  bg,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionTile,
        { backgroundColor: t.surface, borderColor: t.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text numberOfLines={2} style={[styles.actionLabel, { color: t.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xxl,
  },
  loadWrap: {
    flex: 1,
    padding: spacing.screenX,
    gap: spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerMain: { flexShrink: 1 },
  greeting: { ...typography.bodySmall },
  name: {
    ...typography.pageTitle,
    fontWeight: '800',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
  },
  streakText: {
    ...typography.bodySmall,
    fontWeight: '800',
  },

  // Course chip
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  courseChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
    maxWidth: 220,
  },

  // Sections
  section: { marginTop: spacing.md },

  // Continue learning
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  continueIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBody: { flex: 1, minWidth: 0 },
  continueKicker: {
    ...typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  continueTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
    marginTop: 2,
  },
  continueMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  continueProgress: { marginTop: spacing.xs },
  continueCta: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty continue state
  emptyTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  emptyBody: { ...typography.bodySmall, marginTop: spacing.xxs },

  // Daily row
  dailyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  goalCard: { flex: 1, marginTop: 0 },
  goalValue: {
    ...typography.pageTitle,
    fontWeight: '800',
  },
  goalLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  goalProgress: { marginTop: spacing.sm },
  goalDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  goalDoneText: {
    ...typography.micro,
    fontWeight: '700',
  },
  qotdCard: { flex: 1.4, marginTop: 0 },
  qotdKicker: {
    ...typography.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qotdText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  qotdCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.xs,
  },
  qotdCtaText: {
    ...typography.caption,
    fontWeight: '700',
  },

  // Subjects row
  subjectRow: {
    gap: spacing.sm,
    paddingRight: spacing.screenX,
    paddingTop: spacing.xs,
  },
  subjectEmptyCard: { width: 240 },

  // Weak areas
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weakBody: { flex: 1, minWidth: 0 },
  weakTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
  },

  // Quick actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionTile: {
    width: '23.5%',
    flexGrow: 1,
    minWidth: 78,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.micro,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Course switcher rows
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  courseRowText: { flex: 1, minWidth: 0 },
  courseRowName: {
    ...typography.body,
    fontWeight: '700',
  },
  courseRowMeta: {
    ...typography.caption,
    marginTop: 2,
  },
});
