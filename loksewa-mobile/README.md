# Loksewa Prep Pro (mobile)

Expo (SDK 57) + React Native 0.86 client for the Loksewa MCQ question bank.
Fully offline-first: the entire question bank ships inside the app bundle and is
copied into on-device SQLite on first launch.

## Status snapshot

- TypeScript: **0 errors**
- Unit tests (`npm test`): SM-2 spaced-repetition algorithm + full question
  bundler pipeline (**13 tests**)
- `expo prebuild --platform android`: clean, Firebase notification manifest fix applied

## Prerequisites

| Tool | Needed for |
|---|---|
| Node 20+ | everything |
| Expo account (`npx eas-cli login`) | cloud builds |
| Android Studio + JDK 17 (+ `ANDROID_HOME`) | local emulator/device builds only |

> You do **not** need the Android SDK if you build with EAS.

## Run it

```bash
npm install
npx expo prebuild --platform android   # regenerates native project
npm run android                        # local build (needs Android SDK)
# or, with no local SDK:
npx eas-cli build -p android --profile development
```

## Things YOU must configure (cannot be done from code)

1. **Firebase project** — `src/utils/firebaseConfig.ts` holds the web-app config.
   Confirm it points at the app registration you want the mobile client to use
   (it currently differs from the one in `app.config.ts → extra.firebaseConfig`).
2. **Enable auth providers** in Firebase console → Authentication:
   Email/Password and Anonymous work out of the box; Google/Apple need setup.
3. **Google sign-in on Android** — the web (client_type 3) and iOS (client_type 2)
   client IDs are already set in `src/services/auth.ts` from `google-services.json`.
   The Android client (client_type 1) needs the SHA-1 of the EAS signing keystore,
   which only exists after the first EAS build. After building: run `npx eas credentials`
   (Android → view keystore) → copy SHA-1 → create an Android OAuth client in
   Google Cloud console (package `com.loksewa.preppro`) → paste its ID into
   `GOOGLE_ANDROID_CLIENT_ID` in `src/services/auth.ts`. Until then Google
   sign-in on Android raises a clear not-configured error; email/anonymous work.
4. **Firestore rules** — review `../firestore.rules` before any public release.

## Updating the question bank

The bank lives in the repo root at `../questions/*.json`. After editing those:

```bash
npm run questions:generate   # copies files + rewrites src/data/questions/index.ts
npm test                     # verifies counts / uniqueness / row shape
```

On next launch the app detects an empty table only on a fresh install. To force
a re-seed on existing installs, clear app storage or bump the DB migration.

## Architecture notes

- **Single Firebase stack**: the JS SDK (`firebase@12`) is used everywhere.
  Auth persistence on native goes through AsyncStorage (see
  `src/services/auth.ts`), because `browserLocalPersistence` throws in RN.
- **Storage**: questions/progress/SR state live in local SQLite (`expo-sqlite`);
  Firestore is only used for the user profile document.
- **Routing**: Expo Router with `(auth)` and `(app)` groups gated in their
  layouts — signed-in users skip auth screens, signed-out users cannot reach tabs.
