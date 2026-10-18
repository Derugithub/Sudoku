import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Board, snapBoardSize, type BoardCell } from '@/components/board';
import { Confetti } from '@/components/confetti';
import { GameTools } from '@/components/game-tools';
import { HintCard } from '@/components/hint-card';
import { NumberPad } from '@/components/number-pad';
import { AppText, Button, IconButton } from '@/components/ui';
import { explainHint, levelName, type HintText } from '@/i18n/explain';
import { useAds } from '@/lib/ads/ads-context';
import { useAppData } from '@/lib/app-data';
import { feedback } from '@/lib/feedback';
import { formatTime, shortDate } from '@/lib/format';
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
  remainingCounts,
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
import { BOARD, difficultyColor, MOTION, RADIUS, SPACE } from '@/theme/tokens';

type End = { kind: 'won'; newBest: boolean } | { kind: 'lost' };
type HintView = { cells: Set<number>; target: number; text: HintText };

const TOP_BAR = 56;
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
  const { settings, t } = useSettings();
  const p = usePalette();
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
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options: PlayOptions = {
    mistakeCheck: settings.mistakeCheck,
    mistakeLimit: settings.mistakeCheck && settings.mistakeLimit,
    autoRemoveNotes: settings.autoRemoveNotes,
  };
  const fb = { sound: settings.sound, vibration: settings.vibration };
  const playing = game.status === 'playing' && !paused && !adOpen && !end;

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
    },
    [],
  );

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

  /** Leaving the end screen: the only place an interstitial may show, then maybe the review card. */
  const leave = async (target: 'home' | 'next' | 'daily') => {
    if (leaving) return;
    setLeaving(true);
    const won = game.status === 'won';
    if (!won) data.finishGame(game);
    const rewardedThisGame = game.rewardedAds > 0;
    const shown = await ads.puzzleFinished({ rewardedThisGame });
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
      setEnd(null);
      setHint(null);
      setSelected(null);
      setActiveDigit(0);
      setNotesMode(false);
      setPaused(false);
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
  const fitsMargin = availW - 2 * BOARD.margin >= 9 * BOARD.minCell + 14;
  const margin = fitsMargin ? BOARD.margin : Math.max(BOARD.minMargin, (availW - 9 * BOARD.minCell - 14) / 2);
  let boardSize: number;
  let keySize: { width: number; height: number };
  if (!landscape) {
    const bottom = Math.max(availH * 0.4, 230);
    boardSize = snapBoardSize(Math.min(availW - 2 * margin, availH - TOP_BAR - bottom - SPACE.sm, 720));
    const padW = Math.min(availW - 2 * margin, 720);
    keySize = { width: Math.floor((padW - 8 * 4) / 9), height: Math.round(Math.min(76, Math.max(52, bottom * 0.3))) };
  } else {
    boardSize = snapBoardSize(Math.min(availH - TOP_BAR - SPACE.lg, availW * 0.56));
    const side = availW - boardSize - SPACE.xl * 3;
    const k = Math.floor(Math.min((side - 16) / 3, (availH - TOP_BAR - 110) / 3, 92));
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
  const hidden = paused && !end;
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
        hidden={hidden}
        palette={p}
        t={t}
        onCellPress={onCellPress}
      />
      {hidden ? (
        <View style={[StyleSheet.absoluteFill, styles.pausedOverlay]}>
          <AppText variant="title">{t('game.paused')}</AppText>
          <Button label={t('game.resume')} icon="play" onPress={() => setPaused(false)} />
        </View>
      ) : null}
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
      <View style={[styles.topBar, { paddingHorizontal: margin - 8 }]}>
        <IconButton icon="chevron-back" label={t('game.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.levelTag}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <AppText variant="bodyMedium" numberOfLines={1}>
            {title}
          </AppText>
        </View>
        {settings.mistakeCheck ? (
          <AppText variant="label" color={game.mistakes > 0 ? p.errorText : p.textMuted} style={styles.topText}>
            {options.mistakeLimit ? t('game.mistakes', { n: game.mistakes, max: MISTAKE_LIMIT }) : t('game.mistakesCount', { n: game.mistakes })}
          </AppText>
        ) : null}
        {settings.showTimer ? (
          <AppText variant="bodyMedium" style={[styles.topText, styles.timer]} accessibilityLabel={formatTime(game.elapsedMs)}>
            {formatTime(game.elapsedMs)}
          </AppText>
        ) : null}
        <IconButton icon={paused ? 'play' : 'pause'} label={paused ? t('game.resume') : t('game.pause')} onPress={() => setPaused((x) => !x)} disabled={!!end} />
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

      {end ? (
        <EndSheet
          end={end}
          game={game}
          busy={leaving}
          canSecond={canSecondChance(game)}
          secondReady={ads.offers.second_chance}
          onSecondChance={onSecondChance}
          onLeave={leave}
          width={width}
          height={height}
        />
      ) : null}
    </View>
  );
}

function EndSheet({
  end,
  game,
  busy,
  canSecond,
  secondReady,
  onSecondChance,
  onLeave,
  width,
  height,
}: {
  end: End;
  game: GameState;
  busy: boolean;
  canSecond: boolean;
  secondReady: boolean;
  onSecondChance: () => void;
  onLeave: (target: 'home' | 'next' | 'daily') => void;
  width: number;
  height: number;
}) {
  const { t } = useSettings();
  const p = usePalette();
  const won = end.kind === 'won';
  return (
    <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop, { backgroundColor: p.overlay }]} accessibilityViewIsModal>
      {won ? <Confetti width={width} height={height} seed={game.startedAt % 997} /> : null}
      <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Ionicons name={won ? 'sparkles' : 'heart-dislike-outline'} size={36} color={won ? difficultyColor(game.level, p) : p.errorText} />
        <AppText variant="title" accessibilityRole="header">
          {won ? (game.daily ? t('win.dailyTitle') : t('win.title')) : t('lose.title')}
        </AppText>
        {won ? (
          <>
            {end.newBest ? (
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
              <Button
                label={t('win.next', { level: levelName(t, game.level) })}
                icon="refresh"
                busy={busy}
                onPress={() => onLeave('next')}
                style={styles.full}
              />
            )}
            <Button label={t('win.home')} kind="secondary" disabled={busy} onPress={() => onLeave('home')} style={styles.full} />
          </>
        ) : (
          <>
            <AppText variant="body" color={p.textMuted} style={styles.center}>
              {canSecond ? t('lose.body') : ''}
            </AppText>
            {canSecond ? (
              <Button
                label={t('lose.secondChance')}
                icon="play-circle-outline"
                disabled={!secondReady || busy}
                detail={secondReady ? undefined : t('lose.noAd')}
                onPress={onSecondChance}
                style={styles.full}
              />
            ) : null}
            {game.daily ? null : (
              <Button label={t('lose.newGame')} kind="secondary" busy={busy} onPress={() => onLeave('next')} style={styles.full} />
            )}
            <Button label={t('lose.home')} kind="secondary" disabled={busy} onPress={() => onLeave(game.daily ? 'daily' : 'home')} style={styles.full} />
          </>
        )}
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
  topBar: { height: TOP_BAR, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  levelTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  topText: { marginHorizontal: SPACE.xs },
  timer: { fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
  portrait: { flex: 1 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexBasis: '40%', flexShrink: 0, justifyContent: 'space-evenly', paddingBottom: SPACE.sm },
  bottomCard: { position: 'absolute', bottom: SPACE.sm },
  landscape: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xl, paddingHorizontal: SPACE.xl },
  side: { gap: SPACE.lg, justifyContent: 'center' },
  sideCard: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  pausedOverlay: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg },
  sheetBackdrop: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
  sheet: { width: '100%', maxWidth: 420, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.xl, alignItems: 'center', gap: SPACE.md },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around', marginVertical: SPACE.sm },
  stat: { alignItems: 'center', gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  full: { alignSelf: 'stretch' },
  center: { textAlign: 'center' },
});
