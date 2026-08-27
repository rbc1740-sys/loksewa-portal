# Loksewa Prep Pro — Comprehensive Implementation Plan

Based on audit of existing codebase and the master prompt requirements.

---

## Executive Summary

**Current State**: Working foundation with SQLite, Expo Router, Zustand stores, question bank (27 topics, ~3000 questions), basic practice/exam/spaced-review screens, auth, course catalog, and gamification. Key gaps: no QOTD, no theory mode, no search/filter, no custom exam UI, no past papers, no videos/study-material, no community, no notifications, no dark mode, no premium entitlements, battle is placeholder, many screens lack empty/error/retry states, state persistence issues during exams.

**Target**: Exametix-level UX with connected learning ecosystem (Course → Subject → Chapter → Topic → Question → Attempt → Progress → Analytics → Review → Recommendations).

**Approach**: 7 phases, each tested end-to-end before proceeding.

---

## Phase 1 — Core Foundation (Weeks 1–2)

### 1.1 Authentication & User Management
- [ ] Complete `authStore` with email/phone auth, profile setup, sign-out
- [ ] Add user profile sync to Firestore (optional, for multi-device)
- [ ] Persist `user.uid` as primary key for all user-scoped data

### 1.2 Course System
- [ ] **Enrollment table** (`course_enrollments`): user_id, course_id, enrolled_at, is_active
- [ ] `CourseStore`: load enrolled courses, switch active course, persist to DB + AsyncStorage
- [ ] Home: active course card with progress, course switcher modal
- [ ] All dependent stores/screens react to `activeCourseId` change (Subjects, Practice, Exams, Analytics)

### 1.3 Question Hierarchy & Seeding
- [ ] Ensure `question_hierarchy` links every question to course/subject/chapter/topic
- [ ] Run `linkQuestionsToHierarchy()` on seed; verify coverage > 95%
- [ ] Add `difficulty`, `marks`, `negative_marks` columns to questions (migration 003)
- [ ] Add `language` field (English/Nepali) for future localization

### 1.4 User-Question Relationship (Single Source of Truth)
- [ ] `user_progress` already exists — extend with: `confidence` (1–3), `review_state` (due/learning/review/mastered), `next_review_at`
- [ ] `sr_state` exists — ensure SM-2 params (`ease_factor`, `interval_days`, `attempts`) drive Smart Review
- [ ] Centralize all mutations in `answerService.recordAnswer()` — no screen-level calculations

### 1.5 Bookmarks, Mistakes, Reports
- [ ] Bookmarks: tags, notes, sync status
- [ ] Mistakes: auto-add on wrong answer; auto-remove on subsequent correct (self-healing)
- [ ] Reports: reasons enum, description, status workflow (pending/reviewed/resolved/rejected)

### 1.6 Design System (Tokens + Components)
- [ ] `theme.ts`: colors (light/dark), spacing, radius, typography scale, shadows
- [ ] Components: `AppCard`, `AppButton`, `IconButton`, `StatCard`, `ProgressBar`, `SectionHeader`, `ScreenHeader`, `SearchBar`, `FilterChips`, `OptionCard`, `QuestionCard`, `ExamCard`, `SubjectCard`, `ChapterCard`, `BottomNav`, `Modal`, `BottomSheet`, `LoadingState`, `Skeleton`, `EmptyState`, `ErrorState`, `Toast`
- [ ] Migrate all existing screens to use these components

### 1.7 Navigation & State Safety
- [ ] Expose typed router hooks (`useTypedPush`, `useTypedReplace`)
- [ ] Add navigation guards: confirm before leaving exam, confirm destructive actions
- [ ] Ensure back navigation restores scroll/state (no random Home reset)

---

## Phase 2 — Practice Engine (Weeks 2–3)

### 2.1 Practice Modes
| Mode | Source |
|------|--------|
| All Questions | `getAllQuestions` (paginated) |
| By Subject | `getQuestionsBySubject` |
| By Chapter | `getQuestionsByIds` via hierarchy |
| By Topic | `getQuestionsByTopic` |
| Unattempted | `getQuestionsByStage` (exclude attempted) |
| Mistakes | `getWrongQuestions` |
| Bookmarks | `getBookmarkedQuestions` |
| Smart Review | `getDueQuestions` |
| Random | `getRandomQuestions` |

### 2.2 Practice Screen (`/practice`)
- [ ] Search bar (debounced, searches question text + topic)
- [ ] Filter chips: Subject → Chapter → Topic → Difficulty → Status (attempted/unattempted/correct/incorrect/bookmarked)
- [ ] Stable `FlatList` with `QuestionCard` (no reshuffle, no jump on answer)
- [ ] Option selection: visual feedback only; no auto-advance; no list rebuild
- [ ] Bookmark/Flag/Report buttons on each card
- [ ] Explanation: collapsible, shown after answer (practice mode)
- [ ] Pull-to-refresh, infinite scroll, empty/error/retry states

### 2.3 Question Card (`QuestionCard.tsx`) — Harden
- [ ] Stable keys, no re-render on parent state change
- [ ] States: unselected → selected → answered (correct/incorrect) → explanation
- [ ] Touch target ≥ 48dp; option text readable at system font scale
- [ ] Support `mode`: `practice` | `exam` | `review` | `battle`
- [ ] Support `showResult`, `timeSpent`, `confidence` (future)

### 2.4 Question Navigation
- [ ] Previous/Next buttons (deterministic order)
- [ ] Question palette (grid) for jump-to-question
- [ ] Mark for review toggle
- [ ] Session persistence: answers, marks, position, timer → `exam_sessions`

---

## Phase 3 — Exam Engine (Weeks 3–4)

### 3.1 Exam Types
| Type | Configuration |
|------|---------------|
| Model Exam | Full syllabus, fixed duration, negative marking |
| Subject Exam | Single subject, configurable |
| Custom Exam | User-defined subjects/chapters/count/duration/marks |
| Past Paper | Pre-built paper (year, level, subject) |
| Daily Challenge | 10–20 Q, fixed time, leaderboard |

### 3.2 Pre-Exam Screen
- [ ] Title, description, question count, duration, marks/q, negative marks, pass %, instructions
- [ ] Start button → creates `exam_session` with frozen question IDs + absolute `endAt`

### 3.3 In-Exam Screen (`/exam` running phase)
- [ ] Header: timer (countdown from `endAt`), question number, progress bar
- [ ] Question palette: answered/unanswered/marked/visited states
- [ ] Navigation: Prev/Next, palette tap, swipe (optional)
- [ ] Mark for review, clear response
- [ ] Pause/resume (background-safe via `endAt`)
- [ ] Auto-submit at `endAt`; confirm manual submit

### 3.4 Exam State Persistence
- [ ] Continuous save to `exam_sessions` (answers_json, marked, currentIndex, endAt)
- [ ] On app kill/restart: resume from `getActiveExamSession` if `endAt > now`
- [ ] No data loss on navigation away/back

### 3.5 Result Screen (`/exam` result phase)
- [ ] Score, correct, incorrect, skipped, accuracy, %, pass/fail, time used, avg time/q
- [ ] Subject/chapter breakdown (from `examEngine.computeExamResult`)
- [ ] Weak areas highlighted
- [ ] Actions: Review Questions, Retry Exam, Back to Exams

### 3.6 Exam History & Analytics
- [ ] `exam_history` table populated on submit
- [ ] History screen: list with date, type, score, %, pass/fail
- [ ] Trend charts: accuracy over time, speed, subject radar

---

## Phase 4 — Learning Engine (Weeks 4–5)

### 4.1 Smart Review (Spaced Repetition)
- [ ] SM-2 algorithm in `spacedRepetition.ts` (already exists — verify + test)
- [ ] States: Due Now, Learning, Reviewing, Mastered (counts from `sr_state`)
- [ ] Session: 10 questions max, manual Next, no auto-advance
- [ ] Post-session: update `sr_state`, refresh stats, award XP

### 4.2 Question of the Day
- [ ] Date-driven selection: `hash(date) % total` → pinned in `daily_questions`
- [ ] Home card: question, answer, explanation, completion state, XP reward
- [ ] History: last 30 days, revisit any day

### 4.3 Streak & XP System
- [ ] `gamification.ts`: `nextStreakDays`, `rankFromXp`, `XP_PER_CORRECT/WRONG`
- [ ] `recordReward()` called from `answerService` — single XP source
- [ ] Daily goal (configurable), streak freeze (premium), longest streak
- [ ] Leaderboard: weekly/monthly/all-time (cached, refreshed nightly)

### 4.4 Badges/Achievements
- [ ] Triggers: first_q, first_exam, q100, q500, q1000, streak7, streak30, chapter_complete, subject_complete, accuracy_90, exam_master
- [ ] `achievements` table + `awardAchievement()` idempotent by (user, type)
- [ ] Profile: badge grid with earned/locked states

### 4.5 Weak Areas & Recommendations
- [ ] Compute from `user_progress` + `question_hierarchy`: accuracy < 60% per chapter
- [ ] Home: "Recommended for you" card → deep link to practice
- [ ] Weekly push: "You're weak in Surveying → Traverse Survey. Practice 10 Q."

---

## Phase 5 — Dashboard & Content (Weeks 5–6)

### 5.1 Home Dashboard (`/`)
- [ ] Header: greeting, avatar, active course (switchable), notification bell
- [ ] Active course card: progress ring, % complete, continue button
- [ ] Question of the Day (inline, answerable)
- [ ] Stat grid (6 cards): Rank, Streak, XP, Bank Qs, Attempted, Accuracy
- [ ] Quick Actions (8): Practice, Timed Exam, Battle, Spaced Review, Subjects, Mistakes, Bookmarks, Custom Exam
- [ ] Spaced Review Status (4 cards + start button)
- [ ] Topic Progress (top 6, view all → practice)
- [ ] Exam Countdown (if `exam_target_date` set)
- [ ] Course Videos carousel (continue watching)
- [ ] Community snippet (latest post)

### 5.2 Subjects → Chapters → Topics
- [ ] Subjects: real stats from `getSubjectsWithProgress`
- [ ] Chapters: `getChaptersWithProgress` with progress bar, accuracy
- [ ] Topics: list with question count, attempted, accuracy
- [ ] Each level: practice button, exam button, theory button

### 5.3 Theory Mode
- [ ] New screen `/theory?topicId=` or per-chapter
- [ ] Content: definitions, concepts, formulas, examples, references
- [ ] Data model: `study_materials` table (type: theory/notes/formula_sheet/pdf/video, linked to topic/chapter)
- [ ] Toggle Practice ↔ Theory on question/chapter screen

### 5.4 Course Videos
- [ ] `videos` table: course, subject, chapter, title, url, thumbnail, duration, order
- [ ] Continue watching row on Home
- [ ] Video player: progress save, playback speed, fullscreen, related questions

### 5.5 Study Material / Books
- [ ] `study_materials` table (type: book/notes/pdf/formula_sheet/past_paper)
- [ ] Library screen: filter by type, subject, chapter
- [ ] PDF viewer (expo-file-system + react-native-pdf)
- [ ] Offline download support

### 5.6 Syllabus
- [ ] Hierarchical tree: Course → Subject → Chapter → Topic
- [ ] Each node: completion %, question count, material links
- [ ] Search within syllabus

---

## Phase 6 — Engagement & Social (Weeks 6–7)

### 6.1 Battle / Games (Replace Placeholder)
- [ ] Modes: Daily Run (10 Q, 5 min), Chapter Rush (single chapter), Mistake Blitz (user's mistakes), Exam Sprint (20 Q, timed)
- [ ] Reuse `examEngine` + `QuestionCard`; add game-specific scoring
- [ ] Result: XP, streak impact, leaderboard entry
- [ ] Local-first; multiplayer via Firebase Realtime DB (future)

### 6.2 Leaderboard
- [ ] Weekly/Monthly/All-Time tabs
- [ ] Rank, name, XP, avatar, current user highlighted
- [ ] Efficient query: materialized view or nightly aggregation

### 6.3 Community (Optional — defer if scope tight)
- [ ] Groups per subject/chapter
- [ ] Messages, unread, timestamps, report, moderation
- [ ] Push notifications for replies/mentions

### 6.4 Notifications
- [ ] `notifications` table: user_id, type, title, body, data_json, read_at, created_at
- [ ] Types: daily_challenge, review_due, streak_reminder, exam_reminder, weekly_report, achievement, community, system
- [ ] Preferences screen: toggle per category
- [ ] Expo push token registration + local notification scheduling

---

## Phase 7 — Platform & Monetization (Weeks 7–8)

### 7.1 Premium / Entitlements
- [ ] `entitlements` table: user_id, feature (custom_exam/past_papers/videos/analytics/ai), source (subscription/purchase), expires_at
- [ ] RevenueCat or Play Billing integration
- [ ] UI gates: `useEntitlement(feature)` hook, show upgrade sheet

### 7.2 Past Year Papers
- [ ] `past_papers` table: exam_name, year, level, subject, question_ids_json, duration, marks_per_q, negative_marks, pass_pct, is_premium
- [ ] List screen with filters, attempt history, premium lock

### 7.3 Custom Exam Builder (UI)
- [ ] Wizard: Title → Subjects/Chapters → Question Count → Duration → Marks/Negative/Pass
- [ ] Preview question pool size before create
- [ ] My Custom Exams: list with attempts, best %, actions (start/continue/edit/delete)

### 7.4 Admin/Content Architecture (Backend-Ready)
- [ ] All content in DB (not hard-coded): courses, subjects, chapters, topics, questions, videos, materials, papers
- [ ] Admin API endpoints (separate repo): CRUD for all entities, bulk import, validation
- [ ] Question validation: unique correct answer, all options present, explanation required, valid hierarchy, no detectable duplicates

### 7.5 Analytics Events
- [ ] Central `analytics.ts`: `track(event, params)` → batch → send (Firebase Analytics / custom)
- [ ] Events: app_open, course_selected, subject_opened, chapter_opened, question_answered, exam_completed, review_completed, video_completed, custom_exam_created, subscription_started

---

## Cross-Cutting Requirements (All Phases)

### Data Consistency
- [ ] Single `answerService.recordAnswer()` updates: progress, SR, XP, streak, mistakes, bookmarks, analytics
- [ ] Idempotent writes: composite keys (user+question), `INSERT OR REPLACE`, idempotency keys for exams

### Offline Resilience
- [ ] Question bank, hierarchy, user progress cached in SQLite
- [ ] Exam state survives kill/restart
- [ ] Sync queue (`sync_queue` table) for offline mutations → background sync when online

### Performance
- [ ] Pagination (20/page) everywhere; indexed queries
- [ ] `FlatList` optimization: `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `getItemLayout`
- [ ] Image caching (expo-image) for thumbnails
- [ ] Bundle size: lazy-load heavy screens (videos, PDF viewer, charts)

### Accessibility
- [ ] Contrast ratios (WCAG AA)
- [ ] Touch targets ≥ 48dp
- [ ] Screen reader labels on all interactive elements
- [ ] Dynamic type support (no hard-coded font sizes)
- [ ] Color-blind safe palette (no info by color alone)

### Testing Checklist (Per Feature)
| Scenario | Verify |
|----------|--------|
| Happy path | Works normally |
| Empty state | Shows helpful EmptyState + action |
| Error state | Shows ErrorState + retry |
| Large data | 10k+ questions, smooth scroll |
| Rapid taps | No duplicate submissions |
| Back nav | State restored, no jump |
| App restart | All progress persisted |
| Network loss | Local data usable, queue syncs |
| Dark mode | All components render correctly |
| Font scale | Layout doesn't break |

---

## Migration & Rollout

1. **DB Migrations**: Add new columns/tables via `MIGRATION_ORDER` (idempotent)
2. **Feature Flags**: Use `expo-constants` or remote config to gate unfinished features
3. **Staged Rollout**: Internal → Beta (TestFlight/Play Console) → Production
4. **Rollback**: Keep previous build; migrations are additive only

---

## Open Questions (Resolve Before Phase 1)

1. **Firebase vs. Pure Local**: Current auth uses Firebase; is Firestore sync required for multi-device, or is local SQLite + anonymous auth sufficient for MVP?
2. **Premium Model**: Subscription (RevenueCat) vs. one-time purchases vs. freemium tiers? Affects entitlement schema.
3. **Video Hosting**: CDN (Mux/Cloudflare Stream) vs. Firebase Storage vs. YouTube unlisted? Impacts player implementation.
4. **Community Scope**: Include in MVP or defer to Phase 7? Requires real-time DB + moderation.
5. **AI Features**: Doubt solver / tutor chat — integrate existing LLM API or build RAG on question bank? Defer to post-MVP?
6. **Nepali Language**: Full UI localization + question content? Requires translation pipeline.

---

## File Structure Additions

```
loksewa-mobile/
├── src/
│   ├── components/
│   │   ├── ui/           # Design system components (new)
│   │   ├── QuestionCard.tsx
│   │   ├── TheoryCard.tsx        # NEW
│   │   ├── QuestionPalette.tsx   # NEW
│   │   ├── VideoPlayer.tsx       # NEW
│   │   ├── BadgeGrid.tsx         # NEW
│   │   ├── LeaderboardRow.tsx    # NEW
│   │   └── NotificationBell.tsx  # NEW
│   ├── screens/          # Feature screens (optional reorganization)
│   ├── hooks/
│   │   ├── useEntitlement.ts     # NEW
│   │   useTypedNavigation.ts     # NEW
│   │   useDebounce.ts
│   │   useOfflineSync.ts         # NEW
│   ├── services/
│   │   ├── analytics.ts          # NEW
│   │   ├── notifications.ts      # NEW
│   │   ├── videoService.ts       # NEW
│   │   ├── studyMaterialService.ts # NEW
│   │   ├── pastPaperService.ts   # NEW
│   │   ├── communityService.ts   # NEW (optional)
│   │   └── aiService.ts          # NEW (deferred)
│   ├── utils/
│   │   ├── spacedRepetition.ts
│   │   ├── gamification.ts
│   │   ├── navigation.ts
│   │   └── dateUtils.ts          # NEW
│   ├── constants/
│   │   ├── theme.ts              # ENHANCE: dark mode tokens
│   │   ├── courses.ts
│   │   └── strings.ts            # NEW: i18n keys
│   └── db/
│       └── migrations/index.ts   # ADD: 007_difficulty, 008_entitlements, 009_videos, 010_materials, 011_papers
├── app/
│   ├── (app)/
│   │   ├── index.tsx             # Home — ENHANCE
│   │   ├── practice.tsx          # ENHANCE
│   │   ├── exam.tsx              # ENHANCE
│   │   ├── spaced.tsx            # ENHANCE
│   │   ├── subjects.tsx          # ENHANCE
│   │   ├── chapters.tsx          # ENHANCE
│   │   ├── theory.tsx            # NEW
│   │   ├── videos.tsx            # NEW
│   │   ├── library.tsx           # NEW
│   │   ├── syllabus.tsx          # NEW
│   │   ├── custom-exam.tsx       # NEW
│   │   ├── past-papers.tsx       # NEW
│   │   ├── battle.tsx            # REPLACE
│   │   ├── leaderboard.tsx       # NEW
│   │   ├── achievements.tsx      # NEW
│   │   ├── notifications.tsx     # NEW
│   │   ├── profile.tsx           # ENHANCE
│   │   ├── settings.tsx          # NEW
│   │   └── help.tsx              # NEW
│   └── (auth)/...
└── scripts/
    └── generate-question-bundle.js
```

---

## Validation Gates (Per Phase)

| Phase | Must Pass Before Next |
|-------|----------------------|
| 1 | Auth + course switch + question bank seeded + design system used on 3 screens |
| 2 | Practice: search, filter, stable card, bookmark, mistake, report all persist |
| 3 | Timed exam: pause/kill/resume, auto-submit, result accuracy, history |
| 4 | Smart Review: due counts match DB, intervals advance correctly, streak/XP consistent |
| 5 | Home dashboard loads < 2s, all quick actions navigate, theory + videos play |
| 6 | Battle modes playable, leaderboard updates, notifications deliver |
| 7 | Premium gates enforced, past papers purchasable, custom exam creatable |

---

## Success Metrics (Post-Launch)

- **Activation**: > 60% new users answer ≥ 5 questions Day 1
- **Retention**: Day 7 > 35%, Day 30 > 15%
- **Engagement**: Avg session > 12 min, questions/session > 15
- **Quality**: < 0.5% crash rate, < 100ms P99 question render
- **Monetization**: > 3% premium conversion (if applicable)

---

## Out of Scope (Explicit)

- Admin dashboard (separate repo)
- Multiplayer real-time battle (Phase 7+)
- AI tutor / doubt solver (post-MVP)
- Full Nepali UI localization (architecture ready, content later)
- iOS-specific features (Apple Sign-In, widgets) — parity later
- Web build (Expo Router supports; test but not prioritize)

---

## Next Step

Resolve **Open Questions** (Section above) → Finalize Phase 1 tasks → Begin implementation.