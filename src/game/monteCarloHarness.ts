import { getRatingBand } from './ratingEngine';
import { createSeededRng } from './seededRng';
import {
  SIMULATION_VERSION,
  simulateFullMatch,
  toEngineTeam,
  type EngineTeam,
} from './cricketMatchEngine';
import type {
  PitchCondition,
  PlayerDetailedAttributes,
  PlayerRole,
  PlayerSeasonRecord,
  SeasonTeam,
} from '../types/game';

const ALL_PITCHES: PitchCondition[] = [
  'BATTING_PARADISE',
  'BALANCED',
  'SPIN_FRIENDLY',
  'PACE_SEAMER',
  'SLOW_AND_LOW',
  'SWINGING',
];

function makeHarnessAttrs(bat: number, bowl: number, ovr: number): PlayerDetailedAttributes {
  return {
    batting: {
      power: bat,
      timing: bat,
      technique: bat,
      strikeRotation: bat,
      paceHitting: bat,
      spinHitting: bat,
      powerplay: bat,
      middleOvers: bat,
      deathOvers: bat,
      chase: bat,
      pressure: bat,
      finishing: bat,
    },
    bowling: {
      wicketTaking: bowl,
      economy: bowl,
      powerplayBowling: bowl,
      middleOversBowling: bowl,
      deathBowling: bowl,
      control: bowl,
      variation: bowl,
      pressure: bowl,
    },
    other: {
      fielding: ovr,
      captaincy: ovr,
      consistency: ovr,
      fitness: ovr,
      impactAbility: ovr,
    },
  };
}

export function createStandardBenchmarkTeam(
  id: SeasonTeam['id'],
  prefix: string,
  bat = 78,
  bowl = 78,
  ovr = 78,
  isUser = false
): SeasonTeam {
  const roles: PlayerRole[] = [
    'WK',
    'BAT',
    'BAT',
    'BAT',
    'BAT',
    'AR',
    'AR',
    'BOWL',
    'BOWL',
    'BOWL',
    'BOWL',
  ];
  const players: PlayerSeasonRecord[] = roles.map((role, idx) => {
    const pBat = role === 'BOWL' ? Math.max(25, bat - 40) : bat;
    const pBowl = role === 'BAT' || role === 'WK' ? Math.max(22, bowl - 44) : bowl;
    const isOs = idx < 4;
    const bowlingStyle =
      idx >= 7
        ? idx % 2 === 0
          ? 'Right-arm fast'
          : 'Slow left-arm orthodox'
        : role === 'AR'
          ? 'Right-arm offbreak'
          : 'None';
    return {
      id: `${prefix}_${idx}`,
      name: `${prefix.toUpperCase()} Player ${idx + 1}`,
      playerId: `${prefix}_${idx}`,
      playerName: `${prefix.toUpperCase()} Player ${idx + 1}`,
      season: 2024,
      franchise: id === 'YOU' ? 'MI' : id,
      teamName: `Team ${id}`,
      nationality: isOs ? 'Australia' : 'India',
      playerType: isOs ? 'Overseas' : 'Domestic',
      isOverseas: isOs,
      role,
      battingStyle: idx % 3 === 1 ? 'Left-hand bat' : 'Right-hand bat',
      bowlingStyle,
      matches: 14,
      runs: 0,
      battingAverage: 0,
      strikeRate: 0,
      wickets: 0,
      economy: 0,
      battingRating: pBat,
      bowlingRating: pBowl,
      impactRating: ovr,
      overallRating: ovr,
      ratingBand: getRatingBand(ovr),
      form: 'NORMAL',
      attributes: makeHarnessAttrs(pBat, pBowl, ovr),
      priceCr: 8,
      ratingStatus: 'PROVISIONAL',
    };
  });

  return {
    id,
    code: id,
    name: `Team ${id}`,
    shortName: id,
    primaryColor: '#1E40AF',
    homeVenue: 'Benchmark Stadium',
    isUser,
    players,
  };
}

export interface PitchAggregateStats {
  matches: number;
  avgFirstInningsScore: number;
  avgWicketsPerInnings: number;
  batFirstWinPct: number;
}

export interface MonteCarloReport {
  simulationVersion: string;
  matches: number;
  teamAId: SeasonTeam['id'];
  teamBId: SeasonTeam['id'];
  teamAWins: number;
  teamBWins: number;
  teamAWinPct: number;
  teamBWinPct: number;
  tiesTriggeredSuperOver: number;
  tiePct: number;
  totalSuperOverRounds: number;
  avgFirstInningsScore: number;
  avgSecondInningsScore: number;
  firstInningsStdDev: number;
  minFirstInningsScore: number;
  maxFirstInningsScore: number;
  avgWicketsPerInnings: number;
  avgPowerplayScore: number;
  powerplayRunRate: number;
  middleRunRate: number;
  deathRunRate: number;
  batFirstWins: number;
  chaseWins: number;
  batFirstWinPct: number;
  chaseWinPct: number;
  allOutInningsCount: number;
  allOutPct: number;
  pitchBreakdown: Partial<Record<PitchCondition, PitchAggregateStats>>;
}

export function runMonteCarloSimulation(params: {
  matches: number;
  seed?: string | number;
  teamA?: SeasonTeam | EngineTeam;
  teamB?: SeasonTeam | EngineTeam;
  pitchDistribution?: PitchCondition[];
}): MonteCarloReport {
  const {
    matches,
    seed = 'mc-default-2026',
    teamA = createStandardBenchmarkTeam('YOU', 'mctA', 78, 78, 78, true),
    teamB = createStandardBenchmarkTeam('MI', 'mctB', 78, 78, 78, false),
    pitchDistribution = ALL_PITCHES,
  } = params;

  const cleanA = toEngineTeam(teamA);
  const cleanB = toEngineTeam(teamB);
  const rng = createSeededRng(seed);

  let teamAWins = 0;
  let teamBWins = 0;
  let tiesTriggeredSuperOver = 0;
  let totalSuperOverRounds = 0;
  let batFirstWins = 0;
  let chaseWins = 0;

  let sumFirstInn = 0;
  let sumSecondInn = 0;
  let minFirst = 999;
  let maxFirst = 0;
  const firstScores: number[] = [];

  let sumWickets = 0;
  let allOutInningsCount = 0;

  let ppRuns = 0;
  let ppBalls = 0;
  let ppCount = 0;
  let midRuns = 0;
  let midBalls = 0;
  let deathRuns = 0;
  let deathBalls = 0;

  const pitchAgg = new Map<
    PitchCondition,
    { matches: number; firstRuns: number; wkts: number; batFirstWins: number }
  >();

  for (let i = 0; i < matches; i += 1) {
    const pitchCondition =
      pitchDistribution[i % pitchDistribution.length] ?? 'BALANCED';
    // Alternate caller & toss fairly across matches
    const firstIsA = i % 2 === 0 ? rng.next() < 0.5 : rng.next() >= 0.5;
    const { result } = simulateFullMatch({
      matchId: `mc-${seed}-${i}`,
      matchSeed: `${seed}:m:${i}`,
      teamA: cleanA,
      teamB: cleanB,
      pitchCondition,
      toss: {
        callerTeamId: firstIsA ? cleanA.id : cleanB.id,
        call: 'HEADS',
        outcome: 'HEADS',
        winnerTeamId: firstIsA ? cleanA.id : cleanB.id,
        decision: 'BAT',
      },
    });

    if (result.winnerId === cleanA.id) teamAWins += 1;
    else teamBWins += 1;

    if (result.superOver) {
      tiesTriggeredSuperOver += 1;
      totalSuperOverRounds += result.superOverCount ?? 1;
    }

    if (result.winnerId === result.battingFirstTeamId) batFirstWins += 1;
    else chaseWins += 1;

    const r1 = result.firstInnings.runs;
    const r2 = result.secondInnings.runs;
    sumFirstInn += r1;
    sumSecondInn += r2;
    firstScores.push(r1);
    if (r1 < minFirst) minFirst = r1;
    if (r1 > maxFirst) maxFirst = r1;

    const w1 = result.firstInnings.wickets;
    const w2 = result.secondInnings.wickets;
    sumWickets += w1 + w2;
    if (w1 >= 10) allOutInningsCount += 1;
    if (w2 >= 10) allOutInningsCount += 1;

    for (const card of [result.firstScorecard, result.secondScorecard]) {
      if (!card?.phaseSplits) continue;
      for (const sp of card.phaseSplits) {
        if (sp.phase === 'POWERPLAY') {
          ppRuns += sp.runs;
          ppBalls += sp.balls;
          ppCount += 1;
        } else if (sp.phase === 'MIDDLE') {
          midRuns += sp.runs;
          midBalls += sp.balls;
        } else if (sp.phase === 'DEATH') {
          deathRuns += sp.runs;
          deathBalls += sp.balls;
        }
      }
    }

    const pEntry = pitchAgg.get(pitchCondition) ?? {
      matches: 0,
      firstRuns: 0,
      wkts: 0,
      batFirstWins: 0,
    };
    pEntry.matches += 1;
    pEntry.firstRuns += r1;
    pEntry.wkts += w1 + w2;
    if (result.winnerId === result.battingFirstTeamId) pEntry.batFirstWins += 1;
    pitchAgg.set(pitchCondition, pEntry);
  }

  const avgFirstInningsScore = matches > 0 ? sumFirstInn / matches : 0;
  const variance =
    matches > 0
      ? firstScores.reduce((acc, s) => acc + (s - avgFirstInningsScore) ** 2, 0) / matches
      : 0;
  const firstInningsStdDev = Math.sqrt(variance);

  const pitchBreakdown: Partial<Record<PitchCondition, PitchAggregateStats>> = {};
  for (const [pitch, agg] of pitchAgg.entries()) {
    pitchBreakdown[pitch] = {
      matches: agg.matches,
      avgFirstInningsScore: Number((agg.firstRuns / agg.matches).toFixed(2)),
      avgWicketsPerInnings: Number((agg.wkts / (agg.matches * 2)).toFixed(2)),
      batFirstWinPct: Number(((agg.batFirstWins / agg.matches) * 100).toFixed(2)),
    };
  }

  return {
    simulationVersion: SIMULATION_VERSION,
    matches,
    teamAId: cleanA.id,
    teamBId: cleanB.id,
    teamAWins,
    teamBWins,
    teamAWinPct: Number(((teamAWins / matches) * 100).toFixed(2)),
    teamBWinPct: Number(((teamBWins / matches) * 100).toFixed(2)),
    tiesTriggeredSuperOver,
    tiePct: Number(((tiesTriggeredSuperOver / matches) * 100).toFixed(2)),
    totalSuperOverRounds,
    avgFirstInningsScore: Number(avgFirstInningsScore.toFixed(2)),
    avgSecondInningsScore: Number((sumSecondInn / matches).toFixed(2)),
    firstInningsStdDev: Number(firstInningsStdDev.toFixed(2)),
    minFirstInningsScore: matches > 0 ? minFirst : 0,
    maxFirstInningsScore: maxFirst,
    avgWicketsPerInnings: Number((sumWickets / (matches * 2)).toFixed(2)),
    avgPowerplayScore: Number((ppCount > 0 ? ppRuns / ppCount : 0).toFixed(2)),
    powerplayRunRate: Number((ppBalls > 0 ? (ppRuns * 6) / ppBalls : 0).toFixed(2)),
    middleRunRate: Number((midBalls > 0 ? (midRuns * 6) / midBalls : 0).toFixed(2)),
    deathRunRate: Number((deathBalls > 0 ? (deathRuns * 6) / deathBalls : 0).toFixed(2)),
    batFirstWins,
    chaseWins,
    batFirstWinPct: Number(((batFirstWins / matches) * 100).toFixed(2)),
    chaseWinPct: Number(((chaseWins / matches) * 100).toFixed(2)),
    allOutInningsCount,
    allOutPct: Number(((allOutInningsCount / (matches * 2)) * 100).toFixed(2)),
    pitchBreakdown,
  };
}

export interface FairnessAuditReport {
  simulationVersion: string;
  userFlagReversalPassed: boolean;
  mirrorTest: MonteCarloReport;
  strongVsWeakTest: MonteCarloReport;
  passed: boolean;
}

export function runFairnessAudit(options?: {
  mirrorMatches?: number;
  strongWeakMatches?: number;
  seed?: string;
}): FairnessAuditReport {
  const mirrorMatches = options?.mirrorMatches ?? 5000;
  const strongWeakMatches = options?.strongWeakMatches ?? 5000;
  const seed = options?.seed ?? 'fairness-audit-2026';

  // 1. User-flag reversal: identical rosters, identical seed, swap isUser flag
  const teamAUser = createStandardBenchmarkTeam('YOU', 'revA', 79, 78, 79, true);
  const teamBOpp = createStandardBenchmarkTeam('CSK', 'revB', 79, 78, 79, false);
  const teamANonUser: SeasonTeam = { ...teamAUser, isUser: false };
  const teamBUser: SeasonTeam = { ...teamBOpp, isUser: true };

  const fixedToss = {
    callerTeamId: 'YOU' as const,
    call: 'HEADS' as const,
    outcome: 'HEADS' as const,
    winnerTeamId: 'YOU' as const,
    decision: 'BAT' as const,
  };

  const run1 = simulateFullMatch({
    matchId: 'rev-1',
    matchSeed: `${seed}:reversal`,
    teamA: teamAUser,
    teamB: teamBOpp,
    pitchCondition: 'BALANCED',
    toss: fixedToss,
  });
  const run2 = simulateFullMatch({
    matchId: 'rev-1',
    matchSeed: `${seed}:reversal`,
    teamA: teamANonUser,
    teamB: teamBUser,
    pitchCondition: 'BALANCED',
    toss: fixedToss,
  });

  const userFlagReversalPassed =
    JSON.stringify(run1.result) === JSON.stringify(run2.result) &&
    JSON.stringify(run1.finalState.firstInnings.deliveryLog) ===
      JSON.stringify(run2.finalState.firstInnings.deliveryLog) &&
    JSON.stringify(run1.finalState.secondInnings?.deliveryLog) ===
      JSON.stringify(run2.finalState.secondInnings?.deliveryLog);

  // 2. Mirror-team parity (identical ratings, should split ~50/50)
  const mirrorA = createStandardBenchmarkTeam('YOU', 'mir', 78, 78, 78, true);
  const mirrorB = {
    ...createStandardBenchmarkTeam('MI', 'mir', 78, 78, 78, false),
    players: mirrorA.players.map((p) => ({ ...p })),
  };
  const mirrorTest = runMonteCarloSimulation({
    matches: mirrorMatches,
    seed: `${seed}:mirror`,
    teamA: mirrorA,
    teamB: mirrorB,
  });

  // 3. Strong vs Weak (85 vs 65 — strong wins clearly, upsets still > 0)
  const strongTeam = createStandardBenchmarkTeam('YOU', 'str', 85, 85, 85, true);
  const weakTeam = createStandardBenchmarkTeam('RR', 'wk', 65, 65, 65, false);
  const strongVsWeakTest = runMonteCarloSimulation({
    matches: strongWeakMatches,
    seed: `${seed}:strong-weak`,
    teamA: strongTeam,
    teamB: weakTeam,
  });

  const mirrorBalanced = mirrorTest.teamAWinPct >= 46 && mirrorTest.teamAWinPct <= 54;
  const strongDecisiveWithUpsets =
    strongVsWeakTest.teamAWinPct >= 65 && strongVsWeakTest.teamBWins > 0;

  return {
    simulationVersion: SIMULATION_VERSION,
    userFlagReversalPassed,
    mirrorTest,
    strongVsWeakTest,
    passed: userFlagReversalPassed && mirrorBalanced && strongDecisiveWithUpsets,
  };
}
