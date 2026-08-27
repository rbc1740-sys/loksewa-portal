# Loksewa Prep Pro — React Native/Expo Mobile App Implementation Plan

## Project Overview
- **Source**: Existing PWA at `D:\loksewa-portal` (app.html, 28 JSON question banks, Firebase backend)
- **Target**: Cross-platform iOS + Android app via React Native + Expo
- **Backend**: Shared Firebase project (`loksewa-portal-8a3ae`) — Auth, Firestore, Realtime DB, FCM, Storage
- **MVP Scope**: Core practice + timed exams + offline sync + 1v1 Battle Arena
- **Timeline**: 14-16 weeks to TestFlight / Play Console internal testing

---

## Phase 1: Core Foundation (Weeks 1-5)

### 1.1 Project Setup & Configuration
- [ ] Initialize Expo project with TypeScript template
  ```bash
  npx create-expo-app@latest loksewa-mobile --template typescript
  ```
- [ ] Configure `app.json`/`app.config.ts`:
  - Bundle identifier: `com.loksewa.preppro`
  - iOS: `com.loksewa.preppro` (App Store Connect)
  - Android: `com.loksewa.preppro` (Play Console)
  - Permissions: `CAMERA` (AR), `RECEIVE_BOOT_COMPLETED` (FCM), `VIBRATE`
  - Associated domains / intent filters for deep links
- [ ] Install core dependencies:
  ```
  expo install firebase @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/database @react-native-firebase/messaging @react-native-firebase/storage expo-sqlite expo-secure-store expo-notifications expo-device expo-constants expo-linking expo-router react-native-gesture-handler react-native-reanimated react-native-screens react-native-safe-area-context @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs zustand react-hook-form zod date-fns lucide-react-native
  ```
- [ ] Configure EAS Build (`eas.json`) with `development`, `preview`, `production` profiles
- [ ] Set up Firebase config files:
  - `google-services.json` (Android) → `android/app/`
  - `GoogleService-Info.plist` (iOS) → `ios/`
  - Update `app.config.ts` with `googleServicesFile` / `googleServicesFile` paths

### 1.2 Firebase Authentication (All Providers)
**Auth Providers Required**: Email/Password, Phone (OTP), Google, Apple, Anonymous

#### Implementation Tasks:
- [ ] **Auth Service** (`src/services/auth.ts`):
  - `signUpWithEmail(email, password, displayName)`
  - `signInWithEmail(email, password)`
  - `signInWithPhone(phoneNumber)` → OPT verification flow with `recaptchaVerifier`
  - `signInWithGoogle()` → `GoogleSignin` (expo-auth-session)
  - `signInWithApple()` → `AppleAuthentication` (expo-auth-session)
  - `signInAnonymously()` → guest mode
  - `linkAnonymousToPermanent(credential)` → upgrade guest account
  - `sendPasswordReset(email)`
  - `updateProfile(displayName, photoURL)`
  - `deleteAccount()`
  - `onAuthStateChanged` listener → sync to Zustand store

- [ ] **Auth Screens**:
  - `WelcomeScreen` — hero + "Get Started" / "Sign In"
  - `AuthChoiceScreen` — tabs: Email, Phone, Google, Apple, Continue as Guest
  - `EmailAuthScreen` — sign in / sign up toggle, validation, forgot password
  - `PhoneAuthScreen` — country picker (expo-intl-phone-input), OTP entry (6-digit)
  - `ProfileSetupScreen` — post-OAuth: username, exam target date, notification preferences

- [ ] **Security Rules** (Firestore):
  ```javascript
  // Users can only read/write their own data
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  // Progress subcollections
  match /users/{userId}/progress/{questionId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```

### 1.3 Local SQLite Database (Offline-First)
**Schema Design** (expo-sqlite + drizzle-orm or raw SQL):

```sql
-- Questions table (immutable, synced from JSON)
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,  -- JSON string: {"a": "...", "b": "..."}
  answer TEXT NOT NULL,
  explanation TEXT,
  source_file TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_questions_topic ON questions(topic);

-- User progress (synced to Firestore)
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,  -- composite: userId_questionId
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_answer TEXT,
  is_correct INTEGER,  -- 0/1/null
  attempt_count INTEGER DEFAULT 0,
  time_spent_ms INTEGER DEFAULT 0,
  last_attempted_at INTEGER,
  synced_at INTEGER,  -- null = pending sync
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX idx_progress_user ON user_progress(user_id);
CREATE INDEX idx_progress_sync ON user_progress(synced_at) WHERE synced_at IS NULL;

-- Spaced Repetition state (SM-2)
CREATE TABLE sr_state (
  id TEXT PRIMARY KEY,  -- userId_questionId
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  interval_days INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  attempts INTEGER DEFAULT 0,
  due_at INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_result TEXT,  -- 'correct' | 'wrong'
  last_answered_at INTEGER,
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX idx_sr_user_due ON sr_state(user_id, due_at);

-- Bookmarks & Tags
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,  -- userId_questionId
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  tags_json TEXT DEFAULT '[]',  -- JSON array
  note TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Weak points
CREATE TABLE weak_points (
  id TEXT PRIMARY KEY,  -- userId_questionId
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  synced_at INTEGER,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Gamification
CREATE TABLE user_profile (
  user_id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active_date TEXT,  -- YYYY-MM-DD
  rank_tier TEXT DEFAULT 'Bronze',
  rank_sub TEXT DEFAULT 'V',
  sound_enabled INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'system',  -- 'light' | 'dark' | 'system'
  accent_color TEXT DEFAULT 'indigo',
  exam_target_date INTEGER,  -- timestamp
  daily_goal_minutes INTEGER DEFAULT 30,
  notification_token TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- Exam sessions
CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT,
  question_count INTEGER,
  time_limit_seconds INTEGER,
  questions_json TEXT NOT NULL,  -- array of question IDs in order
  answers_json TEXT DEFAULT '{}',  -- {questionId: selectedAnswer}
  started_at INTEGER,
  submitted_at INTEGER,
  score INTEGER,  -- percentage
  synced_at INTEGER
);

-- Battle state (local backup for Realtime DB)
CREATE TABLE battle_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  room_id TEXT,
  opponent_id TEXT,
  opponent_name TEXT,
  settings_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  current_question_index INTEGER DEFAULT 0,
  my_score INTEGER DEFAULT 0,
  opp_score INTEGER DEFAULT 0,
  my_answers_json TEXT DEFAULT '[]',
  opp_answers_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'waiting',  -- 'waiting' | 'active' | 'completed' | 'abandoned'
  created_at INTEGER,
  updated_at INTEGER
);

-- Sync queue (outbox pattern)
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE'
  payload_json TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  last_attempt_at INTEGER
);
```

- [ ] **Migration System**: Versioned migrations in `src/db/migrations/` (001_init.sql, 002_add_xp.sql, etc.)
- [ ] **Database Service** (`src/services/database.ts`):
  - `init()` — run migrations, enable WAL mode
  - `bulkInsertQuestions(questions)` — upsert with `ON CONFLICT(id) DO UPDATE`
  - `getQuestionsByTopic(topic)`, `searchQuestions(query)`, `getRandomQuestions(topic, count, excludeIds)`
  - CRUD for all tables with `synced_at` management
  - `getPendingSync()` — returns records with `synced_at IS NULL`
  - `markSynced(table, recordId, serverTimestamp)`

### 1.4 Question Bank Parser & Initial Sync
- [ ] **Parser Service** (`src/services/questionParser.ts`):
  - Fetch `manifest.json` from Firebase Storage or bundled asset
  - Parallel fetch all 28 JSON files with `Promise.allSettled`
  - Normalize using logic from `core-logic.js`: `normalizeQuestionData`, `getQuestionSignature`, `deduplicateQuestions`
  - Generate deterministic IDs: `${topicHash}_${baseId}` (match web app)
  - Bulk insert into SQLite (transaction, ~5000 rows)
  - Store manifest hash/version for incremental updates

- [ ] **Initial Load Flow**:
  1. Splash screen → check local DB version
  2. If empty/outdated → show progress "Loading question bank (1/28)..."
  3. Parse & insert → mark `db_version` in `user_profile`
  4. On success → navigate to Home

### 1.5 Core Practice Modes
**Navigation Structure** (expo-router + tabs):
```
(app)
├── _layout.tsx          # Root layout, auth guard, providers
├── (auth)
│   ├── welcome.tsx
│   ├── auth-choice.tsx
│   ├── email-auth.tsx
│   ├── phone-auth.tsx
│   └── profile-setup.tsx
├── (app)
│   ├── _layout.tsx      # Tab navigator
│   ├── index.tsx        # Home / Dashboard
│   ├── practice.tsx     # Objective Practice (list view)
│   ├── exam.tsx         # Timed Exam
│   ├── battle.tsx       # 1v1 Battle Arena
│   ├── spaced.tsx       # Spaced Review
│   ├── revision.tsx     # Weak Areas
│   ├── profile.tsx      # Settings, Stats, Achievements
│   └── cheat-sheet.tsx  # Civil Reference & Converter
```

#### Practice List Screen (`practice.tsx`):
- [ ] Topic filter chips (All, GK, Technical, Due, custom tags)
- [ ] Search bar with debounced live filtering
- [ ] Virtualized list (FlashList) — each item: QuestionCard
- [ ] QuestionCard component:
  - Topic badge, question text (truncated), option buttons (A/B/C/D)
  - Immediate feedback: green/red border, show explanation on tap
  - Bookmark toggle, flag button, vote buttons (synced to Firestore)
  - XP reward animation on first correct answer
- [ ] Pagination / infinite scroll (page size 20)
- [ ] Keyboard shortcuts: 1-4 / A-D to answer, Space for next

#### Timed Exam Screen (`exam.tsx`):
- [ ] Setup screen: topic select, question count (10/25/50), timer preview
- [ ] Exam screen: sticky header with progress + countdown timer (MM:SS)
- [ ] One question at a time, swipe or Next/Prev buttons
- [ ] Auto-submit on timer expiry
- [ ] Results screen: score, per-question review, add to weak points, share

---

## Phase 2: Engagement & Real-time (Weeks 6-10)

### 2.1 Spaced Repetition (SM-2) Engine
- [ ] **SR Service** (`src/services/spacedRepetition.ts`):
  - Port `calculateNextInterval`, `updateSRState`, `getDueQuestions` from `core-logic.js`
  - `getDueQuestions(userId)` → query `sr_state` where `due_at <= now`
  - `processAnswer(questionId, wasCorrect)` → update local + queue sync
  - `getSRStats()` → counts for Due / Learning / Review / Mastered
- [ ] **Spaced Review Screen** (`spaced.tsx`):
  - Dashboard cards: Due, Learning, Reviewing, Mastered (tap to filter)
  - "Start Smart Review" button → launches practice session with due questions only
  - Session mode: shows due count, pulls 10 at a time, updates SR after each

### 2.2 Gamification Engine
- [ ] **XP System** (port from web):
  - Correct first attempt: +10 XP
  - Streak bonus: +5 XP per consecutive day (max +50)
  - Battle win: +50 XP
  - Exam completion: +25 XP (bonus for >80%)
  - Daily goal met: +15 XP
- [ ] **Rank Tiers**: Bronze I-V → Silver I-V → Gold I-V → Platinum I-V → Diamond I-V
- [ ] **Streak Logic**: Track `last_active_date` in `user_profile`, reset on gap >1 day
- [ ] **Profile Screen**: XP bar, rank badge, streak flame, achievement grid
- [ ] **Sound FX**: Web Audio API port (expo-audio or react-native-sound)

### 2.3 FCM Push Notifications
- [ ] **Notification Service** (`src/services/notifications.ts`):
  - Request permissions on first app open (iOS: provisional → full)
  - Register device token → save to `user_profile.notification_token`
  - Handle foreground/background/quit state messages
  - Deep link routing: `loksewa://spaced-review`, `loksewa://battle/invite/{roomId}`

- [ ] **Scheduled Notifications** (expo-notifications + Cloud Functions):
  - **Daily Streak Reminder**: 19:00 local if not studied today
  - **SR Due Alert**: 09:00 if `due_count > 0`
  - **Battle Invite**: Real-time via FCM data message
  - **Exam Countdown**: 7d, 1d, morning of (Cloud Function scheduled)
  - **Weak Area Summary**: Weekly Sunday 10:00 (Cloud Function)

- [ ] **Cloud Functions** (`functions/index.ts`):
  - `scheduleDailyReminders` — runs daily, queries users with streak > 0, sends if not active today
  - `scheduleSRAlerts` — runs daily 08:00, checks `sr_state.due_at`
  - `sendBattleInvite` — callable from client when room created
  - `examCountdown` — scheduled on user's `exam_target_date` creation
  - `weeklyWeakSummary` — runs Sunday, aggregates weak points

### 2.4 1v1 Battle Arena (Firebase Realtime Database)
**Architecture**: Realtime DB for match state (low latency), Firestore for persistence

#### Data Model (Realtime DB):
```
/battleRooms/{roomId}
  - hostId: string
  - hostName: string
  - guestId: string (null until joined)
  - guestName: string
  - status: 'waiting' | 'active' | 'completed' | 'expired'
  - settings: { questionCount, timerSeconds, topicFilter, difficulty, mode }
  - questions: [{id, topic, question, options, answer, explanation}]  -- shuffled, same for both
  - currentQuestionIndex: number
  - hostScore: number
  - guestScore: number
  - hostAnswers: [{questionId, answer, timeMs, correct}]
  - guestAnswers: [{questionId, answer, timeMs, correct}]
  - questionStartTime: timestamp
  - createdAt: timestamp
  - expiresAt: timestamp (5 min after created if not joined)
```

#### Security Rules (Realtime DB):
```json
{
  "rules": {
    "battleRooms": {
      "$roomId": {
        ".read": "auth != null && (data.child('hostId').val() == auth.uid || data.child('guestId').val() == auth.uid)",
        ".write": "auth != null && (data.child('hostId').val() == auth.uid || data.child('guestId').val() == auth.uid) && newData.child('status').val() != 'completed'",
        "questions": { ".read": "auth != null" },
        "hostAnswers": { ".write": "auth != null && data.parent().child('hostId').val() == auth.uid" },
        "guestAnswers": { ".write": "auth != null && data.parent().child('guestId').val() == auth.uid" }
      }
    }
  }
}
```

#### Battle Service (`src/services/battle.ts`):
- [ ] `createRoom(settings)` → generates 4-char PIN, writes to RTDB, returns roomId
- [ ] `joinRoom(pin)` → finds room by PIN, sets `guestId`, starts game
- [ ] `listenToRoom(roomId, callbacks)` → `onValue` listeners for real-time updates
- [ ] `submitAnswer(roomId, questionIndex, answer, timeMs)` → writes to `hostAnswers`/`guestAnswers`
- [ ] `advanceQuestion(roomId)` → host only, increments `currentQuestionIndex`, resets timer
- [ ] `calculateScores(roomId)` → on complete, writes results to Firestore `battles/{roomId}`
- [ ] `leaveRoom(roomId)` → cleanup, mark abandoned

#### Battle Screens:
- [ ] **Lobby** (`battle.tsx`): Host settings panel, PIN display, Join by PIN, Local Pass-and-Play, AI Bot
- [ ] **Waiting Screen**: "Waiting for opponent..." with PIN copy/share
- [ ] **Battle Screen**: Full-screen question, dual progress rings, timer, score badges
- [ ] **Results Screen**: Side-by-side comparison, question review, rematch button, share result

#### Game Modes:
- **Classic**: Most correct wins (tie → fastest total time)
- **Sudden Death**: First mistake loses
- **Speed Run**: Fastest correct answer wins per question
- **Survival**: -10 points per wrong, +10 per correct

#### AI Bot (Solo Practice):
- [ ] Configurable difficulty: Easy (70% accuracy, 8s avg), Medium (85%, 5s), Hard (95%, 3s)
- [ ] Simulates human-like variance (random delays, occasional "mistakes")

### 2.5 Data Sync Engine (Offline-First)
**Strategy**: Outbox pattern + conflict resolution (merge attempts)

- [ ] **Sync Service** (`src/services/sync.ts`):
  - `startSync()` — runs on app focus, network change, periodic (5 min)
  - `processQueue()` — reads `sync_queue`, batches by table, calls Firestore
  - **Conflict Resolution** (merge attempts):
    - For `user_progress`: append local attempts to server array (keep all)
    - For `sr_state`: server wins on `due_at`/`interval`/`ease`; merge `total_*` counters by summing
    - For `bookmarks`: union of tags, latest note wins (by timestamp)
    - For `weak_points`: union of question IDs
    - For `user_profile`: server wins on `xp`/`streak`/`rank`; client wins on preferences
  - `onSyncComplete()` → update `synced_at` timestamps, clear processed queue items
  - Exponential backoff on failure (max 3 retries, then alert user)

- [ ] **Network Awareness**: `expo-network` + `NetInfo` listener → trigger sync on reconnect

---

## Phase 3: Tools & Delivery (Weeks 11-16)

### 3.1 Civil Engineering Calculators & Converters
Port from web app drawer (`cheat-sheet-drawer`) to dedicated screens:

- [ ] **Land Converter** (`cheat-sheet/land-converter.tsx`):
  - Bidirectional: Sq Ft ↔ Sq M ↔ Ropani/Aana/Paisa/Daam ↔ Bigha/Kattha/Dhur
  - Real-time update on any field change
  - Copy result buttons, history of recent conversions

- [ ] **Concrete Mix Calculator** (`cheat-sheet/concrete-mix.tsx`):
  - Input: Grade (M5-M25), Volume (m³) → outputs cement bags, sand (m³), aggregate (m³), water (L)
  - Dry volume factor toggle (1.52 / 1.54)
  - Cost estimator (editable material rates)

- [ ] **RCC/Steel Design Calculators** (`cheat-sheet/rcc-calculator.tsx`):
  - Beam design: Mu, b, d, fck, fy → Ast, Asv
  - Column design: Pu, b, D, fck, fy → Asc, lateral ties
  - Slab design: One-way / Two-way moment coefficients

- [ ] **Surveying Calculators** (`cheat-sheet/surveying.tsx`):
  - Traverse closure, area (DMD/DPD), leveling (HI/RL), coordinate geometry

- [ ] **Formula Reference** (`cheat-sheet/formulas.tsx`):
  - Searchable, categorized (Surveying, Soil, Hydraulics, SOM, RCC, Steel)
  - KaTeX rendering (expo-web-view or `katex` + `react-native-webview`)

### 3.2 Testing Strategy
- [ ] **Unit Tests** (Jest + React Native Testing Library):
  - Pure functions: `normalizeForComparison`, `calculateNextInterval`, `getQuestionSignature`, XP/rank logic
  - Database CRUD operations (mock expo-sqlite)
  - Auth flows (mock Firebase Auth)
  - Sync conflict resolution scenarios

- [ ] **Integration Tests** (Detox):
  - Critical flows: Onboarding → Practice → Exam → Battle → Profile
  - Offline → Online sync verification
  - Push notification handling (background/quit)
  - Deep link navigation

- [ ] **E2E Scenarios**:
  - Guest → Email upgrade → data merge
  - Battle: create → join → play → results → rematch
  - Exam: start → background → resume → submit
  - SR: answer due questions → verify intervals update

### 3.3 EAS CI/CD Pipeline
- [ ] **eas.json** profiles:
  ```json
  {
    "build": {
      "development": { "developmentClient": true, "distribution": "internal" },
      "preview": { "distribution": "internal", "ios": { "simulator": true } },
      "production": { "distribution": "store" }
    },
    "submit": {
      "production": { "ios": { "appleId": "...", "ascAppId": "..." }, "android": { "serviceAccountKeyPath": "./google-play-key.json" } }
    }
  }
  ```

- [ ] **GitHub Actions** (`.github/workflows/`):
  - `ci.yml`: lint → typecheck → unit tests → build development client
  - `preview.yml`: on PR → build preview → upload to Expo / TestFlight internal
  - `release.yml`: on tag `v*` → build production → submit to stores

- [ ] **Versioning**: `expo-updates` for OTA updates (non-breaking changes)

### 3.4 App Store Preparation
- [ ] **Metadata**: Screenshots (6.7", 5.5", iPad), App Preview video, Privacy Policy URL
- [ ] **App Store Connect**: In-app purchases (if Pro tier), TestFlight groups
- [ ] **Play Console**: Internal testing track, content rating, data safety form
- [ ] **Release Checklist**: Crashlytics, Performance Monitoring, Analytics events

---

## Critical Technical Decisions & Risks

| Area | Decision | Risk Mitigation |
|------|----------|-----------------|
| **Auth** | All 5 providers enabled | Test each provider on both platforms; Apple Sign-In requires paid Apple Developer account |
| **Offline Sync** | Outbox + merge attempts | Write integration tests for conflict scenarios; log all conflicts for debugging |
| **Battle** | Realtime DB + Firestore persistence | Strict security rules; validate all writes server-side via Cloud Functions |
| **Questions** | Bundled asset + remote manifest | Bundle initial 28 JSON files in app (expo-asset); check manifest hash on startup for updates |
| **Notifications** | expo-notifications + FCM | Test on physical devices; iOS requires provisioning profile with Push capability |
| **Storage** | SQLite (expo-sqlite) | Enable WAL mode; vacuum periodically; monitor DB size (target < 50MB) |
| **Navigation** | expo-router (file-based) | Type-safe routes; deep link handling for notifications/battle invites |

---

## Data Flow Summary

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  SQLite      │────▶│  Sync Queue │
│  (Expo RN)  │◀───│  (Local DB)  │◀───│  (Outbox)   │
└──────┬──────┘     └──────────────┘     └──────┬──────┘
       │                                        │
       │              ┌──────────────┐          │
       └─────────────▶│   Firebase   │◀─────────┘
                      │  (Backend)   │
                      └──────────────┘
       ▲                    ▲               ▲
       │                    │               │
       │              ┌─────┴─────┐         │
       │              │  RTDB     │         │
       └─────────────▶│ (Battles) │─────────┘
                      └───────────┘
```

---

## Open Questions (Resolve Before Phase 1 Start)

1. **Question Updates**: How often do question banks change? Manifest hash check frequency?
2. **Pro Tier**: Will there be a paid tier? If yes, define feature gates now (RevenueCat integration).
3. **Analytics**: Which events to track? (Amplitude / Firebase Analytics / PostHog)
4. **Error Tracking**: Sentry DSN configuration for both platforms.
5. **Legal**: Privacy Policy / Terms of Service URLs for App Store / Play Console.

---

## Validation Checkpoints

| Phase | Checkpoint | Success Criteria |
|-------|------------|------------------|
| 1.1-1.2 | Auth Flow | Can sign up/in with all 5 providers; anonymous → permanent upgrade works |
| 1.3-1.4 | Offline DB | App loads 4,685 questions offline in <3s cold start; search <100ms |
| 1.5 | Practice + Exam | Complete 50-question exam; results persist offline; sync on reconnect |
| 2.1 | Spaced Repetition | Due questions appear at correct intervals; SM-2 math matches web |
| 2.2 | Gamification | XP, streak, rank update correctly; sounds play; no duplicate XP |
| 2.3 | Notifications | All 5 categories deliver on physical devices (iOS + Android) |
| 2.4 | Battle Arena | 2 devices: create → join → play 5 questions → results match; no cheating possible |
| 3.1 | Calculators | All converters produce correct Nepali land units; formulas render |
| 3.2 | Tests | Unit coverage >80%; Detox runs 5 critical flows on CI |
| 3.3 | CI/CD | `eas build --profile preview` succeeds; TestFlight upload works |

---

## File Structure (Target)
```
loksewa-mobile/
├── app/
│   ├── _layout.tsx
│   ├── (auth)/...
│   └── (app)/...
├── src/
│   ├── services/
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   ├── questionParser.ts
│   │   ├── spacedRepetition.ts
│   │   ├── gamification.ts
│   │   ├── notifications.ts
│   │   ├── battle.ts
│   │   └── sync.ts
│   ├── db/
│   │   ├── migrations/
│   │   └── schema.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── progressStore.ts
│   │   ├── battleStore.ts
│   │   └── uiStore.ts
│   ├── components/
│   │   ├── QuestionCard.tsx
│   │   ├── TopicChip.tsx
│   │   ├── XPBar.tsx
│   │   └── BattleTimer.tsx
│   ├── screens/
│   │   ├── PracticeScreen.tsx
│   │   ├── ExamScreen.tsx
│   │   ├── BattleScreen.tsx
│   │   ├── SpacedReviewScreen.tsx
│   │   ├── CheatSheetScreens/
│   │   └── ProfileScreen.tsx
│   ├── hooks/
│   │   ├── useQuestions.ts
│   │   ├── useAuth.ts
│   │   └── useSync.ts
│   └── utils/
│       ├── constants.ts
│       ├── helpers.ts
│       └── firebaseConfig.ts
├── functions/          # Cloud Functions (TypeScript)
├── eas.json
├── app.config.ts
└── package.json
```

---

## Next Steps
1. Confirm plan with stakeholders
2. Provision Firebase project with all Auth providers enabled
3. Generate `google-services.json` / `GoogleService-Info.plist`
4. Initialize Expo project and commit to Git
5. Begin Phase 1.1 implementation