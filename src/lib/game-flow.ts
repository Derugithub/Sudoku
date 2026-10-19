/**
 * What the game screen's popups offer and which actions may lead to an ad (pure, tested).
 *
 * Ad rules this encodes:
 * - The pause popup never contains an ad, and no interstitial shows while the game is paused.
 *   "New game" from the pause popup abandons the puzzle; it is not a finished puzzle.
 * - Restart is never a finished puzzle: it does not count toward or trigger an interstitial.
 * - Out of mistakes: "Another chance" (rewarded, labelled as an ad) at most once per game. Once
 *   used, only Restart, New puzzle and Close remain. Restart cannot refill it (see game.restart).
 * - An interstitial may only be considered when a finished puzzle (won or lost) is left.
 */
import { canSecondChance, hasProgress, type GameState } from '@/sudoku/game';

export type PauseAction = 'resume' | 'restart' | 'new';
export type OutOfMistakesAction = 'secondChance' | 'restart' | 'new' | 'close';

/** Everything the game screen can do that ends, resets or replaces the puzzle. */
export type FlowAction =
  | 'restart' // same puzzle from its givens (top bar, pause popup or out-of-mistakes popup)
  | 'pauseNew' // new puzzle at the same level from the pause popup (abandons this one)
  | 'finishedNext' // next puzzle after a win or a loss
  | 'finishedLeave'; // leave a won or lost puzzle (home, daily calendar, close)

export function pauseActions(game: GameState): PauseAction[] {
  // A Daily Challenge has one puzzle per day, so there is no "new game" for it here.
  return game.daily ? ['resume', 'restart'] : ['resume', 'restart', 'new'];
}

export function outOfMistakesActions(game: GameState): OutOfMistakesAction[] {
  const actions: OutOfMistakesAction[] = [];
  if (canSecondChance(game)) actions.push('secondChance');
  actions.push('restart');
  if (!game.daily) actions.push('new');
  actions.push('close');
  return actions;
}

/** Restarting or replacing a puzzle with entries, notes or mistakes asks first. */
export function needsConfirmation(action: 'restart' | 'pauseNew', game: GameState): boolean {
  void action;
  return hasProgress(game);
}

/** Whether the action ends a puzzle that counts as finished (stats result, interstitial pacing). */
export function countsAsFinished(action: FlowAction): boolean {
  return action === 'finishedNext' || action === 'finishedLeave';
}

/** The only moments an interstitial may even be considered (the caps in ad-policy still apply). */
export function mayConsiderInterstitial(action: FlowAction, context: { paused: boolean; status: GameState['status'] }): boolean {
  if (context.paused) return false;
  if (context.status === 'playing') return false;
  return countsAsFinished(action);
}
