import type {
  BatterScorecardLine,
  BattingAggressionMode,
  BowlerDisabledReason,
  BowlerEligibilityOption,
  BowlerScorecardLine,
  BowlerType,
  BowlingPlanId,
  CaptaincyDifficulty,
  DeliveryEvent,
  DismissalType,
  ExtrasBreakdown,
  FallOfWicketLine,
  ImpactSubstitution,
  InningsPhase,
  InningsScorecard,
  InningsSummary,
  MatchHighlightEvent,
  MatchResult,
  MatchupRating,
  OverSummaryLine,
  PartnershipLine,
  PhaseSplit,
  PitchCondition,
  PlayerForm,
  PlayerSeasonRecord,
  SeasonTeam,
  SeasonTeamId,
  SuperOverInningsSummary,
  SuperOverSummary,
  TossInfo,
} from '../types/game';
import { SIMULATION_VERSION } from '../types/game';
import { getEffectiveMatchRatings } from './ratingEngine';
import { createSeededRng } from './seededRng';
import {
  SIM_CONFIG,
  getDefaultPlanForPhase,
  getInningsPhaseForOver,
} from './simConfig';

export { SIMULATION_VERSION };

/**
 * Ownership-blind team representation inside CricketMatchEngine.
 * Intentionally omits `isUser` or any human/AI distinction.
 */
export interface EngineTeam {
  id: SeasonTeamId;
  code: string;
  name: string;
  shortName: string;
  primaryColor: string;
  homeVenue: string;
  players: PlayerSeasonRecord[];
}

export function toEngineTeam(team: SeasonTeam | EngineTeam): EngineTeam {
  return {
    id: team.id,
    code: team.code,
    name: team.name,
    shortName: team.shortName,
    primaryColor: team.primaryColor,
    homeVenue: team.homeVenue,
    players: [...team.players],
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function ballsToCricketOvers(balls: number): number {
  const safeBalls = Math.max(0, balls);
  const whole = Math.floor(safeBalls / 6);
  const rem = safeBalls % 6;
  return Number((whole + rem / 10).toFixed(1));
}

export function inferBowlerClassification(player: PlayerSeasonRecord): BowlerType {
  const style = (player.bowlingStyle || '').toLowerCase();
  if (
    style.includes('spin') ||
    style.includes('orthodox') ||
    style.includes('chinaman') ||
    style.includes('legbreak') ||
    style.includes('offbreak') ||
    style.includes('googly')
  ) {
    return 'SPIN';
  }
  if (
    style.includes('fast') ||
    style.includes('medium') ||
    style.includes('seam') ||
    style.includes('pace')
  ) {
    return 'PACE';
  }
  if (player.role === 'BOWL' || player.role === 'AR') {
    const hash = player.playerId
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return hash % 3 === 0 ? 'SPIN' : 'PACE';
  }
  return 'NONE';
}

export function isBowlerEligible(
  player: PlayerSeasonRecord,
  injuredPlayerIds: readonly string[] = []
): {
  eligible: boolean;
  isPartTimer: boolean;
  bowlerType: BowlerType;
} {
  const inferred = inferBowlerClassification(player);
  if (injuredPlayerIds.includes(player.playerId)) {
    return {
      eligible: false,
      isPartTimer: false,
      bowlerType: inferred,
    };
  }
  const hasRealStyle = Boolean(
    player.bowlingStyle &&
      player.bowlingStyle !== 'None' &&
      player.bowlingStyle.trim().length > 0
  );

  if (player.role === 'BOWL') {
    return {
      eligible: true,
      isPartTimer: false,
      bowlerType: inferred === 'NONE' ? 'PACE' : inferred,
    };
  }
  if (player.role === 'AR') {
    return {
      eligible: true,
      isPartTimer: false,
      bowlerType: inferred === 'NONE' ? 'PACE' : inferred,
    };
  }
  const partTimerEligible =
    player.bowlingRating >= 42 || (hasRealStyle && player.bowlingRating >= 34);
  if (partTimerEligible && player.role !== 'WK') {
    return {
      eligible: true,
      isPartTimer: true,
      bowlerType: inferred === 'NONE' ? 'SPIN' : inferred,
    };
  }
  if (player.role === 'WK' && hasRealStyle && player.bowlingRating >= 48) {
    return {
      eligible: true,
      isPartTimer: true,
      bowlerType: inferred === 'NONE' ? 'SPIN' : inferred,
    };
  }

  return {
    eligible: false,
    isPartTimer: false,
    bowlerType: inferred,
  };
}

export interface SituationalPlayerRatings {
  batBase: number;
  bowlBase: number;
  impBase: number;
  ovrBase: number;
  batting: {
    power: number;
    timing: number;
    technique: number;
    strikeRotation: number;
    paceHitting: number;
    spinHitting: number;
    powerplay: number;
    middleOvers: number;
    deathOvers: number;
    chase: number;
    pressure: number;
    finishing: number;
    consistency: number;
    impactAbility: number;
  };
  bowling: {
    wicketTaking: number;
    economy: number;
    powerplayBowling: number;
    middleOversBowling: number;
    deathBowling: number;
    control: number;
    variation: number;
    pressure: number;
  };
}

export function resolveSituationalPlayerRatings(
  player: PlayerSeasonRecord,
  form: PlayerForm = 'NORMAL'
): SituationalPlayerRatings {
  const eff = getEffectiveMatchRatings(
    {
      battingRating: player.battingRating,
      bowlingRating: player.bowlingRating,
      impactRating: player.impactRating ?? player.overallRating,
      overallRating: player.overallRating,
    },
    form
  );

  const rawBat = player.attributes?.batting;
  const rawBowl = player.attributes?.bowling;
  const rawOther = player.attributes?.other;
  const mod = eff.formModifier;

  const pickBat = (val: number | undefined, fallback: number): number =>
    clamp(Math.round((typeof val === 'number' && val > 0 ? val : fallback) + mod), 20, 99);
  const pickBowl = (val: number | undefined, fallback: number): number =>
    clamp(Math.round((typeof val === 'number' && val > 0 ? val : fallback) + mod), 20, 99);

  return {
    batBase: eff.battingRating,
    bowlBase: eff.bowlingRating,
    impBase: eff.impactRating,
    ovrBase: eff.overallRating,
    batting: {
      power: pickBat(rawBat?.power, eff.battingRating),
      timing: pickBat(rawBat?.timing, eff.battingRating),
      technique: pickBat(rawBat?.technique, eff.battingRating),
      strikeRotation: pickBat(rawBat?.strikeRotation, eff.battingRating),
      paceHitting: pickBat(rawBat?.paceHitting, eff.battingRating),
      spinHitting: pickBat(rawBat?.spinHitting, eff.battingRating),
      powerplay: pickBat(rawBat?.powerplay, eff.battingRating),
      middleOvers: pickBat(rawBat?.middleOvers, eff.battingRating),
      deathOvers: pickBat(rawBat?.deathOvers, eff.impactRating * 0.4 + eff.battingRating * 0.6),
      chase: pickBat(rawBat?.chase, eff.battingRating),
      pressure: pickBat(rawBat?.pressure, eff.overallRating),
      finishing: pickBat(rawBat?.finishing, eff.impactRating * 0.45 + eff.battingRating * 0.55),
      consistency: pickBat(rawOther?.consistency, eff.overallRating),
      impactAbility: pickBat(rawOther?.impactAbility, eff.impactRating),
    },
    bowling: {
      wicketTaking: pickBowl(rawBowl?.wicketTaking, eff.bowlingRating),
      economy: pickBowl(rawBowl?.economy, eff.bowlingRating),
      powerplayBowling: pickBowl(rawBowl?.powerplayBowling, eff.bowlingRating),
      middleOversBowling: pickBowl(rawBowl?.middleOversBowling, eff.bowlingRating),
      deathBowling: pickBowl(rawBowl?.deathBowling, eff.bowlingRating * 0.7 + eff.impactRating * 0.3),
      control: pickBowl(rawBowl?.control, eff.bowlingRating),
      variation: pickBowl(rawBowl?.variation, eff.bowlingRating),
      pressure: pickBowl(rawBowl?.pressure, eff.overallRating),
    },
  };
}

export function getPhaseBattingRating(
  player: PlayerSeasonRecord,
  phase: InningsPhase,
  form: PlayerForm = 'NORMAL',
  pitchCondition: PitchCondition = 'BALANCED',
  bowlerType?: BowlerType
): number {
  const r = resolveSituationalPlayerRatings(player, form);
  const w = SIM_CONFIG.ratingWeights.batting[phase];
  let base: number;
  if (phase === 'POWERPLAY') {
    base =
      r.batting.powerplay * (w.powerplay ?? 0) +
      r.batting.paceHitting * (w.paceHitting ?? 0) +
      r.batting.timing * (w.timing ?? 0) +
      r.batting.technique * (w.technique ?? 0) +
      r.batting.power * (w.power ?? 0) +
      r.batBase * (w.battingRating ?? 0);
  } else if (phase === 'MIDDLE') {
    base =
      r.batting.technique * (w.technique ?? 0) +
      r.batting.strikeRotation * (w.strikeRotation ?? 0) +
      r.batting.spinHitting * (w.spinHitting ?? 0) +
      r.batting.consistency * (w.consistency ?? 0) +
      r.batting.middleOvers * (w.middleOvers ?? 0);
  } else {
    base =
      r.batting.power * (w.power ?? 0) +
      r.batting.finishing * (w.finishing ?? 0) +
      r.batting.deathOvers * (w.deathOvers ?? 0) +
      r.batting.pressure * (w.pressure ?? 0) +
      r.batting.impactAbility * (w.impactAbility ?? 0);
  }

  const pitch = SIM_CONFIG.pitchProfiles[pitchCondition];
  if (pitch) {
    const baseline = SIM_CONFIG.baselineRating;
    if (pitch.spinHittingWeightBoost > 0) {
      const spinFocus = bowlerType === 'SPIN' ? 1.25 : 0.8;
      base += (r.batting.spinHitting - baseline) * pitch.spinHittingWeightBoost * spinFocus;
    }
    if (pitch.paceHittingWeightBoost > 0) {
      const paceFocus = bowlerType === 'PACE' ? 1.2 : 0.85;
      base += (r.batting.paceHitting - baseline) * pitch.paceHittingWeightBoost * paceFocus;
    }
    if (pitch.techniqueWeightBoost !== 0) {
      const phaseFactor = pitchCondition === 'SWINGING' && phase !== 'POWERPLAY' ? 0.35 : 1.0;
      base += (r.batting.technique - baseline) * pitch.techniqueWeightBoost * phaseFactor;
    }
    if (pitch.powerWeightBoost !== 0) {
      base += (r.batting.power - baseline) * pitch.powerWeightBoost;
    }
  }

  return base;
}

export function getPhaseBowlingRating(
  player: PlayerSeasonRecord,
  phase: InningsPhase,
  form: PlayerForm = 'NORMAL',
  pitchCondition: PitchCondition = 'BALANCED',
  bowlerType?: BowlerType
): number {
  const r = resolveSituationalPlayerRatings(player, form);
  const w = SIM_CONFIG.ratingWeights.bowling[phase];
  let base: number;
  if (phase === 'POWERPLAY') {
    base =
      r.bowling.powerplayBowling * (w.powerplayBowling ?? 0) +
      r.bowling.wicketTaking * (w.wicketTaking ?? 0) +
      r.bowling.control * (w.control ?? 0) +
      r.bowling.economy * (w.economy ?? 0) +
      r.bowlBase * (w.bowlingRating ?? 0);
  } else if (phase === 'MIDDLE') {
    base =
      r.bowling.economy * (w.economy ?? 0) +
      r.bowling.control * (w.control ?? 0) +
      r.bowling.variation * (w.variation ?? 0) +
      r.bowling.middleOversBowling * (w.middleOversBowling ?? 0) +
      r.bowling.wicketTaking * (w.wicketTaking ?? 0);
  } else {
    base =
      r.bowling.deathBowling * (w.deathBowling ?? 0) +
      r.bowling.control * (w.control ?? 0) +
      r.bowling.variation * (w.variation ?? 0) +
      r.bowling.economy * (w.economy ?? 0) +
      r.bowling.pressure * (w.pressure ?? 0);
  }

  const pitch = SIM_CONFIG.pitchProfiles[pitchCondition];
  if (pitch) {
    if (pitch.variationWeightBoost > 0) {
      base += (r.bowling.variation - SIM_CONFIG.baselineRating) * pitch.variationWeightBoost;
    }
    if (bowlerType === 'PACE') {
      base += pitch.paceRatingBonus[phase];
    } else if (bowlerType === 'SPIN') {
      base += pitch.spinRatingBonus[phase];
    }
  }

  return base;
}

export function getCollapseStabilizationRating(
  player: PlayerSeasonRecord,
  form: PlayerForm = 'NORMAL'
): number {
  const r = resolveSituationalPlayerRatings(player, form);
  const w = SIM_CONFIG.collapsePressure.stabilizationWeights;
  return (
    r.batting.technique * w.technique +
    r.batting.pressure * w.pressure +
    r.batting.consistency * w.consistency +
    r.ovrBase * w.overallRating
  );
}

export function getBatterSettlingModifiers(
  ballsFaced: number,
  player?: PlayerSeasonRecord,
  phase?: InningsPhase
): {
  scoringMultiplier: number;
  wicketMultiplier: number;
  isSettled: boolean;
} {
  const cfg = SIM_CONFIG.settling;
  const isEliteDeathFinisher =
    phase === 'DEATH' &&
    player !== undefined &&
    ((player.attributes?.batting?.deathOvers ?? player.battingRating) >= cfg.finisherThreshold ||
      (player.impactRating ?? player.overallRating) >= cfg.finisherThreshold);
  const rampBalls = isEliteDeathFinisher ? cfg.finisherRampBalls : cfg.rampBalls;

  if (ballsFaced < rampBalls) {
    const t = ballsFaced / rampBalls;
    return {
      scoringMultiplier:
        cfg.freshScoringMultiplier + t * (1 - cfg.freshScoringMultiplier),
      wicketMultiplier:
        cfg.freshWicketMultiplier - t * (cfg.freshWicketMultiplier - 1),
      isSettled: false,
    };
  }
  const extraProgress = clamp(
    (ballsFaced - rampBalls) /
      Math.max(1, cfg.settledThresholdBalls - rampBalls + 5),
    0,
    1
  );
  return {
    scoringMultiplier: 1 + extraProgress * (cfg.maxSettledScoringBonus - 1),
    wicketMultiplier: 1 - extraProgress * (1 - cfg.maxSettledWicketReduction),
    isSettled: ballsFaced >= cfg.settledThresholdBalls,
  };
}

export interface EngineBatterState {
  player: PlayerSeasonRecord;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissalText: string;
  dismissalType?: DismissalType;
  knockFactor: number;
  arrivedIndex: number;
}

export interface EngineBowlerState {
  player: PlayerSeasonRecord;
  bowlerType: BowlerType;
  eligible: boolean;
  isPartTimer: boolean;
  isSubbedOut: boolean;
  isImpactIn: boolean;
  isInjured: boolean;
  ballsBowled: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  foursConceded: number;
  sixesConceded: number;
  wides: number;
  noBalls: number;
  lastOverBowled: number;
  currentSpellOvers: number;
  spellFactor: number;
}

export interface ActiveOverBuffer {
  overNumber: number;
  bowlerId: string;
  bowlerName: string;
  bowlerType: BowlerType;
  planId: BowlingPlanId;
  runs: number;
  bowlerRuns: number;
  wickets: number;
  dots: number;
  fours: number;
  sixes: number;
  wides: number;
  noBalls: number;
  legalBalls: number;
  ballsSequence: string[];
  wicketBatterNames: string[];
  extraDeliveriesThisOver: number;
}

export interface InningsEngineState {
  battingTeam: EngineTeam;
  bowlingTeam: EngineTeam;
  target?: number;
  pitchCondition: PitchCondition;
  playerForms: Record<string, PlayerForm>;
  injuredPlayerIds: string[];
  difficulty: CaptaincyDifficulty;
  teamDaySwing: number;
  batOrder: PlayerSeasonRecord[];
  batterStates: Record<string, EngineBatterState>;
  batterOrderIds: string[];
  strikerId: string;
  nonStrikerId: string;
  nextBatterCursor: number;
  bowlers: EngineBowlerState[];
  runs: number;
  wickets: number;
  extras: number;
  extrasBreakdown: ExtrasBreakdown;
  legalBalls: number;
  completedOvers: number;
  lastBowlerId: string | null;
  lastOverBowledWasQuiet: boolean;
  freeHitActive: boolean;
  activeOver: ActiveOverBuffer | null;
  phaseTrack: Record<
    InningsPhase,
    { runs: number; wickets: number; balls: number; fours: number; sixes: number }
  >;
  fallOfWickets: FallOfWicketLine[];
  partnerships: PartnershipLine[];
  currentPartnershipRuns: number;
  currentPartnershipBalls: number;
  currentPartnershipFours: number;
  currentPartnershipSixes: number;
  currentPartnershipDots: number;
  partnershipWicketNum: number;
  recentWicketBalls: number[];
  disruptionBallsLeft: number;
  disruptionScoringMult: number;
  disruptionWicketMult: number;
  collapsePressureActive: boolean;
  collapseIntensity: number;
  ballsSinceLastWicket: number;
  collapseEvents: number;
  hadRecoveryAfterCollapse: boolean;
  nightRunMult: number;
  nightWicketMult: number;
  subForBatting?: ImpactSubstitution;
  subForBowling?: ImpactSubstitution;
  overHistory: OverSummaryLine[];
  deliveryLog: DeliveryEvent[];
  isCompleted: boolean;
}

export interface MatchEngineState {
  simulationVersion: string;
  matchId: string;
  matchSeed: string | number;
  rngState: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  teamA: EngineTeam;
  teamB: EngineTeam;
  benchA: PlayerSeasonRecord[];
  benchB: PlayerSeasonRecord[];
  pitchCondition: PitchCondition;
  toss: TossInfo;
  inningsNumber: 1 | 2;
  firstInnings: InningsEngineState;
  firstSummary: InningsSummary | null;
  firstScorecard: InningsScorecard | null;
  secondInnings: InningsEngineState | null;
  secondSummary: InningsSummary | null;
  secondScorecard: InningsScorecard | null;
  impactSubByTeam: Partial<Record<SeasonTeamId, ImpactSubstitution>>;
  impactInPlayerByTeam: Partial<Record<SeasonTeamId, PlayerSeasonRecord>>;
  injuredPlayerIds: string[];
  playerForms: Record<string, PlayerForm>;
  difficulty: CaptaincyDifficulty;
  superOverHistory: SuperOverSummary[];
  result: MatchResult | null;
}

export interface CreateMatchStateParams {
  matchId?: string;
  matchSeed: string | number;
  teamA: SeasonTeam | EngineTeam;
  teamB: SeasonTeam | EngineTeam;
  benchA?: PlayerSeasonRecord[];
  benchB?: PlayerSeasonRecord[];
  pitchCondition?: PitchCondition;
  toss?: TossInfo;
  playerForms?: Record<string, PlayerForm>;
  injuredPlayerIds?: string[];
  difficulty?: CaptaincyDifficulty;
  impactSub?: ImpactSubstitution;
  impactInPlayer?: PlayerSeasonRecord;
}

export interface InningsOutput {
  summary: InningsSummary;
  scorecard: InningsScorecard;
  collapseEvents: number;
  hadRecoveryAfterCollapse: boolean;
}

function cloneInningsState(src: InningsEngineState): InningsEngineState {
  return {
    ...src,
    battingTeam: toEngineTeam(src.battingTeam),
    bowlingTeam: toEngineTeam(src.bowlingTeam),
    injuredPlayerIds: [...src.injuredPlayerIds],
    batOrder: [...src.batOrder],
    batterStates: Object.fromEntries(
      Object.entries(src.batterStates).map(([k, v]) => [k, { ...v }])
    ),
    batterOrderIds: [...src.batterOrderIds],
    bowlers: src.bowlers.map((b) => ({ ...b })),
    extrasBreakdown: { ...src.extrasBreakdown },
    activeOver: src.activeOver
      ? {
          ...src.activeOver,
          ballsSequence: [...src.activeOver.ballsSequence],
          wicketBatterNames: [...src.activeOver.wicketBatterNames],
        }
      : null,
    phaseTrack: {
      POWERPLAY: { ...src.phaseTrack.POWERPLAY },
      MIDDLE: { ...src.phaseTrack.MIDDLE },
      DEATH: { ...src.phaseTrack.DEATH },
    },
    fallOfWickets: [...src.fallOfWickets],
    partnerships: src.partnerships.map((p) => ({ ...p })),
    recentWicketBalls: [...src.recentWicketBalls],
    overHistory: src.overHistory.map((o) => ({
      ...o,
      ballsSequence: [...o.ballsSequence],
      wicketBatterNames: [...o.wicketBatterNames],
    })),
    deliveryLog: [...src.deliveryLog],
  };
}

export function applyImpactRosterSwap(
  team: EngineTeam,
  impactSub?: ImpactSubstitution,
  inPlayer?: PlayerSeasonRecord
): EngineTeam {
  if (!impactSub || !inPlayer || impactSub.teamId !== team.id) {
    return toEngineTeam(team);
  }
  const outIdx = team.players.findIndex((p) => p.playerId === impactSub.outPlayerId);
  const filtered = team.players.filter((p) => p.playerId !== impactSub.outPlayerId);
  if (filtered.some((p) => p.playerId === inPlayer.playerId)) {
    return { ...toEngineTeam(team), players: filtered };
  }
  const isBatSub =
    inPlayer.role === 'BAT' ||
    inPlayer.role === 'WK' ||
    (inPlayer.role === 'AR' && inPlayer.battingRating >= inPlayer.bowlingRating);
  const insertIdx = isBatSub
    ? Math.min(outIdx >= 0 ? outIdx : 4, Math.min(4, filtered.length))
    : outIdx >= 0
      ? Math.min(outIdx, filtered.length)
      : filtered.length;
  return {
    ...toEngineTeam(team),
    players: [
      ...filtered.slice(0, insertIdx),
      inPlayer,
      ...filtered.slice(insertIdx),
    ],
  };
}

export function createInningsEngineState(params: {
  battingTeam: SeasonTeam | EngineTeam;
  bowlingTeam: SeasonTeam | EngineTeam;
  target?: number;
  pitchCondition: PitchCondition;
  playerForms?: Record<string, PlayerForm>;
  injuredPlayerIds?: string[];
  difficulty?: CaptaincyDifficulty;
  subForBatting?: ImpactSubstitution;
  subForBowling?: ImpactSubstitution;
  teamDaySwing?: number;
  rng: () => number;
}): InningsEngineState {
  const {
    battingTeam,
    bowlingTeam,
    target,
    pitchCondition,
    playerForms = {},
    injuredPlayerIds = [],
    difficulty = 'STANDARD',
    subForBatting,
    subForBowling,
    teamDaySwing,
    rng,
  } = params;

  const cleanBatTeam = toEngineTeam(battingTeam);
  const cleanBowlTeam = toEngineTeam(bowlingTeam);

  const injuredSet = new Set(injuredPlayerIds);
  const availableBatOrder = cleanBatTeam.players.filter(
    (p) => !injuredSet.has(p.playerId) && subForBatting?.outPlayerId !== p.playerId
  );
  const batOrder = availableBatOrder.length >= 2 ? availableBatOrder : [...cleanBatTeam.players];

  const bowlers: EngineBowlerState[] = cleanBowlTeam.players.map((p) => {
    const elig = isBowlerEligible(p, injuredPlayerIds);
    return {
      player: p,
      bowlerType: elig.bowlerType === 'NONE' && elig.eligible ? 'PACE' : elig.bowlerType,
      eligible: elig.eligible,
      isPartTimer: elig.isPartTimer,
      isSubbedOut: subForBowling?.outPlayerId === p.playerId,
      isImpactIn: subForBowling?.inPlayerId === p.playerId,
      isInjured: injuredSet.has(p.playerId),
      ballsBowled: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
      foursConceded: 0,
      sixesConceded: 0,
      wides: 0,
      noBalls: 0,
      lastOverBowled: 0,
      currentSpellOvers: 0,
      spellFactor: 1 + (rng() - rng()) * SIM_CONFIG.variance.bowlerSpellSpread,
    };
  });

  // Safety guarantee: ensure at least 5 bowling options (20 overs) on custom rosters
  const eligibleCapacityOvers =
    bowlers.filter((b) => b.eligible && !b.isSubbedOut && !b.isInjured).length * 4;
  if (eligibleCapacityOvers < 20) {
    const candidates = bowlers
      .filter((b) => !b.eligible && !b.isSubbedOut && !b.isInjured)
      .sort((a, b) => {
        const aWkPen = a.player.role === 'WK' ? -30 : 0;
        const bWkPen = b.player.role === 'WK' ? -30 : 0;
        return b.player.bowlingRating + bWkPen - (a.player.bowlingRating + aWkPen);
      });
    let cap = eligibleCapacityOvers;
    for (const c of candidates) {
      if (cap >= 20) break;
      c.eligible = true;
      c.isPartTimer = true;
      c.bowlerType = c.bowlerType === 'NONE' ? 'SPIN' : c.bowlerType;
      cap += 4;
    }
  }

  const nightRoll = rng();
  const isSwingNight = nightRoll < SIM_CONFIG.variance.seamerSwingNightChance;
  const isFlatNight =
    !isSwingNight && nightRoll > 1 - SIM_CONFIG.variance.flatRoadNightChance;
  const nightRunMult = isFlatNight ? 1.06 : isSwingNight ? 0.94 : 1.0;
  const nightWicketMult = isFlatNight ? 0.93 : isSwingNight ? 1.12 : 1.0;

  const computedDaySwing =
    teamDaySwing !== undefined
      ? teamDaySwing
      : (rng() - rng()) * SIM_CONFIG.variance.teamDaySpread;

  const batterStates: Record<string, EngineBatterState> = {};
  const batterOrderIds: string[] = [];

  const registerOpener = (player: PlayerSeasonRecord, arrivedIndex: number) => {
    if (!batterStates[player.playerId]) {
      batterStates[player.playerId] = {
        player,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalText: 'not out',
        knockFactor: 1 + (rng() - rng()) * SIM_CONFIG.variance.batterKnockSpread,
        arrivedIndex,
      };
      batterOrderIds.push(player.playerId);
    }
  };

  const opener1 = batOrder[0];
  const opener2 = batOrder[Math.min(1, batOrder.length - 1)];
  registerOpener(opener1, 0);
  registerOpener(opener2, 1);

  return {
    battingTeam: cleanBatTeam,
    bowlingTeam: cleanBowlTeam,
    target,
    pitchCondition,
    playerForms: { ...playerForms },
    injuredPlayerIds: [...injuredPlayerIds],
    difficulty,
    teamDaySwing: computedDaySwing,
    batOrder,
    batterStates,
    batterOrderIds,
    strikerId: opener1.playerId,
    nonStrikerId: opener2.playerId,
    nextBatterCursor: Math.min(2, batOrder.length),
    bowlers,
    runs: 0,
    wickets: 0,
    extras: 0,
    extrasBreakdown: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    legalBalls: 0,
    completedOvers: 0,
    lastBowlerId: null,
    lastOverBowledWasQuiet: false,
    freeHitActive: false,
    activeOver: null,
    phaseTrack: {
      POWERPLAY: { runs: 0, wickets: 0, balls: 0, fours: 0, sixes: 0 },
      MIDDLE: { runs: 0, wickets: 0, balls: 0, fours: 0, sixes: 0 },
      DEATH: { runs: 0, wickets: 0, balls: 0, fours: 0, sixes: 0 },
    },
    fallOfWickets: [],
    partnerships: [],
    currentPartnershipRuns: 0,
    currentPartnershipBalls: 0,
    currentPartnershipFours: 0,
    currentPartnershipSixes: 0,
    currentPartnershipDots: 0,
    partnershipWicketNum: 1,
    recentWicketBalls: [],
    disruptionBallsLeft: 0,
    disruptionScoringMult: 1,
    disruptionWicketMult: 1,
    collapsePressureActive: false,
    collapseIntensity: 1,
    ballsSinceLastWicket: 0,
    collapseEvents: 0,
    hadRecoveryAfterCollapse: false,
    nightRunMult,
    nightWicketMult,
    subForBatting,
    subForBowling,
    overHistory: [],
    deliveryLog: [],
    isCompleted: false,
  };
}

export function computeBatterMatchup(
  bowler: Pick<EngineBowlerState, 'player' | 'bowlerType'>,
  striker: PlayerSeasonRecord | undefined,
  nonStriker: PlayerSeasonRecord | undefined,
  pitchCondition: PitchCondition,
  phase: InningsPhase,
  playerForms: Record<string, PlayerForm>
): { matchup: MatchupRating; scoreDelta: number; summary: string } {
  const bForm = playerForms[bowler.player.playerId] ?? bowler.player.form ?? 'NORMAL';
  const bowlRating = getPhaseBowlingRating(
    bowler.player,
    phase,
    bForm,
    pitchCondition,
    bowler.bowlerType
  );

  const activeBatters = [striker, nonStriker].filter((p): p is PlayerSeasonRecord => Boolean(p));
  if (activeBatters.length === 0) {
    return { matchup: 'EVEN_MATCHUP', scoreDelta: 0, summary: 'Balanced contest' };
  }

  let batComposite = 0;
  for (const bat of activeBatters) {
    const batForm = playerForms[bat.playerId] ?? bat.form ?? 'NORMAL';
    const r = resolveSituationalPlayerRatings(bat, batForm);
    const vsStyle =
      bowler.bowlerType === 'SPIN' ? r.batting.spinHitting : r.batting.paceHitting;
    const phaseBat = getPhaseBattingRating(bat, phase, batForm, pitchCondition, bowler.bowlerType);
    batComposite += vsStyle * 0.45 + phaseBat * 0.55;
  }
  batComposite /= activeBatters.length;

  // Handedness matchups: off-spin / left-arm wrist spin into left-handers, leg-spin / SLAO into right-handers, left-arm pace angle vs right-handers
  let handEdge = 0;
  if (striker) {
    const batLeft = /left/i.test(striker.battingStyle || '');
    const style = bowler.player.bowlingStyle || '';
    if (bowler.bowlerType === 'SPIN') {
      const offSpin = /offbreak/i.test(style);
      const slaOrthodox = /orthodox/i.test(style);
      const legSpin = /legbreak|googly/i.test(style);
      if (batLeft && offSpin) handEdge += 3.5;
      if (!batLeft && (slaOrthodox || legSpin)) handEdge += 2.5;
      if (batLeft && slaOrthodox) handEdge -= 2.0;
    } else if (bowler.bowlerType === 'PACE') {
      const leftArmPace = /left-arm/i.test(style);
      if (leftArmPace && !batLeft && phase === 'POWERPLAY') handEdge += 1.8;
    }
  }

  const delta = bowlRating + handEdge - batComposite;
  if (delta >= 4.5) {
    return {
      matchup: 'STRONG_MATCHUP',
      scoreDelta: Number(delta.toFixed(1)),
      summary:
        bowler.bowlerType === 'SPIN'
          ? 'Spin edge vs current crease pair'
          : 'Pace & control advantage',
    };
  }
  if (delta <= -4.5) {
    return {
      matchup: 'RISKY_MATCHUP',
      scoreDelta: Number(delta.toFixed(1)),
      summary:
        bowler.bowlerType === 'SPIN'
          ? 'Strong spin hitters at the crease'
          : 'Batters favor pace in this matchup',
    };
  }
  return {
    matchup: 'EVEN_MATCHUP',
    scoreDelta: Number(delta.toFixed(1)),
    summary: 'Even skill matchup',
  };
}

function getSuitabilityTier(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 78) return 'HIGH';
  if (score >= 66) return 'MEDIUM';
  return 'LOW';
}

export function getBowlerSelectionOptions(
  state: InningsEngineState,
  targetOverNumber?: number
): BowlerEligibilityOption[] {
  const nextOver = targetOverNumber ?? state.completedOvers + 1;
  const phase = getInningsPhaseForOver(Math.min(20, Math.max(1, nextOver)));
  const phaseCfg = SIM_CONFIG.phases[phase];
  const pitchCfg = SIM_CONFIG.pitchProfiles[state.pitchCondition];
  const striker = state.batterStates[state.strikerId]?.player;
  const nonStriker = state.batterStates[state.nonStrikerId]?.player;
  const oversLeftInInnings = Math.max(0, 20 - state.completedOvers);

  const deathSpecialistIds = new Set(
    [...state.bowlers]
      .filter((b) => b.eligible && !b.isSubbedOut && !b.isInjured && b.ballsBowled < 24)
      .sort((a, b) => {
        const aD = getPhaseBowlingRating(
          a.player,
          'DEATH',
          state.playerForms[a.player.playerId] ?? a.player.form,
          state.pitchCondition,
          a.bowlerType
        );
        const bD = getPhaseBowlingRating(
          b.player,
          'DEATH',
          state.playerForms[b.player.playerId] ?? b.player.form,
          state.pitchCondition,
          b.bowlerType
        );
        return bD - aD;
      })
      .slice(0, 2)
      .map((b) => b.player.playerId)
  );

  const rawOptions: BowlerEligibilityOption[] = state.bowlers.map((b) => {
    const oversBowled = b.ballsBowled === 24 ? 4 : ballsToCricketOvers(b.ballsBowled);
    const oversRemaining = Math.max(0, 4 - Math.floor(b.ballsBowled / 6));
    const decOv = b.ballsBowled / 6;
    const economy = decOv > 0 ? Number((b.runsConceded / decOv).toFixed(2)) : 0;

    let disabledReason: BowlerDisabledReason | undefined;
    if (state.isCompleted || oversLeftInInnings <= 0) {
      disabledReason = 'INNINGS COMPLETE';
    } else if (b.isSubbedOut) {
      disabledReason = 'SUBSTITUTED OUT';
    } else if (b.isInjured || !b.eligible) {
      disabledReason = 'NOT ELIGIBLE TO BOWL';
    } else if (b.ballsBowled >= 24) {
      disabledReason = 'MAXIMUM 4 OVERS COMPLETE';
    } else if (state.lastBowlerId === b.player.playerId) {
      disabledReason = 'BOWLED PREVIOUS OVER';
    }

    const canBowlNow = !disabledReason;
    const bForm = state.playerForms[b.player.playerId] ?? b.player.form ?? 'NORMAL';
    const phaseBowl = getPhaseBowlingRating(
      b.player,
      phase,
      bForm,
      state.pitchCondition,
      b.bowlerType
    );
    const matchupInfo = computeBatterMatchup(
      b,
      striker,
      nonStriker,
      state.pitchCondition,
      phase,
      state.playerForms
    );

    const pitchSuitability: 'HIGH' | 'MEDIUM' | 'LOW' =
      pitchCfg.idealAttack === b.bowlerType
        ? 'HIGH'
        : pitchCfg.idealAttack === 'BALANCED'
          ? b.eligible
            ? 'MEDIUM'
            : 'LOW'
          : b.bowlerType === 'NONE'
            ? 'LOW'
            : 'MEDIUM';

    const phaseTypeWeight =
      b.bowlerType === 'SPIN' ? phaseCfg.spinBowlerWeight : phaseCfg.paceBowlerWeight;
    const pitchTypeBonus = pitchCfg.idealAttack === b.bowlerType ? 5.5 : 0;
    const formWicketBoost =
      b.wickets * 2.2 - (economy > 10.5 && b.ballsBowled >= 12 ? 3.5 : 0);
    const impactBonus =
      ((b.player.impactRating ?? b.player.overallRating) - SIM_CONFIG.baselineRating) * 0.14;
    const partTimerPenalty = b.isPartTimer ? -14 : 0;

    const nextSpellLen =
      b.lastOverBowled > 0 && nextOver - b.lastOverBowled === 2
        ? b.currentSpellOvers + 1
        : 1;
    const fatiguePenalty = nextSpellLen >= 3 ? -3.5 : 0;
    const preserveDeathBonus =
      phase !== 'DEATH' && deathSpecialistIds.has(b.player.playerId) && oversRemaining <= 2
        ? phase === 'MIDDLE'
          ? -8.5
          : -3.5
        : 0;
    const deathDeployBonus =
      phase === 'DEATH' && deathSpecialistIds.has(b.player.playerId) ? 7.5 : 0;

    const autoScore = Number(
      (
        (phaseBowl + pitchTypeBonus) * phaseTypeWeight +
        matchupInfo.scoreDelta * 0.55 +
        formWicketBoost +
        impactBonus +
        partTimerPenalty +
        fatiguePenalty +
        preserveDeathBonus +
        deathDeployBonus
      ).toFixed(1)
    );

    return {
      player: b.player,
      bowlerType: b.bowlerType,
      isPartTimer: b.isPartTimer,
      eligible: b.eligible,
      canBowlNow,
      disabledReason,
      oversBowled,
      ballsBowled: b.ballsBowled,
      oversRemaining,
      maidens: b.maidens,
      runsConceded: b.runsConceded,
      wickets: b.wickets,
      economy,
      currentSpellOvers: b.currentSpellOvers,
      phaseSuitability: getSuitabilityTier(phaseBowl * phaseTypeWeight),
      pitchSuitability,
      matchup: matchupInfo.matchup,
      matchupSummary: matchupInfo.summary,
      autoScore,
      isRecommended: false,
    };
  });

  rawOptions.sort((a, b) => {
    const rank = (o: BowlerEligibilityOption) => {
      if (o.canBowlNow) return 0;
      if (o.disabledReason === 'BOWLED PREVIOUS OVER') return 1;
      if (o.disabledReason === 'MAXIMUM 4 OVERS COMPLETE') return 2;
      if (o.disabledReason === 'SUBSTITUTED OUT') return 3;
      return 4;
    };
    const rDiff = rank(a) - rank(b);
    if (rDiff !== 0) return rDiff;
    return b.autoScore - a.autoScore;
  });

  const bestAvailable = rawOptions.find((o) => o.canBowlNow);
  if (bestAvailable) {
    bestAvailable.isRecommended = true;
  }

  return rawOptions;
}

export function selectBowlingPlan(
  state: InningsEngineState,
  bowler: EngineBowlerState,
  rng: () => number,
  difficulty: CaptaincyDifficulty = state.difficulty
): BowlingPlanId {
  const nextOver = Math.min(20, state.completedOvers + 1);
  const phase = getInningsPhaseForOver(nextOver);
  const diffCfg = SIM_CONFIG.difficultyAI[difficulty];

  if (rng() > diffCfg.planSmartChance) {
    return getDefaultPlanForPhase(phase);
  }

  const r = resolveSituationalPlayerRatings(
    bowler.player,
    state.playerForms[bowler.player.playerId] ?? bowler.player.form
  );

  if (phase === 'POWERPLAY') {
    if (
      state.pitchCondition === 'SWINGING' ||
      state.pitchCondition === 'PACE_SEAMER' ||
      r.bowling.wicketTaking >= 76
    ) {
      return 'ATTACK_WICKETS';
    }
    if (state.pitchCondition === 'BATTING_PARADISE' && r.bowling.control >= 76) {
      return 'PROTECT_BOUNDARIES';
    }
    return 'BALANCED';
  }

  if (phase === 'MIDDLE') {
    if (state.pitchCondition === 'SPIN_FRIENDLY' || state.wickets <= 2) {
      return r.bowling.wicketTaking >= 78 ? 'ATTACK_WICKETS' : 'BUILD_PRESSURE';
    }
    if (state.pitchCondition === 'BATTING_PARADISE') {
      return 'DEFEND_BOUNDARIES';
    }
    return 'BUILD_PRESSURE';
  }

  if (state.pitchCondition === 'SLOW_AND_LOW' || r.bowling.variation >= 80) {
    return r.bowling.variation >= r.bowling.control ? 'SLOWER_BALL_PLAN' : 'YORKER_PLAN';
  }
  if (state.target !== undefined) {
    const need = Math.max(0, state.target - state.runs);
    const remBalls = Math.max(1, 120 - state.legalBalls);
    const rrr = (need * 6) / remBalls;
    if (rrr <= 8.5 && state.wickets >= 5) {
      return 'ATTACK_STUMPS';
    }
  }
  if (r.bowling.control >= 76) {
    return 'YORKER_PLAN';
  }
  return 'WIDE_LINE_PLAN';
}

export function selectBowler(
  state: InningsEngineState,
  rng: () => number,
  difficulty: CaptaincyDifficulty = state.difficulty
): { bowlerId: string; planId: BowlingPlanId } {
  const options = getBowlerSelectionOptions(state);
  let pool = options.filter((o) => o.canBowlNow);

  if (pool.length === 0) {
    pool = options.filter(
      (o) =>
        o.eligible &&
        !o.disabledReason?.includes('MAXIMUM') &&
        o.disabledReason !== 'SUBSTITUTED OUT'
    );
  }
  if (pool.length === 0) {
    const firstValid = state.bowlers[0]?.player.playerId ?? '';
    return {
      bowlerId: firstValid,
      planId: getDefaultPlanForPhase(getInningsPhaseForOver(state.completedOvers + 1)),
    };
  }

  const noiseSpread = SIM_CONFIG.difficultyAI[difficulty].selectionNoise;
  const scored = pool.map((opt) => ({
    opt,
    score: opt.autoScore + (rng() - 0.5) * noiseSpread,
  }));
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].opt;
  const tracker = state.bowlers.find((b) => b.player.playerId === chosen.player.playerId)!;
  const planId = selectBowlingPlan(state, tracker, rng, difficulty);
  return { bowlerId: chosen.player.playerId, planId };
}

export function selectBattingAggression(
  state: InningsEngineState,
  rng: () => number
): BattingAggressionMode {
  const nextOver = Math.min(20, Math.floor(state.legalBalls / 6) + 1);
  const phase = getInningsPhaseForOver(nextOver);
  const striker = state.batterStates[state.strikerId];
  const strikerSettled = striker ? striker.balls >= 8 : false;

  if (state.collapsePressureActive && state.wickets >= 3 && phase !== 'DEATH') {
    return 'STABILIZE';
  }

  if (state.target !== undefined) {
    const needRuns = Math.max(0, state.target - state.runs);
    const remBalls = Math.max(1, 120 - state.legalBalls);
    const rrr = (needRuns * 6) / remBalls;

    if (rrr >= 13.5 || (remBalls <= 12 && rrr >= 11.2)) {
      return 'ALL_OUT_ATTACK';
    }
    if (rrr >= 10.6 && (phase !== 'POWERPLAY' || rrr >= 11.5)) {
      return state.wickets >= 7 && remBalls > 18 ? 'BALANCED' : 'ATTACK';
    }
    if (rrr <= 6.8 && state.wickets >= 4) {
      return 'ROTATE_STRIKE';
    }
    if (rrr <= 7.2 && state.wickets <= 2) {
      return phase === 'DEATH' ? 'ATTACK' : 'ROTATE_STRIKE';
    }
  }

  if (phase === 'POWERPLAY') {
    if (state.wickets >= 3) return 'STABILIZE';
    if (state.wickets <= 1 && (strikerSettled || state.pitchCondition === 'BATTING_PARADISE') && rng() < 0.5) {
      return 'ATTACK';
    }
    return 'BALANCED';
  }

  if (phase === 'MIDDLE') {
    if (state.wickets >= 5) return 'STABILIZE';
    if (strikerSettled && state.wickets <= 2 && rng() < 0.42) return 'ATTACK';
    return rng() < 0.48 ? 'ROTATE_STRIKE' : 'BALANCED';
  }

  // DEATH
  if (state.wickets >= 8 && state.legalBalls < 110) return 'BALANCED';
  if (state.wickets <= 5 && nextOver >= 18) return 'ALL_OUT_ATTACK';
  return 'ATTACK';
}

function getBowlerForDelivery(
  state: InningsEngineState,
  bowlerIdOverride?: string,
  planOverride?: BowlingPlanId,
  rng?: () => number
): { bowler: EngineBowlerState; planId: BowlingPlanId; overNum1: number; phase: InningsPhase } {
  if (state.activeOver) {
    const existing = state.bowlers.find(
      (b) => b.player.playerId === state.activeOver!.bowlerId
    );
    if (existing && !existing.isSubbedOut && !existing.isInjured && existing.ballsBowled < 24) {
      return {
        bowler: existing,
        planId: planOverride ?? state.activeOver.planId,
        overNum1: state.activeOver.overNumber,
        phase: getInningsPhaseForOver(state.activeOver.overNumber),
      };
    }
  }

  const overNum1 = Math.min(20, state.completedOvers + 1);
  const phase = getInningsPhaseForOver(overNum1);
  let activeBowler: EngineBowlerState | undefined;
  let chosenPlan: BowlingPlanId = planOverride ?? getDefaultPlanForPhase(phase);

  if (bowlerIdOverride) {
    activeBowler = state.bowlers.find(
      (b) =>
        b.player.playerId === bowlerIdOverride &&
        b.eligible &&
        !b.isSubbedOut &&
        !b.isInjured &&
        b.ballsBowled < 24 &&
        b.player.playerId !== state.lastBowlerId
    );
    // Allow explicit override if only blocked by previous over on malformed emergency roster
    if (!activeBowler) {
      activeBowler = state.bowlers.find(
        (b) =>
          b.player.playerId === bowlerIdOverride &&
          b.eligible &&
          !b.isSubbedOut &&
          !b.isInjured &&
          b.ballsBowled < 24
      );
    }
  }

  if (!activeBowler) {
    const pickRng = rng ?? createSeededRng(state.legalBalls + 1).next;
    const auto = selectBowler(state, pickRng, state.difficulty);
    activeBowler =
      state.bowlers.find((b) => b.player.playerId === auto.bowlerId) ?? state.bowlers[0];
    if (!planOverride) chosenPlan = auto.planId;
  }

  return { bowler: activeBowler, planId: chosenPlan, overNum1, phase };
}

function finalizeCompletedOver(
  state: InningsEngineState,
  activeBowler: EngineBowlerState,
  overBuf: ActiveOverBuffer,
  rotateStrikeOnOverEnd: boolean
): OverSummaryLine {
  const phase = getInningsPhaseForOver(overBuf.overNumber);
  const isMaiden = overBuf.legalBalls === 6 && overBuf.runs === 0;
  if (isMaiden) {
    activeBowler.maidens += 1;
  }

  state.completedOvers += 1;
  state.lastOverBowledWasQuiet =
    overBuf.dots >= SIM_CONFIG.quietOverPressure.dotThresholdInOver || overBuf.runs <= 4;

  if (rotateStrikeOnOverEnd) {
    const temp = state.strikerId;
    state.strikerId = state.nonStrikerId;
    state.nonStrikerId = temp;
  }

  const ovStr =
    activeBowler.ballsBowled === 24
      ? '4'
      : String(ballsToCricketOvers(activeBowler.ballsBowled));
  const bowlerSpellFigures = `${ovStr}-${activeBowler.maidens}-${activeBowler.runsConceded}-${activeBowler.wickets}`;

  const summary: OverSummaryLine = {
    overNumber: overBuf.overNumber,
    phase,
    bowlerId: activeBowler.player.playerId,
    bowlerName: activeBowler.player.playerName,
    bowlerType: activeBowler.bowlerType,
    planId: overBuf.planId,
    runs: overBuf.runs,
    wickets: overBuf.wickets,
    dots: overBuf.dots,
    fours: overBuf.fours,
    sixes: overBuf.sixes,
    wides: overBuf.wides,
    noBalls: overBuf.noBalls,
    isMaiden,
    cumulativeRuns: state.runs,
    cumulativeWickets: state.wickets,
    ballsSequence: [...overBuf.ballsSequence],
    bowlerSpellFigures,
    wicketBatterNames: [...overBuf.wicketBatterNames],
  };

  state.overHistory.push(summary);
  state.activeOver = null;
  return summary;
}

export interface StepDeliveryResult {
  nextState: InningsEngineState;
  delivery: DeliveryEvent;
  completedOverSummary: OverSummaryLine | null;
}

export function stepInningsDelivery(
  prevState: InningsEngineState,
  options: {
    bowlerId?: string;
    planId?: BowlingPlanId;
    aggressionMode?: BattingAggressionMode;
    rng: () => number;
  }
): StepDeliveryResult {
  if (prevState.isCompleted) {
    throw new Error('Completed innings cannot simulate further deliveries.');
  }

  const rng = options.rng;
  const state = cloneInningsState(prevState);

  if (
    state.legalBalls >= 120 ||
    state.wickets >= 10 ||
    (state.target !== undefined && state.runs >= state.target)
  ) {
    state.isCompleted = true;
    throw new Error('Completed innings cannot simulate further deliveries.');
  }

  const isStartingNewOver = state.activeOver === null;
  const { bowler: activeBowler, planId, overNum1, phase } = getBowlerForDelivery(
    state,
    options.bowlerId,
    options.planId,
    rng
  );

  if (isStartingNewOver) {
    if (activeBowler.lastOverBowled > 0 && overNum1 - activeBowler.lastOverBowled === 2) {
      activeBowler.currentSpellOvers += 1;
    } else {
      activeBowler.currentSpellOvers = 1;
    }
    activeBowler.lastOverBowled = overNum1;
    state.lastBowlerId = activeBowler.player.playerId;
    state.activeOver = {
      overNumber: overNum1,
      bowlerId: activeBowler.player.playerId,
      bowlerName: activeBowler.player.playerName,
      bowlerType: activeBowler.bowlerType,
      planId,
      runs: 0,
      bowlerRuns: 0,
      wickets: 0,
      dots: 0,
      fours: 0,
      sixes: 0,
      wides: 0,
      noBalls: 0,
      legalBalls: 0,
      ballsSequence: [],
      wicketBatterNames: [],
      extraDeliveriesThisOver: 0,
    };
  }

  const overBuf = state.activeOver!;
  const phaseCfg = SIM_CONFIG.phases[phase];
  const pitchCfg = SIM_CONFIG.pitchProfiles[state.pitchCondition];
  const planCfg = SIM_CONFIG.tacticalPlans[planId] ?? SIM_CONFIG.tacticalPlans.BALANCED;
  const aggressionMode = options.aggressionMode ?? selectBattingAggression(state, rng);
  const aggCfg = SIM_CONFIG.aggressionModes[aggressionMode];

  let striker = state.batterStates[state.strikerId];
  let nonStriker = state.batterStates[state.nonStrikerId];
  const wasFreeHit = state.freeHitActive;

  const bowlForm =
    state.playerForms[activeBowler.player.playerId] ?? activeBowler.player.form ?? 'NORMAL';
  const bRatings = resolveSituationalPlayerRatings(activeBowler.player, bowlForm).bowling;

  // Check illegal delivery (Wide or No-Ball) — capped at 3 extras per over so overs stay realistic
  const controlExtraFactor = clamp(1.18 - (bRatings.control - 60) * 0.008, 0.72, 1.35);
  const wideProb =
    SIM_CONFIG.extrasAndFreeHit.wideBaseProb * planCfg.extraMultiplier * controlExtraFactor;
  const noBallProb =
    SIM_CONFIG.extrasAndFreeHit.noBallBaseProb *
    planCfg.extraMultiplier *
    controlExtraFactor;

  if (overBuf.extraDeliveriesThisOver < 3 && rng() < wideProb + noBallProb) {
    const isNoBall = rng() < noBallProb / (wideProb + noBallProb);
    state.runs += 1;
    state.extras += 1;
    overBuf.runs += 1;
    overBuf.bowlerRuns += 1;
    activeBowler.runsConceded += 1;
    state.phaseTrack[phase].runs += 1;
    state.currentPartnershipRuns += 1;
    overBuf.extraDeliveriesThisOver += 1;

    let deliveryOutcome: string;
    let extraType: DeliveryEvent['extraType'];
    let commentary: string;
    if (isNoBall) {
      overBuf.noBalls += 1;
      activeBowler.noBalls += 1;
      state.extrasBreakdown.noBalls += 1;
      state.freeHitActive = true;
      deliveryOutcome = 'NB';
      extraType = 'NO_BALL';
      commentary = `${activeBowler.player.playerName} oversteps — NO BALL! Free Hit coming up.`;
    } else {
      overBuf.wides += 1;
      activeBowler.wides += 1;
      state.extrasBreakdown.wides += 1;
      // Wide preserves an existing Free Hit
      deliveryOutcome = 'Wd';
      extraType = 'WIDE';
      commentary = `${activeBowler.player.playerName} strays down the tramline — WIDE.`;
    }
    overBuf.ballsSequence.push(deliveryOutcome);

    const delivery: DeliveryEvent = {
      ballNumber: state.deliveryLog.length + 1,
      legalBallNumber: state.legalBalls,
      overNumber: overNum1,
      ballInOver: overBuf.legalBalls,
      phase,
      outcome: deliveryOutcome,
      runs: 1,
      batterRuns: 0,
      extrasRuns: 1,
      extraType,
      isLegal: false,
      isWicket: false,
      bowlerCreditedWicket: false,
      isFreeHit: wasFreeHit,
      batterId: striker.player.playerId,
      nonStrikerId: nonStriker.player.playerId,
      bowlerId: activeBowler.player.playerId,
      aggressionMode,
      bowlingPlan: planId,
      commentary,
    };
    state.deliveryLog.push(delivery);

    let completedOverSummary: OverSummaryLine | null = null;
    if (state.target !== undefined && state.runs >= state.target) {
      completedOverSummary = finalizeCompletedOver(state, activeBowler, overBuf, false);
      state.isCompleted = true;
    }

    return { nextState: state, delivery, completedOverSummary };
  }

  // Legal delivery — consume Free Hit after this ball resolves
  state.freeHitActive = false;

  let phaseBowlRating = getPhaseBowlingRating(
    activeBowler.player,
    phase,
    bowlForm,
    state.pitchCondition,
    activeBowler.bowlerType
  );
  if (planCfg.preferControl) {
    phaseBowlRating += (bRatings.control - SIM_CONFIG.baselineRating) * 0.18;
  } else if (planCfg.preferVariation) {
    phaseBowlRating += (bRatings.variation - SIM_CONFIG.baselineRating) * 0.22;
  } else if (planCfg.preferWicketTaking) {
    phaseBowlRating += (bRatings.wicketTaking - SIM_CONFIG.baselineRating) * 0.2;
  }

  if (phase === 'POWERPLAY') {
    phaseBowlRating += activeBowler.bowlerType === 'PACE' ? 1.5 : -1.5;
  } else if (phase === 'MIDDLE') {
    phaseBowlRating += activeBowler.bowlerType === 'SPIN' ? 2.2 : -1.0;
  } else if (phase === 'DEATH') {
    phaseBowlRating += activeBowler.bowlerType === 'PACE' ? 1.5 : -2.0;
  }

  let spellFatigueRunMult = 1.0;
  if (activeBowler.currentSpellOvers === 3) {
    phaseBowlRating -= SIM_CONFIG.fatigue.consecutivePenaltyOver3;
  } else if (activeBowler.currentSpellOvers >= 4) {
    phaseBowlRating -= SIM_CONFIG.fatigue.consecutivePenaltyOver4;
    spellFatigueRunMult = SIM_CONFIG.fatigue.tiredEconomyRunMult;
  }

  const pitchRunMult = pitchCfg.runMultiplier[phase];
  const pitchWicketMult = pitchCfg.wicketMultiplier[phase];

  const quietPressureWktMult =
    phase === 'MIDDLE' && state.lastOverBowledWasQuiet
      ? SIM_CONFIG.quietOverPressure.pressureWicketBoost
      : 1.0;
  const quietPressureRunMult =
    phase === 'MIDDLE' && state.lastOverBowledWasQuiet
      ? SIM_CONFIG.quietOverPressure.pressureRunDampen
      : 1.0;

  const batForm = state.playerForms[striker.player.playerId] ?? striker.player.form ?? 'NORMAL';
  let phaseBatRating = getPhaseBattingRating(
    striker.player,
    phase,
    batForm,
    state.pitchCondition,
    activeBowler.bowlerType
  );

  // Handedness & spin/pace matchup directly modulates delivery contest cleanly
  const batLeft = /left/i.test(striker.player.battingStyle || '');
  const bowlStyleStr = activeBowler.player.bowlingStyle || '';
  if (activeBowler.bowlerType === 'SPIN') {
    if (batLeft && /offbreak/i.test(bowlStyleStr)) phaseBowlRating += 2.2;
    if (!batLeft && /orthodox|legbreak/i.test(bowlStyleStr)) phaseBowlRating += 1.6;
  } else if (activeBowler.bowlerType === 'PACE') {
    if (!batLeft && /left-arm/i.test(bowlStyleStr) && phase === 'POWERPLAY') phaseBowlRating += 1.5;
  }

  if (phase === 'DEATH' && striker.player.role === 'BOWL') {
    const floor = SIM_CONFIG.baselineRating * phaseCfg.tailenderAggressionFloor;
    phaseBatRating = Math.max(phaseBatRating, floor);
  }

  // Note: NO magical +3 Impact Player boost — players perform purely from ratings, role & form!
  const settling = getBatterSettlingModifiers(striker.balls, striker.player, phase);

  // Batter endurance fatigue after long innings (startBalls = 36, capped gently)
  const fatigueCfg = SIM_CONFIG.batterFatigue;
  const enduranceMult =
    striker.balls > fatigueCfg.startBalls
      ? 1 -
        Math.min(
          fatigueCfg.maxPenalty,
          (striker.balls - fatigueCfg.startBalls) * fatigueCfg.slopePerBall
        )
      : 1.0;

  // Partnership stability benefit once partnership settles (18+ balls)
  const psCfg = SIM_CONFIG.partnershipStability;
  const pProgress =
    state.currentPartnershipBalls >= psCfg.minBalls
      ? clamp((state.currentPartnershipBalls - psCfg.minBalls) / 24, 0, 1)
      : 0;
  const partnershipWicketDampen = 1 - pProgress * psCfg.maxVolatilityDampen;
  const partnershipRotationBoost = 1 + pProgress * psCfg.maxRotationBoost;

  if (state.collapsePressureActive) {
    const stabRating = getCollapseStabilizationRating(striker.player, batForm);
    phaseBatRating = phaseBatRating * 0.45 + stabRating * 0.55;
  }

  // In STABILIZE mode, weight Technique & Consistency higher cleanly
  if (aggressionMode === 'STABILIZE') {
    const stabRating = getCollapseStabilizationRating(striker.player, batForm);
    phaseBatRating = phaseBatRating * 0.65 + stabRating * 0.35;
  }

  const effectiveBatSkill =
    phaseBatRating *
    settling.scoringMultiplier *
    enduranceMult *
    striker.knockFactor *
    (1 + state.teamDaySwing);

  const effectiveBowlSkill = phaseBowlRating * activeBowler.spellFactor;
  const ratingDiff = effectiveBatSkill - effectiveBowlSkill;

  // Neutral chase awareness (identical for both teams)
  let chaseRunMult = 1.0;
  let chaseWicketMult = 1.0;
  if (state.target !== undefined) {
    const remBalls = Math.max(1, 120 - state.legalBalls);
    const needRuns = Math.max(0, state.target - state.runs);
    const rrr = (needRuns * 6) / remBalls;
    const ca = SIM_CONFIG.variance.chaseTargetAwareness;
    if (rrr >= ca.desperateRrrThreshold) {
      chaseRunMult = ca.desperateRunBoost;
      chaseWicketMult = ca.desperateWicketBoost;
    } else if (rrr >= ca.urgentRrrThreshold) {
      chaseRunMult = ca.urgentRunBoost;
      chaseWicketMult = ca.urgentWicketBoost;
    } else if (rrr <= ca.cruiseRrrThreshold && state.wickets < 5) {
      chaseRunMult = 0.95;
      chaseWicketMult = 0.86;
    }
  }

  const activeDisruptRun = state.disruptionBallsLeft > 0 ? state.disruptionScoringMult : 1.0;
  const activeDisruptWkt = state.disruptionBallsLeft > 0 ? state.disruptionWicketMult : 1.0;
  const collapseRunMult = state.collapsePressureActive
    ? SIM_CONFIG.collapsePressure.baseScoringMultiplier
    : 1.0;
  const collapseWktMult = state.collapsePressureActive
    ? SIM_CONFIG.collapsePressure.baseWicketMultiplier * state.collapseIntensity
    : 1.0;

  let pBowlerWicket = wasFreeHit
    ? 0
    : SIM_CONFIG.baseWicketProbPerBall *
      phaseCfg.wicketModifier *
      pitchWicketMult *
      state.nightWicketMult *
      planCfg.wicketMultiplier *
      quietPressureWktMult *
      settling.wicketMultiplier *
      partnershipWicketDampen *
      activeDisruptWkt *
      collapseWktMult *
      chaseWicketMult *
      aggCfg.wicketMultiplier *
      (1 - ratingDiff * SIM_CONFIG.skillWicketSensitivity);

  if (!wasFreeHit) {
    if (phase === 'POWERPLAY' && activeBowler.bowlerType === 'PACE') {
      pBowlerWicket *= 1.04;
    } else if (phase === 'MIDDLE' && activeBowler.bowlerType === 'SPIN') {
      pBowlerWicket *= 1.05;
    }
    if (phase === 'DEATH' && striker.player.role === 'BOWL') {
      pBowlerWicket *= 1.20;
    }
    pBowlerWicket = clamp(pBowlerWicket, 0.009, 0.092);
  }

  const pRunOut = clamp(
    SIM_CONFIG.extrasAndFreeHit.runOutBaseProb *
      aggCfg.runOutRiskMultiplier *
      (phase === 'DEATH' ? 1.35 : 1.0),
    0.001,
    0.02
  );

  // Advance legal-ball counters
  state.legalBalls += 1;
  overBuf.legalBalls += 1;
  striker.balls += 1;
  activeBowler.ballsBowled += 1;
  state.phaseTrack[phase].balls += 1;
  state.currentPartnershipBalls += 1;
  state.ballsSinceLastWicket += 1;
  if (state.disruptionBallsLeft > 0) state.disruptionBallsLeft -= 1;

  if (
    state.collapsePressureActive &&
    state.ballsSinceLastWicket >= SIM_CONFIG.collapsePressure.stabilizationBallsNeeded
  ) {
    state.collapsePressureActive = false;
    state.collapseIntensity = 1;
    state.hadRecoveryAfterCollapse = true;
  }

  let delivery: DeliveryEvent;
  const wicketRoll = rng();
  const isBowlerWicket = !wasFreeHit && wicketRoll < pBowlerWicket;
  const isRunOutWicket =
    !isBowlerWicket && wicketRoll < pBowlerWicket + pRunOut;

  if (isBowlerWicket || isRunOutWicket) {
    state.wickets += 1;
    overBuf.wickets += 1;
    overBuf.dots += 1;
    if (isBowlerWicket) {
      activeBowler.wickets += 1;
    }
    activeBowler.dots += 1;
    state.phaseTrack[phase].wickets += 1;
    state.currentPartnershipDots += 1;
    overBuf.ballsSequence.push('W');
    overBuf.wicketBatterNames.push(striker.player.playerName);

    striker.out = true;
    let dismissalType: DismissalType;
    let dismissalText: string;

    if (isRunOutWicket) {
      dismissalType = 'Run out';
      dismissalText = `run out (${state.bowlingTeam.shortName})`;
    } else {
      const choices: DismissalType[] =
        activeBowler.bowlerType === 'SPIN'
          ? ['Caught', 'Bowled', 'LBW', 'Stumped', 'Caught & bowled']
          : ['Caught', 'Bowled', 'LBW', 'Caught & bowled', 'Hit wicket'];
      const weights =
        activeBowler.bowlerType === 'SPIN'
          ? [0.46, 0.22, 0.16, 0.11, 0.05]
          : [0.54, 0.24, 0.15, 0.05, 0.02];
      let rPick = rng();
      dismissalType = choices[0];
      for (let idx = 0; idx < choices.length; idx += 1) {
        rPick -= weights[idx];
        if (rPick <= 0) {
          dismissalType = choices[idx];
          break;
        }
      }
      const bName = activeBowler.player.playerName;
      switch (dismissalType) {
        case 'Bowled':
          dismissalText = `b ${bName}`;
          break;
        case 'LBW':
          dismissalText = `lbw b ${bName}`;
          break;
        case 'Stumped':
          dismissalText = `st wk b ${bName}`;
          break;
        case 'Hit wicket':
          dismissalText = `hit wicket b ${bName}`;
          break;
        case 'Caught & bowled':
          dismissalText = `c & b ${bName}`;
          break;
        case 'Caught':
        default:
          dismissalText = `c sub b ${bName}`;
          break;
      }
    }

    striker.dismissalType = dismissalType;
    striker.dismissalText = dismissalText;

    state.fallOfWickets.push({
      wicketNumber: state.wickets,
      runs: state.runs,
      overLabel: String(ballsToCricketOvers(state.legalBalls)),
      batterId: striker.player.playerId,
      batterName: striker.player.playerName,
      phase,
    });

    const partOvers = state.currentPartnershipBalls / 6;
    state.partnerships.push({
      wicketNumber: state.partnershipWicketNum,
      batter1Name: striker.player.playerName,
      batter2Name: nonStriker.player.playerName,
      runs: state.currentPartnershipRuns,
      balls: state.currentPartnershipBalls,
      fours: state.currentPartnershipFours,
      sixes: state.currentPartnershipSixes,
      dots: state.currentPartnershipDots,
      runRate: partOvers > 0 ? Number((state.currentPartnershipRuns / partOvers).toFixed(2)) : 0,
    });
    state.partnershipWicketNum += 1;
    state.currentPartnershipRuns = 0;
    state.currentPartnershipBalls = 0;
    state.currentPartnershipFours = 0;
    state.currentPartnershipSixes = 0;
    state.currentPartnershipDots = 0;
    state.ballsSinceLastWicket = 0;

    state.recentWicketBalls.push(state.legalBalls);
    const cutoff = state.legalBalls - SIM_CONFIG.collapsePressure.windowBalls;
    while (state.recentWicketBalls.length > 0 && state.recentWicketBalls[0] < cutoff) {
      state.recentWicketBalls.shift();
    }
    if (
      state.recentWicketBalls.length >= SIM_CONFIG.collapsePressure.triggerWickets &&
      (phase !== 'DEATH' || state.wickets <= 4)
    ) {
      if (!state.collapsePressureActive) state.collapseEvents += 1;
      state.collapsePressureActive = true;
      state.collapseIntensity = Math.min(
        1.42,
        1 +
          (state.recentWicketBalls.length - SIM_CONFIG.collapsePressure.triggerWickets) *
            SIM_CONFIG.collapsePressure.extraEscalationPerWicket
      );
    }

    const outBatterId = striker.player.playerId;
    const outBatterName = striker.player.playerName;

    if (state.wickets < 10 && state.nextBatterCursor < state.batOrder.length) {
      const incomingPlayer = state.batOrder[state.nextBatterCursor];
      if (!state.batterStates[incomingPlayer.playerId]) {
        state.batterStates[incomingPlayer.playerId] = {
          player: incomingPlayer,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          out: false,
          dismissalText: 'not out',
          knockFactor: 1 + (rng() - rng()) * SIM_CONFIG.variance.batterKnockSpread,
          arrivedIndex: state.nextBatterCursor,
        };
        state.batterOrderIds.push(incomingPlayer.playerId);
      }
      const incomingState = state.batterStates[incomingPlayer.playerId];
      state.nextBatterCursor += 1;

      const incomingForm =
        state.playerForms[incomingPlayer.playerId] ?? incomingPlayer.form ?? 'NORMAL';
      const incomingRating = getPhaseBattingRating(
        incomingPlayer,
        phase,
        incomingForm,
        state.pitchCondition,
        activeBowler.bowlerType
      );
      const qualityNorm = clamp((incomingRating - 48) / 45, 0, 1);

      const wVal = SIM_CONFIG.wicketValue[phase];
      state.disruptionBallsLeft = Math.max(
        1,
        Math.round(wVal.disruptionBalls * (1 - qualityNorm * 0.35))
      );
      state.disruptionScoringMult =
        wVal.scoringMultiplier +
        (1 - wVal.scoringMultiplier) * qualityNorm * wVal.incomingQualityMitigation;
      state.disruptionWicketMult =
        wVal.wicketRiskMultiplier -
        (wVal.wicketRiskMultiplier - 1) * qualityNorm * wVal.incomingQualityMitigation;

      striker = incomingState;
      state.strikerId = striker.player.playerId;
    }

    delivery = {
      ballNumber: state.deliveryLog.length + 1,
      legalBallNumber: state.legalBalls,
      overNumber: overNum1,
      ballInOver: overBuf.legalBalls,
      phase,
      outcome: 'W',
      runs: 0,
      batterRuns: 0,
      extrasRuns: 0,
      extraType: 'NONE',
      isLegal: true,
      isWicket: true,
      dismissalType,
      dismissedBatterId: outBatterId,
      bowlerCreditedWicket: isBowlerWicket,
      isFreeHit: wasFreeHit,
      batterId: outBatterId,
      nonStrikerId: nonStriker.player.playerId,
      bowlerId: activeBowler.player.playerId,
      aggressionMode,
      bowlingPlan: planId,
      commentary: `WICKET! ${outBatterName} ${dismissalText}`,
    };
  } else if (
    rng() <
    SIM_CONFIG.extrasAndFreeHit.byeBaseProb + SIM_CONFIG.extrasAndFreeHit.legByeBaseProb
  ) {
    // Legal-ball Bye or Leg-bye (credits team extras, NOT batter runs or bowler runsConceded)
    const isBye =
      rng() <
      SIM_CONFIG.extrasAndFreeHit.byeBaseProb /
        (SIM_CONFIG.extrasAndFreeHit.byeBaseProb + SIM_CONFIG.extrasAndFreeHit.legByeBaseProb);
    const runRoll = rng();
    const extraRuns = runRoll < 0.78 ? 1 : runRoll < 0.92 ? 2 : 4;
    const tag = isBye ? `B${extraRuns}` : `LB${extraRuns}`;

    state.runs += extraRuns;
    state.extras += extraRuns;
    overBuf.runs += extraRuns;
    state.phaseTrack[phase].runs += extraRuns;
    state.currentPartnershipRuns += extraRuns;
    if (isBye) state.extrasBreakdown.byes += extraRuns;
    else state.extrasBreakdown.legByes += extraRuns;
    overBuf.ballsSequence.push(tag);

    if (extraRuns === 1) {
      const temp = striker;
      striker = nonStriker;
      nonStriker = temp;
      state.strikerId = striker.player.playerId;
      state.nonStrikerId = nonStriker.player.playerId;
    }

    delivery = {
      ballNumber: state.deliveryLog.length + 1,
      legalBallNumber: state.legalBalls,
      overNumber: overNum1,
      ballInOver: overBuf.legalBalls,
      phase,
      outcome: tag,
      runs: extraRuns,
      batterRuns: 0,
      extrasRuns: extraRuns,
      extraType: isBye ? 'BYE' : 'LEG_BYE',
      isLegal: true,
      isWicket: false,
      bowlerCreditedWicket: false,
      isFreeHit: wasFreeHit,
      batterId: striker.player.playerId,
      nonStrikerId: nonStriker.player.playerId,
      bowlerId: activeBowler.player.playerId,
      aggressionMode,
      bowlingPlan: planId,
      commentary: `${extraRuns} ${isBye ? 'bye' : 'leg bye'}${extraRuns > 1 ? 's' : ''}.`,
    };
  } else {
    const freeHitRunMult = wasFreeHit ? SIM_CONFIG.extrasAndFreeHit.freeHitRunMultiplier : 1.0;
    const freeHitBndMult = wasFreeHit
      ? SIM_CONFIG.extrasAndFreeHit.freeHitBoundaryMultiplier
      : 1.0;

    let expectedRuns =
      SIM_CONFIG.baseRunsPerBall *
      phaseCfg.scoringModifier *
      pitchRunMult *
      state.nightRunMult *
      planCfg.runMultiplier *
      quietPressureRunMult *
      spellFatigueRunMult *
      activeDisruptRun *
      collapseRunMult *
      chaseRunMult *
      aggCfg.runMultiplier *
      freeHitRunMult *
      (1 + ratingDiff * SIM_CONFIG.skillRunSensitivity);

    expectedRuns = clamp(expectedRuns, 0.60, 2.78);

    const boundaryShare = clamp(
      0.158 *
        phaseCfg.boundaryMultiplier *
        pitchCfg.boundaryMultiplier *
        planCfg.boundaryMultiplier *
        aggCfg.boundaryMultiplier *
        freeHitBndMult *
        clamp(expectedRuns / 1.4, 0.65, 1.55),
      0.05,
      0.52
    );
    const p6 = boundaryShare * phaseCfg.sixShareOfBoundaries;
    const p4 = boundaryShare * (1 - phaseCfg.sixShareOfBoundaries);
    const boundaryRuns = p4 * 4 + p6 * 6;

    const nonBoundaryProb = 1 - boundaryShare;
    const remainingExpected = Math.max(0.12, expectedRuns - boundaryRuns);
    const p3 = 0.008;
    const p2 = clamp(
      remainingExpected * 0.11 * partnershipRotationBoost,
      0.04,
      nonBoundaryProb * 0.24
    );
    const rawP1 = clamp(
      ((remainingExpected - p2 * 2 - p3 * 3) * partnershipRotationBoost) /
        Math.max(0.75, phaseCfg.dotBallBias * planCfg.dotBoost * aggCfg.dotBias),
      0.15,
      nonBoundaryProb - p2 - p3 - 0.04
    );
    const p1 = Math.max(0.12, rawP1);
    const p0 = Math.max(0.05, 1 - (p1 + p2 + p3 + p4 + p6));
    const normSum = p0 + p1 + p2 + p3 + p4 + p6;

    const roll = rng() * normSum;
    let scoredRuns = 0;
    if (roll < p0) scoredRuns = 0;
    else if (roll < p0 + p1) scoredRuns = 1;
    else if (roll < p0 + p1 + p2) scoredRuns = 2;
    else if (roll < p0 + p1 + p2 + p3) scoredRuns = 3;
    else if (roll < p0 + p1 + p2 + p3 + p4) scoredRuns = 4;
    else scoredRuns = 6;

    state.runs += scoredRuns;
    overBuf.runs += scoredRuns;
    overBuf.bowlerRuns += scoredRuns;
    striker.runs += scoredRuns;
    activeBowler.runsConceded += scoredRuns;
    state.phaseTrack[phase].runs += scoredRuns;
    state.currentPartnershipRuns += scoredRuns;
    const outcomeStr = scoredRuns === 0 ? '0' : String(scoredRuns);
    overBuf.ballsSequence.push(outcomeStr);

    if (scoredRuns === 0) {
      overBuf.dots += 1;
      activeBowler.dots += 1;
      state.currentPartnershipDots += 1;
    } else if (scoredRuns === 4) {
      striker.fours += 1;
      overBuf.fours += 1;
      activeBowler.foursConceded += 1;
      state.phaseTrack[phase].fours += 1;
      state.currentPartnershipFours += 1;
    } else if (scoredRuns === 6) {
      striker.sixes += 1;
      overBuf.sixes += 1;
      activeBowler.sixesConceded += 1;
      state.phaseTrack[phase].sixes += 1;
      state.currentPartnershipSixes += 1;
    }

    const batterIdAtCrease = striker.player.playerId;
    const nonStrikerIdAtCrease = nonStriker.player.playerId;

    if (scoredRuns === 1 || scoredRuns === 3) {
      const temp = striker;
      striker = nonStriker;
      nonStriker = temp;
      state.strikerId = striker.player.playerId;
      state.nonStrikerId = nonStriker.player.playerId;
    }

    delivery = {
      ballNumber: state.deliveryLog.length + 1,
      legalBallNumber: state.legalBalls,
      overNumber: overNum1,
      ballInOver: overBuf.legalBalls,
      phase,
      outcome: outcomeStr,
      runs: scoredRuns,
      batterRuns: scoredRuns,
      extrasRuns: 0,
      extraType: 'NONE',
      isLegal: true,
      isWicket: false,
      bowlerCreditedWicket: false,
      isFreeHit: wasFreeHit,
      batterId: batterIdAtCrease,
      nonStrikerId: nonStrikerIdAtCrease,
      bowlerId: activeBowler.player.playerId,
      aggressionMode,
      bowlingPlan: planId,
      commentary:
        scoredRuns === 6
          ? `SIX! ${striker.player.playerId === batterIdAtCrease ? striker.player.playerName : nonStriker.player.playerName} launches it over the ropes!`
          : scoredRuns === 4
            ? `FOUR! Cracked to the boundary.`
            : scoredRuns === 0
              ? `Dot ball.`
              : `${scoredRuns} run${scoredRuns > 1 ? 's' : ''}.`,
    };
  }

  state.deliveryLog.push(delivery);

  const inningsEndedMidOver =
    state.wickets >= 10 ||
    state.legalBalls >= 120 ||
    (state.target !== undefined && state.runs >= state.target);
  const overCompleted = overBuf.legalBalls >= 6;

  let completedOverSummary: OverSummaryLine | null = null;
  if (overCompleted || inningsEndedMidOver) {
    completedOverSummary = finalizeCompletedOver(
      state,
      activeBowler,
      overBuf,
      overCompleted && !inningsEndedMidOver
    );
  }

  if (inningsEndedMidOver) {
    state.isCompleted = true;
  }

  return { nextState: state, delivery, completedOverSummary };
}

export function simulateInningsOver(
  prevState: InningsEngineState,
  options: {
    bowlerId?: string;
    planId?: BowlingPlanId;
    aggressionMode?: BattingAggressionMode;
    rng: () => number;
  }
): {
  nextState: InningsEngineState;
  overSummary: OverSummaryLine | null;
  deliveries: DeliveryEvent[];
} {
  if (
    prevState.isCompleted ||
    prevState.completedOvers >= 20 ||
    prevState.wickets >= 10 ||
    (prevState.target !== undefined && prevState.runs >= prevState.target)
  ) {
    return {
      nextState: { ...prevState, isCompleted: true },
      overSummary: null,
      deliveries: [],
    };
  }

  const targetOverNumber = prevState.activeOver
    ? prevState.activeOver.overNumber
    : prevState.completedOvers + 1;
  let cur = prevState;
  const deliveries: DeliveryEvent[] = [];
  let overSummary: OverSummaryLine | null = null;

  let safety = 0;
  while (!cur.isCompleted && safety < 20) {
    safety += 1;
    const step = stepInningsDelivery(cur, {
      bowlerId: options.bowlerId,
      planId: options.planId,
      aggressionMode: options.aggressionMode,
      rng: options.rng,
    });
    cur = step.nextState;
    deliveries.push(step.delivery);
    if (step.completedOverSummary) {
      overSummary = step.completedOverSummary;
      if (overSummary.overNumber === targetOverNumber) break;
    }
  }

  return { nextState: cur, overSummary, deliveries };
}

export function applyImpactPlayerToInnings(
  state: InningsEngineState,
  impactSub: ImpactSubstitution,
  inPlayer: PlayerSeasonRecord
): InningsEngineState {
  const nextBowlers = state.bowlers.map((b) => ({ ...b }));
  const nextBatOrder = [...state.batOrder];
  let nextSubBat = state.subForBatting;
  let nextSubBowl = state.subForBowling;

  if (impactSub.teamId === state.bowlingTeam.id) {
    nextSubBowl = impactSub;
    const outTracker = nextBowlers.find((b) => b.player.playerId === impactSub.outPlayerId);
    if (outTracker) {
      outTracker.isSubbedOut = true;
    }
    const existingIn = nextBowlers.find((b) => b.player.playerId === inPlayer.playerId);
    if (existingIn) {
      existingIn.isSubbedOut = false;
      existingIn.isImpactIn = true;
      existingIn.eligible = true;
    } else {
      const elig = isBowlerEligible(inPlayer, state.injuredPlayerIds);
      nextBowlers.push({
        player: inPlayer,
        bowlerType: elig.bowlerType === 'NONE' ? 'PACE' : elig.bowlerType,
        eligible:
          !state.injuredPlayerIds.includes(inPlayer.playerId) &&
          (elig.eligible ||
            inPlayer.role === 'BOWL' ||
            inPlayer.role === 'AR' ||
            inPlayer.bowlingRating >= 38),
        isPartTimer: elig.isPartTimer,
        isSubbedOut: false,
        isImpactIn: true,
        isInjured: state.injuredPlayerIds.includes(inPlayer.playerId),
        ballsBowled: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        dots: 0,
        foursConceded: 0,
        sixesConceded: 0,
        wides: 0,
        noBalls: 0,
        lastOverBowled: 0,
        currentSpellOvers: 0,
        spellFactor: 1.0,
      });
    }
  } else if (impactSub.teamId === state.battingTeam.id) {
    nextSubBat = impactSub;
    const alreadyInOrder = nextBatOrder.some((p) => p.playerId === inPlayer.playerId);
    if (!alreadyInOrder) {
      const outIdx = nextBatOrder.findIndex((p) => p.playerId === impactSub.outPlayerId);
      if (outIdx >= state.nextBatterCursor) {
        nextBatOrder.splice(outIdx, 1);
      }
      const insertPos = Math.min(state.nextBatterCursor, nextBatOrder.length);
      nextBatOrder.splice(insertPos, 0, inPlayer);
    }
  }

  return {
    ...state,
    bowlers: nextBowlers,
    batOrder: nextBatOrder,
    subForBatting: nextSubBat,
    subForBowling: nextSubBowl,
  };
}

export function finalizeInningsOutput(state: InningsEngineState): InningsOutput {
  const partnerships = state.partnerships.map((p) => ({ ...p }));
  if (state.currentPartnershipBalls > 0) {
    const b1 = state.batterStates[state.strikerId];
    const b2 = state.batterStates[state.nonStrikerId];
    const partOv = state.currentPartnershipBalls / 6;
    partnerships.push({
      wicketNumber: state.partnershipWicketNum,
      batter1Name: b1?.player.playerName ?? 'Batter 1',
      batter2Name: b2?.player.playerName ?? 'Batter 2',
      runs: state.currentPartnershipRuns,
      balls: state.currentPartnershipBalls,
      fours: state.currentPartnershipFours,
      sixes: state.currentPartnershipSixes,
      dots: state.currentPartnershipDots,
      runRate: partOv > 0 ? Number((state.currentPartnershipRuns / partOv).toFixed(2)) : 0,
    });
  }

  const oversFormatted =
    state.legalBalls === 120 ? 20 : ballsToCricketOvers(state.legalBalls);
  const oversForNrr =
    state.wickets === 10 || state.legalBalls === 120 ? 20.0 : state.legalBalls / 6;

  const summary: InningsSummary = {
    teamId: state.battingTeam.id,
    runs: state.runs,
    wickets: state.wickets,
    overs: oversFormatted,
    oversForNrr,
  };

  const battingLines: BatterScorecardLine[] = state.batterOrderIds
    .map((id) => state.batterStates[id])
    .filter((b): b is EngineBatterState => Boolean(b))
    .sort((a, b) => a.arrivedIndex - b.arrivedIndex)
    .map((b) => {
      const sr = b.balls > 0 ? Number(((b.runs / b.balls) * 100).toFixed(1)) : 0;
      const srBonus = b.runs >= 20 && sr >= 155 ? 12 : b.runs >= 15 && sr >= 140 ? 6 : 0;
      const milestoneBonus = b.runs >= 100 ? 28 : b.runs >= 50 ? 14 : b.runs >= 30 ? 6 : 0;
      const impactPoints = Number(
        (b.runs * 1.1 + b.sixes * 2.5 + b.fours * 1.2 + srBonus + milestoneBonus).toFixed(1)
      );
      return {
        playerId: b.player.playerId,
        playerName: b.player.playerName,
        role: b.player.role,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        strikeRate: sr,
        out: b.out,
        dismissalText: b.out ? b.dismissalText : 'not out',
        impactPoints,
        isImpactIn: state.subForBatting?.inPlayerId === b.player.playerId,
        isSubbedOut: state.subForBatting?.outPlayerId === b.player.playerId,
      };
    });

  const bowlingLines: BowlerScorecardLine[] = state.bowlers
    .filter((b) => b.ballsBowled > 0)
    .map((b) => {
      const ov = b.ballsBowled === 24 ? 4 : ballsToCricketOvers(b.ballsBowled);
      const decOv = b.ballsBowled / 6;
      const econ = decOv > 0 ? Number((b.runsConceded / decOv).toFixed(2)) : 0;
      const econBonus = econ <= 6.5 ? 14 : econ <= 7.8 ? 7 : econ >= 11 ? -6 : 0;
      const haulBonus = b.wickets >= 4 ? 22 : b.wickets === 3 ? 12 : 0;
      const impactPoints = Number(
        (b.wickets * 24 + b.maidens * 8 + econBonus + haulBonus).toFixed(1)
      );
      return {
        playerId: b.player.playerId,
        playerName: b.player.playerName,
        role: b.player.role,
        bowlerType: b.bowlerType,
        overs: ov,
        ballsBowled: b.ballsBowled,
        maidens: b.maidens,
        runsConceded: b.runsConceded,
        wickets: b.wickets,
        economy: econ,
        dots: b.dots,
        foursConceded: b.foursConceded,
        sixesConceded: b.sixesConceded,
        wides: b.wides,
        noBalls: b.noBalls,
        impactPoints,
        isImpactIn: state.subForBowling?.inPlayerId === b.player.playerId,
        isSubbedOut: state.subForBowling?.outPlayerId === b.player.playerId,
      };
    });

  const phaseSplits: PhaseSplit[] = (['POWERPLAY', 'MIDDLE', 'DEATH'] as InningsPhase[]).map(
    (ph) => {
      const tr = state.phaseTrack[ph];
      const ov = tr.balls / 6;
      return {
        phase: ph,
        label: SIM_CONFIG.phases[ph].shortLabel,
        runs: tr.runs,
        wickets: tr.wickets,
        balls: tr.balls,
        fours: tr.fours,
        sixes: tr.sixes,
        runRate: ov > 0 ? Number((tr.runs / ov).toFixed(2)) : 0,
      };
    }
  );

  const decimalOvers = Math.max(0.1, state.legalBalls / 6);
  const scorecard: InningsScorecard = {
    teamId: state.battingTeam.id,
    runs: state.runs,
    wickets: state.wickets,
    overs: oversFormatted,
    legalBalls: state.legalBalls,
    batting: battingLines,
    bowling: bowlingLines,
    extras: state.extras,
    extrasBreakdown: { ...state.extrasBreakdown },
    runRate: Number((state.runs / decimalOvers).toFixed(2)),
    phaseSplits,
    fallOfWickets: state.fallOfWickets,
    partnerships,
    collapseEvents: state.collapseEvents,
    overHistory: state.overHistory,
  };

  return {
    summary,
    scorecard,
    collapseEvents: state.collapseEvents,
    hadRecoveryAfterCollapse: state.hadRecoveryAfterCollapse,
  };
}

function simulateSuperOverInnings(params: {
  battingTeam: EngineTeam;
  bowlingTeam: EngineTeam;
  pitchCondition: PitchCondition;
  playerForms: Record<string, PlayerForm>;
  injuredPlayerIds: string[];
  target?: number;
  rng: () => number;
}): SuperOverInningsSummary {
  const { battingTeam, bowlingTeam, pitchCondition, playerForms, injuredPlayerIds, target, rng } =
    params;
  const injuredSet = new Set(injuredPlayerIds);

  // Best 3 death batters + best 1 death bowler from post-Impact active players
  const eligibleBatters = battingTeam.players
    .filter((p) => !injuredSet.has(p.playerId))
    .sort((a, b) => {
      const aR = resolveSituationalPlayerRatings(a, playerForms[a.playerId] ?? a.form);
      const bR = resolveSituationalPlayerRatings(b, playerForms[b.playerId] ?? b.form);
      const aScore = aR.batting.deathOvers * 0.4 + aR.batting.finishing * 0.35 + aR.batting.power * 0.25;
      const bScore = bR.batting.deathOvers * 0.4 + bR.batting.finishing * 0.35 + bR.batting.power * 0.25;
      return bScore - aScore;
    });

  const eligibleBowlers = bowlingTeam.players
    .filter((p) => isBowlerEligible(p, injuredPlayerIds).eligible)
    .sort((a, b) => {
      const aType = inferBowlerClassification(a);
      const bType = inferBowlerClassification(b);
      const aR = getPhaseBowlingRating(
        a,
        'DEATH',
        playerForms[a.playerId] ?? a.form,
        pitchCondition,
        aType === 'NONE' ? 'PACE' : aType
      );
      const bR = getPhaseBowlingRating(
        b,
        'DEATH',
        playerForms[b.playerId] ?? b.form,
        pitchCondition,
        bType === 'NONE' ? 'PACE' : bType
      );
      return bR - aR;
    });

  const bowler = eligibleBowlers[0] ?? bowlingTeam.players[0];
  const bowlerType =
    inferBowlerClassification(bowler) === 'NONE' ? 'PACE' : inferBowlerClassification(bowler);
  const bForm = playerForms[bowler.playerId] ?? bowler.form ?? 'NORMAL';
  const bowlRating = getPhaseBowlingRating(bowler, 'DEATH', bForm, pitchCondition, bowlerType);
  const bRatings = resolveSituationalPlayerRatings(bowler, bForm).bowling;

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let freeHit = false;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextIdx = 2;
  const ballsSequence: string[] = [];
  const pitchCfg = SIM_CONFIG.pitchProfiles[pitchCondition];

  let safety = 0;
  while (legalBalls < 6 && wickets < 2 && safety < 14) {
    if (target !== undefined && runs >= target) break;
    safety += 1;

    const extraChance = clamp(
      (SIM_CONFIG.extrasAndFreeHit.wideBaseProb + SIM_CONFIG.extrasAndFreeHit.noBallBaseProb) *
        clamp(1.15 - (bRatings.control - 60) * 0.008, 0.72, 1.35),
      0.015,
      0.075
    );
    if (rng() < extraChance) {
      const isNb = rng() < 0.25;
      runs += 1;
      if (isNb) {
        freeHit = true;
        ballsSequence.push('NB');
      } else {
        ballsSequence.push('Wd');
      }
      continue;
    }

    const batter = eligibleBatters[strikerIdx] ?? eligibleBatters[0];
    const batForm = playerForms[batter.playerId] ?? batter.form ?? 'NORMAL';
    const batRating = getPhaseBattingRating(
      batter,
      'DEATH',
      batForm,
      pitchCondition,
      bowlerType
    );
    const diff = batRating - bowlRating;
    const wasFreeHit = freeHit;
    freeHit = false;
    legalBalls += 1;

    // Super Over is pure Death-over All-Out Attack
    const wktProb = wasFreeHit
      ? 0
      : clamp(
          SIM_CONFIG.baseWicketProbPerBall *
            1.65 *
            pitchCfg.wicketMultiplier.DEATH *
            (1 - diff * SIM_CONFIG.skillWicketSensitivity),
          0.02,
          0.16
        );

    if (rng() < wktProb) {
      wickets += 1;
      ballsSequence.push('W');
      strikerIdx = nextIdx;
      nextIdx += 1;
      continue;
    }

    const expRuns = clamp(
      SIM_CONFIG.baseRunsPerBall *
        1.48 *
        pitchCfg.runMultiplier.DEATH *
        (wasFreeHit ? SIM_CONFIG.extrasAndFreeHit.freeHitRunMultiplier : 1.0) *
        (1 + diff * SIM_CONFIG.skillRunSensitivity),
      0.85,
      3.3
    );
    const bndShare = clamp(0.32 * pitchCfg.boundaryMultiplier * (wasFreeHit ? 1.35 : 1), 0.14, 0.56);
    const p6 = bndShare * 0.55;
    const p4 = bndShare * 0.45;
    const p2 = 0.14;
    const p1 = clamp((expRuns - p6 * 6 - p4 * 4 - p2 * 2) * 0.8, 0.18, 1 - p6 - p4 - p2 - 0.08);
    const p0 = Math.max(0.06, 1 - (p6 + p4 + p2 + p1));
    const total = p0 + p1 + p2 + p4 + p6;
    const r = rng() * total;
    let scored = 0;
    if (r < p0) scored = 0;
    else if (r < p0 + p1) scored = 1;
    else if (r < p0 + p1 + p2) scored = 2;
    else if (r < p0 + p1 + p2 + p4) scored = 4;
    else scored = 6;

    runs += scored;
    ballsSequence.push(String(scored));
    if (scored === 1) {
      const tmp = strikerIdx;
      strikerIdx = nonStrikerIdx;
      nonStrikerIdx = tmp;
    }
  }

  return {
    teamId: battingTeam.id,
    runs,
    wickets,
    balls: legalBalls,
    ballsSequence,
  };
}

export function resolveSuperOvers(params: {
  firstTeam: EngineTeam;
  secondTeam: EngineTeam;
  pitchCondition: PitchCondition;
  playerForms: Record<string, PlayerForm>;
  injuredPlayerIds?: string[];
  rng: () => number;
}): {
  winnerId: SeasonTeamId;
  loserId: SeasonTeamId;
  superOverHistory: SuperOverSummary[];
} {
  const { firstTeam, secondTeam, pitchCondition, playerForms, injuredPlayerIds = [], rng } =
    params;
  const history: SuperOverSummary[] = [];

  for (let round = 1; round <= 10; round += 1) {
    // Team that batted second bats first in the Super Over (standard T20 law)
    const soFirst = simulateSuperOverInnings({
      battingTeam: secondTeam,
      bowlingTeam: firstTeam,
      pitchCondition,
      playerForms,
      injuredPlayerIds,
      rng,
    });
    const soSecond = simulateSuperOverInnings({
      battingTeam: firstTeam,
      bowlingTeam: secondTeam,
      pitchCondition,
      playerForms,
      injuredPlayerIds,
      target: soFirst.runs + 1,
      rng,
    });

    if (soSecond.runs > soFirst.runs) {
      history.push({
        round,
        firstTeam: soFirst,
        secondTeam: soSecond,
        winnerId: firstTeam.id,
      });
      return { winnerId: firstTeam.id, loserId: secondTeam.id, superOverHistory: history };
    }
    if (soFirst.runs > soSecond.runs) {
      history.push({
        round,
        firstTeam: soFirst,
        secondTeam: soSecond,
        winnerId: secondTeam.id,
      });
      return { winnerId: secondTeam.id, loserId: firstTeam.id, superOverHistory: history };
    }

    history.push({
      round,
      firstTeam: soFirst,
      secondTeam: soSecond,
      winnerId: 'TIE',
    });
  }

  // Ultra-rare 10x consecutive tied Super Overs fallback resolved fairly by RNG
  const firstWins = rng() < 0.5;
  return {
    winnerId: firstWins ? firstTeam.id : secondTeam.id,
    loserId: firstWins ? secondTeam.id : firstTeam.id,
    superOverHistory: history,
  };
}

function buildHighlightsTimeline(params: {
  firstTeam: EngineTeam;
  secondTeam: EngineTeam;
  firstCard: InningsScorecard;
  secondCard: InningsScorecard;
  winnerId: SeasonTeamId;
  marginText: string;
  impactSub?: ImpactSubstitution;
}): MatchHighlightEvent[] {
  const { firstTeam, secondTeam, firstCard, secondCard, winnerId, marginText, impactSub } =
    params;
  const events: MatchHighlightEvent[] = [];

  const starBat1 = [...firstCard.batting].sort((a, b) => b.runs - a.runs)[0];
  const starBowl1 = [...firstCard.bowling].sort(
    (a, b) => b.wickets - a.wickets || a.economy - b.economy
  )[0];
  const pp1 = firstCard.phaseSplits?.find((p) => p.phase === 'POWERPLAY');
  const mid1 = firstCard.phaseSplits?.find((p) => p.phase === 'MIDDLE');
  const death1 = firstCard.phaseSplits?.find((p) => p.phase === 'DEATH');

  const pp1Runs = pp1?.runs ?? Math.min(firstCard.runs, 48);
  const pp1Wkts = pp1?.wickets ?? Math.min(firstCard.wickets, 1);
  if (pp1Wkts >= 3 || (firstCard.collapseEvents ?? 0) > 0) {
    events.push({
      id: 'h-inn1-pp',
      inningsNumber: 1,
      phase: 'POWERPLAY',
      overLabel: '6.0',
      teamId: firstTeam.id,
      scoreSnapshot: `${pp1Runs}/${pp1Wkts}`,
      runRateSnapshot: (pp1?.runRate ?? pp1Runs / 6).toFixed(2),
      requiredRateSnapshot: null,
      badge: 'COLLAPSE ALERT',
      title: `New-ball burst! ${firstTeam.shortName} wobble at ${pp1Runs}/${pp1Wkts}`,
      detail: `${secondTeam.shortName} pace attack strikes early in the Powerplay to trigger collapse pressure.`,
      progressPct: 16,
    });
  } else {
    events.push({
      id: 'h-inn1-pp',
      inningsNumber: 1,
      phase: 'POWERPLAY',
      overLabel: '6.0',
      teamId: firstTeam.id,
      scoreSnapshot: `${pp1Runs}/${pp1Wkts}`,
      runRateSnapshot: (pp1?.runRate ?? pp1Runs / 6).toFixed(2),
      requiredRateSnapshot: null,
      badge: '50 UP!',
      title: `${firstTeam.shortName} post ${pp1Runs}/${pp1Wkts} in the Powerplay`,
      detail: starBat1
        ? `${starBat1.playerName} attacks the two-fielder circle early.`
        : `${firstTeam.shortName} set the early tone in overs 1–6.`,
      progressPct: 16,
    });
  }

  const afterMidRuns = pp1Runs + (mid1?.runs ?? Math.max(0, firstCard.runs - pp1Runs - 40));
  const afterMidWkts = pp1Wkts + (mid1?.wickets ?? Math.max(0, firstCard.wickets - pp1Wkts));
  events.push({
    id: 'h-inn1-mid',
    inningsNumber: 1,
    phase: 'MIDDLE',
    overLabel: '15.0',
    teamId: firstTeam.id,
    scoreSnapshot: `${afterMidRuns}/${Math.min(10, afterMidWkts)}`,
    runRateSnapshot: (afterMidRuns / 15).toFixed(2),
    requiredRateSnapshot: null,
    badge:
      starBat1 && starBat1.runs >= 50
        ? 'FIFTY'
        : (firstCard.collapseEvents ?? 0) > 0 && afterMidRuns >= 105
          ? 'RECOVERY'
          : '100 UP!',
    title:
      starBat1 && starBat1.runs >= 50
        ? `${starBat1.playerName} anchors Middle Overs en route to ${starBat1.runs}`
        : `${firstTeam.shortName} reach ${afterMidRuns}/${Math.min(10, afterMidWkts)} after 15 overs`,
    detail: `Middle Overs (7–15): ${mid1?.runs ?? 65}/${mid1?.wickets ?? 2} · Strike rotation & spin test.`,
    progressPct: 32,
  });

  if ((death1?.runs ?? 0) >= 54 || (starBowl1 && starBowl1.wickets >= 2)) {
    const deathRuns = death1?.runs ?? Math.max(0, firstCard.runs - afterMidRuns);
    const isDeathSurge = deathRuns >= 55;
    events.push({
      id: 'h-inn1-death',
      inningsNumber: 1,
      phase: 'DEATH',
      overLabel: String(firstCard.overs),
      teamId: firstTeam.id,
      scoreSnapshot: `${firstCard.runs}/${firstCard.wickets}`,
      runRateSnapshot: firstCard.runRate.toFixed(2),
      requiredRateSnapshot: null,
      badge: isDeathSurge
        ? 'DEATH SURGE'
        : starBowl1 && starBowl1.wickets >= 3
          ? '3 WICKETS'
          : 'WICKET!',
      title: isDeathSurge
        ? `Death-overs blitz! ${deathRuns} runs plundered in overs 16–20`
        : `${starBowl1?.playerName ?? secondTeam.shortName} closes out strongly (${starBowl1?.wickets ?? 2}/${starBowl1?.runsConceded ?? 28})`,
      detail: `${firstTeam.shortName} finish on ${firstCard.runs}/${firstCard.wickets} (${firstCard.overs} ov). Target set: ${firstCard.runs + 1}.`,
      progressPct: 48,
    });
  }

  const target = firstCard.runs + 1;
  const starBat2 = [...secondCard.batting].sort((a, b) => b.runs - a.runs)[0];
  const starBowl2 = [...secondCard.bowling].sort(
    (a, b) => b.wickets - a.wickets || a.economy - b.economy
  )[0];
  const pp2 = secondCard.phaseSplits?.find((p) => p.phase === 'POWERPLAY');
  const mid2 = secondCard.phaseSplits?.find((p) => p.phase === 'MIDDLE');
  const death2 = secondCard.phaseSplits?.find((p) => p.phase === 'DEATH');

  const pp2Runs = pp2?.runs ?? Math.min(secondCard.runs, 48);
  const pp2Wkts = pp2?.wickets ?? Math.min(secondCard.wickets, 1);
  const reqAfterPp = Math.max(1.0, (target - pp2Runs) / 14).toFixed(2);
  events.push({
    id: 'h-inn2-pp',
    inningsNumber: 2,
    phase: 'POWERPLAY',
    overLabel: '6.0',
    teamId: secondTeam.id,
    scoreSnapshot: `${pp2Runs}/${pp2Wkts}`,
    runRateSnapshot: (pp2?.runRate ?? pp2Runs / 6).toFixed(2),
    requiredRateSnapshot: reqAfterPp,
    badge: pp2Wkts >= 3 ? 'COLLAPSE ALERT' : '50 PARTNERSHIP',
    title:
      pp2Wkts >= 3
        ? `Powerplay tremors! ${secondTeam.shortName} ${pp2Runs}/${pp2Wkts} chasing ${target}`
        : `${secondTeam.shortName} close Powerplay at ${pp2Runs}/${pp2Wkts}`,
    detail: `Chasing ${target} · Required rate now ${reqAfterPp} RPO.`,
    progressPct: 62,
  });

  if (impactSub) {
    const midSnapRuns = Math.min(secondCard.runs, pp2Runs + Math.round((mid2?.runs ?? 60) * 0.55));
    const req = Math.max(2.0, (target - midSnapRuns) / 9).toFixed(2);
    events.push({
      id: 'h-impact-sub',
      inningsNumber: 2,
      phase: 'MIDDLE',
      overLabel: impactSub.overLabel,
      teamId: impactSub.teamId,
      scoreSnapshot: `${midSnapRuns}/${Math.min(secondCard.wickets, 3)}`,
      runRateSnapshot: secondCard.runRate.toFixed(2),
      requiredRateSnapshot: req,
      badge: 'IMPACT PLAYER ACTIVATED',
      title: `IMPACT SUB: ${impactSub.inPlayerName} replaces ${impactSub.outPlayerName}`,
      detail: impactSub.wasFifthOverseas
        ? `5th Overseas Impact tactical call activated at ${impactSub.overLabel} overs.`
        : `Situational Impact Player brought on at ${impactSub.overLabel} overs.`,
      progressPct: 74,
    });
  }

  const afterMid2Runs = Math.min(secondCard.runs, pp2Runs + (mid2?.runs ?? 60));
  const afterMid2Wkts = Math.min(secondCard.wickets, pp2Wkts + (mid2?.wickets ?? 2));
  const reqAfter15 = Math.max(0.5, (target - afterMid2Runs) / 5).toFixed(2);

  if ((death2?.runs ?? 0) >= 52 && winnerId === secondTeam.id) {
    events.push({
      id: 'h-inn2-death',
      inningsNumber: 2,
      phase: 'DEATH',
      overLabel: '16.4',
      teamId: secondTeam.id,
      scoreSnapshot: `${afterMid2Runs}/${afterMid2Wkts}`,
      runRateSnapshot: (afterMid2Runs / 15).toFixed(2),
      requiredRateSnapshot: reqAfter15,
      badge: 'DEATH SURGE',
      title: `${starBat2?.playerName ?? secondTeam.shortName} ignites Death Overs chase`,
      detail: `${death2?.runs ?? 55} runs smashed in the final phase to hunt down ${target}.`,
      progressPct: 88,
    });
  } else if (starBat2 && starBat2.runs >= 50) {
    events.push({
      id: 'h-inn2-milestone',
      inningsNumber: 2,
      phase: 'MIDDLE',
      overLabel: '15.0',
      teamId: secondTeam.id,
      scoreSnapshot: `${afterMid2Runs}/${afterMid2Wkts}`,
      runRateSnapshot: (afterMid2Runs / 15).toFixed(2),
      requiredRateSnapshot: reqAfter15,
      badge: starBat2.runs >= 100 ? 'CENTURY' : 'FIFTY',
      title: `${starBat2.playerName} anchors the chase with ${starBat2.runs}`,
      detail: `${starBat2.playerName} hits ${starBat2.fours} fours & ${starBat2.sixes} sixes off ${starBat2.balls} balls.`,
      progressPct: 88,
    });
  } else if (starBowl2 && starBowl2.wickets >= 2) {
    events.push({
      id: 'h-inn2-wicket',
      inningsNumber: 2,
      phase: 'DEATH',
      overLabel: '17.2',
      teamId: secondTeam.id,
      scoreSnapshot: `${afterMid2Runs}/${afterMid2Wkts}`,
      runRateSnapshot: secondCard.runRate.toFixed(2),
      requiredRateSnapshot: reqAfter15,
      badge: starBowl2.wickets >= 3 ? '3 WICKETS' : 'WICKET!',
      title: `${starBowl2.playerName} turns the screw with ${starBowl2.wickets}/${starBowl2.runsConceded}`,
      detail: `Crucial strikes through the middle & death overs keep ${firstTeam.shortName} in front.`,
      progressPct: 88,
    });
  }

  const winTeamName = winnerId === firstTeam.id ? firstTeam.shortName : secondTeam.shortName;
  events.push({
    id: 'h-result',
    inningsNumber: 2,
    phase: 'DEATH',
    overLabel: String(secondCard.overs),
    teamId: secondTeam.id,
    scoreSnapshot: `${secondCard.runs}/${secondCard.wickets}`,
    runRateSnapshot: secondCard.runRate.toFixed(2),
    requiredRateSnapshot: '0.00',
    badge: 'VICTORY!',
    title: `${winTeamName} seal it — ${marginText}`,
    detail: `${firstTeam.shortName} ${firstCard.runs}/${firstCard.wickets} vs ${secondTeam.shortName} ${secondCard.runs}/${secondCard.wickets}.`,
    progressPct: 100,
  });

  return events;
}

export function buildMatchResultFromInnings(params: {
  simulationVersion?: string;
  matchSeed?: string | number;
  firstTeam: SeasonTeam | EngineTeam;
  secondTeam: SeasonTeam | EngineTeam;
  firstSummary: InningsSummary;
  firstScorecard: InningsScorecard;
  secondSummary: InningsSummary;
  secondScorecard: InningsScorecard;
  pitchCondition: PitchCondition;
  toss?: TossInfo;
  impactSub?: ImpactSubstitution;
  playerForms?: Record<string, PlayerForm>;
  injuredPlayerIds?: string[];
  rng: () => number;
}): MatchResult {
  const {
    simulationVersion = SIMULATION_VERSION,
    matchSeed,
    firstTeam,
    secondTeam,
    firstSummary,
    firstScorecard,
    secondSummary,
    secondScorecard,
    pitchCondition,
    toss,
    impactSub,
    playerForms = {},
    injuredPlayerIds = [],
    rng,
  } = params;

  const cleanFirst = toEngineTeam(firstTeam);
  const cleanSecond = toEngineTeam(secondTeam);

  const target = firstSummary.runs + 1;
  let winnerId: SeasonTeamId;
  let loserId: SeasonTeamId;
  let marginText: string;
  let superOver = false;
  let superOverCount = 0;
  let superOverHistory: SuperOverSummary[] | undefined;

  if (secondSummary.runs >= target) {
    const wicketsLeft = Math.max(1, 10 - secondSummary.wickets);
    winnerId = cleanSecond.id;
    loserId = cleanFirst.id;
    marginText = `Win by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`;
  } else if (secondSummary.runs === firstSummary.runs) {
    superOver = true;
    const so = resolveSuperOvers({
      firstTeam: cleanFirst,
      secondTeam: cleanSecond,
      pitchCondition,
      playerForms,
      injuredPlayerIds,
      rng,
    });
    winnerId = so.winnerId;
    loserId = so.loserId;
    superOverHistory = so.superOverHistory;
    superOverCount = so.superOverHistory.length;
    marginText =
      superOverCount > 1 ? `Won in ${superOverCount}x Super Over` : 'Won in Super Over';
  } else {
    const deficit = firstSummary.runs - secondSummary.runs;
    winnerId = cleanFirst.id;
    loserId = cleanSecond.id;
    marginText = `Win by ${deficit} run${deficit === 1 ? '' : 's'}`;
  }

  const matchPerf = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      teamId: SeasonTeamId;
      impactPoints: number;
      batSummary: string;
      bowlSummary: string;
      isImpactIn: boolean;
    }
  >();

  const registerBat = (line: BatterScorecardLine, teamId: SeasonTeamId) => {
    const prev = matchPerf.get(line.playerId) ?? {
      playerId: line.playerId,
      playerName: line.playerName,
      teamId,
      impactPoints: 0,
      batSummary: '',
      bowlSummary: '',
      isImpactIn: Boolean(line.isImpactIn),
    };
    prev.impactPoints = Number((prev.impactPoints + line.impactPoints).toFixed(1));
    prev.batSummary = `${line.runs}(${line.balls})`;
    if (line.isImpactIn) prev.isImpactIn = true;
    matchPerf.set(line.playerId, prev);
  };

  const registerBowl = (line: BowlerScorecardLine, teamId: SeasonTeamId) => {
    const prev = matchPerf.get(line.playerId) ?? {
      playerId: line.playerId,
      playerName: line.playerName,
      teamId,
      impactPoints: 0,
      batSummary: '',
      bowlSummary: '',
      isImpactIn: Boolean(line.isImpactIn),
    };
    prev.impactPoints = Number((prev.impactPoints + line.impactPoints).toFixed(1));
    prev.bowlSummary = `${line.wickets}/${line.runsConceded}`;
    if (line.isImpactIn) prev.isImpactIn = true;
    matchPerf.set(line.playerId, prev);
  };

  firstScorecard.batting.forEach((l) => registerBat(l, cleanFirst.id));
  firstScorecard.bowling.forEach((l) => registerBowl(l, cleanSecond.id));
  secondScorecard.batting.forEach((l) => registerBat(l, cleanSecond.id));
  secondScorecard.bowling.forEach((l) => registerBowl(l, cleanFirst.id));

  const allPerfs = Array.from(matchPerf.values()).sort(
    (a, b) => b.impactPoints - a.impactPoints
  );
  const winningPerfs = allPerfs.filter((p) => p.teamId === winnerId);
  const potmRaw = winningPerfs[0] ?? allPerfs[0];
  const bestImpactRaw =
    allPerfs.find((p) => p.isImpactIn && p.impactPoints >= 25) ?? allPerfs[0];

  const formatSummary = (p: typeof potmRaw) =>
    [p.batSummary, p.bowlSummary].filter(Boolean).join(' & ') || `${p.impactPoints} IMP`;

  const playerOfTheMatch = potmRaw
    ? {
        playerId: potmRaw.playerId,
        playerName: potmRaw.playerName,
        teamId: potmRaw.teamId,
        summary: formatSummary(potmRaw),
        impactPoints: potmRaw.impactPoints,
      }
    : undefined;

  const bestImpact = bestImpactRaw
    ? {
        playerId: bestImpactRaw.playerId,
        playerName: bestImpactRaw.playerName,
        teamId: bestImpactRaw.teamId,
        summary: formatSummary(bestImpactRaw),
        impactPoints: bestImpactRaw.impactPoints,
      }
    : undefined;

  const keyMoment = impactSub
    ? `Impact Player ${impactSub.inPlayerName} entered at ${impactSub.overLabel} ov and swung momentum.`
    : potmRaw
      ? `${potmRaw.playerName}'s ${formatSummary(potmRaw)} proved decisive (${marginText}).`
      : marginText;

  const highlights = buildHighlightsTimeline({
    firstTeam: cleanFirst,
    secondTeam: cleanSecond,
    firstCard: firstScorecard,
    secondCard: secondScorecard,
    winnerId,
    marginText,
    impactSub,
  });

  return {
    simulationVersion,
    matchSeed,
    battingFirstTeamId: cleanFirst.id,
    battingSecondTeamId: cleanSecond.id,
    firstInnings: firstSummary,
    secondInnings: secondSummary,
    winnerId,
    loserId,
    marginText,
    superOver,
    superOverCount,
    superOverHistory,
    pitchCondition,
    toss,
    firstScorecard,
    secondScorecard,
    highlights,
    playerOfTheMatch,
    bestImpact,
    keyMoment,
    impactSub,
  };
}

function getAllPitchValues(): PitchCondition[] {
  return [
    'BATTING_PARADISE',
    'BALANCED',
    'SPIN_FRIENDLY',
    'PACE_SEAMER',
    'SLOW_AND_LOW',
    'SWINGING',
  ];
}

export function createMatchState(params: CreateMatchStateParams): MatchEngineState {
  const rng = createSeededRng(params.matchSeed);
  const teamA = toEngineTeam(params.teamA);
  const teamB = toEngineTeam(params.teamB);
  const playerForms = { ...(params.playerForms ?? {}) };
  const injuredPlayerIds = [...(params.injuredPlayerIds ?? [])];
  const difficulty = params.difficulty ?? 'STANDARD';

  const pitches = getAllPitchValues();
  const pitchCondition =
    params.pitchCondition ?? pitches[Math.floor(rng.next() * pitches.length) % pitches.length];

  const toss: TossInfo = params.toss ?? {
    callerTeamId: teamA.id,
    call: 'HEADS',
    outcome: rng.next() < 0.5 ? 'HEADS' : 'TAILS',
    winnerTeamId: rng.next() < 0.5 ? teamA.id : teamB.id,
    decision: rng.next() < 0.5 ? 'BAT' : 'BOWL',
  };

  const winnerIsA = toss.winnerTeamId === teamA.id;
  const aBatsFirst = toss.decision === 'BAT' ? winnerIsA : !winnerIsA;
  let firstTeam = aBatsFirst ? teamA : teamB;
  let secondTeam = aBatsFirst ? teamB : teamA;

  const impactSubByTeam: Partial<Record<SeasonTeamId, ImpactSubstitution>> = {};
  const impactInPlayerByTeam: Partial<Record<SeasonTeamId, PlayerSeasonRecord>> = {};
  if (params.impactSub && params.impactInPlayer) {
    impactSubByTeam[params.impactSub.teamId] = params.impactSub;
    impactInPlayerByTeam[params.impactSub.teamId] = params.impactInPlayer;
    firstTeam = applyImpactRosterSwap(firstTeam, params.impactSub, params.impactInPlayer);
    secondTeam = applyImpactRosterSwap(secondTeam, params.impactSub, params.impactInPlayer);
  }

  const firstInnings = createInningsEngineState({
    battingTeam: firstTeam,
    bowlingTeam: secondTeam,
    pitchCondition,
    playerForms,
    injuredPlayerIds,
    difficulty,
    subForBatting: impactSubByTeam[firstTeam.id],
    subForBowling: impactSubByTeam[secondTeam.id],
    rng: rng.next,
  });

  return {
    simulationVersion: SIMULATION_VERSION,
    matchId: params.matchId ?? `match-${params.matchSeed}`,
    matchSeed: params.matchSeed,
    rngState: rng.getState(),
    status: 'IN_PROGRESS',
    teamA,
    teamB,
    benchA: [...(params.benchA ?? [])],
    benchB: [...(params.benchB ?? [])],
    pitchCondition,
    toss,
    inningsNumber: 1,
    firstInnings,
    firstSummary: null,
    firstScorecard: null,
    secondInnings: null,
    secondSummary: null,
    secondScorecard: null,
    impactSubByTeam,
    impactInPlayerByTeam,
    injuredPlayerIds,
    playerForms,
    difficulty,
    superOverHistory: [],
    result: null,
  };
}

function assertMatchMutable(state: MatchEngineState): void {
  if (state.status === 'COMPLETED') {
    throw new Error('Completed match is immutable and cannot be re-run.');
  }
}

function finalizeMatchFromCompletedSecondInnings(
  state: MatchEngineState,
  rng: ReturnType<typeof createSeededRng>
): MatchEngineState {
  if (!state.firstSummary || !state.firstScorecard || !state.secondInnings) {
    return state;
  }
  const out2 = finalizeInningsOutput(state.secondInnings);
  const firstImpact = state.impactSubByTeam[state.firstInnings.battingTeam.id];
  const secondImpact = state.impactSubByTeam[state.secondInnings.battingTeam.id];
  const anyImpact = secondImpact ?? firstImpact;

  const result = buildMatchResultFromInnings({
    simulationVersion: state.simulationVersion,
    matchSeed: state.matchSeed,
    firstTeam: state.firstInnings.battingTeam,
    secondTeam: state.secondInnings.battingTeam,
    firstSummary: state.firstSummary,
    firstScorecard: state.firstScorecard,
    secondSummary: out2.summary,
    secondScorecard: out2.scorecard,
    pitchCondition: state.pitchCondition,
    toss: state.toss,
    impactSub: anyImpact,
    playerForms: state.playerForms,
    injuredPlayerIds: state.injuredPlayerIds,
    rng: rng.next,
  });

  return {
    ...state,
    rngState: rng.getState(),
    status: 'COMPLETED',
    secondSummary: out2.summary,
    secondScorecard: out2.scorecard,
    superOverHistory: result.superOverHistory ?? [],
    result,
  };
}

function transitionToSecondInnings(
  state: MatchEngineState,
  rng: ReturnType<typeof createSeededRng>
): MatchEngineState {
  const out1 = finalizeInningsOutput(state.firstInnings);
  const firstTeam = applyImpactRosterSwap(
    state.firstInnings.battingTeam,
    state.impactSubByTeam[state.firstInnings.battingTeam.id],
    state.impactInPlayerByTeam[state.firstInnings.battingTeam.id]
  );
  const secondTeam = applyImpactRosterSwap(
    state.firstInnings.bowlingTeam,
    state.impactSubByTeam[state.firstInnings.bowlingTeam.id],
    state.impactInPlayerByTeam[state.firstInnings.bowlingTeam.id]
  );

  const secondInnings = createInningsEngineState({
    battingTeam: secondTeam,
    bowlingTeam: firstTeam,
    target: out1.summary.runs + 1,
    pitchCondition: state.pitchCondition,
    playerForms: state.playerForms,
    injuredPlayerIds: state.injuredPlayerIds,
    difficulty: state.difficulty,
    subForBatting: state.impactSubByTeam[secondTeam.id],
    subForBowling: state.impactSubByTeam[firstTeam.id],
    rng: rng.next,
  });

  return {
    ...state,
    rngState: rng.getState(),
    inningsNumber: 2,
    firstSummary: out1.summary,
    firstScorecard: out1.scorecard,
    secondInnings,
  };
}

export function simulateDelivery(
  state: MatchEngineState,
  options?: {
    bowlerId?: string;
    planId?: BowlingPlanId;
    aggressionMode?: BattingAggressionMode;
    autoStartSecondInnings?: boolean;
  }
): {
  nextState: MatchEngineState;
  delivery: DeliveryEvent;
  completedOverSummary: OverSummaryLine | null;
} {
  assertMatchMutable(state);
  const rng = createSeededRng(state.matchSeed, state.rngState);

  if (state.inningsNumber === 1) {
    const step = stepInningsDelivery(state.firstInnings, {
      bowlerId: options?.bowlerId,
      planId: options?.planId,
      aggressionMode: options?.aggressionMode,
      rng: rng.next,
    });
    let next: MatchEngineState = {
      ...state,
      rngState: rng.getState(),
      firstInnings: step.nextState,
    };
    if (step.nextState.isCompleted && (options?.autoStartSecondInnings ?? true)) {
      next = transitionToSecondInnings(next, rng);
    }
    return {
      nextState: next,
      delivery: step.delivery,
      completedOverSummary: step.completedOverSummary,
    };
  }

  if (!state.secondInnings) {
    throw new Error('Second innings has not started.');
  }

  const step = stepInningsDelivery(state.secondInnings, {
    bowlerId: options?.bowlerId,
    planId: options?.planId,
    aggressionMode: options?.aggressionMode,
    rng: rng.next,
  });
  let next: MatchEngineState = {
    ...state,
    rngState: rng.getState(),
    secondInnings: step.nextState,
  };
  if (step.nextState.isCompleted) {
    next = finalizeMatchFromCompletedSecondInnings(next, rng);
  }
  return {
    nextState: next,
    delivery: step.delivery,
    completedOverSummary: step.completedOverSummary,
  };
}

export function simulateOver(
  state: MatchEngineState,
  options?: {
    bowlerId?: string;
    planId?: BowlingPlanId;
    aggressionMode?: BattingAggressionMode;
    autoStartSecondInnings?: boolean;
  }
): {
  nextState: MatchEngineState;
  overSummary: OverSummaryLine | null;
  deliveries: DeliveryEvent[];
} {
  assertMatchMutable(state);
  const rng = createSeededRng(state.matchSeed, state.rngState);

  if (state.inningsNumber === 1) {
    const step = simulateInningsOver(state.firstInnings, {
      bowlerId: options?.bowlerId,
      planId: options?.planId,
      aggressionMode: options?.aggressionMode,
      rng: rng.next,
    });
    let next: MatchEngineState = {
      ...state,
      rngState: rng.getState(),
      firstInnings: step.nextState,
    };
    if (step.nextState.isCompleted && (options?.autoStartSecondInnings ?? true)) {
      next = transitionToSecondInnings(next, rng);
    }
    return {
      nextState: next,
      overSummary: step.overSummary,
      deliveries: step.deliveries,
    };
  }

  if (!state.secondInnings) {
    throw new Error('Second innings has not started.');
  }

  const step = simulateInningsOver(state.secondInnings, {
    bowlerId: options?.bowlerId,
    planId: options?.planId,
    aggressionMode: options?.aggressionMode,
    rng: rng.next,
  });
  let next: MatchEngineState = {
    ...state,
    rngState: rng.getState(),
    secondInnings: step.nextState,
  };
  if (step.nextState.isCompleted) {
    next = finalizeMatchFromCompletedSecondInnings(next, rng);
  }
  return {
    nextState: next,
    overSummary: step.overSummary,
    deliveries: step.deliveries,
  };
}

export function applyImpactSubstitution(
  state: MatchEngineState,
  teamId: SeasonTeamId,
  inPlayer: PlayerSeasonRecord,
  outPlayer: PlayerSeasonRecord,
  maxStandardOverseas: number = 4
): MatchEngineState {
  assertMatchMutable(state);

  if (state.impactSubByTeam[teamId]) {
    throw new Error(`Team ${teamId} has already used its Impact Player substitution.`);
  }
  if (inPlayer.playerId === outPlayer.playerId) {
    throw new Error('Incoming and outgoing Impact Players must be different.');
  }
  if (state.injuredPlayerIds.includes(inPlayer.playerId)) {
    throw new Error('Injured player cannot enter as Impact Player.');
  }

  const activeInnings =
    state.inningsNumber === 2 && state.secondInnings ? state.secondInnings : state.firstInnings;
  const activeRoster =
    activeInnings.battingTeam.id === teamId
      ? activeInnings.battingTeam.players
      : activeInnings.bowlingTeam.players;

  if (!activeRoster.some((p) => p.playerId === outPlayer.playerId)) {
    throw new Error('Outgoing player must be in the active XI.');
  }

  const overseasInXi = activeRoster.filter((p) => p.isOverseas === true).length;
  const willBeOverseas =
    overseasInXi - (outPlayer.isOverseas === true ? 1 : 0) + (inPlayer.isOverseas === true ? 1 : 0);
  if (willBeOverseas > maxStandardOverseas + 1) {
    throw new Error(
      `Cannot exceed ${maxStandardOverseas + 1} overseas players even with Impact Player.`
    );
  }

  const wasFifthOverseas =
    overseasInXi >= maxStandardOverseas &&
    inPlayer.isOverseas === true &&
    outPlayer.isOverseas !== true;

  const overLabel = activeInnings.isCompleted
    ? '0.0 (Inn 2)'
    : String(ballsToCricketOvers(activeInnings.legalBalls));

  const sub: ImpactSubstitution = {
    teamId,
    inPlayerId: inPlayer.playerId,
    inPlayerName: inPlayer.playerName,
    outPlayerId: outPlayer.playerId,
    outPlayerName: outPlayer.playerName,
    overLabel,
    wasFifthOverseas,
  };

  const nextSubByTeam = { ...state.impactSubByTeam, [teamId]: sub };
  const nextInByTeam = { ...state.impactInPlayerByTeam, [teamId]: inPlayer };

  let nextFirst = state.firstInnings;
  let nextSecond = state.secondInnings;

  if (state.inningsNumber === 1) {
    nextFirst = applyImpactPlayerToInnings(state.firstInnings, sub, inPlayer);
    nextFirst = {
      ...nextFirst,
      battingTeam: applyImpactRosterSwap(nextFirst.battingTeam, sub, inPlayer),
      bowlingTeam: applyImpactRosterSwap(nextFirst.bowlingTeam, sub, inPlayer),
    };
  } else if (state.secondInnings) {
    nextSecond = applyImpactPlayerToInnings(state.secondInnings, sub, inPlayer);
    nextSecond = {
      ...nextSecond,
      battingTeam: applyImpactRosterSwap(nextSecond.battingTeam, sub, inPlayer),
      bowlingTeam: applyImpactRosterSwap(nextSecond.bowlingTeam, sub, inPlayer),
    };
  }

  return {
    ...state,
    firstInnings: nextFirst,
    secondInnings: nextSecond,
    impactSubByTeam: nextSubByTeam,
    impactInPlayerByTeam: nextInByTeam,
  };
}

export function serializeMatchState(state: MatchEngineState): string {
  return JSON.stringify(state);
}

export function restoreMatchState(serialized: string | MatchEngineState): MatchEngineState {
  const parsed: MatchEngineState =
    typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  if (!parsed || parsed.simulationVersion !== SIMULATION_VERSION) {
    throw new Error(
      `Unsupported match simulationVersion: ${parsed?.simulationVersion ?? 'unknown'}`
    );
  }
  return parsed;
}

export function simulateFullMatch(params: CreateMatchStateParams): {
  finalState: MatchEngineState;
  result: MatchResult;
} {
  let state = createMatchState(params);
  let guard = 0;
  while (state.status !== 'COMPLETED' && guard < 60) {
    guard += 1;
    state = simulateOver(state).nextState;
  }
  if (!state.result) {
    throw new Error('Failed to finalize full match simulation.');
  }
  return { finalState: state, result: state.result };
}

export const CricketMatchEngine = {
  simulationVersion: SIMULATION_VERSION,
  createMatchState,
  simulateDelivery,
  simulateOver,
  simulateFullMatch,
  selectBowler,
  selectBowlingPlan,
  selectBattingAggression,
  applyImpactSubstitution,
  resolveSuperOvers,
  serializeMatchState,
  restoreMatchState,
};
