/**
 * Auth Store - Zustand for authentication state
 */
import { create } from 'zustand';
import { User } from 'firebase/auth';
import {
  onAuthStateChange,
  getCurrentUser,
  signUpWithEmail,
  signInWithEmail,
  signInAnonymously_,
  signInWithGoogle,
  signInWithApple,
  signOut_,
  updateUserProfile,
  deleteAccount,
  resetPassword,
  linkGoogleAccount,
  linkAppleAccount,
} from '../services/auth';

interface AuthState {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  hydrate: () => () => void;
  setInitialized: (value: boolean) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (displayName?: string, photoURL?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // Auth methods
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  
  // Link providers
  linkGoogle: () => Promise<void>;
  linkApple: () => Promise<void>;
  
  // Clear error
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  loading: false,
  error: null,
  
  hydrate: () => {
    const unsubscribe = onAuthStateChange((user) => {
      set({ user, initialized: true, loading: false });
    });
    
    // Also check current user immediately
    const currentUser = getCurrentUser();
    if (currentUser) {
      set({ user: currentUser, initialized: true, loading: false });
    } else {
      set({ initialized: true, loading: false });
    }
    
    return unsubscribe;
  },
  
  setInitialized: (value) => set({ initialized: value }),
  
  clearError: () => set({ error: null }),
  
  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await signOut_();
      set({ user: null, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  deleteAccount: async () => {
    set({ loading: true, error: null });
    try {
      await deleteAccount();
      set({ user: null, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  updateProfile: async (displayName?: string, photoURL?: string) => {
    set({ loading: true, error: null });
    try {
      await updateUserProfile(displayName, photoURL);
      set({ loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  resetPassword: async (email: string) => {
    set({ loading: true, error: null });
    try {
      await resetPassword(email);
      set({ loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  signUpWithEmail: async (email: string, password: string, displayName: string) => {
    set({ loading: true, error: null });
    try {
      const user = await signUpWithEmail(email, password, displayName);
      set({ user, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  signInWithEmail: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const user = await signInWithEmail(email, password);
      set({ user, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  signInAnonymously: async () => {
    set({ loading: true, error: null });
    try {
      const user = await signInAnonymously_();
      set({ user, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const user = await signInWithGoogle();
      set({ user, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  signInWithApple: async () => {
    set({ loading: true, error: null });
    try {
      const user = await signInWithApple();
      set({ user, loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  linkGoogle: async () => {
    set({ loading: true, error: null });
    try {
      await linkGoogleAccount();
      set({ loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
  
  linkApple: async () => {
    set({ loading: true, error: null });
    try {
      await linkAppleAccount();
      set({ loading: false });
    } catch (err) {
      const error = err as Error;
      set({ error: error.message, loading: false });
      throw err;
    }
  },
}));