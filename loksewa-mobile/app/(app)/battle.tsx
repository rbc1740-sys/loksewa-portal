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

  /** Live room subscription drives lobby → play → result transitions. */
  const watch = useCallback((code: string) => {
    unsubRef.current?.();
    subscribeRoom(code, r => {
      setRoom(r);
      if (r.status === 'active' && r.myRole) {
        setPhase(p => (p === 'menu' || p === 'lobby' ? 'play' : p));
      }
      if (r.status === 'done') {
        setWinner(determineWinner(r.hostScore, r.guestScore));
        setPhase('result');
      }
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not watch the room.'));
  }, []);

  useEffect(() => () => unsubRef.current?.(), []);

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
    (option: string) => {
      const q = questions[qIndex];
      if (!q) return;
      const gained = computeScore(q.answer === option, Date.now() - qStartRef.current);
      setScore(s => s + gained);
      if (qIndex + 1 >= questions.length) {
        const role = room?.myRole;
        if (role) void finishMyPaper(room!.roomCode, role, score + gained);
        setPhase('result'); // my paper done; await opponent via subscription
      } else {
        setQIndex(i => i + 1);
        qStartRef.current = Date.now();
      }
    },
    [questions, qIndex, room, score]
  );

  const backToMenu = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setRoom(null);
    setQuestions([]);
    setQIndex(0);
    setScore(0);
    setWinner(null);
    setPhase('menu');
  }, []);

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
          <TouchableOpacity style={styles.ghostBtn} onPress={backToMenu}>
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
          subtitle={`Score ${score}`}
        />
        <View style={styles.play}>
          <Text style={styles.question}>{questions[qIndex]?.question}</Text>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={styles.option} onPress={() => answer(opt)}>
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.timer}>
            {Math.round(BATTLE_QUESTION_MS / 1000)}s per question — faster answers score more
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- RESULT ----------
  if (phase === 'result') {
    const mine = room ? (room.myRole === 'guest' ? room.guestScore : room.hostScore) : score;
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
  timer: { ...typography.caption, color: t.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
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