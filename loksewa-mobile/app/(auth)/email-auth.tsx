/**
 * Email Auth Screen - Sign in / Sign up with email
 */
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TextInputProps } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react-native';
import { signInWithEmail, signUpWithEmail, resetPassword } from '../../src/services/auth';

// RN's TextInput has no leftIcon/rightIcon; the visual design puts them as
// row siblings inside a styled container, so we wrap them here.
function AuthInput({
  leftIcon,
  rightIcon,
  error,
  ...inputProps
}: TextInputProps & { leftIcon?: ReactNode; rightIcon?: ReactNode; error?: boolean }) {
  return (
    <View style={[styles.input, error && styles.inputError]}>
      {leftIcon}
      <TextInput style={styles.inputInner} {...inputProps} />
      {rightIcon}
    </View>
  );
}

export default function EmailAuthScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode === 'signup';
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (isSignUp) {
      if (!formData.displayName.trim()) {
        newErrors.displayName = 'Display name is required';
      } else if (formData.displayName.trim().length < 2) {
        newErrors.displayName = 'Display name must be at least 2 characters';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(formData.email.trim(), formData.password, formData.displayName.trim());
      } else {
        await signInWithEmail(formData.email.trim(), formData.password);
      }
      setSuccess(true);
      setTimeout(() => router.replace('/(app)'), 500);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        setErrors({ email: 'An account with this email already exists' });
      } else if (err.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address' });
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrors({ password: 'Invalid email or password' });
      } else if (err.code === 'auth/weak-password') {
        setErrors({ password: 'Password should be at least 6 characters' });
      } else {
        setErrors({ general: err.message || 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    if (!formData.email.trim()) {
      setErrors({ email: 'Enter your email first' });
      return;
    }
    
    try {
      await resetPassword(formData.email.trim());
      alert('Password reset email sent! Check your inbox.');
    } catch (error) {
      alert('Failed to send reset email. Please try again.');
    }
  };
  
  const toggleMode = () => {
    router.replace(`/(auth)/email-auth?mode=${isSignUp ? 'signin' : 'signup'}`);
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Start your Loksewa preparation journey' : 'Sign in to continue your progress'}
          </Text>
        </View>
        
        {errors.general && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.errorText}>{errors.general}</Text>
          </View>
        )}
        
        {isSignUp && (
          <View style={styles.inputGroup}>
            <AuthInput
              error={!!errors.displayName}
              leftIcon={<User size={20} color="#94a3b8" />}
              placeholder="Display Name"
              value={formData.displayName}
              onChangeText={(text) => setFormData({ ...formData, displayName: text })}
              autoCapitalize="words"
              autoComplete="name"
            />
            {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}
          </View>
        )}
        
        <View style={styles.inputGroup}>
          <AuthInput
            error={!!errors.email}
            leftIcon={<Mail size={20} color="#94a3b8" />}
            placeholder="Email Address"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <AuthInput
            error={!!errors.password}
            leftIcon={<Lock size={20} color="#94a3b8" />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
              </TouchableOpacity>
            }
            placeholder="Password"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            secureTextEntry={!showPassword}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>
        
        {isSignUp && (
          <View style={styles.inputGroup}>
            <AuthInput
              error={!!errors.confirmPassword}
              leftIcon={<Lock size={20} color="#94a3b8" />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
                </TouchableOpacity>
              }
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>
        )}
        
        {!isSignUp && (
          <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonLoading]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonSpinner}>
              <CheckCircle size={24} color="#fff" />
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <Text style={styles.dividerText}>or</Text>
        </View>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={toggleMode}>
          <Text style={styles.secondaryButtonText}>
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    gap: 8,
  },
  inputInner: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 16,
  },
  dividerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
});