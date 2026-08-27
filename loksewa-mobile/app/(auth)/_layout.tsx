/**
 * Auth Layout - Stack navigator for auth screens
 */
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);

  // Already signed in — send straight to the app.
  if (user) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="auth-choice" />
      <Stack.Screen name="email-auth" />
      <Stack.Screen name="phone-auth" />
      <Stack.Screen name="profile-setup" />
    </Stack>
  );
}