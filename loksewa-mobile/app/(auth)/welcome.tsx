/**
 * Welcome Screen - First screen users see
 */
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Target, Shield, Users } from 'lucide-react-native';

export default function WelcomeScreen() {
  const router = useRouter();
  
  const features = [
    { icon: Target, title: '4,600+ MCQs', desc: 'Civil Engineering & GK for Loksewa' },
    { icon: Sparkles, title: 'Smart Learning', desc: 'Spaced repetition & AI recommendations' },
    { icon: Users, title: 'Battle Arena', desc: '1v1 real-time practice with peers' },
    { icon: Shield, title: 'Offline First', desc: 'Study anywhere, sync when online' },
  ];
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Loksewa Prep Pro</Text>
        <Text style={styles.tagline}>Your path to civil service success</Text>
      </View>

      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature.title} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <feature.icon size={24} color="#6366f1" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/auth-choice')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
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
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    fontFamily: 'Outfit_800ExtraBold',
  },
  tagline: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  features: {
    paddingVertical: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  featureTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  featureDesc: {
    fontSize: 14,
    color: '#64748b',
  },
  footer: {
    paddingBottom: 40,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  termsText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});