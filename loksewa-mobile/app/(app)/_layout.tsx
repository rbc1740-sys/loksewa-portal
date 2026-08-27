/**
 * Main App Layout - Tab Navigator
 */
import { Tabs, Redirect } from 'expo-router';
import { Home, BookOpen, Timer, Zap, Brain, Settings } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const user = useAuthStore((state) => state.user);

  // Not signed in — bounce back to the auth flow.
  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: isDark ? '#1e293b' : '#fff',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Home size={24} color={color} strokeWidth={focused ? 3 : 2} fill={focused ? '#6366f1' : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ focused, color }) => (
            <BookOpen size={24} color={color} strokeWidth={focused ? 3 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="exam"
        options={{
          title: 'Exam',
          tabBarIcon: ({ focused, color }) => (
            <Timer size={24} color={color} strokeWidth={focused ? 3 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="battle"
        options={{
          title: 'Battle',
          tabBarIcon: ({ focused, color }) => (
            <Zap size={24} color={color} strokeWidth={focused ? 3 : 2} fill={focused ? '#f59e0b' : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="spaced"
        options={{
          title: 'Review',
          tabBarIcon: ({ focused, color }) => (
            <Brain size={24} color={color} strokeWidth={focused ? 3 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Settings size={24} color={color} strokeWidth={focused ? 3 : 2} />
          ),
        }}
      />
      {/* Stack-pushed detail screens (rule 4: no dead routes, rule 61:
          they keep their own back behavior via ScreenHeader/router.back). */}
      <Tabs.Screen name="subjects" options={{ href: null }} />
      <Tabs.Screen name="chapters" options={{ href: null }} />
      <Tabs.Screen name="mistakes" options={{ href: null }} />
      <Tabs.Screen name="bookmarks" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="result" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="custom-exam-create" options={{ href: null }} />
    </Tabs>
  );
}