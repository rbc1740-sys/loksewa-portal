/**
 * Phone Auth Screen - Sign in with phone number (OTP)
 */
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Smartphone, ArrowRight, AlertCircle, CheckCircle, Loader } from 'lucide-react-native';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';

export default function PhoneAuthScreen() {
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('NP'); // Default to Nepal
  const [countryDialCode, setCountryDialCode] = useState('+977');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [verificationId, setVerificationId] = useState('');
  const [error, setError] = useState('');
  
  // Country picker
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  
  // Timer for OTP resend
  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setTimer(60);
    }
  }, [step, timer]);
  
  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Note: Full implementation requires @react-native-firebase/auth
      // This is a placeholder showing the flow
      const fullPhone = `${countryDialCode}${phoneNumber}`;
      
      // In production, use:
      // const { signInWithPhone } = await import('../../src/services/auth');
      // await signInWithPhone(fullPhone, handleCodeSent, handleError);
      
      // Mock for development
      setVerificationId('mock_verification_id');
      setStep('otp');
      setTimer(60);
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // In production:
      // const { confirmPhoneCode } = await import('../../src/services/auth');
      // await confirmPhoneCode(verificationId, otp);
      
      // Mock for development
      setTimeout(() => {
        router.replace('/(app)');
      }, 500);
    } catch (err) {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResendOTP = () => {
    if (timer > 0) return;
    setOtp('');
    handleSendOTP();
  };
  
  const formatPhoneInput = (text: string) => {
    // Only allow digits
    return text.replace(/\D/g, '');
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Smartphone size={32} color="#6366f1" />
          </View>
          <Text style={styles.title}>Phone Verification</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' 
              ? 'Enter your phone number to receive a verification code'
              : `Enter the 6-digit code sent to ${countryDialCode} ${phoneNumber}`}
          </Text>
        </View>
        
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {step === 'phone' ? (
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryPicker}>
              <TouchableOpacity style={styles.countryButton} onPress={() => setShowCountryPicker(true)}>
                <View style={styles.countryFlag}>
                  <Text style={styles.flagText}>🇳🇵</Text>
                </View>
                <Text style={styles.countryCodeText}>{countryDialCode}</Text>
                <ArrowRight size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={formatPhoneInput}
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
            />
          </View>
        ) : (
          <View style={styles.otpContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="••••••"
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              autoComplete="one-time-code"
            />
            <TouchableOpacity
              style={[styles.resendButton, timer > 0 && styles.resendDisabled]}
              onPress={handleResendOTP}
              disabled={timer > 0 || loading}
            >
              <Text style={styles.resendText}>
                {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonLoading]}
          onPress={step === 'phone' ? handleSendOTP : handleVerifyOTP}
          disabled={loading}
        >
          {loading ? (
            <Loader size={24} color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {step === 'phone' ? 'Send Verification Code' : 'Verify & Continue'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('phone')}>
          <Text style={styles.backText}>
            {step === 'otp' ? 'Change phone number' : 'Back to sign in options'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <CountryPicker
        visible={showCountryPicker}
        countryCode={countryCode as CountryCode}
        withFilter
        withCloseButton
        withCallingCodeButton
        withFlagButton
        onSelect={(country) => {
          setCountryCode(country.cca2);
          const dial = Array.isArray(country.callingCode)
            ? country.callingCode[0]
            : country.callingCode;
          setCountryDialCode(`+${dial || ''}`);
          setShowCountryPicker(false);
        }}
        onClose={() => setShowCountryPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    paddingHorizontal: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    flex: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  countryPicker: {
    width: 100,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  countryFlag: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  flagText: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  otpContainer: {
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 18,
    fontSize: 28,
    color: '#0f172a',
    letterSpacing: 24,
    textAlign: 'center',
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
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
  backButton: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});