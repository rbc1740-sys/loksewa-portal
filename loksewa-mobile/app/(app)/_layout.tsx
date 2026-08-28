/**
 * Main App Layout - Tab Navigator
 */
import { Tabs, Redirect } from 'expo-router';
import { Home, BookOpen, Timer, Brain, Settings } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';

export default function AppLayout() {
  const t = useTheme();
  const user = useAuthStore((state) => state.user);

  // Not signed in — bounce back to the auth flow.
  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.secondary,
        tabBarInactiveTintColor: t.textTertiary,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: t.dark ? 0.3 : 0.1,
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
            <Home size={24} color={color} strokeWidth={focused ? 3 : 2} fill={focused ? t.secondary : 'none'} />
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
          title: 'Exams',
          tabBarIcon: ({ focused, color }) => (
            <Timer size={24} color={color} strokeWidth={focused ? 3 : 2} />
          ),
        }}
      />
      {/* Battle is reachable from Home/Exams quick actions, not primary nav */}
      <Tabs.Screen name="battle" options={{ href: null }} />
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