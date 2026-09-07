/**
 * Auth Choice Screen - Select sign-in method
 */
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Smartphone, Globe, Apple, User, Lock } from 'lucide-react-native';

export default function AuthChoiceScreen() {
  const router = useRouter();
  
  const authOptions = [
    {
      icon: Mail,
      title: 'Email & Password',
      desc: 'Create account or sign in with email',
      onPress: () => router.push('/(auth)/email-auth?mode=signin'),
      color: '#6366f1',
    },
    {
      icon: Smartphone,
      title: 'Phone Number (OTP)',
      desc: 'Sign in with SMS verification',
      onPress: () => router.push('/(auth)/phone-auth'),
      color: '#10b981',
    },
    {
      icon: Globe,
      title: 'Continue with Google',
      desc: 'One-tap sign in with Google account',
      onPress: () => handleGoogleSignIn(),
      color: '#ea4335',
      variant: 'outline',
    },
    {
      icon: Apple,
      title: 'Continue with Apple',
      desc: 'Private sign in with Apple ID',
      onPress: () => handleAppleSignIn(),
      color: '#000',
      variant: 'outline',
      iosOnly: true,
    },
    {
      icon: User,
      title: 'Continue as Guest',
      desc: 'Try the app without an account',
      onPress: () => handleGuestSignIn(),
      color: '#64748b',
      variant: 'ghost',
    },
  ];
  
  const describeError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    return 'Please try again.';
  };

  const handleGoogleSignIn = async () => {
    try {
      const { signInWithGoogle } = await import('../../src/services/auth');
      await signInWithGoogle();
      router.replace('/(app)');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      alert(`Google sign-in failed: ${describeError(error)}`);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const { signInWithApple } = await import('../../src/services/auth');
      await signInWithApple();
      router.replace('/(app)');
    } catch (error) {
      console.error('Apple sign-in failed:', error);
      alert(`Apple sign-in failed: ${describeError(error)}`);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      const { signInAnonymously_ } = await import('../../src/services/auth');
      await signInAnonymously_();
      router.replace('/(app)');
    } catch (error) {
      console.error('Guest sign-in failed:', error);
      alert(`Guest sign-in failed: ${describeError(error)}`);
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose how to continue</Text>
        <Text style={styles.subtitle}>Your progress will be saved and synced</Text>
      </View>
      
      <View style={styles.options}>
        {authOptions.map((option, index) => {
          if (option.iosOnly && require('react-native').Platform.OS !== 'ios') {
            return null;
          }
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                option.variant === 'outline' && styles.optionOutline,
                option.variant === 'ghost' && styles.optionGhost,
              ]}
              onPress={option.onPress}
            >
              <View style={[{ backgroundColor: option.color }, styles.optionIcon]}>
                <option.icon size={22} color={option.variant === 'outline' ? option.color : '#fff'} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, option.variant === 'ghost' && { color: option.color }]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionDesc, option.variant === 'ghost' && { color: '#94a3b8' }]}>
                  {option.desc}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      
      <Text style={styles.footerText}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </Text>
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
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  options: {
    gap: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionOutline: {
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  optionGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 14,
    color: '#64748b',
  },
  footerText: {
    marginTop: 32,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});