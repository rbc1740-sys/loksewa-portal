/**
 * Battle Screen - 1v1 real-time practice
 *
 * Feature not implemented yet: per master-prompt rule 19B we must NOT show a
 * misleading actionable CTA. The button is visibly disabled until matchmaking
 * actually ships.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Zap, Clock } from 'lucide-react-native';

export default function BattleScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Zap size={40} color="#f59e0b" />
      </View>
      <Text style={styles.title}>Battle Arena</Text>
      <Text style={styles.subtitle}>
        1v1 real-time practice with peers is coming soon. Check back soon!
      </Text>
      <View style={styles.buttonDisabled}>
        <Clock size={18} color="#94a3b8" />
        <Text style={styles.buttonDisabledText}>Coming Soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonDisabledText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
  },
});