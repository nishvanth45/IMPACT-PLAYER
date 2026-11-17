import type {
  BatterScorecardLine,
  BowlerScorecardLine,
  ImpactRecommendation,
  ImpactSituationType,
  ImpactSubstitution,
  InningsScorecard,
  InningsSummary,
  MatchHighlightEvent,
  MatchResult,
  PitchCondition,
  PlayerForm,
  PlayerSeasonRecord,
  SeasonTeam,
  SeasonTeamId,
  TossInfo,
} from '../types/game';
import {
  SIMULATION_VERSION,
  buildMatchResultFromInnings,
} from './cricketMatchEngine';
import {
  resolveSituationalPlayerRatings,
} from './inningsSim';
import { getEffectiveMatchRatings } from './ratingEngine';
import { SIM_CONFIG } from './simConfig';

export interface PitchConditionMeta {
  id: PitchCondition;
  label: string;
  shortLabel: string;
  expectedParRange: [number, number];
  summary: string;
  keyAdvantage: string;
  threat: string;
  tossHint: string;
  battingBias: number;
  bowlingBias: number;
}

export const PITCH_CONDITIONS: Record<PitchCondition, PitchConditionMeta> = {
  BATTING_PARADISE: {
    id: 'BATTING_PARADISE',
    label: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.label,
    shortLabel: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.threat,
    tossHint: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.BATTING_PARADISE.bowlingBias,
  },
  BALANCED: {
    id: 'BALANCED',
    label: SIM_CONFIG.pitchProfiles.BALANCED.label,
    shortLabel: SIM_CONFIG.pitchProfiles.BALANCED.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.BALANCED.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.BALANCED.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.BALANCED.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.BALANCED.threat,
    tossHint: SIM_CONFIG.pitchProfiles.BALANCED.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.BALANCED.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.BALANCED.bowlingBias,
  },
  SPIN_FRIENDLY: {
    id: 'SPIN_FRIENDLY',
    label: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.label,
    shortLabel: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.threat,
    tossHint: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.SPIN_FRIENDLY.bowlingBias,
  },
  PACE_SEAMER: {
    id: 'PACE_SEAMER',
    label: SIM_CONFIG.pitchProfiles.PACE_SEAMER.label,
    shortLabel: SIM_CONFIG.pitchProfiles.PACE_SEAMER.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.PACE_SEAMER.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.PACE_SEAMER.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.PACE_SEAMER.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.PACE_SEAMER.threat,
    tossHint: SIM_CONFIG.pitchProfiles.PACE_SEAMER.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.PACE_SEAMER.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.PACE_SEAMER.bowlingBias,
  },
  SLOW_AND_LOW: {
    id: 'SLOW_AND_LOW',
    label: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.label,
    shortLabel: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.threat,
    tossHint: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.SLOW_AND_LOW.bowlingBias,
  },
  SWINGING: {
    id: 'SWINGING',
    label: SIM_CONFIG.pitchProfiles.SWINGING.label,
    shortLabel: SIM_CONFIG.pitchProfiles.SWINGING.shortLabel,
    expectedParRange: SIM_CONFIG.pitchProfiles.SWINGING.expectedParRange,
    summary: SIM_CONFIG.pitchProfiles.SWINGING.summary,
    keyAdvantage: SIM_CONFIG.pitchProfiles.SWINGING.keyAdvantage,
    threat: SIM_CONFIG.pitchProfiles.SWINGING.threat,
    tossHint: SIM_CONFIG.pitchProfiles.SWINGING.tossHint,
    battingBias: SIM_CONFIG.pitchProfiles.SWINGING.battingBias,
    bowlingBias: SIM_CONFIG.pitchProfiles.SWINGING.bowlingBias,
  },
};

export function getPitchConditionForVenue(
  venue: string,
  rng: () => number = Math.random
): PitchCondition {
  const lower = venue.toLowerCase();
  const r = rng();
  if (lower.includes('chinnaswamy') || lower.includes('wankhede') || lower.includes('eden')) {
    if (r < 0.52) return 'BATTING_PARADISE';
    if (r < 0.72) return 'BALANCED';
    return 'SWINGING';
  }
  if (lower.includes('chidambaram') || lower.includes('ekana') || lower.includes('jaipur')) {
    if (r < 0.45) return 'SPIN_FRIENDLY';
    if (r < 0.75) return 'SLOW_AND_LOW';
    return 'BALANCED';
  }
  if (lower.includes('mullanpur') || lower.includes('narendra modi') || lower.includes('hyderabad') || lower.includes('dharamshala')) {
    if (r < 0.36) return 'PACE_SEAMER';
    if (r < 0.6) return 'SWINGING';
    if (r < 0.82) return 'BALANCED';
    return 'BATTING_PARADISE';
  }
  const all: PitchCondition[] = [
    'BATTING_PARADISE',
    'BALANCED',
    'SPIN_FRIENDLY',
    'PACE_SEAMER',
    'SLOW_AND_LOW',
    'SWINGING',
  ];
  return all[Math.floor(r * all.length) % all.length];
}

export function resolveToss(
  userTeamId: SeasonTeamId,
  opponentTeamId: SeasonTeamId,
  userCall: 'HEADS' | 'TAILS',
  pitchCondition: PitchCondition,
  rng: () => number = Math.random
): TossInfo {
  const outcome: 'HEADS' | 'TAILS' = rng() < 0.5 ? 'HEADS' : 'TAILS';
  const userWon = outcome === userCall;
  const winnerTeamId = userWon ? userTeamId : opponentTeamId;

  // Opponent automatic decision based on pitch & T20 chasing trends
  let opponentDecision: 'BAT' | 'BOWL' = 'BOWL';
  if (pitchCondition === 'SPIN_FRIENDLY' || pitchCondition === 'SLOW_AND_LOW') {
    opponentDecision = rng() < 0.64 ? 'BAT' : 'BOWL';
  } else if (pitchCondition === 'SWINGING' || pitchCondition === 'PACE_SEAMER') {
    opponentDecision = rng() < 0.78 ? 'BOWL' : 'BAT';
  } else if (pitchCondition === 'BATTING_PARADISE') {
    opponentDecision = rng() < 0.72 ? 'BOWL' : 'BAT';
  } else {
    opponentDecision = rng() < 0.55 ? 'BOWL' : 'BAT';
  }

  return {
    callerTeamId: userTeamId,
    call: userCall,
    outcome,
    winnerTeamId,
    decision: userWon ? 'BAT' : opponentDecision,
  };
}

export function applyUserTossDecision(toss: TossInfo, decision: 'BAT' | 'BOWL'): TossInfo {
  return {
    ...toss,
    decision,
  };
}

export interface ImpactEligibilityCheck {
  allowed: boolean;
  wasFifthOverseas: boolean;
  reason?: string;
}

export function checkImpactSubstitution(
  currentXi: PlayerSeasonRecord[],
  inPlayer: PlayerSeasonRecord,
  outPlayer: PlayerSeasonRecord,
  maxStandardOverseas: number = 4
): ImpactEligibilityCheck {
  if (inPlayer.playerId === outPlayer.playerId) {
    return { allowed: false, wasFifthOverseas: false, reason: 'Select two different players.' };
  }
  const overseasInXi = currentXi.filter((p) => p.isOverseas === true).length;
  const willBeOverseasCount =
    overseasInXi - (outPlayer.isOverseas === true ? 1 : 0) + (inPlayer.isOverseas === true ? 1 : 0);

  // 5th overseas Impact rule: allowed only when bringing in 1 overseas Impact Player (max 5 total)
  if (willBeOverseasCount > maxStandardOverseas + 1) {
    return {
      allowed: false,
      wasFifthOverseas: false,
      reason: `Cannot exceed ${maxStandardOverseas + 1} overseas players even with Impact Player.`,
    };
  }

  const wasFifthOverseas =
    overseasInXi >= maxStandardOverseas &&
    inPlayer.isOverseas === true &&
    outPlayer.isOverseas !== true;

  return {
    allowed: true,
    wasFifthOverseas,
  };
}

function readSituationalAttribute(
  player: PlayerSeasonRecord,
  attrKey: string,
  form: PlayerForm = 'NORMAL'
): number {
  const r = resolveSituationalPlayerRatings(player, form);
  switch (attrKey) {
    case 'technique':
      return r.batting.technique;
    case 'pressure':
      return r.batting.pressure;
    case 'consistency':
      return r.batting.consistency;
    case 'middleOvers':
      return r.batting.middleOvers;
    case 'spinHitting':
      return r.batting.spinHitting;
    case 'strikeRotation':
      return r.batting.strikeRotation;
    case 'finishing':
      return r.batting.finishing;
    case 'power':
      return r.batting.power;
    case 'deathOvers':
      return r.batting.deathOvers;
    case 'impactAbility':
      return r.batting.impactAbility;
    case 'wicketTaking':
      return r.bowling.wicketTaking;
    case 'variation':
      return r.bowling.variation;
    case 'deathBowling':
      return r.bowling.deathBowling;
    case 'control':
      return r.bowling.control;
    case 'economy':
      return r.bowling.economy;
    default:
      return r.ovrBase;
  }
}

const ATTR_DISPLAY_LABELS: Record<string, string> = {
  technique: 'Technique',
  pressure: 'Pressure',
  consistency: 'Consistency',
  middleOvers: 'Mid Overs Bat',
  spinHitting: 'Spin Hitting',
  strikeRotation: 'Strike Rotation',
  finishing: 'Finishing',
  power: 'Power',
  deathOvers: 'Death Bat',
  impactAbility: 'Impact',
  wicketTaking: 'Wicket Taking',
  variation: 'Variation',
  deathBowling: 'Death Bowl',
  control: 'Control',
  economy: 'Economy',
};

/**
 * Recommends the best Impact Player from the 4-man bench for the exact match situation + pitch conditions.
 * Prioritizes situational attributes over raw OVR so lower-OVR specialists win when appropriate.
 */
export function recommendImpactPlayer(params: {
  situation: ImpactSituationType;
  benchPlayers: PlayerSeasonRecord[];
  activeXi: PlayerSeasonRecord[];
  playerForms?: Record<string, PlayerForm>;
  maxStandardOverseas?: number;
  pitchCondition?: PitchCondition;
}): ImpactRecommendation[] {
  const {
    situation,
    benchPlayers,
    activeXi,
    playerForms = {},
    maxStandardOverseas = 4,
    pitchCondition = 'BALANCED',
  } = params;
  const cfg = SIM_CONFIG.impactRecommendation[situation];

  const scored = benchPlayers.map((benchPlayer) => {
    const form = playerForms[benchPlayer.playerId] ?? benchPlayer.form ?? 'NORMAL';
    let weightedSum = 0;
    const keyAttributes: Array<{ label: string; value: number; weight: number }> = [];

    for (const [key, weight] of Object.entries(cfg.weights)) {
      const val = readSituationalAttribute(benchPlayer, key, form);
      weightedSum += val * weight;
      keyAttributes.push({
        label: ATTR_DISPLAY_LABELS[key] ?? key,
        value: val,
        weight,
      });
    }

    // Gentle discipline relevance adjustment
    if (cfg.preferRole === 'BAT_SPECIALIST' && benchPlayer.role === 'BOWL') {
      weightedSum -= 18;
    } else if (
      cfg.preferRole === 'BOWL_SPECIALIST' &&
      (benchPlayer.role === 'BAT' || benchPlayer.role === 'WK')
    ) {
      weightedSum -= 20;
    }

    // Pitch-aware tactical nuance (e.g. Spinner boosted on Spin Friendly, Finisher boosted on Batting Paradise)
    const isSpin = /spin|orthodox|legbreak|offbreak|chinaman|googly/i.test(
      benchPlayer.bowlingStyle || ''
    );
    const isPace =
      (benchPlayer.role === 'BOWL' || benchPlayer.role === 'AR') && !isSpin;
    const r = resolveSituationalPlayerRatings(benchPlayer, form);

    if (pitchCondition === 'SPIN_FRIENDLY') {
      if (cfg.preferRole === 'BOWL_SPECIALIST' && isSpin) weightedSum += 8.5;
      if (cfg.preferRole === 'BAT_SPECIALIST') {
        weightedSum += (r.batting.spinHitting - 72) * 0.16;
      }
    } else if (pitchCondition === 'PACE_SEAMER' || pitchCondition === 'SWINGING') {
      if (cfg.preferRole === 'BOWL_SPECIALIST' && isPace) weightedSum += 7.5;
      if (cfg.preferRole === 'BAT_SPECIALIST') {
        weightedSum += (r.batting.technique - 72) * 0.14;
      }
    } else if (pitchCondition === 'SLOW_AND_LOW') {
      if (cfg.preferRole === 'BOWL_SPECIALIST' && isSpin) weightedSum += 6;
      if (cfg.preferRole === 'BOWL_SPECIALIST') {
        weightedSum += (r.bowling.variation - 72) * 0.18;
      }
    } else if (pitchCondition === 'BATTING_PARADISE' && cfg.preferRole === 'BAT_SPECIALIST') {
      weightedSum += (r.batting.power - 72) * 0.12 + (r.batting.finishing - 72) * 0.1;
    }

    // Pick best legal OUT candidate from activeXI
    const legalOuts = activeXi
      .filter(
        (xiPlayer) =>
          checkImpactSubstitution(activeXi, benchPlayer, xiPlayer, maxStandardOverseas)
            .allowed
      )
      .sort((a, b) => {
        if (cfg.preferRole === 'BAT_SPECIALIST') {
          const aBowlPref = a.role === 'BOWL' ? -25 : 0;
          const bBowlPref = b.role === 'BOWL' ? -25 : 0;
          return a.battingRating + aBowlPref - (b.battingRating + bBowlPref);
        }
        const aBatPref = a.role === 'BAT' ? -25 : a.role === 'WK' ? -10 : 0;
        const bBatPref = b.role === 'BAT' ? -25 : b.role === 'WK' ? -10 : 0;
        return a.bowlingRating + aBatPref - (b.bowlingRating + bBatPref);
      });

    const suggestedOut = legalOuts[0] ?? null;
    keyAttributes.sort((a, b) => b.weight - a.weight);
    const topTwo = keyAttributes
      .slice(0, 2)
      .map((k) => `${k.label} ${k.value}`)
      .join(' · ');

    return {
      playerId: benchPlayer.playerId,
      playerName: benchPlayer.playerName,
      situation,
      situationLabel: cfg.label,
      tacticalScore: Number(weightedSum.toFixed(1)),
      headlineReason: `${cfg.label}: ${topTwo}`,
      keyAttributes: keyAttributes.slice(0, 3).map(({ label, value }) => ({ label, value })),
      suggestedOutId: suggestedOut?.playerId ?? null,
      suggestedOutName: suggestedOut?.playerName ?? null,
    };
  });

  return scored.sort((a, b) => b.tacticalScore - a.tacticalScore);
}

export function detectImpactSituation(params: {
  matchResult: MatchResult;
  userTeamId?: SeasonTeamId;
}): ImpactSituationType {
  const { matchResult, userTeamId = 'YOU' } = params;
  const userBatsSecond = matchResult.battingSecondTeamId === userTeamId;
  const target = matchResult.firstInnings.runs + 1;
  const secondCard = matchResult.secondScorecard;
  const ppSplit2 = secondCard?.phaseSplits?.find((p) => p.phase === 'POWERPLAY');

  if (userBatsSecond) {
    if ((ppSplit2?.wickets ?? 0) >= 3 || (secondCard?.collapseEvents ?? 0) > 0) {
      return 'POWERPLAY_COLLAPSE';
    }
    if (target >= 182) {
      return 'DEATH_FINISH';
    }
    if (
      matchResult.pitchCondition === 'SPIN_FRIENDLY' ||
      matchResult.pitchCondition === 'SLOW_AND_LOW'
    ) {
      return 'MIDDLE_VS_SPIN';
    }
    return 'DEATH_FINISH';
  }

  // User is defending in 2nd innings
  if ((secondCard?.wickets ?? 0) <= 4 && (secondCard?.runs ?? 0) >= target - 18) {
    return 'NEED_WICKETS';
  }
  return 'DEFENDING_DEATH';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function oversToBalls(overs: number): number {
  const whole = Math.floor(overs);
  const rem = Math.round((overs - whole) * 10);
  return whole * 6 + clamp(rem, 0, 5);
}

function ballsToOvers(balls: number): number {
  const whole = Math.floor(balls / 6);
  const rem = balls % 6;
  return Number((whole + rem / 10).toFixed(1));
}

function orderBattersForScorecard(
  players: PlayerSeasonRecord[],
  isUser: boolean
): PlayerSeasonRecord[] {
  // User XI is already ordered by batting order 1-11
  if (isUser) return [...players];
  const top = players
    .filter((p) => p.role === 'BAT' || p.role === 'WK')
    .sort((a, b) => b.battingRating - a.battingRating);
  const ar = players.filter((p) => p.role === 'AR').sort((a, b) => b.battingRating - a.battingRating);
  const rest = players
    .filter((p) => p.role !== 'BAT' && p.role !== 'WK' && p.role !== 'AR')
    .sort((a, b) => b.battingRating - a.battingRating);
  return [...top.slice(0, 5), ...ar, ...top.slice(5), ...rest];
}

function selectBowlingAttack(
  players: PlayerSeasonRecord[],
  playerForms: Record<string, PlayerForm>
): PlayerSeasonRecord[] {
  const ranked = [...players].sort((a, b) => {
    const aIsBowl = a.role === 'BOWL' ? 18 : a.role === 'AR' ? 9 : 0;
    const bIsBowl = b.role === 'BOWL' ? 18 : b.role === 'AR' ? 9 : 0;
    const aEff = getEffectiveMatchRatings(a, playerForms[a.playerId] ?? a.form).bowlingRating;
    const bEff = getEffectiveMatchRatings(b, playerForms[b.playerId] ?? b.form).bowlingRating;
    return bEff + bIsBowl - (aEff + aIsBowl);
  });
  return ranked.slice(0, Math.min(6, ranked.length));
}

function buildInningsScorecard(params: {
  battingTeam: SeasonTeam;
  bowlingTeam: SeasonTeam;
  summary: InningsSummary;
  playerForms: Record<string, PlayerForm>;
  impactSub?: ImpactSubstitution;
  rng: () => number;
}): InningsScorecard {
  const { battingTeam, bowlingTeam, summary, playerForms, impactSub, rng } = params;

  const totalBalls = Math.max(6, oversToBalls(summary.overs));
  const extras = clamp(Math.round(summary.runs * (0.035 + rng() * 0.03)), 2, 16);
  const runsFromBat = Math.max(0, summary.runs - extras);

  let batOrder = orderBattersForScorecard(battingTeam.players, battingTeam.isUser);
  // If batting team made an impact sub, insert Impact In player if not already in lineup
  const subForBatting = impactSub && impactSub.teamId === battingTeam.id ? impactSub : undefined;
  const subForBowling = impactSub && impactSub.teamId === bowlingTeam.id ? impactSub : undefined;

  // Determine how many batters actually batted
  const maxBattersUsed = clamp(
    summary.wickets + 2,
    2,
    Math.min(11, batOrder.length)
  );
  const activeBatters = batOrder.slice(0, maxBattersUsed);

  // Allocate runs across active batters proportional to effective battingRating + order position + randomness
  const weights = activeBatters.map((p, idx) => {
    const eff = getEffectiveMatchRatings(p, playerForms[p.playerId] ?? p.form);
    const posFactor = Math.max(0.25, 1.35 - idx * 0.11);
    const impactBoost = subForBatting && p.playerId === subForBatting.inPlayerId ? 1.35 : 1;
    const luck = 0.35 + rng() * 1.45;
    return Math.pow(eff.battingRating / 50, 1.8) * posFactor * luck * impactBoost;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const rawRuns = weights.map((w) => Math.floor((w / totalWeight) * runsFromBat));
  let remainder = runsFromBat - rawRuns.reduce((a, b) => a + b, 0);
  // Distribute remainder to top-weighted batters
  const rankedIdx = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.i);
  let rCursor = 0;
  while (remainder > 0 && rankedIdx.length > 0) {
    rawRuns[rankedIdx[rCursor % rankedIdx.length]] += 1;
    remainder -= 1;
    rCursor += 1;
  }

  // Allocate balls faced (sum <= totalBalls)
  const ballWeights = activeBatters.map((p, idx) => {
    const r = rawRuns[idx];
    const eff = getEffectiveMatchRatings(p, playerForms[p.playerId] ?? p.form);
    const expectedSr = clamp(108 + (eff.battingRating - 60) * 1.15 + (rng() - 0.5) * 28, 78, 215);
    return Math.max(2, Math.round((r / expectedSr) * 100) + (r === 0 ? 2 : 0));
  });
  const rawBallSum = ballWeights.reduce((a, b) => a + b, 0) || 1;
  const batterBalls = ballWeights.map((b) => Math.max(1, Math.round((b / rawBallSum) * totalBalls)));
  let ballDiff = totalBalls - batterBalls.reduce((a, b) => a + b, 0);
  let bCursor = 0;
  while (ballDiff !== 0 && batterBalls.length > 0) {
    const i = bCursor % batterBalls.length;
    if (ballDiff > 0) {
      batterBalls[i] += 1;
      ballDiff -= 1;
    } else if (batterBalls[i] > 1) {
      batterBalls[i] -= 1;
      ballDiff += 1;
    }
    bCursor += 1;
    if (bCursor > 500) break;
  }

  // Select bowling attack for bowlingTeam
  const bowlers = selectBowlingAttack(bowlingTeam.players, playerForms);
  const bowlerNames = bowlers.map((b) => b.playerName);

  // Determine dismissals: exact summary.wickets batters out
  const outFlags = new Array(activeBatters.length).fill(false);
  // Usually 2 batters remain not out (unless all out = 10 wickets -> 10 out, 1 not out)
  let outAssigned = 0;
  for (let i = 0; i < activeBatters.length && outAssigned < summary.wickets; i += 1) {
    // Keep one top-scoring batter not out if wickets < 10 and enough batters exist
    const isLastTwo = i >= activeBatters.length - 2;
    if (summary.wickets < 10 && isLastTwo && activeBatters.length - outAssigned <= 2) {
      continue;
    }
    outFlags[i] = true;
    outAssigned += 1;
  }
  for (let i = activeBatters.length - 1; i >= 0 && outAssigned < summary.wickets; i -= 1) {
    if (!outFlags[i]) {
      outFlags[i] = true;
      outAssigned += 1;
    }
  }

  const battingLines: BatterScorecardLine[] = activeBatters.map((p, idx) => {
    const runs = rawRuns[idx];
    const balls = batterBalls[idx];
    const sr = balls > 0 ? Number(((runs / balls) * 100).toFixed(1)) : 0;
    const sixes = runs >= 10 ? Math.min(Math.floor(runs / 6), Math.round((runs * (0.22 + rng() * 0.2)) / 6)) : 0;
    const remAfterSixes = Math.max(0, runs - sixes * 6);
    const fours = remAfterSixes >= 4 ? Math.min(Math.floor(remAfterSixes / 4), Math.round((remAfterSixes * (0.35 + rng() * 0.2)) / 4)) : 0;
    const isOut = outFlags[idx];
    const bowlerName = bowlerNames[idx % Math.max(1, bowlerNames.length)] ?? 'Bowler';
    const dismissalTypes = [
      `c sub b ${bowlerName}`,
      `b ${bowlerName}`,
      `lbw b ${bowlerName}`,
      `c & b ${bowlerName}`,
    ];
    const dismissalText = isOut
      ? dismissalTypes[Math.floor(rng() * dismissalTypes.length)]
      : 'not out';

    const srBonus = runs >= 20 && sr >= 155 ? 12 : runs >= 15 && sr >= 140 ? 6 : 0;
    const milestoneBonus = runs >= 100 ? 28 : runs >= 50 ? 14 : runs >= 30 ? 6 : 0;
    const impactPoints = Number((runs * 1.1 + sixes * 2.5 + fours * 1.2 + srBonus + milestoneBonus).toFixed(1));

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      role: p.role,
      runs,
      balls,
      fours,
      sixes,
      strikeRate: sr,
      out: isOut,
      dismissalText,
      impactPoints,
      isImpactIn: subForBatting?.inPlayerId === p.playerId,
      isSubbedOut: subForBatting?.outPlayerId === p.playerId,
    };
  });

  // Allocate bowling overs (max 24 balls = 4 overs per bowler)
  const bowlerBalls = new Array(bowlers.length).fill(0);
  let remainingBallsToBowl = totalBalls;
  let bIdx = 0;
  while (remainingBallsToBowl > 0 && bowlers.length > 0) {
    const chunk = Math.min(6, remainingBallsToBowl);
    if (bowlerBalls[bIdx % bowlers.length] + chunk <= 24) {
      bowlerBalls[bIdx % bowlers.length] += chunk;
      remainingBallsToBowl -= chunk;
    }
    bIdx += 1;
    if (bIdx > 200) break;
  }

  const activeBowlers = bowlers
    .map((p, idx) => ({ player: p, balls: bowlerBalls[idx] }))
    .filter((x) => x.balls > 0);

  // Allocate wickets
  const bowlerWickets = new Array(activeBowlers.length).fill(0);
  for (let w = 0; w < summary.wickets; w += 1) {
    const scores = activeBowlers.map((b) => {
      const eff = getEffectiveMatchRatings(b.player, playerForms[b.player.playerId] ?? b.player.form);
      const subBoost = subForBowling?.inPlayerId === b.player.playerId ? 1.4 : 1;
      return (eff.bowlingRating + 20) * (b.balls / 24) * (0.4 + rng() * 1.2) * subBoost;
    });
    const sumS = scores.reduce((a, b) => a + b, 0) || 1;
    let pick = rng() * sumS;
    let chosen = 0;
    for (let i = 0; i < scores.length; i += 1) {
      pick -= scores[i];
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    bowlerWickets[chosen] += 1;
  }

  // Allocate runs conceded
  const runsByBowlersTotal = Math.max(0, summary.runs - Math.floor(extras * 0.4));
  const econWeights = activeBowlers.map((b, i) => {
    const eff = getEffectiveMatchRatings(b.player, playerForms[b.player.playerId] ?? b.player.form);
    const skillInv = Math.max(0.55, 1.55 - eff.bowlingRating / 100);
    const wicketDiscount = bowlerWickets[i] > 1 ? 0.85 : 1;
    return b.balls * skillInv * wicketDiscount * (0.75 + rng() * 0.5);
  });
  const sumEW = econWeights.reduce((a, b) => a + b, 0) || 1;
  const bowlerRuns = econWeights.map((w) => Math.floor((w / sumEW) * runsByBowlersTotal));
  let remBowlRuns = runsByBowlersTotal - bowlerRuns.reduce((a, b) => a + b, 0);
  let brIdx = 0;
  while (remBowlRuns > 0 && bowlerRuns.length > 0) {
    bowlerRuns[brIdx % bowlerRuns.length] += 1;
    remBowlRuns -= 1;
    brIdx += 1;
  }

  const bowlingLines: BowlerScorecardLine[] = activeBowlers.map(({ player, balls }, idx) => {
    const overs = ballsToOvers(balls);
    const decOvers = balls / 6;
    const rc = bowlerRuns[idx];
    const w = bowlerWickets[idx];
    const econ = decOvers > 0 ? Number((rc / decOvers).toFixed(2)) : 0;
    const econBonus = econ <= 6.5 ? 14 : econ <= 7.8 ? 7 : econ >= 11 ? -6 : 0;
    const haulBonus = w >= 4 ? 22 : w === 3 ? 12 : 0;
    const impactPoints = Number((w * 24 + econBonus + haulBonus).toFixed(1));

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      role: player.role,
      overs,
      runsConceded: rc,
      wickets: w,
      economy: econ,
      impactPoints,
      isImpactIn: subForBowling?.inPlayerId === player.playerId,
      isSubbedOut: subForBowling?.outPlayerId === player.playerId,
    };
  });

  const decimalOvers = Math.max(0.1, totalBalls / 6);
  const runRate = Number((summary.runs / decimalOvers).toFixed(2));

  return {
    teamId: battingTeam.id,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    batting: battingLines,
    bowling: bowlingLines,
    extras,
    runRate,
  };
}

function buildHighlightsTimeline(params: {
  firstTeam: SeasonTeam;
  secondTeam: SeasonTeam;
  firstCard: InningsScorecard;
  secondCard: InningsScorecard;
  winnerId: SeasonTeamId;
  marginText: string;
  impactSub?: ImpactSubstitution;
}): MatchHighlightEvent[] {
  const { firstTeam, secondTeam, firstCard, secondCard, winnerId, marginText, impactSub } = params;
  const events: MatchHighlightEvent[] = [];

  const starBat1 = [...firstCard.batting].sort((a, b) => b.runs - a.runs)[0];
  const starBowl1 = [...firstCard.bowling].sort(
    (a, b) => b.wickets - a.wickets || a.economy - b.economy
  )[0];
  const pp1 = firstCard.phaseSplits?.find((p) => p.phase === 'POWERPLAY');
  const mid1 = firstCard.phaseSplits?.find((p) => p.phase === 'MIDDLE');
  const death1 = firstCard.phaseSplits?.find((p) => p.phase === 'DEATH');

  // 1st Innings Powerplay highlight (actual simulated PP split or collapse)
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

  // 1st Innings Middle Overs highlight
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
    badge: starBat1 && starBat1.runs >= 50 ? 'FIFTY' : (firstCard.collapseEvents ?? 0) > 0 && afterMidRuns >= 105 ? 'RECOVERY' : '100 UP!',
    title:
      starBat1 && starBat1.runs >= 50
        ? `${starBat1.playerName} anchors Middle Overs en route to ${starBat1.runs}`
        : `${firstTeam.shortName} reach ${afterMidRuns}/${Math.min(10, afterMidWkts)} after 15 overs`,
    detail: `Middle Overs (7–15): ${mid1?.runs ?? 65}/${mid1?.wickets ?? 2} · Strike rotation & spin test.`,
    progressPct: 32,
  });

  // 1st Innings Death Overs highlight
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

  // Second Innings Chase
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

export function buildPhaseAwareMatchDetails(params: {
  firstTeam: SeasonTeam;
  secondTeam: SeasonTeam;
  firstScorecard: InningsScorecard;
  secondScorecard: InningsScorecard;
  winnerId: SeasonTeamId;
  marginText: string;
  pitchCondition: PitchCondition;
  toss?: TossInfo;
  impactSub?: ImpactSubstitution;
}): Pick<
  MatchResult,
  | 'pitchCondition'
  | 'toss'
  | 'firstScorecard'
  | 'secondScorecard'
  | 'highlights'
  | 'playerOfTheMatch'
  | 'bestImpact'
  | 'keyMoment'
  | 'impactSub'
> {
  const {
    firstTeam,
    secondTeam,
    firstScorecard,
    secondScorecard,
    winnerId,
    marginText,
    pitchCondition,
    toss,
    impactSub,
  } = params;

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

  firstScorecard.batting.forEach((l) => registerBat(l, firstTeam.id));
  firstScorecard.bowling.forEach((l) => registerBowl(l, secondTeam.id));
  secondScorecard.batting.forEach((l) => registerBat(l, secondTeam.id));
  secondScorecard.bowling.forEach((l) => registerBowl(l, firstTeam.id));

  const allPerfs = Array.from(matchPerf.values()).sort((a, b) => b.impactPoints - a.impactPoints);
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
    firstTeam,
    secondTeam,
    firstCard: firstScorecard,
    secondCard: secondScorecard,
    winnerId,
    marginText,
    impactSub,
  });

  return {
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

export function assembleMatchResultFromInnings(params: {
  simulationVersion?: string;
  matchSeed?: string | number;
  firstTeam: SeasonTeam;
  secondTeam: SeasonTeam;
  firstSummary: InningsSummary;
  firstScorecard: InningsScorecard;
  secondSummary: InningsSummary;
  secondScorecard: InningsScorecard;
  pitchCondition: PitchCondition;
  toss?: TossInfo;
  impactSub?: ImpactSubstitution;
  playerForms?: Record<string, PlayerForm>;
  injuredPlayerIds?: string[];
  rng?: () => number;
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
    rng = Math.random,
  } = params;

  return buildMatchResultFromInnings({
    simulationVersion,
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
    playerForms,
    injuredPlayerIds,
    rng,
  });
}

export function generateScorecardsAndDetails(params: {
  firstTeam: SeasonTeam;
  secondTeam: SeasonTeam;
  firstInnings: InningsSummary;
  secondInnings: InningsSummary;
  winnerId: SeasonTeamId;
  marginText: string;
  pitchCondition: PitchCondition;
  toss?: TossInfo;
  playerForms: Record<string, PlayerForm>;
  impactSub?: ImpactSubstitution;
  rng?: () => number;
}): Pick<
  MatchResult,
  | 'pitchCondition'
  | 'toss'
  | 'firstScorecard'
  | 'secondScorecard'
  | 'highlights'
  | 'playerOfTheMatch'
  | 'bestImpact'
  | 'keyMoment'
  | 'impactSub'
> {
  const rng = params.rng ?? Math.random;
  const {
    firstTeam,
    secondTeam,
    firstInnings,
    secondInnings,
    winnerId,
    marginText,
    pitchCondition,
    toss,
    playerForms,
    impactSub,
  } = params;

  const firstScorecard = buildInningsScorecard({
    battingTeam: firstTeam,
    bowlingTeam: secondTeam,
    summary: firstInnings,
    playerForms,
    impactSub,
    rng,
  });

  const secondScorecard = buildInningsScorecard({
    battingTeam: secondTeam,
    bowlingTeam: firstTeam,
    summary: secondInnings,
    playerForms,
    impactSub,
    rng,
  });

  // Aggregate combined match impact points per player
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

  firstScorecard.batting.forEach((l) => registerBat(l, firstTeam.id));
  firstScorecard.bowling.forEach((l) => registerBowl(l, secondTeam.id));
  secondScorecard.batting.forEach((l) => registerBat(l, secondTeam.id));
  secondScorecard.bowling.forEach((l) => registerBowl(l, firstTeam.id));

  const allPerfs = Array.from(matchPerf.values()).sort((a, b) => b.impactPoints - a.impactPoints);
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
    firstTeam,
    secondTeam,
    firstCard: firstScorecard,
    secondCard: secondScorecard,
    winnerId,
    marginText,
    impactSub,
  });

  return {
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
