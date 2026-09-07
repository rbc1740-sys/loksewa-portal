import { ExpoConfig, ConfigContext } from 'expo/config';
import { withAndroidManifest, ConfigPlugin } from '@expo/config-plugins';

const withFirebaseMessagingManifestFix: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    // `modResults` is the parsed AndroidManifest.xml document, i.e.
    // `{ manifest: { application: [...] } }`. Under a clean `expo prebuild`
    // the manifest file may not exist yet, in which case `modResults` (and
    // therefore `manifest.application`) can be `undefined` — so every step
    // here is guarded with optional chaining.
    const manifest = modConfig.modResults;
    const application = manifest?.manifest?.application?.[0];
    const metaData = application?.['meta-data'];

    if (Array.isArray(metaData)) {
      const channelMeta = metaData.find(
        (item) =>
          item?.$?.['android:name'] ===
          'com.google.firebase.messaging.default_notification_channel_id',
      );
      if (channelMeta?.$ && !('tools:replace' in channelMeta.$)) {
        // `tools:replace` isn't part of the typed manifest attributes, so
        // widen to allow adding it.
        (channelMeta.$ as Record<string, string>)['tools:replace'] = 'android:value';
      }
    }

    return modConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Loksewa Prep Pro',
  slug: 'loksewa-prep-pro',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  // `com.loksewa.preppro` is the native OAuth redirect scheme used by Google
  // sign-in (see makeRedirectUri({ native: ... }) in src/services/auth.ts).
  scheme: ['loksewa', 'com.loksewa.preppro'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.loksewa.preppro',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription: 'This app uses camera for AR structural visualization features.',
      NSFaceIDUsageDescription: 'This app uses Face ID for secure authentication.',
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: ['applinks:loksewa-prep-pro.firebaseapp.com'],
    googleServicesFile: './GoogleService-Info.plist',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#6366f1',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
    },
    package: 'com.loksewa.preppro',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'INTERNET',
      'ACCESS_NETWORK_STATE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'loksewa-prep-pro.firebaseapp.com',
          },
          {
            scheme: 'loksewa',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    googleServicesFile: './google-services.json',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    // Registered first so this manifest mod runs last in the chain (config-plugins
    // execute the mod wrapping-instructions outermost-first). This ensures the
    // default_notification_channel_id meta-data already exists (added by
    // expo-notifications) when we attach `tools:replace`, preventing the
    // react-native-firebase messaging vs expo-notifications manifest merge clash.
    // NOTE: @expo/config-types omits bare functions from `plugins`, but the
    // runtime accepts ConfigPlugin functions — hence the cast.
    withFirebaseMessagingManifestFix as unknown as NonNullable<ExpoConfig['plugins']>[number],
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#6366f1',
        defaultChannel: 'default',
        enableBackgroundRemoteNotifications: true,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
        },
        android: {
          enableProguardInReleaseBuilds: false,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    firebaseConfig: {
      apiKey: 'AIzaSyA1CLM0ebvelK4qYJhHiMKZaIcXsH4PF28',
      authDomain: 'loksewa-portal-8a3ae.firebaseapp.com',
      projectId: 'loksewa-portal-8a3ae',
      storageBucket: 'loksewa-portal-8a3ae.firebasestorage.app',
      messagingSenderId: '611217654714',
      appId: '1:611217654714:android:6e95ceb07cb404fcc3d383',
    },
    eas: {
      projectId: '437826ee-6ee8-43f3-b56d-99ebecd795ec',
    },
  },
  owner: 'rbc1740gmailcom',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/437826ee-6ee8-43f3-b56d-99ebecd795ec',
  },
});