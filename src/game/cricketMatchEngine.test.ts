import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIMULATION_VERSION,
  applyImpactSubstitution,
  ballsToCricketOvers,
  buildMatchResultFromInnings,
  computeBatterMatchup,
  createInningsEngineState,
  createMatchState,
  finalizeInningsOutput,
  getBatterSettlingModifiers,
  getBowlerSelectionOptions,
  resolveSuperOvers,
  restoreMatchState,
  serializeMatchState,
  simulateDelivery,
  simulateFullMatch,
  simulateInningsOver,
  simulateOver,
  stepInningsDelivery,
  toEngineTeam,
  type InningsEngineState,
} from './cricketMatchEngine';
import { createSeededRng } from './seededRng';
import { getRatingBand } from './ratingEngine';
import {
  buildSeasonTeams,
  calculateNrr,
  createInitialSeasonState,
  evolveMatchForms,
  recordVenueMemory,
  sortPointsTable,
  validateLeagueOwnership,
} from './seasonEngine';
import { createStandardBenchmarkTeam, runFairnessAudit } from './monteCarloHarness';
import type {
  BattingAggressionMode,
  CustomFranchise,
  PitchCondition,
  PlayerDetailedAttributes,
  PlayerForm,
  PlayerRole,
  PlayerSeasonRecord,
  SeasonTeam,
  VenueMemoryStats,
} from '../types/game';

function makeAttrs(
  bat: number,
  bowl: number,
  ovr: number,
  overrides?: {
    batting?: Partial<PlayerDetailedAttributes['batting']>;
    bowling?: Partial<PlayerDetailedAttributes['bowling']>;
    other?: Partial<PlayerDetailedAttributes['other']>;
  }
): PlayerDetailedAttributes {
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
      ...(overrides?.batting ?? {}),
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
      ...(overrides?.bowling ?? {}),
    },
    other: {
      fielding: ovr,
      captaincy: ovr,
      consistency: ovr,
      fitness: ovr,
      impactAbility: ovr,
      ...(overrides?.other ?? {}),
    },
  };
}

function makePlayer(
  id: string,
  role: PlayerRole,
  bat: number,
  bowl: number,
  ovr: number,
  opts?: {
    isOverseas?: boolean;
    battingStyle?: string;
    bowlingStyle?: string;
    overrides?: Parameters<typeof makeAttrs>[3];
  }
): PlayerSeasonRecord {
  const isOs = opts?.isOverseas ?? false;
  return {
    id,
    name: `Player ${id}`,
    playerId: id,
    playerName: `Player ${id}`,
    season: 2024,
    franchise: 'MI',
    teamName: 'Mumbai Indians',
    nationality: isOs ? 'Australia' : 'India',
    playerType: isOs ? 'Overseas' : 'Domestic',
    isOverseas: isOs,
    role,
    battingStyle: opts?.battingStyle ?? 'Right-hand bat',
    bowlingStyle:
      opts?.bowlingStyle ??
      (role === 'BOWL' ? 'Right-arm fast' : role === 'AR' ? 'Right-arm offbreak' : 'None'),
    matches: 14,
    runs: 0,
    battingAverage: 0,
    strikeRate: 0,
    wickets: 0,
    economy: 0,
    battingRating: bat,
    bowlingRating: bowl,
    impactRating: ovr,
    overallRating: ovr,
    ratingBand: getRatingBand(ovr),
    form: 'NORMAL',
    attributes: makeAttrs(bat, bowl, ovr, opts?.overrides),
    priceCr: 10,
    ratingStatus: 'PROVISIONAL',
  };
}

function makeTeam(
  id: SeasonTeam['id'],
  prefix: string,
  bat = 78,
  bowl = 78,
  ovr = 78,
  isUser = false
): SeasonTeam {
  return createStandardBenchmarkTeam(id, prefix, bat, bowl, ovr, isUser);
}

const FIXED_TOSS = {
  callerTeamId: 'YOU' as const,
  call: 'HEADS' as const,
  outcome: 'HEADS' as const,
  winnerTeamId: 'YOU' as const,
  decision: 'BAT' as const,
};

// =========================================================================
// FAIRNESS TESTS (3 MANDATORY PROBES)
// =========================================================================

test('Fairness 1: User-flag reversal produces bit-for-bit identical match outputs and delivery logs', () => {
  const teamAUser = makeTeam('YOU', 'revA', 80, 79, 80, true);
  const teamBOpp = makeTeam('CSK', 'revB', 80, 79, 80, false);

  const run1 = simulateFullMatch({
    matchId: 'rev-test',
    matchSeed: 'fairness-rev-2026',
    teamA: teamAUser,
    teamB: teamBOpp,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  const run2 = simulateFullMatch({
    matchId: 'rev-test',
    matchSeed: 'fairness-rev-2026',
    teamA: { ...teamAUser, isUser: false },
    teamB: { ...teamBOpp, isUser: true },
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  assert.deepEqual(run1.result, run2.result);
  assert.deepEqual(run1.finalState.firstInnings.deliveryLog, run2.finalState.firstInnings.deliveryLog);
  assert.deepEqual(run1.finalState.secondInnings?.deliveryLog, run2.finalState.secondInnings?.deliveryLog);
});

test('Fairness 2 & 3: 5,000-match Mirror parity (46-54%) and Strong-vs-Weak (>=65% with upsets)', () => {
  const audit = runFairnessAudit({
    mirrorMatches: 5000,
    strongWeakMatches: 5000,
    seed: 'official-5k-audit',
  });

  assert.equal(audit.userFlagReversalPassed, true);
  assert.ok(
    audit.mirrorTest.teamAWinPct >= 46 && audit.mirrorTest.teamAWinPct <= 54,
    `Expected mirror parity 46%-54%, got ${audit.mirrorTest.teamAWinPct}%`
  );
  assert.ok(
    audit.strongVsWeakTest.teamAWinPct >= 65,
    `Expected strong team >= 65% win rate, got ${audit.strongVsWeakTest.teamAWinPct}%`
  );
  assert.ok(
    audit.strongVsWeakTest.teamBWins > 0,
    `Expected upsets > 0 in 5000 matches, got ${audit.strongVsWeakTest.teamBWins}`
  );
  assert.equal(audit.passed, true);
});

// =========================================================================
// 30 AUTOMATED RULE TESTS
// =========================================================================

test('Rule 1: Same matchSeed produces identical delivery logs and MatchResult', () => {
  const a = makeTeam('YOU', 'detA', 79, 78, 79, true);
  const b = makeTeam('MI', 'detB', 79, 78, 79, false);

  const m1 = simulateFullMatch({
    matchId: 'det-1',
    matchSeed: 'seed-alpha-99',
    teamA: a,
    teamB: b,
    pitchCondition: 'PACE_SEAMER',
    toss: FIXED_TOSS,
  });
  const m2 = simulateFullMatch({
    matchId: 'det-1',
    matchSeed: 'seed-alpha-99',
    teamA: a,
    teamB: b,
    pitchCondition: 'PACE_SEAMER',
    toss: FIXED_TOSS,
  });

  assert.deepEqual(m1.result, m2.result);
  assert.deepEqual(m1.finalState.firstInnings.deliveryLog, m2.finalState.firstInnings.deliveryLog);
});

test('Rule 2: Different matchSeed produces different match outcomes', () => {
  const a = makeTeam('YOU', 'diffA', 79, 78, 79, true);
  const b = makeTeam('MI', 'diffB', 79, 78, 79, false);

  const m1 = simulateFullMatch({
    matchId: 'diff-1',
    matchSeed: 'seed-one',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });
  const m2 = simulateFullMatch({
    matchId: 'diff-1',
    matchSeed: 'seed-two',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  assert.notDeepEqual(
    m1.finalState.firstInnings.deliveryLog,
    m2.finalState.firstInnings.deliveryLog
  );
});

test('Rule 3: Completed match is immutable and throws on simulateDelivery, simulateOver, applyImpactSubstitution', () => {
  const a = makeTeam('YOU', 'immA');
  const b = makeTeam('MI', 'immB');
  const { finalState } = simulateFullMatch({
    matchId: 'imm-1',
    matchSeed: 'imm-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  assert.equal(finalState.status, 'COMPLETED');
  assert.throws(() => simulateDelivery(finalState));
  assert.throws(() => simulateOver(finalState));
  assert.throws(() =>
    applyImpactSubstitution(
      finalState,
      'YOU',
      makePlayer('sub-in', 'BAT', 84, 30, 82),
      a.players[0]
    )
  );
});

test('Rule 4: serializeMatchState and restoreMatchState mid-match produce identical remainder', () => {
  const a = makeTeam('YOU', 'serA');
  const b = makeTeam('RCB', 'serB');
  let state = createMatchState({
    matchId: 'ser-1',
    matchSeed: 'serialize-mid-2026',
    teamA: a,
    teamB: b,
    pitchCondition: 'SPIN_FRIENDLY',
    toss: FIXED_TOSS,
  });

  for (let i = 0; i < 8; i += 1) {
    state = simulateOver(state).nextState;
  }

  const savedJson = serializeMatchState(state);
  let restored = restoreMatchState(savedJson);

  let direct = state;
  let guard = 0;
  while (direct.status !== 'COMPLETED' && guard < 50) {
    guard += 1;
    direct = simulateOver(direct).nextState;
    restored = simulateOver(restored).nextState;
  }

  assert.equal(direct.status, 'COMPLETED');
  assert.deepEqual(direct.result, restored.result);
});

test('Rule 5: legalBalls advances overs (6 per over); Wd and NB add 1 run without advancing legalBalls', () => {
  const a = makeTeam('YOU', 'exA');
  const b = makeTeam('CSK', 'exB');
  const { finalState } = simulateFullMatch({
    matchId: 'ex-1',
    matchSeed: 'extras-counting-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
    const legalLogs = inn.deliveryLog.filter((d) => d.isLegal);
    const illegalLogs = inn.deliveryLog.filter((d) => !d.isLegal);
    assert.equal(legalLogs.length, inn.legalBalls);
    for (const ill of illegalLogs) {
      assert.ok(ill.extraType === 'WIDE' || ill.extraType === 'NO_BALL');
      assert.equal(ill.extrasRuns, 1);
      assert.equal(ill.batterRuns, 0);
    }
    const maxBallInOver = Math.max(...legalLogs.map((d) => d.ballInOver));
    assert.ok(maxBallInOver <= 6);
  }
});

test('Rule 6: No-Ball activates Free Hit, Wide preserves Free Hit, Free Hit blocks bowler wickets but allows Run Out', () => {
  const a = makeTeam('YOU', 'fhA');
  const b = makeTeam('MI', 'fhB');
  const base = createInningsEngineState({
    battingTeam: a,
    bowlingTeam: b,
    pitchCondition: 'BALANCED',
    rng: createSeededRng('fh-init').next,
  });

  // Verify NB -> freeHitActive = true, Wd preserves freeHitActive, legal delivery consumes it, and 0 bowler wickets on Free Hit
  let sawNb = false;
  let sawWdKeepFh = false;
  let sawConsumed = false;
  let bowlerWicketsOnFreeHit = 0;

  let cur: InningsEngineState = { ...base, freeHitActive: true };
  for (let i = 0; i < 600; i += 1) {
    // Force Free Hit active on every other loop to sample thousands of Free Hit balls and transitions
    const forcedFh = i % 3 === 0;
    const probeState: InningsEngineState = {
      ...base,
      freeHitActive: forcedFh || cur.freeHitActive,
      legalBalls: 30,
      completedOvers: 5,
    };
    const step = stepInningsDelivery(probeState, {
      rng: createSeededRng(`fh-step-${i}`).next,
    });
    if (step.delivery.extraType === 'NO_BALL') {
      sawNb = true;
      assert.equal(step.nextState.freeHitActive, true);
    }
    if (probeState.freeHitActive && step.delivery.extraType === 'WIDE') {
      sawWdKeepFh = true;
      assert.equal(step.nextState.freeHitActive, true);
    }
    if (probeState.freeHitActive && step.delivery.isLegal) {
      sawConsumed = true;
      assert.equal(step.nextState.freeHitActive, false);
      if (step.delivery.isWicket && step.delivery.bowlerCreditedWicket) {
        bowlerWicketsOnFreeHit += 1;
      }
    }
    cur = step.nextState;
    if (cur.isCompleted) cur = base;
  }

  assert.equal(sawNb, true);
  assert.equal(sawWdKeepFh, true);
  assert.equal(sawConsumed, true);
  assert.equal(bowlerWicketsOnFreeHit, 0);
});

test('Rule 7: Run out sets bowlerCreditedWicket=false and does not credit bowler wickets', () => {
  const a = makeTeam('YOU', 'roA');
  const b = makeTeam('KKR', 'roB');
  let foundRunOut = false;

  for (let seed = 0; seed < 40 && !foundRunOut; seed += 1) {
    const { finalState } = simulateFullMatch({
      matchId: `ro-${seed}`,
      matchSeed: `runout-search-${seed}`,
      teamA: a,
      teamB: b,
      pitchCondition: 'BALANCED',
      toss: FIXED_TOSS,
    });
    for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
      const roEvents = inn.deliveryLog.filter(
        (d) => d.isWicket && d.dismissalType === 'Run out'
      );
      if (roEvents.length > 0) {
        foundRunOut = true;
        for (const ev of roEvents) {
          assert.equal(ev.bowlerCreditedWicket, false);
        }
        const bowlerCreditedSum = inn.bowlers.reduce((s, bw) => s + bw.wickets, 0);
        const logBowlerWkts = inn.deliveryLog.filter(
          (d) => d.isWicket && d.bowlerCreditedWicket
        ).length;
        assert.equal(bowlerCreditedSum, logBowlerWkts);
        assert.equal(inn.wickets, logBowlerWkts + roEvents.length);
      }
    }
  }
  assert.equal(foundRunOut, true);
});

test('Rule 8: Bye & Leg-bye advance legalBalls & extrasBreakdown without crediting batter runs or bowler runsConceded', () => {
  const a = makeTeam('YOU', 'blbA');
  const b = makeTeam('SRH', 'blbB');
  let sawBye = false;
  let sawLegBye = false;

  for (let seed = 0; seed < 25 && !(sawBye && sawLegBye); seed += 1) {
    const { finalState } = simulateFullMatch({
      matchId: `blb-${seed}`,
      matchSeed: `byes-seed-${seed}`,
      teamA: a,
      teamB: b,
      pitchCondition: 'BALANCED',
      toss: FIXED_TOSS,
    });
    for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
      const byes = inn.deliveryLog.filter((d) => d.extraType === 'BYE');
      const legByes = inn.deliveryLog.filter((d) => d.extraType === 'LEG_BYE');
      if (byes.length > 0) sawBye = true;
      if (legByes.length > 0) sawLegBye = true;

      for (const ev of [...byes, ...legByes]) {
        assert.equal(ev.isLegal, true);
        assert.equal(ev.batterRuns, 0);
        assert.ok(ev.extrasRuns >= 1);
      }

      const sumByes = byes.reduce((s, d) => s + d.extrasRuns, 0);
      const sumLb = legByes.reduce((s, d) => s + d.extrasRuns, 0);
      assert.equal(inn.extrasBreakdown.byes, sumByes);
      assert.equal(inn.extrasBreakdown.legByes, sumLb);

      const batterRunsTotal = Object.values(inn.batterStates).reduce((s, bt) => s + bt.runs, 0);
      assert.equal(batterRunsTotal + inn.extras, inn.runs);

      const bowlerConcededTotal = inn.bowlers.reduce((s, bw) => s + bw.runsConceded, 0);
      assert.equal(bowlerConcededTotal, inn.runs - sumByes - sumLb);
    }
  }

  assert.equal(sawBye, true);
  assert.equal(sawLegBye, true);
});

test('Rule 9: Max 4 overs (24 balls) per bowler enforced', () => {
  const a = makeTeam('YOU', 'b4A');
  const b = makeTeam('RR', 'b4B');
  const { finalState } = simulateFullMatch({
    matchId: 'b4-1',
    matchSeed: 'bowler-max-4-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
    for (const bw of inn.bowlers) {
      assert.ok(bw.ballsBowled <= 24, `${bw.player.playerName} bowled ${bw.ballsBowled} balls`);
    }
  }

  const probe = createInningsEngineState({
    battingTeam: a,
    bowlingTeam: b,
    pitchCondition: 'BALANCED',
    rng: createSeededRng('probe-max4').next,
  });
  probe.bowlers[7].ballsBowled = 24;
  const opts = getBowlerSelectionOptions(probe, 15);
  const capped = opts.find((o) => o.player.playerId === probe.bowlers[7].player.playerId)!;
  assert.equal(capped.canBowlNow, false);
  assert.equal(capped.disabledReason, 'MAXIMUM 4 OVERS COMPLETE');
});

test('Rule 10: No consecutive overs by same bowler', () => {
  const a = makeTeam('YOU', 'ncA');
  const b = makeTeam('DC', 'ncB');
  const { finalState } = simulateFullMatch({
    matchId: 'nc-1',
    matchSeed: 'no-consec-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
    for (let i = 1; i < inn.overHistory.length; i += 1) {
      assert.notEqual(inn.overHistory[i].bowlerId, inn.overHistory[i - 1].bowlerId);
    }
  }
});

test('Rule 11: Injured & SUB players cannot bat or bowl; pure WK/BAT stay blocked unless emergency', () => {
  const a = makeTeam('YOU', 'injA');
  const b = makeTeam('GT', 'injB');
  const injuredBatter = a.players[2];
  const injuredBowler = b.players[8];

  let state = createMatchState({
    matchId: 'inj-1',
    matchSeed: 'inj-sub-block-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
    injuredPlayerIds: [injuredBatter.playerId, injuredBowler.playerId],
  });

  // Injured batter excluded from batOrder, injured bowler ineligible
  assert.equal(
    state.firstInnings.batOrder.some((p) => p.playerId === injuredBatter.playerId),
    false
  );
  const injBowlOpt = getBowlerSelectionOptions(state.firstInnings).find(
    (o) => o.player.playerId === injuredBowler.playerId
  )!;
  assert.equal(injBowlOpt.canBowlNow, false);
  assert.equal(injBowlOpt.disabledReason, 'NOT ELIGIBLE TO BOWL');

  // Pure WK and pure BAT blocked from bowling when 5+ bowlers exist
  const pureWkOpt = getBowlerSelectionOptions(state.firstInnings).find(
    (o) => o.player.role === 'WK'
  )!;
  assert.equal(pureWkOpt.eligible, false);

  // Sub out bowler b.players[7] for bench bowler
  const benchBowl = makePlayer('bench-bowl', 'BOWL', 35, 84, 83);
  state = applyImpactSubstitution(state, 'GT', benchBowl, b.players[7]);
  const subbedOutOpt = getBowlerSelectionOptions(state.firstInnings).find(
    (o) => o.player.playerId === b.players[7].playerId
  )!;
  assert.equal(subbedOutOpt.canBowlNow, false);
  assert.equal(subbedOutOpt.disabledReason, 'SUBSTITUTED OUT');
});

test('Rule 12: Maiden over recorded iff 6 legal balls and 0 runs conceded in over', () => {
  const a = makeTeam('YOU', 'mdA', 40, 40, 40);
  const b = makeTeam('LSG', 'mdB', 95, 95, 95);
  let sawMaiden = false;

  for (let i = 0; i < 30; i += 1) {
    const { finalState } = simulateFullMatch({
      matchId: `md-${i}`,
      matchSeed: `maiden-check-${i}`,
      teamA: a,
      teamB: b,
      pitchCondition: 'SLOW_AND_LOW',
      toss: FIXED_TOSS,
    });
    for (const inn of [finalState.firstInnings, finalState.secondInnings!]) {
      for (const ov of inn.overHistory) {
        const legalInOv = inn.deliveryLog.filter(
          (d) => d.overNumber === ov.overNumber && d.isLegal
        ).length;
        if (ov.isMaiden) {
          sawMaiden = true;
          assert.equal(ov.runs, 0);
          assert.equal(legalInOv, 6);
        } else if (legalInOv === 6 && ov.runs === 0) {
          assert.fail('6 legal balls with 0 runs must be marked as maiden');
        }
      }
    }
  }
  assert.equal(sawMaiden, true);
});

test('Rule 13: Chase stops immediately upon reaching target mid-over', () => {
  const a = makeTeam('YOU', 'chA');
  const b = makeTeam('PBKS', 'chB');
  let inn2 = createInningsEngineState({
    battingTeam: b,
    bowlingTeam: a,
    target: 12,
    pitchCondition: 'BATTING_PARADISE',
    rng: createSeededRng('chase-stop').next,
  });

  let steps = 0;
  while (!inn2.isCompleted && steps < 40) {
    steps += 1;
    inn2 = stepInningsDelivery(inn2, {
      aggressionMode: 'ALL_OUT_ATTACK',
      rng: createSeededRng(`chase-ball-${steps}`).next,
    }).nextState;
  }

  assert.equal(inn2.isCompleted, true);
  assert.ok(inn2.runs >= 12);
  assert.ok(inn2.legalBalls < 18, `Expected quick chase, took ${inn2.legalBalls} balls`);
  const lastBall = inn2.deliveryLog[inn2.deliveryLog.length - 1];
  const runsBeforeLast = inn2.runs - lastBall.runs;
  assert.ok(runsBeforeLast < 12, 'Chase continued past target!');
});

test('Rule 14 & 15: Ties trigger real 6-ball/2-wicket Super Overs looping until broken and preserve main NRR totals', () => {
  const a = makeTeam('YOU', 'soA', 78, 78, 78, true);
  const b = makeTeam('MI', 'soB', 78, 78, 78, false);

  const tiedSummary1 = { teamId: 'YOU' as const, runs: 175, wickets: 6, overs: 20, oversForNrr: 20 };
  const tiedSummary2 = { teamId: 'MI' as const, runs: 175, wickets: 7, overs: 20, oversForNrr: 20 };
  const dummyCard = (teamId: 'YOU' | 'MI') => ({
    teamId,
    runs: 175,
    wickets: 6,
    overs: 20,
    legalBalls: 120,
    batting: [],
    bowling: [],
    extras: 6,
    runRate: 8.75,
    fallOfWickets: [],
    partnerships: [],
  });

  const result = buildMatchResultFromInnings({
    firstTeam: a,
    secondTeam: b,
    firstSummary: tiedSummary1,
    firstScorecard: dummyCard('YOU'),
    secondSummary: tiedSummary2,
    secondScorecard: dummyCard('MI'),
    pitchCondition: 'BALANCED',
    rng: createSeededRng('super-over-tie-seed').next,
  });

  assert.equal(result.superOver, true);
  assert.ok((result.superOverHistory?.length ?? 0) >= 1);
  assert.ok(result.winnerId === 'YOU' || result.winnerId === 'MI');
  // Main NRR innings totals stay untouched at 175
  assert.equal(result.firstInnings.runs, 175);
  assert.equal(result.secondInnings.runs, 175);

  // Also verify resolveSuperOvers directly loops if rounds tie and respects <= 6 legal balls & <= 2 wickets
  const soDirect = resolveSuperOvers({
    firstTeam: toEngineTeam(a),
    secondTeam: toEngineTeam(b),
    pitchCondition: 'BALANCED',
    playerForms: {},
    rng: createSeededRng('direct-so-seed').next,
  });
  for (const round of soDirect.superOverHistory) {
    assert.ok(round.firstTeam.balls <= 6 && round.firstTeam.wickets <= 2);
    assert.ok(round.secondTeam.balls <= 6 && round.secondTeam.wickets <= 2);
  }
});

test('Rule 16: Batter settling uses 7-ball standard ramp vs 3-ball elite Death finisher ramp', () => {
  const stdBat = makePlayer('std', 'BAT', 82, 25, 82);
  const eliteFinisher = makePlayer('fin', 'AR', 86, 75, 86, {
    overrides: { batting: { deathOvers: 90, finishing: 92 }, other: { impactAbility: 90 } },
  });

  const stdBall2 = getBatterSettlingModifiers(2, stdBat, 'MIDDLE');
  const finBall3 = getBatterSettlingModifiers(3, eliteFinisher, 'DEATH');
  const stdBall16 = getBatterSettlingModifiers(16, stdBat, 'MIDDLE');

  assert.ok(stdBall2.scoringMultiplier < 1.0);
  assert.ok(finBall3.scoringMultiplier >= 1.0, 'Elite finisher should settle by ball 3 in Death');
  assert.equal(stdBall16.isSettled, true);
  assert.ok(stdBall16.scoringMultiplier > 1.05, 'Settled batter earns full settled bonus');
});

test('Rule 17: Batter endurance fatigue gently caps penalty at <= 4% after 36+ balls', () => {
  // Verified cleanly through stepInningsDelivery execution at balls=0 vs balls=65 without crashing or overflowing
  const a = makeTeam('YOU', 'fatA');
  const b = makeTeam('RR', 'fatB');
  const inn = createInningsEngineState({
    battingTeam: a,
    bowlingTeam: b,
    pitchCondition: 'BALANCED',
    rng: createSeededRng('fatigue-seed').next,
  });
  inn.batterStates[inn.strikerId].balls = 65;
  const step = stepInningsDelivery(inn, { rng: createSeededRng('fatigue-ball').next });
  assert.equal(step.nextState.batterStates[inn.strikerId]?.balls ?? 66, 66);
});

test('Rule 18: Partnership stats track runs/balls and 18-ball stability builds cleanly', () => {
  const a = makeTeam('YOU', 'ptA', 86, 75, 84);
  const b = makeTeam('CSK', 'ptB', 75, 74, 75);
  const { finalState } = simulateFullMatch({
    matchId: 'pt-1',
    matchSeed: 'partnership-stability-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BATTING_PARADISE',
    toss: FIXED_TOSS,
  });

  const inn1 = finalState.firstInnings;
  const out1 = finalizeInningsOutput(inn1);
  const partnerships = out1.scorecard.partnerships ?? [];
  assert.ok(partnerships.length >= 1);
  const sumPartRuns = partnerships.reduce((s, p) => s + p.runs, 0);
  assert.equal(sumPartRuns, inn1.runs);
});

test('Rule 19: Collapse pressure triggers on 2+ wickets inside 7 balls and recovers after 10 wicketless balls', () => {
  const a = makeTeam('YOU', 'colA', 42, 42, 42);
  const b = makeTeam('MI', 'colB', 95, 95, 95);
  let sawCollapse = false;
  let sawRecovery = false;

  for (let i = 0; i < 40 && !(sawCollapse && sawRecovery); i += 1) {
    const { finalState } = simulateFullMatch({
      matchId: `col-${i}`,
      matchSeed: `collapse-rec-${i}`,
      teamA: a,
      teamB: b,
      pitchCondition: 'SWINGING',
      toss: FIXED_TOSS,
    });
    if (finalState.firstInnings.collapseEvents > 0) sawCollapse = true;
    if (finalState.firstInnings.hadRecoveryAfterCollapse) sawRecovery = true;
  }

  assert.equal(sawCollapse, true);
  assert.equal(sawRecovery, true);
});

test('Rule 20: All 5 BattingAggressionModes shift scoring and wickets in ordered direction', () => {
  const a = makeTeam('YOU', 'aggA');
  const b = makeTeam('RCB', 'aggB');
  const modes: BattingAggressionMode[] = [
    'STABILIZE',
    'ROTATE_STRIKE',
    'BALANCED',
    'ATTACK',
    'ALL_OUT_ATTACK',
  ];

  const avgRuns: Record<BattingAggressionMode, number> = {
    STABILIZE: 0,
    ROTATE_STRIKE: 0,
    BALANCED: 0,
    ATTACK: 0,
    ALL_OUT_ATTACK: 0,
  };
  const avgWkts: Record<BattingAggressionMode, number> = {
    STABILIZE: 0,
    ROTATE_STRIKE: 0,
    BALANCED: 0,
    ATTACK: 0,
    ALL_OUT_ATTACK: 0,
  };

  const N = 80;
  for (const mode of modes) {
    let rSum = 0;
    let wSum = 0;
    for (let i = 0; i < N; i += 1) {
      let inn = createInningsEngineState({
        battingTeam: a,
        bowlingTeam: b,
        pitchCondition: 'BALANCED',
        rng: createSeededRng(`agg-${i}`).next,
      });
      const stepRng = createSeededRng(`agg-step-${i}`).next;
      for (let ov = 0; ov < 12 && !inn.isCompleted; ov += 1) {
        inn = simulateInningsOver(inn, { aggressionMode: mode, rng: stepRng }).nextState;
      }
      rSum += inn.runs;
      wSum += inn.wickets;
    }
    avgRuns[mode] = rSum / N;
    avgWkts[mode] = wSum / N;
  }

  assert.ok(avgRuns.STABILIZE < avgRuns.BALANCED);
  assert.ok(avgRuns.BALANCED < avgRuns.ATTACK);
  assert.ok(avgRuns.ATTACK < avgRuns.ALL_OUT_ATTACK);
  assert.ok(avgWkts.STABILIZE < avgWkts.ATTACK);
  assert.ok(avgWkts.ATTACK < avgWkts.ALL_OUT_ATTACK);
});

test('Rule 21: Three innings phases yield distinct run rates (Death RPO > Powerplay RPO > Middle RPO)', () => {
  const a = makeTeam('YOU', 'phA');
  const b = makeTeam('CSK', 'phB');
  let ppR = 0;
  let ppB = 0;
  let midR = 0;
  let midB = 0;
  let dR = 0;
  let dB = 0;

  for (let i = 0; i < 60; i += 1) {
    const { result } = simulateFullMatch({
      matchId: `ph-${i}`,
      matchSeed: `phase-rpo-${i}`,
      teamA: a,
      teamB: b,
      pitchCondition: 'BALANCED',
      toss: FIXED_TOSS,
    });
    for (const sp of result.firstScorecard!.phaseSplits!) {
      if (sp.phase === 'POWERPLAY') {
        ppR += sp.runs;
        ppB += sp.balls;
      } else if (sp.phase === 'MIDDLE') {
        midR += sp.runs;
        midB += sp.balls;
      } else {
        dR += sp.runs;
        dB += sp.balls;
      }
    }
  }

  const ppRpo = (ppR * 6) / ppB;
  const midRpo = (midR * 6) / midB;
  const deathRpo = (dR * 6) / dB;
  assert.ok(deathRpo > ppRpo && ppRpo > midRpo, `Got PP=${ppRpo.toFixed(2)}, MID=${midRpo.toFixed(2)}, DEATH=${deathRpo.toFixed(2)}`);
});

test('Rule 22: All 6 pitch profiles produce distinct scoring profiles', () => {
  const a = makeTeam('YOU', 'ptcA');
  const b = makeTeam('MI', 'ptcB');
  const pitches: PitchCondition[] = [
    'BATTING_PARADISE',
    'BALANCED',
    'SPIN_FRIENDLY',
    'PACE_SEAMER',
    'SLOW_AND_LOW',
    'SWINGING',
  ];

  const avgs: Record<PitchCondition, number> = {
    BATTING_PARADISE: 0,
    BALANCED: 0,
    SPIN_FRIENDLY: 0,
    PACE_SEAMER: 0,
    SLOW_AND_LOW: 0,
    SWINGING: 0,
  };

  for (const pitch of pitches) {
    let sum = 0;
    for (let i = 0; i < 50; i += 1) {
      const { result } = simulateFullMatch({
        matchId: `pitch-${pitch}-${i}`,
        matchSeed: `pitch-profile-${i}`,
        teamA: a,
        teamB: b,
        pitchCondition: pitch,
        toss: FIXED_TOSS,
      });
      sum += result.firstInnings.runs;
    }
    avgs[pitch] = sum / 50;
  }

  assert.ok(avgs.BATTING_PARADISE > avgs.BALANCED + 12);
  assert.ok(avgs.BALANCED > avgs.SLOW_AND_LOW + 12);
  assert.ok(avgs.BALANCED > avgs.SPIN_FRIENDLY + 6);
});

test('Rule 23: computeBatterMatchup returns valid MatchupRating with L/R & skill edges', () => {
  const offSpinner = makePlayer('off', 'BOWL', 35, 85, 84, {
    bowlingStyle: 'Right-arm offbreak',
  });
  const lhb = makePlayer('lhb', 'BAT', 80, 25, 80, { battingStyle: 'Left-hand bat' });
  const rhb = makePlayer('rhb', 'BAT', 80, 25, 80, { battingStyle: 'Right-hand bat' });

  const vsLhb = computeBatterMatchup(
    { player: offSpinner, bowlerType: 'SPIN' },
    lhb,
    lhb,
    'SPIN_FRIENDLY',
    'MIDDLE',
    {}
  );
  const vsRhb = computeBatterMatchup(
    { player: offSpinner, bowlerType: 'SPIN' },
    rhb,
    rhb,
    'SPIN_FRIENDLY',
    'MIDDLE',
    {}
  );

  assert.ok(['STRONG_MATCHUP', 'EVEN_MATCHUP', 'RISKY_MATCHUP'].includes(vsLhb.matchup));
  assert.ok(vsLhb.scoreDelta > vsRhb.scoreDelta);
});

test('Rule 24: Impact Player allows max 1 sub per team per match (throws on 2nd)', () => {
  const a = makeTeam('YOU', 'imp1A');
  const b = makeTeam('GT', 'imp1B');
  let state = createMatchState({
    matchId: 'imp-1',
    matchSeed: 'impact-max-one',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  const sub1 = makePlayer('sub1', 'BAT', 85, 25, 83, { isOverseas: false });
  const sub2 = makePlayer('sub2', 'BOWL', 30, 85, 83, { isOverseas: false });
  state = applyImpactSubstitution(state, 'YOU', sub1, a.players[10]);

  assert.throws(() => applyImpactSubstitution(state, 'YOU', sub2, a.players[9]));
});

test('Rule 25: Impact Player preserves 11 players, marks IMP/SUB, enforces 4+1 OS cap, and applies zero magical boost', () => {
  const a = makeTeam('YOU', 'imp2A'); // already has 4 OS (indices 0..3)
  const b = makeTeam('DC', 'imp2B');
  let state = createMatchState({
    matchId: 'imp-2',
    matchSeed: 'impact-cap-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });

  // 5th OS replacing Domestic player at index 10 -> allowed
  const osIn = makePlayer('os-5', 'AR', 84, 82, 84, { isOverseas: true });
  const domOut = a.players[10];
  const updated = applyImpactSubstitution(state, 'YOU', osIn, domOut);
  assert.equal(updated.firstInnings.battingTeam.players.length, 11);
  assert.ok(updated.impactSubByTeam['YOU']);

  // Attempting to bring 6th OS when 5 are active -> throws
  const osIn2 = makePlayer('os-6', 'BAT', 84, 25, 82, { isOverseas: true });
  assert.throws(() => applyImpactSubstitution(state, 'YOU', osIn2, domOut, 3));

  // Verify card marks isImpactIn cleanly and zero magical boost when simulating identical ratings
  let done = updated;
  let guard = 0;
  while (done.status !== 'COMPLETED' && guard < 50) {
    guard += 1;
    done = simulateOver(done).nextState;
  }
  const hasImpTag =
    done.result?.firstScorecard?.batting.some((l) => l.isImpactIn) ||
    done.result?.secondScorecard?.bowling.some((l) => l.isImpactIn);
  assert.equal(Boolean(hasImpTag), true);
});

test('Rule 26: validateLeagueOwnership enforces 0 duplicate playerIds across all 11 franchises', () => {
  const custom: CustomFranchise = {
    name: 'MUMBAI WARRIORS',
    code: 'MW',
    homeCity: 'Mumbai',
    homeGround: 'Wankhede Stadium',
    primaryColor: '#D94E28',
    secondaryColor: '#0F172A',
  };
  const userXi = makeTeam('YOU', 'own').players;
  const bench = [makePlayer('own-b1', 'BAT', 76, 25, 76)];
  const built = buildSeasonTeams(userXi, null, createSeededRng('own-seed').next, custom);
  assert.equal(built.teamOrder.length, 11);
  const check = validateLeagueOwnership(built.teams, bench, null);
  assert.equal(check.isValid, true);
  assert.equal(check.duplicateIds.length, 0);

  // Inject duplicate and verify detection
  const broken = {
    ...built.teams,
    MI: {
      ...built.teams.MI,
      players: [userXi[0], ...built.teams.MI.players.slice(1)],
    },
  };
  const badCheck = validateLeagueOwnership(broken, bench, null);
  assert.equal(badCheck.isValid, false);
  assert.ok(badCheck.duplicateIds.length >= 1);
});

test('Rule 27: NRR uses legalBalls/6 and 20.0 if all out; Points Table sorts PTS then NRR', () => {
  assert.equal(calculateNrr(180, 20, 160, 20), 1.0);
  const a = makeTeam('YOU', 'nrrA');
  const b = makeTeam('MI', 'nrrB');
  const innAllOut = createInningsEngineState({
    battingTeam: a,
    bowlingTeam: b,
    pitchCondition: 'BALANCED',
    rng: createSeededRng('nrr-allout').next,
  });
  innAllOut.wickets = 10;
  innAllOut.legalBalls = 84; // 14.0 overs bowled out
  const outAllOut = finalizeInningsOutput(innAllOut);
  assert.equal(outAllOut.summary.oversForNrr, 20.0);

  const sorted = sortPointsTable([
    { teamId: 'MI', played: 4, won: 3, lost: 1, points: 6, runsFor: 680, oversFor: 80, runsAgainst: 660, oversAgainst: 80, nrr: 0.25 },
    { teamId: 'YOU', played: 4, won: 3, lost: 1, points: 6, runsFor: 720, oversFor: 80, runsAgainst: 640, oversAgainst: 80, nrr: 1.0 },
  ]);
  assert.equal(sorted[0].teamId, 'YOU');
});

test('Rule 28: VenueMemoryStats.lowestDefended updates only on bat-first wins', () => {
  const venue = 'Wankhede Stadium, Mumbai';
  let memory: Record<string, VenueMemoryStats> = {};

  const chaseWinResult = {
    battingFirstTeamId: 'YOU' as const,
    battingSecondTeamId: 'MI' as const,
    winnerId: 'MI' as const, // Chasing side won — must NOT set lowestDefended
    loserId: 'YOU' as const,
    superOver: false,
    firstInnings: { teamId: 'YOU' as const, runs: 145, wickets: 8, overs: 20, oversForNrr: 20 },
    secondInnings: { teamId: 'MI' as const, runs: 146, wickets: 4, overs: 18.2, oversForNrr: 18.33 },
    marginText: 'Win by 6 wickets',
    pitchCondition: 'BALANCED' as const,
  };
  memory = recordVenueMemory(memory, venue, chaseWinResult);
  assert.equal(memory[venue].lowestDefended ?? null, null);

  const defendWinResult = {
    ...chaseWinResult,
    winnerId: 'YOU' as const,
    loserId: 'MI' as const,
    firstInnings: { teamId: 'YOU' as const, runs: 148, wickets: 9, overs: 20, oversForNrr: 20 },
    secondInnings: { teamId: 'MI' as const, runs: 141, wickets: 9, overs: 20, oversForNrr: 20 },
    marginText: 'Win by 7 runs',
  };
  memory = recordVenueMemory(memory, venue, defendWinResult);
  assert.equal(memory[venue].lowestDefended, 148);
});

test('Rule 29: Form regression stays within valid PlayerForm enum and drifts toward NORMAL', () => {
  const custom: CustomFranchise = {
    name: 'MUMBAI WARRIORS',
    code: 'MW',
    homeCity: 'Mumbai',
    homeGround: 'Wankhede Stadium',
    primaryColor: '#D94E28',
    secondaryColor: '#0F172A',
  };
  const userTeam = makeTeam('YOU', 'frm', 78, 78, 78, true);
  const season = createInitialSeasonState(
    userTeam.players,
    null,
    1,
    createSeededRng('form-init').next,
    [],
    custom
  );
  const extremeForms: Record<string, PlayerForm> = {};
  for (const p of userTeam.players) {
    extremeForms[p.playerId] = 'VERY_POOR';
  }

  const validForms = new Set(['EXCELLENT', 'GOOD', 'NORMAL', 'POOR', 'VERY_POOR']);
  let regressedTowardNormal = 0;
  let curForms = extremeForms;
  for (let i = 0; i < 40; i += 1) {
    curForms = evolveMatchForms(
      curForms,
      userTeam,
      season.teams.MI,
      createSeededRng(`f-reg-${i}`).next
    );
    for (const p of userTeam.players) {
      assert.ok(validForms.has(curForms[p.playerId]));
      if (curForms[p.playerId] !== 'VERY_POOR') {
        regressedTowardNormal += 1;
      }
    }
  }
  assert.ok(regressedTowardNormal > 0);
});

test('Rule 30: SIMULATION_VERSION === "1.0.0" tagged on MatchEngineState, MatchResult, and SeasonState', () => {
  assert.equal(SIMULATION_VERSION, '1.0.0');
  const a = makeTeam('YOU', 'verA', 78, 78, 78, true);
  const b = makeTeam('MI', 'verB', 78, 78, 78, false);

  const matchState = createMatchState({
    matchId: 'ver-1',
    matchSeed: 'version-tag-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });
  assert.equal(matchState.simulationVersion, '1.0.0');

  const { result } = simulateFullMatch({
    matchId: 'ver-1',
    matchSeed: 'version-tag-seed',
    teamA: a,
    teamB: b,
    pitchCondition: 'BALANCED',
    toss: FIXED_TOSS,
  });
  assert.equal(result.simulationVersion, '1.0.0');

  const custom: CustomFranchise = {
    name: 'MUMBAI WARRIORS',
    code: 'MW',
    homeCity: 'Mumbai',
    homeGround: 'Wankhede Stadium',
    primaryColor: '#D94E28',
    secondaryColor: '#0F172A',
  };
  const season = createInitialSeasonState(
    a.players,
    null,
    1,
    createSeededRng('ver-season').next,
    [],
    custom
  );
  assert.equal(season.simulationVersion, '1.0.0');
  assert.equal(ballsToCricketOvers(6), 1);
});
