/**
 * Auth Service - Firebase Authentication with all 5 providers
 * Email/Password, Phone (OTP), Google, Apple, Anonymous
 */
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged,
  User,
  Auth,
  PhoneAuthProvider,
  RecaptchaVerifier,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  EmailAuthProvider,
  signInWithCredential,
  setPersistence,
  browserLocalPersistence,
  type Persistence,
} from 'firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../utils/firebaseConfig';

// Configure WebBrowser for auth sessions
WebBrowser.maybeCompleteAuthSession();

// Firebase JS SDK ships a React Native build (`@firebase/auth/dist/rn`) whose
// `getReactNativePersistence` wraps AsyncStorage. Metro resolves `firebase/auth`
// to that build, but the public (browser) type declarations don't expose the
// helper — so we require it defensively. Using `browserLocalPersistence` on
// native would throw (`localStorage` doesn't exist there).
function getAuthPersistence(): Persistence {
  if (Platform.OS === 'web') {
    return browserLocalPersistence;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authModule = require('firebase/auth') as {
    getReactNativePersistence?: (storage: unknown) => Persistence;
  };

  if (typeof authModule.getReactNativePersistence !== 'function') {
    throw new Error(
      'Firebase React Native persistence is unavailable. Ensure @react-native-async-storage/async-storage is installed.'
    );
  }

  return authModule.getReactNativePersistence(AsyncStorage);
}

// Initialize Firebase
let auth: Auth | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

export function initializeFirebase(): { auth: Auth; db: ReturnType<typeof getFirestore> } {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  
  const app = getApp();
  
  if (!auth) {
    auth = initializeAuth(app, {
      persistence: getAuthPersistence(),
    });
  }
  
  if (!db) {
    db = getFirestore(app);
  }
  
  return { auth, db };
}

export function getAuthInstance(): Auth {
  if (!auth) initializeFirebase();
  return auth!;
}

export function getFirestoreInstance() {
  if (!db) initializeFirebase();
  return db!;
}

// Auth state listener
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const authInstance = getAuthInstance();
  return onAuthStateChanged(authInstance, callback);
}

// Current user
export function getCurrentUser(): User | null {
  return getAuthInstance().currentUser;
}

// ==================== Email/Password ====================

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const authInstance = getAuthInstance();
  const cred = await createUserWithEmailAndPassword(authInstance, email, password);
  await updateProfile(cred.user, { displayName });
  await createUserDocument(cred.user.uid, { email, displayName });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const authInstance = getAuthInstance();
  const cred = await signInWithEmailAndPassword(authInstance, email, password);
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  const authInstance = getAuthInstance();
  await sendPasswordResetEmail(authInstance, email);
}

// ==================== Anonymous (Guest) ====================

export async function signInAnonymously_(): Promise<User> {
  const authInstance = getAuthInstance();
  const cred = await signInAnonymously(authInstance);
  await createUserDocument(cred.user.uid, { isAnonymous: true });
  return cred.user;
}

export async function upgradeAnonymousAccount(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const authInstance = getAuthInstance();
  const user = authInstance.currentUser;
  
  if (!user?.isAnonymous) {
    throw new Error('Current user is not anonymous');
  }
  
  const credential = EmailAuthProvider.credential(email, password);
  const cred = await linkWithCredential(user, credential);
  await updateProfile(cred.user, { displayName });
  await createUserDocument(cred.user.uid, { email, displayName, upgradedFromAnonymous: true });
  return cred.user;
}

// ==================== Phone Auth (OTP) ====================

let recaptchaVerifier: RecaptchaVerifier | null = null;

export async function signInWithPhone(
  phoneNumber: string,
  onCodeSent: (verificationId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  const authInstance = getAuthInstance();
  const provider = new PhoneAuthProvider(authInstance);
  
  // For React Native, we need to use the native Firebase Auth phone auth
  // This is a simplified version - in production use @react-native-firebase/auth directly
  try {
    // Phone auth with the Firebase JS SDK requires a real reCAPTCHA/verification
    // flow (or an SMS provider). Not wired up yet.
    throw new Error('Phone auth is not configured yet.');
  } catch (error) {
    onError(error as Error);
  }
}

export async function confirmPhoneCode(
  verificationId: string,
  code: string
): Promise<User> {
  const authInstance = getAuthInstance();
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const cred = await signInWithCredential(authInstance, credential);
  await createUserDocument(cred.user.uid, { phoneNumber: cred.user.phoneNumber });
  return cred.user;
}

// ==================== Google Sign-In ====================
//
// Client IDs come from google-services.json (project loksewa-portal-8a3ae):
//   - Web client  (client_type 3) — used on web and to verify id_token audience
//   - iOS client  (client_type 2) — used for the custom-scheme flow on iOS
//   - Android client (client_type 1) — create it in Google Cloud console
//     (Credentials → Create → Android, package com.loksewa.preppro + SHA-1),
//     then paste its client ID below.
const GOOGLE_WEB_CLIENT_ID = '611217654714-lle2m1k1grtidmv4gqi9fqpoqa8a0ac0.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '611217654714-5ibc68spvfjdssg89nj3rng41vrm0428.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = ''; // ← paste your Android client ID here

// Google automatically trusts `<applicationId>:/oauthredirect` for installed-app
// clients (iOS/Android types), so no manual redirect URIs are needed.
const GOOGLE_NATIVE_REDIRECT = 'com.loksewa.preppro:/oauthredirect';

function getPlatformGoogleClientId(): string {
  if (Platform.OS === 'ios') return GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === 'android') {
    if (!GOOGLE_ANDROID_CLIENT_ID) {
      throw new Error(
        'Android Google sign-in is not configured. Create an Android OAuth client ID in Google Cloud console and set GOOGLE_ANDROID_CLIENT_ID in src/services/auth.ts.'
      );
    }
    return GOOGLE_ANDROID_CLIENT_ID;
  }
  return GOOGLE_WEB_CLIENT_ID;
}

let googleAuthRequest: AuthSession.AuthRequest | null = null;

function getGoogleAuthRequest(): AuthSession.AuthRequest {
  if (!googleAuthRequest) {
    googleAuthRequest = new AuthSession.AuthRequest({
      clientId: getPlatformGoogleClientId(),
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri:
        Platform.OS === 'web'
          ? AuthSession.makeRedirectUri({ scheme: 'loksewa' })
          : AuthSession.makeRedirectUri({ native: GOOGLE_NATIVE_REDIRECT }),
      extraParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });
  }
  return googleAuthRequest;
}

export async function signInWithGoogle(): Promise<User> {
  const authInstance = getAuthInstance();

  // Google sign-in via Expo AuthSession (id_token -> Firebase credential)
  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
  const result = await getGoogleAuthRequest().promptAsync(discovery);

  if (result.type !== 'success') {
    throw new Error(`Google sign-in was cancelled or failed (${result.type}).`);
  }

  const idToken = result.params?.id_token;
  if (!idToken) {
    throw new Error('Google sign-in did not return an identity token. Please try again.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(authInstance, credential);
  await createUserDocument(cred.user.uid, {
    email: cred.user.email,
    displayName: cred.user.displayName,
    photoURL: cred.user.photoURL,
    provider: 'google',
  });
  return cred.user;
}

// ==================== Apple Sign-In ====================

const APPLE_CLIENT_ID = 'com.loksewa.preppro';
const APPLE_SERVICES_ID = 'your-services-id';

const appleAuthRequest = new AuthSession.AuthRequest({
  clientId: APPLE_CLIENT_ID,
  scopes: ['name', 'email'],
  responseType: AuthSession.ResponseType.IdToken,
  redirectUri: AuthSession.makeRedirectUri({ scheme: 'loksewa' }),
});

export async function signInWithApple(): Promise<User> {
  const authInstance = getAuthInstance();
  
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In only available on iOS');
  }
  
  const discovery = await AuthSession.fetchDiscoveryAsync('https://appleid.apple.com');
  const result = await appleAuthRequest.promptAsync(discovery);
  
  if (result.type === 'success') {
    const { id_token, authorization_code } = result.params;
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: id_token,
      accessToken: authorization_code,
    });
    const cred = await signInWithCredential(authInstance, credential);
    await createUserDocument(cred.user.uid, {
      email: cred.user.email,
      displayName: cred.user.displayName,
      provider: 'apple',
    });
    return cred.user;
  } else {
    throw new Error('Apple sign-in cancelled or failed');
  }
}

// ==================== Common Operations ====================

async function createUserDocument(uid: string, data: Record<string, unknown>): Promise<void> {
  const firestore = getFirestoreInstance();
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    await setDoc(userRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      xp: 0,
      streak: 0,
      rank: 'Bronze V',
    });
  }
}

export async function signOut_(): Promise<void> {
  const authInstance = getAuthInstance();
  await signOut(authInstance);
}

export async function updateUserProfile(displayName?: string, photoURL?: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user signed in');
  await updateProfile(user, { displayName, photoURL });
}

export async function deleteAccount(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user signed in');

  // Remove the Firestore profile first (rules allow the owner to delete it).
  // If that fails we still delete the auth account, so the user is never left
  // half-signed-in with an unusable session.
  try {
    const firestore = getFirestoreInstance();
    await deleteDoc(doc(firestore, 'users', user.uid));
  } catch (error) {
    console.error('[Auth] Failed to remove user profile document:', error);
  }

  await deleteUser(user);
}

// ==================== Token Management ====================

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

// ==================== Helper: Link Providers ====================

export async function linkGoogleAccount(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user signed in');

  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
  const result = await getGoogleAuthRequest().promptAsync(discovery);

  if (result.type === 'success') {
    const idToken = result.params?.id_token;
    if (!idToken) {
      throw new Error('Google sign-in did not return an identity token. Please try again.');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    await linkWithCredential(user, credential);
  }
}

export async function linkAppleAccount(): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user signed in');
  if (Platform.OS !== 'ios') throw new Error('Apple Sign-In only available on iOS');
  
  const discovery = await AuthSession.fetchDiscoveryAsync('https://appleid.apple.com');
  const result = await appleAuthRequest.promptAsync(discovery);
  
  if (result.type === 'success') {
    const { id_token, authorization_code } = result.params;
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: id_token,
      accessToken: authorization_code,
    });
    await linkWithCredential(user, credential);
  }
}

export async function linkPhoneAccount(phoneNumber: string): Promise<void> {
  // Not wired up yet — see signInWithPhone.
  throw new Error('Phone linking is not configured yet.');
}