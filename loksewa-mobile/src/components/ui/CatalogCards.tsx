/**
 * CatalogCards — SubjectCard / ChapterCard / TopicCard for the
 * Course → Subject → Chapter → Topic hierarchy (master-prompt rule 7).
 *
 * All share one visual language: name, meta line, progress row with accuracy.
 * Data comes from database.ts progress queries — never invented.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { spacing, typography } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { AppCard } from './AppCard';
import { ProgressBar } from './ProgressBar';

export function formatAccuracy(accuracy: number | undefined): string {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return '—';
  return `${Math.round(accuracy * 100)}%`;
}

/* ---------------------------------- Subject ---------------------------------- */

export interface SubjectCardProps {
  name: string;
  questionCount: number;
  attempted?: number;
  accuracy?: number;
  /** 0..1 */
  completion?: number;
  onPress?: () => void;
}

export function SubjectCard({
  name,
  questionCount,
  attempted,
  accuracy,
  completion,
  onPress,
}: SubjectCardProps) {
  const t = useTheme();

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={[styles.name, { color: t.textPrimary }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.sub, { color: t.textSecondary }]} numberOfLines={1}>
            {questionCount} question{questionCount === 1 ? '' : 's'}
            {attempted !== undefined ? ` · ${attempted} attempted` : ''}
          </Text>
        </View>
        <ChevronRight size={20} color={t.textTertiary} />
      </View>
      {completion !== undefined ? (
        <View style={styles.progressRow}>
          <ProgressBar progress={completion} height={6} accessibilityLabel={`${name} completion`} />
          <Text style={[styles.progressPct, { color: t.textTertiary }]}>
            {Math.round(completion * 100)}%
          </Text>
          {accuracy !== undefined ? (
            <Text style={[styles.accuracy, { color: t.textSecondary }]}>
              {formatAccuracy(accuracy)} accuracy
            </Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

/* ---------------------------------- Chapter ---------------------------------- */

export interface ChapterCardProps {
  name: string;
  questionCount: number;
  /** 0..1 */
  progress?: number;
  accuracy?: number;
  lastStudied?: string;
  onPress?: () => void;
}

export function ChapterCard({
  name,
  questionCount,
  progress,
  accuracy,
  lastStudied,
  onPress,
}: ChapterCardProps) {
  const t = useTheme();

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={[styles.name, { color: t.textPrimary }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.sub, { color: t.textSecondary }]} numberOfLines={1}>
            {questionCount} question{questionCount === 1 ? '' : 's'}
            {lastStudied ? ` · ${lastStudied}` : ''}
          </Text>
        </View>
        <ChevronRight size={20} color={t.textTertiary} />
      </View>
      {progress !== undefined ? (
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} height={6} accessibilityLabel={`${name} progress`} />
          <Text style={[styles.progressPct, { color: t.textTertiary }]}>
            {Math.round(progress * 100)}%
          </Text>
          {accuracy !== undefined ? (
            <Text style={[styles.accuracy, { color: t.textSecondary }]}>
              {formatAccuracy(accuracy)} accuracy
            </Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

/* ----------------------------------- Topic ----------------------------------- */

export interface TopicCardProps {
  name: string;
  questionCount: number;
  /** 0..1 */
  progress?: number;
  accuracy?: number;
  onPress?: () => void;
}

export function TopicCard({
  name,
  questionCount,
  progress,
  accuracy,
  onPress,
}: TopicCardProps) {
  const t = useTheme();

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={[styles.name, { color: t.textPrimary }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[styles.sub, { color: t.textSecondary }]} numberOfLines={1}>
            {questionCount} question{questionCount === 1 ? '' : 's'}
            {progress !== undefined ? ` · ${Math.round(progress * 100)}% done` : ''}
          </Text>
        </View>
        <ChevronRight size={20} color={t.textTertiary} />
      </View>
      {progress !== undefined ? (
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} height={6} accessibilityLabel={`${name} progress`} />
          <Text style={[styles.progressPct, { color: t.textTertiary }]}>
            {Math.round(progress * 100)}%
          </Text>
          {accuracy !== undefined ? (
            <Text style={[styles.accuracy, { color: t.textSecondary }]}>
              {formatAccuracy(accuracy)} accuracy
            </Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  sub: {
    ...typography.bodySmall,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressPct: {
    ...typography.micro,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },
  accuracy: {
    ...typography.micro,
  },
});
