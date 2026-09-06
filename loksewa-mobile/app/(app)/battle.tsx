/**
 * Battle Screen — 1v1 async battle (Phase 8).
 *
 * Flow: menu → host (frozen 10-question paper, share code) or join by code →
 * both players answer the same paper at their own pace → scores land in the
 * room doc (rules allow only per-side score + status writes) → winner shown
 * when both papers are in. All Firestore writes go through battleService.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Swords, Trophy } from 'lucide-react-native';
import {
  BATTLE_QUESTIONS,
  BATTLE_QUESTION_MS,
  computeScore,
  determineWinner,
  type BattleWinner,
} from '../../src/services/battleEngine';
import {
  createBattleRoom,
  joinBattleRoom,
  subscribeRoom,
  finishMyPaper,
  fetchRoom,
  cancelOpenRoom,
  pickBattleQuestions,
  type BattleRoomView,
} from '../../src/services/battleService';
import { getQuestionsByIds, type Question } from '../../src/services/database';
import { useAuthStore } from '../../src/stores/authStore';
import { ScreenHeader, ErrorState } from '../../src/components/ui';
import { spacing, radius, typography, type AppTheme } from '../../src/constants/theme';
import { useTheme } from '../../src/hooks/useTheme';

type Phase = 'menu' | 'lobby' | 'play' | 'result';

export default function BattleScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const user = useAuthStore(s => s.user);
  const name = user?.displayName ?? 'Player';

  const [phase, setPhase] = useState<Phase>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<BattleRoomView | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [winner, setWinner] = useState<'host' | 'guest' | 'tie' | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const qStartRef = useRef<number>(0);
  // Multi-try-free battle answering: one pick per question, then a short
  // feedback beat (green/red) before advancing. Timer forces a pick.
  const [picked, setPicked] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(BATTLE_QUESTION_MS);
  const [myFinal, setMyFinal] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SYNCHRONOUS guards — state updates are async, so a rapid double-tap
  // would read the stale `picked == null` from the same render and score
  // twice. The ref is checked and set in the same synchronous pass.
  const pickedRef = useRef<string | null>(null);
  // Whether MY paper has been submitted (drives the status write-off repair).
  const finishedRef = useRef(false);
  const myScoreRef = useRef(0);

  /** Live room subscription drives lobby → play → result transitions. */
  const watch = useCallback((code: string) => {
    unsubRef.current?.();
    subscribeRoom(
      code,
      r => {
        setRoom(r);
        if (r.status === 'active' && r.myRole) {
          setPhase(p => (p === 'menu' || p === 'lobby' ? 'play' : p));
        }
        if (r.status === 'done') {
          setWinner(determineWinner(r.hostScore, r.guestScore));
          setPhase('result');
        }
        // WRITE-OFF REPAIR: if both papers finished nearly simultaneously,
        // the last status write can clobber the 'done' transition (e.g. doc
        // stuck at 'host_done' with both scores recorded). When I see the
        // OTHER side's finish recorded while the match isn't closed and my
        // paper is already in, my finish write is exactly the missing
        // {myScore, 'done'} update — legal under the rules and idempotent.
        if (finishedRef.current && r.myRole) {
          const otherDone =
            r.myRole === 'host' ? r.status === 'guest_done' : r.status === 'host_done';
          if (otherDone) {
            void finishMyPaper(r.roomCode, r.myRole, myScoreRef.current).catch(() => {
              setSubmitError(true);
            });
          }
        }
      },
      e => setError(e instanceof Error ? e.message : 'Lost the connection to the room.')
    ).catch(e => setError(e instanceof Error ? e.message : 'Could not watch the room.'));
  }, []);

  useEffect(() => () => {
    unsubRef.current?.();
    if (advanceRef.current) clearTimeout(advanceRef.current);
  }, []);

  const host = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const ids = await pickBattleQuestions('constitution');
      const { roomCode } = await createBattleRoom(name, 'constitution', ids);
      watch(roomCode);
      setPhase('lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the battle.');
    } finally {
      setBusy(false);
    }
  }, [name, watch]);

  const join = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Enter the 6-character room code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await joinBattleRoom(code, name);
      setRoom(r);
      watch(code);
      const fresh = await fetchRoom(code);
      setPhase(fresh?.status === 'active' ? 'play' : 'lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join.');
    } finally {
      setBusy(false);
    }
  }, [joinCode, name, watch]);
/** Load the frozen paper on entering play. */
  useEffect(() => {
    if (phase !== 'play' || !room || questions.length) return;
    let alive = true;
    getQuestionsByIds(room.question_ids)
      .then(qs => {
        if (!alive) return;
        setQuestions(qs);
        setQIndex(0);
        qStartRef.current = Date.now();
        pickedRef.current = null;
        setPicked(null);
        setTimeLeft(BATTLE_QUESTION_MS);
      })
      .catch(() => setError('Could not load the battle questions.'));
    return () => {
      alive = false;
    };
  }, [phase, room, questions.length]);

  const options: string[] = React.useMemo(() => {
    if (phase !== 'play' || !questions.length) return [];
    try {
      const parsed = JSON.parse(questions[qIndex]?.options_json ?? '[]');
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [phase, questions, qIndex]);

  const answer = useCallback(
    (option: string | null) => {
      const q = questions[qIndex];
      // Sync guard first: rapid double-taps (or a tap racing the timer
      // effect) land in the same tick before setPicked re-renders.
      if (!q || pickedRef.current != null) return; // one pick per question
      pickedRef.current = option ?? ''; // '' = timed out
      setPicked(option ?? '');
      const correct = option != null && q.answer === option;
      const gained = computeScore(correct, Date.now() - qStartRef.current);
      const finalScore = score + gained;
      myScoreRef.current = finalScore;
      setScore(finalScore);
      // Brief green/red feedback beat, then advance (or finish the paper).
      if (advanceRef.current) clearTimeout(advanceRef.current);
      advanceRef.current = setTimeout(() => {
        advanceRef.current = null;
        if (qIndex + 1 >= questions.length) {
          const role = room?.myRole;
          if (role) {
            finishedRef.current = true;
            void finishMyPaper(room!.roomCode, role, finalScore).catch(() => {
              setSubmitError(true); // retried in-service; also repaired on next snapshot
            });
          }
          setMyFinal(finalScore); // result shows MY score even if the doc lags
          setPhase('result'); // my paper done; await opponent via subscription
        } else {
          setQIndex(i => i + 1);
          qStartRef.current = Date.now();
          pickedRef.current = null;
          setPicked(null);
          setTimeLeft(BATTLE_QUESTION_MS);
        }
      }, 900);
    },
    [questions, qIndex, room, score]
  );

  /**
   * Per-question countdown, WALL-CLOCK based (not accumulated ticks): RN
   * timers pause while the app is backgrounded, but Date.now() doesn't —
   * so backgrounding can't extend the budget and drift never accumulates.
   */
  useEffect(() => {
    if (phase !== 'play' || !questions.length || picked != null) return;
    const sync = () => setTimeLeft(Math.max(0, BATTLE_QUESTION_MS - (Date.now() - qStartRef.current)));
    sync(); // catch up immediately after backgrounding/reconnect
    const iv = setInterval(sync, 250);
    return () => clearInterval(iv);
  }, [phase, questions.length, qIndex, picked]);

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    if (phase === 'play' && questions.length && timeLeft === 0 && pickedRef.current == null) {
      answerRef.current(null);
    }
  }, [phase, questions.length, timeLeft]);

  // Back navigation must not silently destroy an active match (hardware
  // back / gesture would pop the route and orphan the room doc).
  usePreventRemove(phase === 'play', () => {
    // Swallowed on purpose: the only exits are finishing the paper or the
    // explicit Cancel/Back buttons, which do the cleanup themselves.
  });

  const backToMenu = useCallback(() => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
    setRoom(null);
    setQuestions([]);
    setQIndex(0);
    setScore(0);
    setWinner(null);
    setMyFinal(null);
    setSubmitError(false);
    pickedRef.current = null;
    finishedRef.current = false;
    myScoreRef.current = 0;
    setPicked(null);
    setTimeLeft(BATTLE_QUESTION_MS);
    setPhase('menu');
  }, []);

  /** Lobby Cancel: also deletes the still-empty room so it can't pile up. */
  const cancelAndExit = useCallback(() => {
    const code = room?.roomCode;
    if (code) void cancelOpenRoom(code).catch(() => {}); // best-effort; rules scope it
    backToMenu();
  }, [room, backToMenu]);

  if (error) return <ErrorState message={error} onRetry={backToMenu} />;

  // ---------- LOBBY ----------
  if (phase === 'lobby') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Battle Lobby" subtitle="Waiting for an opponent" />
        <View style={styles.center}>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Share this code</Text>
            <Text style={styles.code}>{room?.roomCode}</Text>
          </View>
          <Text style={styles.waiting}>
            {room?.guestUid
              ? `${room.guest} joined — starting…`
              : `${BATTLE_QUESTIONS} questions · waiting for a challenger`}
          </Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={cancelAndExit}>
            <Text style={styles.ghostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- PLAY ----------
  if (phase === 'play' && questions.length > 0) {
    const q = questions[qIndex];
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title={`Battle · ${qIndex + 1}/${questions.length}`}
          subtitle={`Score ${score} · You are the ${room?.myRole === 'guest' ? 'Guest' : 'Host'}`}
        />
        <View style={styles.play}>
          <Text style={styles.question}>{questions[qIndex]?.question}</Text>
          {options.map(opt => {
            const isCorrect = picked != null && opt === q.answer;
            const isWrongPick = picked != null && picked === opt && opt !== q.answer;
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.option,
                  isCorrect && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                  picked != null && !isCorrect && !isWrongPick && styles.optionDim,
                ]}
                onPress={() => answer(opt)}
                disabled={picked != null}
              >
                <Text
                  style={[
                    styles.optionText,
                    isCorrect && styles.optionTextCorrect,
                    isWrongPick && styles.optionTextWrong,
                  ]}
                >
                  {opt}
                  {isCorrect ? '  ✓' : isWrongPick ? '  ✗' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text
            style={[
              picked == null ? styles.timer : styles.timerDone,
              picked == null && timeLeft <= 5000 && styles.timerUrgent,
            ]}
          >
            {picked == null
              ? `${Math.ceil(timeLeft / 1000)}s — faster answers score more`
              : picked === ''
                ? "Time's up! +0"
                : q.answer === picked
                  ? 'Correct!'
                  : 'Wrong — +0'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- RESULT ----------
  if (phase === 'result') {
    // Prefer MY locally-computed final score — the room doc can lag behind
    // the snapshot right after finishing (eventual consistency).
    const mine = myFinal ?? (room ? (room.myRole === 'guest' ? room.guestScore : room.hostScore) : score);
    const theirs = room ? (room.myRole === 'guest' ? room.hostScore : room.guestScore) : 0;
    const label =
      winner == null
        ? 'Your paper is in — waiting for your opponent…'
        : winner === 'tie'
          ? "It's a tie!"
          : winner === room?.myRole
            ? 'You win! 🏆'
            : 'You lost — try again!';
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Battle Result" />
        <View style={styles.play}>
          <Trophy size={56} color={winner ? '#f59e0b' : '#94a3b8'} style={styles.trophy} />
          <Text style={styles.scoreBig}>{mine}</Text>
          <Text style={styles.verdict}>{label}</Text>
          {winner != null && (
            <Text style={styles.detail}>
              Final — host {room?.hostScore} · guest {room?.guestScore}
            </Text>
          )}
          {submitError && (
            <Text style={styles.detail}>
              Couldn't sync your final score — reopen this battle once you're back online.
            </Text>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={backToMenu}>
            <Text style={styles.primaryText}>Back to Battle Arena</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- MENU ----------
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Battle Arena" subtitle="1v1 · same 10 questions · fastest brain wins" />
      <View style={styles.menu}>
        <Swords size={44} color="#f59e0b" style={styles.swords} />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void host()} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Preparing…' : 'Host a Battle'}</Text>
        </TouchableOpacity>
        <Text style={styles.or}>— or join with a code —</Text>
        <TextInput
          style={styles.codeInput}
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="ABC234"
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={styles.joinBtn} onPress={() => void join()} disabled={busy}>
          <Text style={styles.primaryText}>Join Battle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const makeStyles = (t: AppTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screenX },
  menu: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screenX, gap: spacing.md },
  play: { flex: 1, padding: spacing.screenX, gap: spacing.sm },
  swords: { marginBottom: spacing.xs },
  codeBox: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  codeLabel: { ...typography.caption, color: t.textSecondary, marginBottom: spacing.xxs },
  code: { fontSize: 40, fontWeight: '900', letterSpacing: 6, color: t.primary },
  waiting: { ...typography.bodySmall, color: t.textSecondary, marginTop: spacing.md, textAlign: 'center' },
  ghostBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: t.surfaceMuted,
  },
  ghostText: { ...typography.bodySmall, fontWeight: '700', color: t.textSecondary },
  question: { ...typography.cardTitle, color: t.textPrimary, marginBottom: spacing.sm },
  option: {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing.md,
  },
  optionText: { ...typography.bodySmall, color: t.textPrimary },
  optionCorrect: { backgroundColor: t.successSoft, borderColor: t.success },
  optionWrong: { backgroundColor: t.errorSoft, borderColor: t.error },
  optionDim: { opacity: 0.5 },
  optionTextCorrect: { color: t.success, fontWeight: '700' },
  optionTextWrong: { color: t.error, fontWeight: '700' },
  timer: { ...typography.caption, color: t.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
  timerDone: { ...typography.caption, color: t.textSecondary, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },
  timerUrgent: { color: t.error },
  trophy: { marginBottom: spacing.sm },
  scoreBig: { fontSize: 64, fontWeight: '900', color: t.textPrimary },
  verdict: { ...typography.body, color: t.textSecondary, marginTop: spacing.xxs, textAlign: 'center' },
  detail: { ...typography.caption, color: t.textTertiary, marginTop: spacing.xs },
  primaryBtn: {
    backgroundColor: t.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 220,
  },
  primaryText: { ...typography.bodySmall, fontWeight: '800', color: '#fff' },
  or: { ...typography.caption, color: t.textTertiary },
  codeInput: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radius.md,
    backgroundColor: t.surface,
    color: t.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    minWidth: 200,
  },
  joinBtn: {
    backgroundColor: t.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 220,
  },
});