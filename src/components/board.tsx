import { memo, useEffect, useRef } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import type { Translate } from '@/i18n';
import { bit, cellLabel, digitsOf } from '@/sudoku/grid';
import { BOARD, MOTION, type Palette } from '@/theme/tokens';

/** A press that moved further than this (px) was a drag or scroll, not a tap. */
const TAP_DEADZONE = 12;

export type BoardCell = {
  value: number;
  given: boolean;
  notes: number;
  wrong: boolean;
};

export type BoardProps = {
  size: number;
  cells: BoardCell[];
  selected: number | null;
  /** Digit to highlight everywhere (same-number highlight), or 0. */
  highlightDigit: number;
  highlightUnits: boolean;
  showErrors: boolean;
  hintCells: Set<number>;
  hintTarget: number | null;
  ripple: { id: number; delays: Map<number, number> };
  palette: Palette;
  t: Translate;
  onCellPress: (cell: number) => void;
};

const SEP = (k: number) => (k % 3 === 0 ? BOARD.lineBox : BOARD.lineThin);

/** Left edge of cell i inside the border, for cell size c. */
function offset(i: number, c: number): number {
  let x = i * c;
  for (let k = 1; k <= i; k++) x += SEP(k);
  return x;
}

export function cellSizeFor(boardSize: number): number {
  const lines = 2 * BOARD.lineBox + 2 * BOARD.lineBox + 6 * BOARD.lineThin;
  return (boardSize - lines) / 9;
}

/** Board size for an available square, snapped so every cell lands on whole pixels. */
export function snapBoardSize(available: number): number {
  const lines = 4 * BOARD.lineBox + 6 * BOARD.lineThin;
  const cell = Math.floor(PixelRatio.roundToNearestPixel((available - lines) / 9));
  return cell * 9 + lines;
}

export function Board(props: BoardProps) {
  const { size, cells, selected, palette: p } = props;
  const c = cellSizeFor(size);
  const inner = size - 2 * BOARD.lineBox;
  const selRow = selected != null ? Math.floor(selected / 9) : -1;
  const selCol = selected != null ? selected % 9 : -1;
  const selBox = selected != null ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;

  return (
    <View
      style={[styles.board, { width: size, height: size, borderColor: p.lineBox, backgroundColor: p.lineThin, borderRadius: BOARD.radius }]}>
      {cells.map((cell, i) => {
        const r = Math.floor(i / 9);
        const col = i % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(col / 3);
        const isSel = i === selected;
        const inUnit = props.highlightUnits && selected != null && (r === selRow || col === selCol || b === selBox);
        const same = props.highlightDigit > 0 && cell.value === props.highlightDigit;
        const showWrong = props.showErrors && cell.wrong;
        const bg = isSel
          ? p.selected
          : showWrong
            ? p.errorBg
            : i === props.hintTarget
              ? p.hintCell
              : same
                ? p.sameNumber
                : props.hintCells.has(i)
                  ? p.hintPattern
                  : inUnit
                    ? p.unitTint
                    : p.board;
        const color = showWrong ? p.errorText : cell.given ? p.given : p.player;
        const noteHit = props.highlightDigit > 0 && (cell.notes & bit(props.highlightDigit)) !== 0 ? props.highlightDigit : 0;
        return (
          <Cell
            key={i}
            index={i}
            left={offset(col, c)}
            top={offset(r, c)}
            size={c}
            value={cell.value}
            given={cell.given}
            notes={cell.notes}
            noteHit={noteHit}
            bg={bg}
            color={color}
            noteColor={p.notes}
            noteHitColor={p.player}
            rippleColor={p.ripple}
            rippleId={props.ripple.id}
            rippleDelay={props.ripple.delays.get(i) ?? -1}
            label={cellAccessibility(props.t, i, cell)}
            selected={isSel}
            onPress={props.onCellPress}
          />
        );
      })}
      {[3, 6].map((k) => (
        <View key={`v${k}`} pointerEvents="none" style={[styles.boxLine, { left: offset(k, c) - BOARD.lineBox, top: 0, width: BOARD.lineBox, height: inner, backgroundColor: p.lineBox }]} />
      ))}
      {[3, 6].map((k) => (
        <View key={`h${k}`} pointerEvents="none" style={[styles.boxLine, { top: offset(k, c) - BOARD.lineBox, left: 0, height: BOARD.lineBox, width: inner, backgroundColor: p.lineBox }]} />
      ))}
    </View>
  );
}

function cellAccessibility(t: Translate, i: number, cell: BoardCell): string {
  const { row, col } = cellLabel(i);
  if (cell.value) {
    const base = t('game.cellValue', { row, col, value: cell.value });
    return cell.given ? `${base}, ${t('game.given')}` : base;
  }
  const base = t('game.cellEmpty', { row, col });
  return cell.notes ? `${base}, ${t('game.cellNotes', { notes: digitsOf(cell.notes).join(' ') })}` : base;
}

type CellProps = {
  index: number;
  left: number;
  top: number;
  size: number;
  value: number;
  given: boolean;
  notes: number;
  noteHit: number;
  bg: string;
  color: string;
  noteColor: string;
  noteHitColor: string;
  rippleColor: string;
  rippleId: number;
  rippleDelay: number;
  label: string;
  selected: boolean;
  onPress: (cell: number) => void;
};

const Cell = memo(function Cell(props: CellProps) {
  const { index, size, value, given, onPress } = props;
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);
  const prevValue = useRef(value);
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (value && value !== prevValue.current && !given) {
      scale.set(MOTION.placeFrom);
      scale.set(withTiming(1, { duration: MOTION.placeMs }));
    }
    prevValue.current = value;
  }, [value, given, scale]);

  useEffect(() => {
    if (props.rippleDelay < 0 || props.rippleId === 0) return;
    const half = MOTION.rippleMs / 2;
    flash.set(
      withDelay(props.rippleDelay, withSequence(withTiming(1, { duration: half }), withTiming(0, { duration: half }))),
    );
  }, [props.rippleId, props.rippleDelay, flash]);

  const digitStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.85 }));

  const onPressIn = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onRelease = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - start.current.x;
    const dy = e.nativeEvent.pageY - start.current.y;
    if (dx * dx + dy * dy <= TAP_DEADZONE * TAP_DEADZONE) onPress(index);
  };

  const digitSize = Math.round(size * BOARD.digitRatio);
  const noteSize = Math.max(8, Math.round(size * BOARD.noteRatio));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPressIn={onPressIn}
      onPress={onRelease}
      style={[styles.cell, { left: props.left, top: props.top, width: size, height: size, backgroundColor: props.bg }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: props.rippleColor }, flashStyle]} />
      {value ? (
        <Animated.View style={digitStyle}>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: given ? BOARD.givenFont : BOARD.playerFont,
              fontSize: digitSize,
              lineHeight: Math.round(digitSize * 1.2),
              color: props.color,
              fontVariant: [...BOARD.fontVariant],
              textAlign: 'center',
            }}>
            {value}
          </Text>
        </Animated.View>
      ) : props.notes ? (
        <View style={styles.notes} pointerEvents="none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <Text
              key={d}
              allowFontScaling={false}
              style={{
                width: '33.33%',
                height: '33.33%',
                textAlign: 'center',
                textAlignVertical: 'center',
                fontFamily: BOARD.noteFont,
                fontSize: noteSize,
                lineHeight: Math.round(size / 3),
                color: d === props.noteHit ? props.noteHitColor : props.noteColor,
                fontVariant: [...BOARD.fontVariant],
              }}>
              {props.notes & bit(d) ? d : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  board: { borderWidth: BOARD.lineBox, overflow: 'hidden' },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boxLine: { position: 'absolute' },
  notes: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, flexDirection: 'row', flexWrap: 'wrap', padding: 1 },
});
