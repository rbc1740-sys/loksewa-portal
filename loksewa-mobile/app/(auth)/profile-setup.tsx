/**
 * Profile Setup Screen - Post-auth onboarding
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Calendar, Bell, Target, Palette, Sparkles, ArrowRight } from 'lucide-react-native';
import { upsertUserProfile } from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [examDate, setExamDate] = useState<Date | null>(null);
  const [dailyGoal, setDailyGoal] = useState(30);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [accentColor, setAccentColor] = useState('indigo');
  const [loading, setLoading] = useState(false);

  /** Helper: a date N months from today (for exam target presets). */
  const monthsAheadDate = (months: number): Date => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d;
  };
  
  const accentColors = [
    { id: 'indigo', label: 'Indigo', color: '#6366f1' },
    { id: 'blue', label: 'Blue', color: '#3b82f6' },
    { id: 'emerald', label: 'Emerald', color: '#10b981' },
    { id: 'amber', label: 'Amber', color: '#f59e0b' },
    { id: 'rose', label: 'Rose', color: '#f43f5e' },
    { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  ];
  
  const handleContinue = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await upsertUserProfile({
        user_id: user.uid,
        exam_target_date: examDate?.getTime(),
        daily_goal_minutes: dailyGoal,
        theme,
        accent_color: accentColor,
        // notification_token will be set after FCM registration
      });
      router.replace('/(app)');
    } catch (error) {
      console.error('Profile setup failed:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSkip = () => {
    router.replace('/(app)');
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '80%' }]} />
        </View>
        <Text style={styles.stepText}>Step 3 of 3</Text>
        <Text style={styles.title}>Personalize your experience</Text>
        <Text style={styles.subtitle}>Help us tailor your study plan</Text>
      </View>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Target size={20} color="#6366f1" />
          <Text style={styles.sectionTitle}>Exam Target</Text>
        </View>
        {examDate && (
          <View style={styles.dateButton}>
            <View style={styles.dateContent}>
              <Calendar size={20} color="#6366f1" />
              <Text style={[styles.dateText, { color: '#0f172a', fontWeight: '600' }]}>
                {examDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setExamDate(null)}>
              <Text style={styles.dateClear}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.datePresets}>
          {[3, 6, 12].map(months => (
            <TouchableOpacity
              key={months}
              style={[
                styles.presetChip,
                examDate?.getTime() === monthsAheadDate(months)?.getTime() && styles.presetChipActive,
              ]}
              onPress={() => setExamDate(monthsAheadDate(months))}
            >
              <Text style={[
                styles.presetChipText,
                examDate?.getTime() === monthsAheadDate(months)?.getTime() && styles.presetChipTextActive,
              ]}>In {months} months</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sectionHint}>We'll create a personalized countdown and daily targets</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={20} color="#10b981" />
          <Text style={styles.sectionTitle}>Daily Goal</Text>
        </View>
        <View style={styles.goalValue}>
          <Text style={styles.goalNumber}>{dailyGoal}</Text>
          <Text style={styles.goalUnit}>min/day</Text>
        </View>
        <View style={styles.datePresets}>
          {[15, 30, 60, 90, 120].map(mins => (
            <TouchableOpacity
              key={mins}
              style={[styles.presetChip, dailyGoal === mins && styles.presetChipActive]}
              onPress={() => setDailyGoal(mins)}
            >
              <Text style={[
                styles.presetChipText,
                dailyGoal === mins && styles.presetChipTextActive,
              ]}>{mins}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Bell size={20} color="#f59e0b" />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <TouchableOpacity 
          style={[
            styles.toggleButton,
            notificationsEnabled && styles.toggleOn,
          ]}
          onPress={() => setNotificationsEnabled(!notificationsEnabled)}
        >
          <View style={[
            styles.toggleThumb,
            notificationsEnabled && styles.toggleThumbOn,
          ]} />
        </TouchableOpacity>
        <Text style={styles.sectionHint}>
          {notificationsEnabled 
            ? 'Streak reminders, review alerts, battle invites' 
            : 'You can enable this later in Settings'}
        </Text>
      </View>
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Palette size={20} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>Theme & Color</Text>
        </View>
        <View style={styles.themeOptions}>
          {(['light', 'dark', 'system'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                styles.themeOption,
                theme === t && styles.themeOptionSelected,
              ]}
              onPress={() => setTheme(t)}
            >
              <Text style={[
                styles.themeOptionText,
                theme === t && styles.themeOptionTextSelected,
              ]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.colorOptions}>
          {accentColors.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.colorOption,
                accentColor === c.id && styles.colorOptionSelected,
              ]}
              onPress={() => setAccentColor(c.id)}
            >
              <View style={[
                styles.colorCircle,
                { backgroundColor: c.color },
                accentColor === c.id && styles.colorCircleSelected,
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonLoading]}
        onPress={handleContinue}
        disabled={loading}
      >
        {loading ? (
          <View style={styles.buttonSpinner} />
        ) : (
          <Text style={styles.buttonText}>Continue to App</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#0f172a',
  },
  goalValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  goalNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#6366f1',
  },
  goalUnit: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 4,
  },
  datePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 40,
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  presetChipTextActive: {
    color: '#fff',
  },
  dateClear: {
    fontSize: 16,
    color: '#94a3b8',
    paddingHorizontal: 8,
  },
  toggleButton: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleOn: {
    backgroundColor: '#6366f1',
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    marginLeft: 24,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  themeOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  themeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  themeOptionTextSelected: {
    color: '#6366f1',
  },
  colorOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.15 }],
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  buttonSpinner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
});