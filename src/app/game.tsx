import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Board, snapBoardSize, type BoardCell } from '@/components/board';
import { Confetti } from '@/components/confetti';
import { GameTools } from '@/components/game-tools';
import { HintCard } from '@/components/hint-card';
import { NumberPad } from '@/components/number-pad';
import { Popup, PopupButton } from '@/components/popup';
import { PROGRESS_ROW_HEIGHT, ProgressBar } from '@/components/progress-bar';
import { Toast } from '@/components/toast';
import { TopIcon } from '@/components/top-bar';
import { AppText, Button } from '@/components/ui';
import { explainHint, levelName, type HintText } from '@/i18n/explain';
import { useAds } from '@/lib/ads/ads-context';
import { useAppData } from '@/lib/app-data';
import { feedback, lightTap } from '@/lib/feedback';
import { formatTime, shortDate } from '@/lib/format';
import { mayConsiderInterstitial, needsConfirmation, outOfMistakesActions, pauseActions, type FlowAction } from '@/lib/game-flow';
import { setGenerationPaused } from '@/lib/puzzle-source';
import { noteWinAndMaybeAskReview } from '@/lib/review/store-review';
import { useSettings } from '@/lib/settings';
import {
  applyHint,
  canSecondChance,
  canUndo,
  erase,
  freeHintsLeft,
  hintsUsed,
  isGiven,
  isWrong,
  MISTAKE_LIMIT,
  place,
  progressPercent,
  remainingCounts,
  restart,
  secondChance,
  solutionDigits,
  tick,
  toggleNote,
  undo,
  type GameState,
  type PlayOptions,
  type Result,
} from '@/sudoku/game';
import { colOf, rowOf, UNITS } from '@/sudoku/grid';
import { findHint, hintButtonState, hintCells } from '@/sudoku/hints';
import { usePalette } from '@/theme/theme-context';
import { BOARD, difficultyColor, MOTION, RADIUS, SPACE, TOP_BAR } from '@/theme/tokens';

type End = { kind: 'won'; newBest: boolean } | { kind: 'lost' };
type Confirm = 'restart' | 'pauseNew';
type HintView = { cells: Set<number>; target: number; text: HintText };

/** Stats row under the top bar: mistakes, timer and pause. */
const STATS_ROW = 40;
const TOAST_MS = 1400;
const NO_CELLS = new Set<number>();

function rippleDelays(units: number[], origin: number): Map<number, number> {
  const delays = new Map<number, number>();
  const r0 = rowOf(origin);
  const c0 = colOf(origin);
  for (const u of units) {
    for (const cell of UNITS[u]) {
      const d = (Math.abs(rowOf(cell) - r0) + Math.abs(colOf(cell) - c0)) * MOTION.rippleStaggerMs;
      delays.set(cell, Math.min(delays.get(cell) ?? Infinity, d));
    }
  }
  return delays;
}

export default function GameScreen() {
  const data = useAppData();
  const [game, setGame] = useState<GameState | null>(() => data.game);
  if (!game) return <Redirect href="/" />;
  return <Game game={game} setGame={setGame} />;
}

function Game({ game, setGame }: { game: GameState; setGame: (g: GameState | ((prev: GameState | null) => GameState | null)) => void }) {
  const data = useAppData();
  const ads = useAds();
  const { settings, update, t } = useSettings();
  const p = usePalette();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [selected, setSelected] = useState<number | null>(null);
  const [activeDigit, setActiveDigit] = useState(0);
  const [notesMode, setNotesMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [hint, setHint] = useState<HintView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ripple, setRipple] = useState<{ id: number; delays: Map<number, number> }>({ id: 0, delays: new Map() });
  const [end, setEnd] = useState<End | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options: PlayOptions = {
    mistakeCheck: settings.mistakeCheck,
    autoRemoveNotes: settings.autoRemoveNotes,
  };
  const fb = { sound: settings.sound, vibration: settings.vibration };
  // Opening Settings mid-game (screen not focused) stops the clock like Pause, without the popup.
  const playing = game.status === 'playing' && !paused && !adOpen && !end && !confirm && focused;

  // Timer: counts only while the board is visible and in play.
  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      setGame((g) => (g ? tick(g, delta) : g));
    }, 1000);
    return () => clearInterval(id);
  }, [playing, setGame]);

  // Autosave while the game is in progress.
  const { saveGame } = data;
  useEffect(() => {
    if (game.status === 'playing') saveGame(game);
  }, [game, saveGame]);

  // Background generation waits while a puzzle is being played.
  useEffect(() => {
    setGenerationPaused(playing);
    return () => setGenerationPaused(false);
  }, [playing]);

  // Auto-pause when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setPaused(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (text: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  /** Same persisted setting as the Settings toggle. Only the piano; ad audio is the ad's own. */
  const toggleMusic = () => {
    const on = !settings.music;
    update({ music: on });
    lightTap(settings.vibration);
    showToast(on ? t('game.musicOn') : t('game.musicOff'));
  };

  /** Settings on top of the game: the game stays mounted, so it comes back exactly as it was. */
  const openSettings = () => router.push('/settings');

  const flash = (text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 3500);
  };

  const finish = (state: GameState) => {
    const { newBest } = data.finishGame(state);
    setEnd({ kind: 'won', newBest });
  };

  const apply = (r: Result, cell: number, keepHint = false) => {
    if (r.state === game) return;
    setGame(r.state);
    if (!keepHint) setHint(null);
    const ev = r.events;
    if (ev.won) {
      feedback('win', fb);
      finish(r.state);
    } else if (ev.lost) {
      feedback('mistake', fb);
      setEnd({ kind: 'lost' });
    } else if (ev.mistake) feedback('mistake', fb);
    else if (ev.completedUnits.length) feedback('unit', fb);
    else if (ev.noted) feedback('note', fb);
    else if (ev.placed) feedback('place', fb);
    if (ev.completedUnits.length) setRipple((prev) => ({ id: prev.id + 1, delays: rippleDelays(ev.completedUnits, cell) }));
  };

  const act = (cell: number, digit: number) => {
    if (notesMode) return apply(toggleNote(game, cell, digit), cell);
    if (game.values[cell] === digit && !isGiven(game, cell)) return apply(erase(game, cell), cell);
    apply(place(game, cell, digit, options), cell);
  };

  const onCellPress = (cell: number) => {
    if (!playing) return;
    setSelected(cell);
    if (settings.inputMode === 'number' && activeDigit && !isGiven(game, cell)) act(cell, activeDigit);
    else if (hint) setHint(null);
  };

  const onDigit = (d: number) => {
    if (!playing) return;
    if (settings.inputMode === 'number') {
      setActiveDigit((a) => (a === d ? 0 : d));
      return;
    }
    if (selected != null) act(selected, d);
  };

  const onErase = () => {
    if (playing && selected != null) apply(erase(game, selected), selected);
  };

  const onUndo = () => {
    if (playing) apply(undo(game), selected ?? 0);
  };

  const hintState = hintButtonState(freeHintsLeft(game), game.rewardedHintsUsed);

  const onHint = async () => {
    if (!playing) return;
    if (hintState.kind === 'used') return flash(t('game.hintUsed'));
    const h = findHint(game.values, solutionDigits(game));
    if (!h) return;
    let source: 'free' | 'rewarded' = 'free';
    if (hintState.kind === 'ad') {
      if (!ads.offers.hint) return flash(t('game.hintNoAd'));
      setAdOpen(true);
      const earned = await ads.showRewarded('hint');
      setAdOpen(false);
      if (!earned) return;
      source = 'rewarded';
    }
    const r = applyHint(game, h, source, options);
    if (r.state === game) return;
    setSelected(h.cell);
    setHint({ cells: new Set(hintCells(h)), target: h.cell, text: explainHint(t, h) });
    apply(r, h.cell, true);
  };

  const onSecondChance = async () => {
    if (!canSecondChance(game)) return;
    if (!ads.offers.second_chance) return flash(t('lose.noAd'));
    setAdOpen(true);
    const ok = await ads.showRewarded('second_chance');
    setAdOpen(false);
    if (!ok) return;
    setGame((g) => (g ? secondChance(g) : g));
    setEnd(null);
  };

  /** Back to a clean view of the current (or a new) puzzle. */
  const resetView = () => {
    setEnd(null);
    setHint(null);
    setMessage(null);
    setSelected(null);
    setActiveDigit(0);
    setNotesMode(false);
    setPaused(false);
    setConfirm(null);
  };

  /** Same puzzle from its givens. Not a finished puzzle: no stats, no interstitial. */
  const doRestart = () => {
    setGame((g) => (g ? restart(g) : g));
    resetView();
  };

  /** New puzzle at the same level from the pause popup. Abandons this one; never an ad. */
  const doPauseNew = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      const next = await data.startLevel(game.level);
      setGame(next);
      resetView();
    } finally {
      setLeaving(false);
    }
  };

  const ask = (action: Confirm) => {
    if (needsConfirmation(action, game)) return setConfirm(action);
    if (action === 'restart') doRestart();
    else void doPauseNew();
  };

  /** Leaving the end screen: the only place an interstitial may show, then maybe the review card. */
  const leave = async (target: 'home' | 'next' | 'daily') => {
    if (leaving) return;
    setLeaving(true);
    const won = game.status === 'won';
    if (!won) data.finishGame(game);
    const rewardedThisGame = game.rewardedAds > 0;
    const action: FlowAction = target === 'next' ? 'finishedNext' : 'finishedLeave';
    const shown = mayConsiderInterstitial(action, { paused: paused && !end, status: game.status })
      ? await ads.puzzleFinished({ rewardedThisGame })
      : false;
    if (won) {
      const now = Date.now();
      void noteWinAndMaybeAskReview({
        now,
        sessionCount: ads.state.sessionCount,
        won: true,
        mistakes: game.mistakes,
        usedSecondChance: game.secondChanceUsed,
        rewardedThisGame,
        interstitialNow: shown,
        lastInterstitialAt: ads.state.lastInterstitialAt,
        lastRewardedAt: ads.state.lastRewardedAt,
      });
    }
    if (target === 'next') {
      const next = await data.startLevel(game.level);
      setGame(next);
      resetView();
      setLeaving(false);
      return;
    }
    if (target === 'daily') router.replace('/daily');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ---- layout ----
  const availW = width - insets.left - insets.right;
  const availH = height - insets.top - insets.bottom;
  const landscape = availW > availH * 1.15;
  const HEADER = TOP_BAR.height + STATS_ROW + PROGRESS_ROW_HEIGHT;
  // Back + three icons with 4px gaps: 48dp targets when the title keeps at least 120dp, else 44.
  const iconTarget = availW - 8 - 4 * TOP_BAR.target - 4 * TOP_BAR.gap >= 120 ? TOP_BAR.target : TOP_BAR.minTarget;
  const fitsMargin = availW - 2 * BOARD.margin >= 9 * BOARD.minCell + 14;
  const margin = fitsMargin ? BOARD.margin : Math.max(BOARD.minMargin, (availW - 9 * BOARD.minCell - 14) / 2);
  let boardSize: number;
  let keySize: { width: number; height: number };
  if (!landscape) {
    const bottom = Math.max(availH * 0.34, 230);
    boardSize = snapBoardSize(Math.min(availW - 2 * margin, availH - HEADER - bottom - SPACE.sm, 720));
    const padW = Math.min(availW - 2 * margin, 720);
    keySize = { width: Math.floor((padW - 8 * 4) / 9), height: Math.round(Math.min(76, Math.max(52, bottom * 0.3))) };
  } else {
    boardSize = snapBoardSize(Math.min(availH - HEADER - SPACE.lg, availW * 0.56));
    const side = availW - boardSize - SPACE.xl * 3;
    const k = Math.floor(Math.min((side - 16) / 3, (availH - HEADER - 110) / 3, 92));
    keySize = { width: k, height: Math.round(k * 0.8) };
  }

  const remaining = remainingCounts(game);
  const selectedValue = selected != null ? game.values[selected] : 0;
  const highlightDigit = settings.inputMode === 'number' && activeDigit ? activeDigit : settings.highlightSame ? selectedValue : 0;
  const cells: BoardCell[] = game.values.map((value, i) => ({
    value,
    given: isGiven(game, i),
    notes: game.notes[i],
    wrong: isWrong(game, i),
  }));
  const color = difficultyColor(game.level, p);
  const progress = progressPercent(game);
  const title = game.daily ? t('game.daily', { date: shortDate(game.daily) }) : levelName(t, game.level);

  const board = (
    <View>
      <Board
        size={boardSize}
        cells={cells}
        selected={end ? null : selected}
        highlightDigit={end ? 0 : highlightDigit}
        highlightUnits={settings.highlightUnits && !end}
        showErrors={settings.mistakeCheck}
        hintCells={hint?.cells ?? NO_CELLS}
        hintTarget={hint?.target ?? null}
        ripple={ripple}
        palette={p}
        t={t}
        onCellPress={onCellPress}
      />
    </View>
  );

  const tools = (
    <GameTools
      palette={p}
      t={t}
      canUndo={canUndo(game) && playing}
      notesMode={notesMode}
      hint={hintState}
      onUndo={onUndo}
      onErase={onErase}
      onNotes={() => setNotesMode((n) => !n)}
      onHint={onHint}
    />
  );
  const pad = (
    <NumberPad
      remaining={remaining}
      active={settings.inputMode === 'number' ? activeDigit : 0}
      onDigit={onDigit}
      layout={landscape ? 'grid' : 'row'}
      keySize={keySize}
      palette={p}
      t={t}
      notesMode={notesMode}
    />
  );
  const overlayCard = hint ? (
    <HintCard title={hint.text.title} body={hint.text.body} dismissLabel={t('game.dismiss')} onDismiss={() => setHint(null)} palette={p} />
  ) : message ? (
    <HintCard title={t('game.hint')} body={message} dismissLabel={t('common.ok')} onDismiss={() => setMessage(null)} palette={p} />
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: p.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.topBar}>
        <TopIcon
          icon="chevron-back"
          label={t('game.back')}
          color={p.topIcon}
          target={iconTarget}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View style={styles.levelTag}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <AppText variant="bodyMedium" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
        </View>
        <TopIcon icon="refresh-outline" label={t('game.restart')} color={p.topIcon} target={iconTarget} onPress={() => ask('restart')} disabled={!!end || leaving} />
        <TopIcon icon="musical-note-outline" label={t('game.music')} color={p.topIcon} target={iconTarget} toggle off={!settings.music} onPress={toggleMusic} />
        <TopIcon icon="settings-outline" label={t('game.settings')} color={p.topIcon} target={iconTarget} onPress={openSettings} disabled={leaving} />
      </View>
      <View style={[styles.statBar, { paddingLeft: margin, paddingRight: Math.max(0, margin - 10) }]}>
        {settings.mistakeCheck ? (
          <AppText variant="label" color={game.mistakes > 0 ? p.errorText : p.textMuted}>
            {t('game.mistakes', { n: game.mistakes, max: MISTAKE_LIMIT })}
          </AppText>
        ) : null}
        <View style={styles.flex} />
        {settings.showTimer ? (
          <AppText variant="bodyMedium" style={styles.timer} accessibilityLabel={formatTime(game.elapsedMs)}>
            {formatTime(game.elapsedMs)}
          </AppText>
        ) : null}
        <TopIcon
          icon={paused ? 'play-outline' : 'pause-outline'}
          label={paused ? t('game.resume') : t('game.pause')}
          color={p.topIcon}
          target={TOP_BAR.minTarget}
          onPress={() => setPaused((x) => !x)}
          disabled={!!end}
        />
      </View>
      <View style={{ paddingHorizontal: margin }}>
        <ProgressBar percent={progress} palette={p} t={t} />
      </View>

      {landscape ? (
        <View style={styles.landscape}>
          {board}
          <View style={[styles.side, { width: Math.max(keySize.width * 3 + 16, 260) }]}>
            {tools}
            {pad}
            {overlayCard ? <View style={styles.sideCard}>{overlayCard}</View> : null}
          </View>
        </View>
      ) : (
        <View style={styles.portrait}>
          <View style={styles.boardArea}>{board}</View>
          <View style={[styles.bottom, { paddingHorizontal: margin }]}>
            {tools}
            {pad}
            {overlayCard ? <View style={[styles.bottomCard, { left: margin, right: margin }]}>{overlayCard}</View> : null}
          </View>
        </View>
      )}

      {end?.kind === 'won' ? <WinSheet newBest={end.newBest} game={game} busy={leaving} onLeave={leave} width={width} height={height} /> : null}

      {end?.kind === 'lost' && !confirm ? (
        <Popup
          title={t('lose.title')}
          body={canSecondChance(game) ? t('lose.body') : t('lose.bodyUsed')}
          icon="heart-dislike-outline"
          iconColor={p.errorText}>
          {outOfMistakesActions(game).map((action) =>
            action === 'secondChance' ? (
              <PopupButton
                key={action}
                kind="filled"
                label={t('lose.secondChance')}
                ad
                disabled={!ads.offers.second_chance || leaving}
                detail={ads.offers.second_chance ? t('lose.secondChanceDetail') : t('lose.noAd')}
                onPress={onSecondChance}
              />
            ) : action === 'restart' ? (
              <PopupButton key={action} label={t('game.restart')} disabled={leaving} onPress={() => ask('restart')} />
            ) : action === 'new' ? (
              <PopupButton key={action} label={t('lose.newGame')} busy={leaving} onPress={() => leave('next')} />
            ) : (
              <PopupButton key={action} kind="text" label={t('common.close')} disabled={leaving} onPress={() => leave(game.daily ? 'daily' : 'home')} />
            ),
          )}
        </Popup>
      ) : null}

      {paused && !end && !confirm ? (
        <Popup title={t('game.paused')} subtitle={`${formatTime(game.elapsedMs)} · ${title}`}>
          {pauseActions(game).map((action) =>
            action === 'resume' ? (
              <PopupButton key={action} kind="filled" label={t('game.resume')} disabled={leaving} onPress={() => setPaused(false)} />
            ) : action === 'restart' ? (
              <PopupButton key={action} label={t('game.restart')} disabled={leaving} onPress={() => ask('restart')} />
            ) : (
              <PopupButton key={action} label={t('game.newGame')} busy={leaving} onPress={() => ask('pauseNew')} />
            ),
          )}
        </Popup>
      ) : null}

      {confirm ? (
        <Popup
          title={confirm === 'restart' ? t('confirm.restartTitle') : t('confirm.newTitle')}
          body={confirm === 'restart' ? t('confirm.restartBody') : t('confirm.newBody')}>
          <PopupButton
            kind="filled"
            label={confirm === 'restart' ? t('confirm.restart') : t('confirm.new')}
            busy={leaving}
            onPress={() => (confirm === 'restart' ? doRestart() : void doPauseNew())}
          />
          <PopupButton label={t('common.cancel')} disabled={leaving} onPress={() => setConfirm(null)} />
        </Popup>
      ) : null}

      {toast ? <Toast key={toast.id} text={toast.text} palette={p} top={insets.top + TOP_BAR.height + 6} /> : null}
    </View>
  );
}

function WinSheet({
  newBest,
  game,
  busy,
  onLeave,
  width,
  height,
}: {
  newBest: boolean;
  game: GameState;
  busy: boolean;
  onLeave: (target: 'home' | 'next' | 'daily') => void;
  width: number;
  height: number;
}) {
  const { t } = useSettings();
  const p = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop, { backgroundColor: p.overlay }]} accessibilityViewIsModal>
      <Confetti width={width} height={height} seed={game.startedAt % 997} />
      <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Ionicons name="sparkles" size={36} color={difficultyColor(game.level, p)} />
        <AppText variant="title" accessibilityRole="header">
          {game.daily ? t('win.dailyTitle') : t('win.title')}
        </AppText>
        {newBest ? (
          <AppText variant="bodyMedium" color={p.accent}>
            {t('win.best')}
          </AppText>
        ) : null}
        <View style={styles.statsRow}>
          <Stat label={t('win.time')} value={formatTime(game.elapsedMs)} />
          <Stat label={t('win.mistakes')} value={String(game.mistakes)} />
          <Stat label={t('win.hints')} value={String(hintsUsed(game))} />
        </View>
        {game.daily ? (
          <Button label={t('daily.title')} icon="calendar-outline" busy={busy} onPress={() => onLeave('daily')} style={styles.full} />
        ) : (
          <Button label={t('win.next', { level: levelName(t, game.level) })} icon="refresh" busy={busy} onPress={() => onLeave('next')} style={styles.full} />
        )}
        <Button label={t('win.home')} kind="secondary" disabled={busy} onPress={() => onLeave('home')} style={styles.full} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.stat}>
      <AppText variant="title" style={styles.tabular}>
        {value}
      </AppText>
      <AppText variant="meta" color={p.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { height: TOP_BAR.height, flexDirection: 'row', alignItems: 'center', gap: TOP_BAR.gap, paddingHorizontal: 4 },
  title: { flexShrink: 1 },
  statBar: { height: STATS_ROW, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  levelTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minWidth: 0, paddingLeft: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timer: { fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
  portrait: { flex: 1 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexBasis: '40%', flexShrink: 0, justifyContent: 'space-evenly', paddingBottom: SPACE.sm },
  bottomCard: { position: 'absolute', bottom: SPACE.sm },
  landscape: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xl, paddingHorizontal: SPACE.xl },
  side: { gap: SPACE.lg, justifyContent: 'center' },
  sideCard: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheetBackdrop: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
  sheet: { width: '100%', maxWidth: 420, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.xl, alignItems: 'center', gap: SPACE.md },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around', marginVertical: SPACE.sm },
  stat: { alignItems: 'center', gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  full: { alignSelf: 'stretch' },
});
