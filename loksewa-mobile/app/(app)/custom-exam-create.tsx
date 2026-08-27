/**
 * CustomExamCreate — build a custom exam (rule 27): choose subjects, question
 * count, duration and marking, then persist via the custom-exam store. Saving
 * is idempotent (same config produces the same stored exam, not a duplicate).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTypedPush } from '../../src/utils/navigation';
import { useAuthStore } from '../../src/stores/authStore';
import { useCustomExamStore } from '../../src/stores/customExamStore';
import { COURSES } from '../../src/constants/courses';
import { themes, spacing, radius, typography, touchTarget } from '../../src/constants/theme';
import { AppButton, ScreenHeader } from '../../src/components/ui';

/** Subject options always mirror the seeded catalog — never a hardcoded copy. */
const SUBJECTS = COURSES.flatMap(c => c.subjects.map(s => ({ id: s.id, name: s.name })));

/** chapterId -> owning subjectId, derived from the catalog (prune helper). */
const CHAPTER_SUBJECT = new Map<string, string>(
  COURSES.flatMap(c =>
    c.subjects.flatMap(s => s.chapters.map(ch => [ch.id, s.id] as const))
  )
);

export default function CustomExamCreateScreen() {
  const push = useTypedPush();
  const user = useAuthStore(s => s.user);

  const [title, setTitle] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>(['ce_technical']);
  /** Empty = all chapters of the selected subjects. */
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [marks, setMarks] = useState(1);
  const [negative, setNegative] = useState(0);
  const [pass, setPass] = useState(40);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSubject = useCallback((id: string) => {
    setSubjectIds(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
    // Keep the config consistent: drop chapters owned by a deselected subject.
    setChapterIds(prev => prev.filter(cid => CHAPTER_SUBJECT.get(cid) !== id));
  }, []);

  const toggleChapter = useCallback((id: string) => {
    setChapterIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));
  }, []);

  const save = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;
    if (!title.trim()) { setError('Give your exam a title.'); return; }
    if (subjectIds.length === 0) { setError('Select at least one subject.'); return; }
    setSaving(true);
    setError(null);
    try {
      await useCustomExamStore.getState().save(uid, {
        title: title.trim().slice(0, 80),
        description: undefined,
        subjectIds,
        chapterIds,
        questionCount: Math.max(1, Math.min(200, Math.round(count || 20))),
        durationSeconds: Math.round(minutes) * 60,
        marksPerQuestion: Math.max(1, Math.round(marks || 1)),
        negativeMarks: Math.max(0, Number(negative) || 0),
        passPercent: Math.min(100, Math.max(1, Math.round(pass || 40))),
      });
      push('/exam');
    } catch (e) {
      console.error('[CustomCreate] save failed', e);
      setError('Could not save the custom exam.');
      setSaving(false);
    }
  }, [user?.uid, title, subjectIds, chapterIds, count, minutes, marks, negative, pass, push]);

  // Chapters offered for selection follow the currently selected subjects.
  const chapterOptions = COURSES
    .flatMap(c => c.subjects)
    .filter(s => subjectIds.includes(s.id))
    .flatMap(s => s.chapters.map(ch => ({ id: ch.id, name: ch.name })));

  const t = themes.light;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Create Custom Exam" subtitle="Pick subjects, duration & marking" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Exam Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Structural Mock — 25 Q"
            maxLength={80}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Subjects</Text>
          <View style={styles.chipRow}>
            {SUBJECTS.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.chip,
                  subjectIds.includes(s.id) && styles.chipActive,
                ]}
                onPress={() => toggleSubject(s.id)}
              >
                <Text style={[
                  styles.chipText,
                  subjectIds.includes(s.id) && styles.chipTextActive,
                ]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {chapterOptions.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Chapters (optional)</Text>
            <Text style={styles.hint}>
              Leave empty to include all chapters of the selected subjects.
            </Text>
            <View style={styles.chipRow}>
              {chapterOptions.map(ch => {
                const active = chapterIds.includes(ch.id);
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleChapter(ch.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {ch.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.twoCols}>
          <View style={styles.field}>
            <Text style={styles.label}>Questions</Text>
            <TextInput
              style={styles.input}
              value={String(count)}
              onChangeText={t => setCount(Number(t) || 0)}
              placeholder="20"
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Duration (min)</Text>
            <TextInput
              style={styles.input}
              value={String(minutes)}
              onChangeText={t => setMinutes(Number(t) || 0)}
              placeholder="30"
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.twoCols}>
          <View style={styles.field}>
            <Text style={styles.label}>Marks / Q</Text>
            <TextInput
              style={styles.input}
              value={String(marks)}
              onChangeText={t => setMarks(Number(t) || 0)}
              placeholder="1"
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Negative Marks</Text>
            <TextInput
              style={styles.input}
              value={String(negative)}
              onChangeText={t => setNegative(Number(t) || 0)}
              placeholder="0"
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Pass %</Text>
          <TextInput
            style={styles.input}
            value={String(pass)}
            onChangeText={t => setPass(Number(t) || 0)}
            placeholder="40"
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <AppButton
            label={saving ? 'Saving…' : 'Save & Start Exam'}
            onPress={save}
            disabled={saving}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: spacing.screenX, gap: spacing.lg, paddingBottom: spacing.xxl },
  field: { gap: spacing.xs },
  label: { ...typography.bodySmall, fontWeight: '700', color: themes.light.textSecondary },
  hint: { ...typography.micro, color: themes.light.textTertiary },
  input: {
    height: 48,
    backgroundColor: themes.light.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themes.light.border,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: themes.light.textPrimary,
  },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: themes.light.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themes.light.border,
  },
  chipActive: { backgroundColor: themes.light.primary, borderColor: themes.light.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: themes.light.textSecondary },
  chipTextActive: { color: themes.light.textOnPrimary },
  errorBox: {
    backgroundColor: themes.light.errorSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: { fontSize: 14, fontWeight: '500' },
});