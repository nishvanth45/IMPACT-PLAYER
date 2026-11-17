import type {
  BattingAggressionMode,
  BowlerType,
  BowlingPlanId,
  CaptaincyDifficulty,
  ImpactSubstitution,
  OverSummaryLine,
  PitchCondition,
  PlayerForm,
  PlayerSeasonRecord,
  SeasonTeam,
} from '../types/game';
import {
  type EngineBatterState,
  type EngineBowlerState,
  type EngineTeam,
  type InningsEngineState,
  type InningsOutput,
  applyImpactPlayerToInnings,
  ballsToCricketOvers,
  computeBatterMatchup,
  createInningsEngineState,
  finalizeInningsOutput,
  getBatterSettlingModifiers,
  getBowlerSelectionOptions,
  getCollapseStabilizationRating,
  getPhaseBattingRating,
  getPhaseBowlingRating,
  inferBowlerClassification,
  isBowlerEligible,
  resolveSituationalPlayerRatings,
  selectBowler,
  selectBowlingPlan,
  simulateInningsOver,
} from './cricketMatchEngine';
import { getEffectiveMatchRatings } from './ratingEngine';

export {
  applyImpactPlayerToInnings,
  ballsToCricketOvers,
  computeBatterMatchup,
  finalizeInningsOutput,
  getBatterSettlingModifiers,
  getBowlerSelectionOptions,
  getCollapseStabilizationRating,
  getPhaseBattingRating,
  getPhaseBowlingRating,
  inferBowlerClassification,
  isBowlerEligible,
  resolveSituationalPlayerRatings,
};

export type ActiveBatterState = EngineBatterState;
export type InteractiveBowlerTracker = EngineBowlerState;
export type InteractiveInningsState = InningsEngineState;
export type SimulatedInningsOutput = InningsOutput;

/**
 * Pure heuristic batting-order sorter (used equally if a team needs auto-ordering;
 * never branches on user vs AI inside match simulation).
 */
export function orderTeamBattingLineup(
  players: PlayerSeasonRecord[]
): PlayerSeasonRecord[] {
  const top = players
    .filter((p) => p.role === 'BAT' || p.role === 'WK')
    .sort((a, b) => b.battingRating - a.battingRating);
  const ar = players
    .filter((p) => p.role === 'AR')
    .sort((a, b) => b.battingRating - a.battingRating);
  const tail = players
    .filter((p) => p.role !== 'BAT' && p.role !== 'WK' && p.role !== 'AR')
    .sort((a, b) => b.battingRating - a.battingRating);
  return [...top.slice(0, 5), ...ar, ...top.slice(5), ...tail];
}

export function selectTeamBowlingPlan(
  players: PlayerSeasonRecord[],
  playerForms: Record<string, PlayerForm>
): Array<{ player: PlayerSeasonRecord; type: BowlerType }> {
  const ranked = [...players].sort((a, b) => {
    const aRoleBonus = a.role === 'BOWL' ? 20 : a.role === 'AR' ? 10 : 0;
    const bRoleBonus = b.role === 'BOWL' ? 20 : b.role === 'AR' ? 10 : 0;
    const aEff = getEffectiveMatchRatings(
      a,
      playerForms[a.playerId] ?? a.form
    ).bowlingRating;
    const bEff = getEffectiveMatchRatings(
      b,
      playerForms[b.playerId] ?? b.form
    ).bowlingRating;
    return bEff + bRoleBonus - (aEff + aRoleBonus);
  });
  return ranked.slice(0, Math.min(6, ranked.length)).map((p) => ({
    player: p,
    type: inferBowlerClassification(p),
  }));
}

export interface BallByBallInningsParams {
  battingTeam: SeasonTeam | EngineTeam;
  bowlingTeam: SeasonTeam | EngineTeam;
  target?: number;
  pitchCondition: PitchCondition;
  playerForms: Record<string, PlayerForm>;
  homeEdgeTeamId?: SeasonTeam['id'];
  impactSub?: ImpactSubstitution;
  teamDaySwing?: number;
  difficulty?: CaptaincyDifficulty;
  injuredPlayerIds?: string[];
  rng: () => number;
}

export function createInitialInningsState(
  params: BallByBallInningsParams
): InteractiveInningsState {
  const subForBatting =
    params.impactSub && params.impactSub.teamId === params.battingTeam.id
      ? params.impactSub
      : undefined;
  const subForBowling =
    params.impactSub && params.impactSub.teamId === params.bowlingTeam.id
      ? params.impactSub
      : undefined;

  return createInningsEngineState({
    battingTeam: params.battingTeam,
    bowlingTeam: params.bowlingTeam,
    target: params.target,
    pitchCondition: params.pitchCondition,
    playerForms: params.playerForms,
    injuredPlayerIds: params.injuredPlayerIds,
    difficulty: params.difficulty,
    subForBatting,
    subForBowling,
    teamDaySwing: params.teamDaySwing,
    rng: params.rng,
  });
}

export function pickSmartTacticalPlan(
  state: InteractiveInningsState,
  bowler: InteractiveBowlerTracker,
  rng: () => number,
  difficulty: CaptaincyDifficulty = state.difficulty
): BowlingPlanId {
  return selectBowlingPlan(state, bowler, rng, difficulty);
}

export function pickAutoBowler(
  state: InteractiveInningsState,
  rng: () => number,
  difficulty: CaptaincyDifficulty = state.difficulty
): { bowlerId: string; planId: BowlingPlanId } {
  return selectBowler(state, rng, difficulty);
}

export function simulateSingleOver(
  prevState: InteractiveInningsState,
  options: {
    bowlerId: string;
    planId?: BowlingPlanId;
    aggressionMode?: BattingAggressionMode;
    rng: () => number;
  }
): { nextState: InteractiveInningsState; overSummary: OverSummaryLine | null } {
  const { nextState, overSummary } = simulateInningsOver(prevState, options);
  return { nextState, overSummary };
}

export function simulateT20InningsBallByBall(
  params: BallByBallInningsParams
): SimulatedInningsOutput {
  let state = createInitialInningsState(params);
  while (!state.isCompleted && state.completedOvers < 20) {
    const { bowlerId, planId } = selectBowler(state, params.rng, state.difficulty);
    const step = simulateInningsOver(state, { bowlerId, planId, rng: params.rng });
    state = step.nextState;
  }
  return finalizeInningsOutput(state);
}
