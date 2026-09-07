# Loksewa Prep Pro - Mobile App Implementation Plan

## Executive Summary
Build a cross-platform mobile app (iOS + Android) using **React Native + Expo** that shares the existing Firebase backend with the web app. MVP focuses on core practice, timed exams, and offline-first data sync.

---

## 1. Architecture & Tech Stack

### Core Stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | **Expo SDK 51+** (React Native 0.76) | Fast iteration, OTA updates, native modules via config plugins |
| Language | **TypeScript** | Type safety, shared types with web |
| State | **Zustand** + **MMKV** | Lightweight, performant, persists to native storage |
| Navigation | **Expo Router v4** (file-based) | Deep linking, shared routes with web |
| Data/Offline | **WatermelonDB** + **Firebase Firestore** | Reactive offline-first, auto-sync when online |
| Auth | **Firebase Auth** (Anonymous + Email/Google) | Shared with web, seamless cross-platform |
| Storage | **MMKV** (key-value) + **SQLite** (Watermelon) | Fast sync, large dataset support |
| UI | **NativeWind** (Tailwind for RN) | Reuse web design tokens, consistent theming |
| Animations | **Reanimated 3** + **Gesture Handler** | 60fps native animations |
| Push | **Expo Push Notifications** + **FCM** | Cross-platform, integrates with Firebase |

### Project Structure
```
loksewa-mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigator screens
│   │   ├── practice.tsx   # Objective practice
│   │   ├── exam.tsx       # Timed exams
│   │   ├── battle.tsx     # 1v1 Battle Arena
│   │   ├── revision.tsx   # Weak areas
│   │   ├── spaced.tsx     # Spaced repetition
│   │   └── profile.tsx    # Progress, settings
│   ├── practice/
│   │   ├── [topic].tsx    # Topic-specific practice
│   │   └── question/[id].tsx  # Question detail
│   ├── exam/
│   │   ├── setup.tsx      # Exam configuration
│   │   ├── active/[id].tsx    # Live exam
│   │   └── results/[id].tsx   # Exam review
│   └── battle/
│       ├── lobby.tsx      # Battle setup
│       ├── room/[pin].tsx # Live battle
│       └── results.tsx
├── src/
│   ├── db/                # WatermelonDB models
│   │   ├── schema.ts
│   │   ├── models/
│   │   └── migrations/
│   ├── sync/              # Firebase sync engine
│   │   ├── firestore.ts
│   │   ├── conflict-resolution.ts
│   │   └── background-sync.ts
│   ├── store/             # Zustand stores
│   │   ├── practice.ts
│   │   ├── exam.ts
│   │   ├── battle.ts
│   │   ├── gamification.ts
│   │   └── settings.ts
│   ├── services/
│   │   ├── questions.ts   # Question loading/filtering
│   │   ├── spaced-repetition.ts  # SM-2 algorithm
│   │   ├── analytics.ts
│   │   └── notifications.ts
│   ├── hooks/
│   ├── components/
│   │   ├── ui/            # Base components (Button, Card, Input)
│   │   ├── practice/      # MCQCard, ProgressRing, FilterChips
│   │   ├── exam/          # Timer, QuestionNavigator
│   │   ├── battle/        # DuelArena, ScoreBoard
│   │   └── shared/
│   ├── utils/
│   └── constants/
├── assets/                # Fonts, images, animations
├── native/                # Native config plugins
└── shared/                # Types shared with web (generated)
```

---

## 2. Data Layer - Offline-First Architecture

### WatermelonDB Models
```typescript
// Question model (core)
class Question extends Model {
  @field('topic') topic!: string;
  @field('question') question!: string;
  @field('options') options!: string; // JSON stringified
  @field('answer') answer!: string;
  @field('explanation') explanation?: string;
  @field('difficulty') difficulty?: string;
  @field('source_file') sourceFile?: string;
  @field('last_synced') lastSynced!: number;
  @field('is_deleted') isDeleted!: boolean;
}

// User attempt (local + sync)
class Attempt extends Model {
  @field('question_id') questionId!: string;
  @field('selected_answer') selectedAnswer!: string;
  @field('is_correct') isCorrect!: boolean;
  @field('mode') mode!: 'practice' | 'exam' | 'battle' | 'spaced';
  @field('timestamp') timestamp!: number;
  @field('attempt_id') attemptId!: string; // UUID for deduplication
  @field('synced') synced!: boolean;
}

// Spaced Repetition (SM-2)
class SRCard extends Model {
  @field('question_id') questionId!: string;
  @field('interval') interval!: number;
  @field('ease_factor') easeFactor!: number;
  @field('repetitions') repetitions!: number;
  @field('due_date') dueDate!: number;
  @field('total_attempts') totalAttempts!: number;
  @field('total_correct') totalCorrect!: number;
  @field('last_result') lastResult!: 'correct' | 'wrong';
}

// Gamification
class UserProfile extends Model {
  @field('xp') xp!: number;
  @field('streak') streak!: number;
  @field('last_active') lastActive!: number;
  @field('rank') rank!: string;
  @field('sub_rank') subRank!: string;
}

// Bookmarks & Tags
class Bookmark extends Model {
  @field('question_id') questionId!: string;
  @field('tags') tags!: string; // JSON array
  @field('note') note?: string;
  @field('created_at') createdAt!: number;
}
```

### Sync Strategy
| Data Type | Sync Direction | Conflict Resolution |
|-----------|----------------|---------------------|
| Questions | Server → Client (initial bulk, then incremental) | Server wins (immutable content) |
| Attempts | Bidirectional | Client wins (append-only, dedup by attemptId) |
| SR Cards | Bidirectional | Merge: max(interval), max(repetitions), latest dueDate |
| Profile (XP/Streak) | Bidirectional | Server authoritative for XP; client for streak |
| Bookmarks | Bidirectional | Merge by questionId + tag set union |
| Comments/Votes | Server → Client (read-only on mobile MVP) | N/A |

### Background Sync
- **Expo TaskManager** + **Background Fetch** for periodic sync (15 min intervals)
- **Manual pull-to-refresh** on key screens
- **Optimistic UI** - local changes apply instantly, sync in background
- **Conflict UI** only for profile data (rare)

---

## 3. MVP Feature Scope

### Phase 1: Core Practice (Week 1-2)
- [ ] Topic browser with progress rings (adapted from web syllabus)
- [ ] MCQ card with swipe gestures (left=wrong, right=correct, up=bookmark)
- [ ] Instant filter chips (Unattempted, Incorrect, Bookmarked, Custom Tags)
- [ ] Search with live suggestions
- [ ] Keyboard shortcuts → gesture/voice alternatives
- [ ] Offline question cache (all 1000+ questions)

### Phase 2: Timed Exams (Week 2-3)
- [ ] Exam setup screen (topic, count, duration)
- [ ] Full-screen exam mode with persistent timer
- [ ] Question navigator (grid with status indicators)
- [ ] Auto-submit on time expiry
- [ ] Results with breakdown (topic-wise, time spent)
- [ ] Exam history with trends

### Phase 3: Spaced Repetition (Week 3)
- [ ] SM-2 scheduler (port from web)
- [ ] Due dashboard with stats (Due, Learning, Reviewing, Mastered)
- [ ] "Start Smart Review" session flow
- [ ] Grade buttons (Again/Hard/Good/Easy) with haptic feedback
- [ ] Notification when cards become due

### Phase 4: Gamification & Profile (Week 3-4)
- [ ] XP system with rank tiers (Bronze → Diamond, I-V)
- [ ] Daily streak with calendar heatmap
- [ ] Level-up modal with confetti + haptics
- [ ] Sound FX toggle (synthesized via Expo AV)
- [ ] Theme customizer (accent, radius, density)

### Phase 5: 1v1 Battle Arena (Week 4-5)
- [ ] Local multiplayer (pass-and-play) - **offline first**
- [ ] AI bot duel (difficulty tiers)
- [ ] Room creation/join via 4-char PIN
- [ ] Real-time sync via Firebase Realtime Database
- [ ] Game modes: Classic, Sudden Death, Speed, Survival

### Phase 6: Polish & Launch (Week 5-6)
- [ ] Onboarding flow (topic selection, notification permission)
- [ ] Push notifications (daily streak reminder, due cards, battle invites)
- [ ] App icons, splash screens, store assets
- [ ] TestFlight / Play Console internal testing
- [ ] Crash reporting (Sentry) + Analytics (Expo/Amplitude)

---

## 4. Mobile-Specific UX Adaptations

### From Web → Mobile
| Web Pattern | Mobile Adaptation |
|-------------|-------------------|
| Hover states | Press states + haptic feedback |
| Keyboard shortcuts (1-4) | Swipe gestures + bottom action bar |
| Multi-select dropdowns | Bottom sheet pickers |
| Side drawer (cheat sheet) | Bottom sheet with tabs |
| Desktop table (concrete mixes) | Card list with expandable rows |
| Mouse hover tooltips | Long-press → tooltip |
| Pagination | Infinite scroll + pull-to-refresh |

### New Mobile-Native Features
1. **Haptic feedback** on answer selection, correct/incorrect, level-up
2. **Voice input** for search (Expo Speech Recognition)
3. **Shake to shuffle** questions
4. **Widget** (iOS) / **Glance** (Android) for streak + due count
5. **Shortcuts** (iOS) / **App Actions** (Android) for "Resume Practice"
6. **Picture-in-picture** for exam timer (background audio timer)

---

## 5. Shared Code Strategy

### Shared Packages (Monorepo via Yarn Workspaces / pnpm)
```
loksewa-monorepo/
├── apps/
│   ├── web/           # Current app.html + index.html
│   └── mobile/        # Expo app
├── packages/
│   ├── shared/
│   │   ├── types/           # Question, Attempt, SRCard, UserProfile
│   │   ├── constants/       # Topics, RANK_TIERS, SYLLABUS_CATEGORIES
│   │   ├── algorithms/      # SM-2, XP calculation, rank computation
│   │   ├── validation/      # Zod schemas for API/data
│   │   └── utils/           # normalizeText, escapeHtml, deduplication
│   ├── ui-tokens/           # Design tokens (colors, spacing, radii)
│   └── firebase-config/     # Shared Firebase init + types
```

### Code Sharing % Target
- **Types/Constants/Algorithms**: 100% shared
- **Business Logic (services)**: 70% shared (adapt storage layer)
- **UI Components**: 0% shared (web=HTML, mobile=RN) but same design tokens
- **Firebase Config**: 100% shared

---

## 6. Build & Deployment

### Development
```bash
# Start dev server
cd mobile && npx expo start

# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Physical device (Expo Go)
# Scan QR code
```

### EAS Build (Production)
```yaml
# eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "xxx", "ascAppId": "xxx" },
      "android": { "serviceAccountKeyPath": "./google-play.json" }
    }
  }
}
```

### OTA Updates (Expo Updates)
- **Channel**: `production` / `preview`
- **Runtime version**: `appVersion` (native) + `sdkVersion`
- **CodePush-style** instant updates for JS bundle changes

---

## 7. Firebase Backend Integration (Shared)

### Firestore Collections (Existing + New)
```
users/{uid}/
  ├── profile          # XP, streak, rank, settings
  ├── attempts/{attemptId}   # Synced attempts
  ├── srCards/{questionId}   # SM-2 state
  ├── bookmarks/{questionId} # Tags, notes
  └── examHistory/{examId}   # Completed exams

questions/{questionId}/       # Read-only on mobile (cached locally)
  ├── metadata
  └── votes, comments, flags  # Read-only on mobile MVP

battles/{battleId}/           # Real-time for live battles
  ├── settings
  ├── players/{playerId}
  └── questions/{index}
```

### Security Rules (Key Points)
- Users can only read/write their own `users/{uid}/*`
- Questions readable by all authenticated users
- Battles: players can write own state, read opponent
- Admin functions via Cloud Functions (not client)

---

## 8. Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WatermelonDB learning curve | Medium | High | Start with simple models; use Expo SQLite adapter |
| Offline sync conflicts | Low | Medium | Append-only attempts; server-authoritative XP |
| Bundle size (1000+ questions) | Medium | Medium | Lazy-load by topic; compress JSON; use Hermes |
| Firebase costs at scale | Low | Medium | Cache aggressively; batch writes; monitor usage |
| App Store review (educational) | Low | Low | No payments, no user-generated content risk |
| iOS background fetch limits | Medium | Low | Foreground sync + push notifications as fallback |

---

## 9. Validation Plan

### Unit Tests (Jest + React Native Testing Library)
- SM-2 algorithm edge cases
- XP/rank calculation
- Question deduplication logic
- Filter/sort functions

### Integration Tests (Detox)
- Practice flow: select topic → answer 10 questions → verify XP
- Exam flow: start → answer → submit → review results
- Offline: disable network → answer questions → re-enable → verify sync
- Battle: create room → join → play → verify winner

### Manual QA Checklist
- [ ] Fresh install → loads all questions offline
- [ ] Airplane mode → full practice functionality
- [ ] Reconnect → attempts sync to Firebase
- [ ] Streak persists across app kills
- [ ] Push notification received → opens correct screen
- [ ] Battle room created on device A → joinable on device B
- [ ] Theme changes apply instantly across app
- [ ] Text size / corner radius accessibility settings work

---

## 10. Timeline Estimate (6 Weeks)

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Setup + Data Layer | Expo init, WatermelonDB, Firebase, question load |
| 2 | Practice Tab | Topic browser, MCQ cards, filters, search |
| 3 | Exams + Spaced Rep | Timed exam, SM-2 scheduler, due dashboard |
| 4 | Gamification + Battle | XP, ranks, streak, local battle, AI bot |
| 5 | Online Battle + Polish | Real-time battle, notifications, onboarding |
| 6 | Launch Prep | Store assets, TestFlight/Play, crash reporting |

---

## 11. Open Questions (Resolve Before Sprint 1)

1. **Question Images**: Do any MCQs have diagrams/images? (Need image caching strategy)
2. **Math Rendering**: KaTeX on web → **MathJax / KaTeX-RN / native MathML** on mobile?
3. **Audio**: Web uses Web Audio API → **Expo AV** for synthesized sounds?
4. **Firebase Config**: Share `firebase-config.js` or use native Firebase SDKs?
5. **Analytics**: Add **PostHog** or **Amplitude** for funnel analysis?
6. **Monetization**: Future - keep free or add supporter tier?

---

## 12. Next Steps

1. **Initialize monorepo** with shared packages
2. **Extract shared types/constants** from `app.html` into `packages/shared`
3. **Create Expo app** with NativeWind + WatermelonDB
4. **Implement question loader** (manifest → WatermelonDB bulk insert)
5. **Build Practice tab** as first vertical slice

---

*Plan created: 2026-08-25*
*Status: Ready for implementation*