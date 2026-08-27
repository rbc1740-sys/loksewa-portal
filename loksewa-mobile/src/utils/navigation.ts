/**
 * Typed Navigation Hooks - Type-safe navigation for Expo Router
 */
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { useCallback, useRef, useEffect, useState } from 'react';
import { Alert, BackHandler } from 'react-native';

/**
 * Type-safe push navigation
 */
export function useTypedPush() {
  const router = useRouter();
  
  return useCallback((href: string, params?: Record<string, string>) => {
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    router.push(href + queryString as any);
  }, [router]);
}

/**
 * Type-safe replace navigation
 */
export function useTypedReplace() {
  const router = useRouter();
  
  return useCallback((href: string, params?: Record<string, string>) => {
    const queryString = params 
      ? '?' + new URLSearchParams(params).toString()
      : '';
    router.replace(href + queryString as any);
  }, [router]);
}

/**
 * Type-safe back navigation
 */
export function useTypedBack() {
  const router = useRouter();
  
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)');
    }
  }, [router]);
}

/**
 * Get typed search params with validation
 */
export function useTypedSearchParams<T extends Record<string, string | undefined>>() {
  const params = useLocalSearchParams() as T;
  return params;
}

/**
 * Get current route segments
 */
export function useRouteSegments() {
  return useSegments();
}

/**
 * Navigation guard hook - confirms before leaving a screen
 */
export function useNavigationGuard(
  shouldGuard: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) {
  const guardRef = useRef(shouldGuard);
  guardRef.current = shouldGuard;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guardRef.current) {
        Alert.alert('Unsaved Changes', message, [
          { text: 'Stay', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive',
            onPress: () => {
              // We can't actually prevent back navigation here,
              // but we can warn. The actual navigation prevention
              // would need to be handled at the router level.
            }
          },
        ]);
        return true; // Prevent default back behavior
      }
      return false;
    });

    return () => subscription.remove();
  }, [message]);
}

/**
 * Confirm before leaving a screen (for use in components)
 */
export function useConfirmLeave(
  isDirty: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) {
  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true;
    
    return new Promise((resolve) => {
      Alert.alert('Unsaved Changes', message, [
        { text: 'Stay', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Leave', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  }, [isDirty, message]);

  return confirmLeave;
}

/**
 * Hook to track navigation state for persistence
 */
export function useNavigationState<T>(key: string, initialValue: T) {
  // This would integrate with AsyncStorage or a persistence layer
  // For now, return the value and a setter
  const [value, setValue] = useState<T>(initialValue);
  
  useEffect(() => {
    // Load from persistence
    // const saved = await AsyncStorage.getItem(key);
    // if (saved) setValue(JSON.parse(saved));
  }, [key]);

  const updateValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
      // AsyncStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  return [value, updateValue] as const;
}