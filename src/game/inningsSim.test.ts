import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyImpactPlayerToInnings,
  ballsToCricketOvers,
  createInitialInningsState,
  finalizeInningsOutput,
  getBatterSettlingModifiers,
  getBowlerSelectionOptions,
  getCollapseStabilizationRating,
  getPhaseBattingRating,
  getPhaseBowlingRating,
  isBowlerEligible,
  pickAutoBowler,
  resolveSituationalPlayerRatings,
  simulateSingleOver,
  simulateT20InningsBallByBall,
} from './inningsSim';
import { recommendImpactPlayer } from './matchEngine';
import { SIM_CONFIG } from './simConfig';
import { getRatingBand } from './ratingEngine';
import type {
  PlayerDetailedAttributes,
  PlayerRole,
  PlayerSeasonRecord,
  SeasonTeam,
} from '../types/game';

function seededRng(seedInput: number): () => number {
  let s = seedInput >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

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
    battingStyle: 'Right-hand bat',
    bowlingStyle:
      opts?.bowlingStyle ?? (role === 'BOWL' ? 'Right-arm fast' : role === 'AR' ? 'Right-arm offbreak' : 'None'),
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
    priceCr: 8,
    ratingStatus: 'PROVISIONAL',
  };
}

function makeBalancedTeam(id: SeasonTeam['id'], prefix: string, bat = 78, bowl = 78, ovr = 78): SeasonTeam {
  const roles: PlayerRole[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL'];
  const players = roles.map((role, idx) =>
    makePlayer(
      `${prefix}_${idx}`,
      role,
      role === 'BOWL' ? Math.max(25, bat - 40) : bat,
      role === 'BAT' || role === 'WK' ? Math.max(22, bowl - 45) : bowl,
      ovr,
      {
        isOverseas: idx < 4,
        bowlingStyle:
          idx >= 7
            ? idx % 2 === 0
              ? 'Right-arm fast'
              : 'Slow left-arm orthodox'
            : role === 'AR'
              ? 'Right-arm offbreak'
              : 'None',
      }
    )
  );
  return {
    id,
    code: id,
    name: `Team ${id}`,
    shortName: id,
    primaryColor: '#1E40AF',
    homeVenue: 'Wankhede Stadium',
    isUser: id === 'YOU',
    players,
  };
}

test('Three innings phases produce distinct scoring and wicket rates (Death RPO > Powerplay RPO > Middle RPO)', () => {
  const teamA = makeBalancedTeam('YOU', 'a', 78, 78, 78);
  const teamB = makeBalancedTeam('MI', 'b', 78, 78, 78);
  const rng = seededRng(2025);

  let ppRuns = 0;
  let ppBalls = 0;
  let ppWkts = 0;
  let midRuns = 0;
  let midBalls = 0;
  let midWkts = 0;
  let deathRuns = 0;
  let deathBalls = 0;
  let deathWkts = 0;
  let collapseInnings = 0;

  const N = 220;
  for (let i = 0; i < N; i += 1) {
    const out = simulateT20InningsBallByBall({
      battingTeam: teamA,
      bowlingTeam: teamB,
      pitchCondition: 'BALANCED',
      playerForms: {},
      homeEdgeTeamId: 'YOU',
      rng,
    });
    const pp = out.scorecard.phaseSplits!.find((s) => s.phase === 'POWERPLAY')!;
    const mid = out.scorecard.phaseSplits!.find((s) => s.phase === 'MIDDLE')!;
    const death = out.scorecard.phaseSplits!.find((s) => s.phase === 'DEATH')!;

    assert.equal(
      pp.runs + mid.runs + death.runs,
      out.summary.runs,
      'Phase split runs must equal innings runs'
    );
    assert.equal(
      pp.wickets + mid.wickets + death.wickets,
      out.summary.wickets,
      'Phase split wickets must equal innings wickets'
    );

    ppRuns += pp.runs;
    ppBalls += pp.balls;
    ppWkts += pp.wickets;
    midRuns += mid.runs;
    midBalls += mid.balls;
    midWkts += mid.wickets;
    deathRuns += death.runs;
    deathBalls += death.balls;
    deathWkts += death.wickets;
    if ((out.scorecard.collapseEvents ?? 0) > 0) collapseInnings += 1;
  }

  const ppRpo = (ppRuns * 6) / ppBalls;
  const midRpo = (midRuns * 6) / midBalls;
  const deathRpo = (deathRuns * 6) / deathBalls;
  const ppWktPerBall = ppWkts / ppBalls;
  const midWktPerBall = midWkts / midBalls;
  const deathWktPerBall = deathWkts / deathBalls;

  assert.ok(deathRpo > ppRpo, `Expected Death RPO (${deathRpo.toFixed(2)}) > PP RPO (${ppRpo.toFixed(2)})`);
  assert.ok(ppRpo > midRpo, `Expected PP RPO (${ppRpo.toFixed(2)}) > Middle RPO (${midRpo.toFixed(2)})`);
  assert.ok(deathWktPerBall > midWktPerBall, 'Death wicket hazard should exceed Middle Overs');
  assert.ok(ppWktPerBall > midWktPerBall, 'New-ball Powerplay wicket hazard should exceed Middle Overs');
  assert.ok(collapseInnings > 0 && collapseInnings < N, 'Collapse pressure triggers on a realistic subset of innings');
});

test('Batter settling rewards set batters so a set BAT 85 outperforms a fresh BAT 92', () => {
  const fresh = getBatterSettlingModifiers(0);
  const mid = getBatterSettlingModifiers(4);
  const set = getBatterSettlingModifiers(12);

  assert.equal(fresh.isSettled, false);
  assert.equal(set.isSettled, true);
  assert.ok(fresh.scoringMultiplier < mid.scoringMultiplier);
  assert.ok(mid.scoringMultiplier < set.scoringMultiplier);
  assert.ok(fresh.wicketMultiplier > 1);
  assert.ok(set.wicketMultiplier < 1);

  const set85Effective = 85 * set.scoringMultiplier;
  const fresh92Effective = 92 * fresh.scoringMultiplier;
  assert.ok(
    set85Effective > fresh92Effective,
    `Expected set BAT 85 (${set85Effective.toFixed(1)}) > fresh BAT 92 (${fresh92Effective.toFixed(1)})`
  );
});

test('Contextual wicket value scales disruption strongest in Powerplay and lightest in Death', () => {
  const { POWERPLAY, MIDDLE, DEATH } = SIM_CONFIG.wicketValue;
  assert.ok(POWERPLAY.disruptionBalls > MIDDLE.disruptionBalls);
  assert.ok(MIDDLE.disruptionBalls > DEATH.disruptionBalls);
  assert.ok(POWERPLAY.scoringMultiplier < MIDDLE.scoringMultiplier);
  assert.ok(MIDDLE.scoringMultiplier < DEATH.scoringMultiplier);
  assert.ok(POWERPLAY.wicketRiskMultiplier > MIDDLE.wicketRiskMultiplier);
  assert.ok(MIDDLE.wicketRiskMultiplier > DEATH.wicketRiskMultiplier);
});

test('Collapse stabilization favors high technique/pressure/consistency over brittle sloggers', () => {
  const stabilizer = makePlayer('stab', 'BAT', 80, 25, 84, {
    overrides: {
      batting: { technique: 94, pressure: 93, power: 68 },
      other: { consistency: 92 },
    },
  });
  const brittleSlogger = makePlayer('slog', 'BAT', 80, 25, 76, {
    overrides: {
      batting: { technique: 56, pressure: 54, power: 96 },
      other: { consistency: 55 },
    },
  });

  const stabScore = getCollapseStabilizationRating(stabilizer);
  const slogScore = getCollapseStabilizationRating(brittleSlogger);
  assert.ok(stabScore > slogScore + 20, `Expected stabilizer (${stabScore}) >> slogger (${slogScore})`);
});

test('Strong finishers batting from ~115-125 after 15 overs regularly finish 175-198 naturally', () => {
  const finishersTeam = makeBalancedTeam('YOU', 'fin', 80, 78, 80);
  // Give #4-#7 elite death finishing ratings
  for (let idx = 3; idx <= 6; idx += 1) {
    finishersTeam.players[idx] = makePlayer(`fin_${idx}`, finishersTeam.players[idx].role, 85, 50, 84, {
      overrides: {
        batting: { power: 93, finishing: 95, deathOvers: 94, pressure: 90 },
        other: { impactAbility: 92 },
      },
    });
  }
  const opp = makeBalancedTeam('CSK', 'opp', 76, 76, 76);
  const rng = seededRng(888);

  let reachedWindow = 0;
  let hit175Plus = 0;
  for (let i = 0; i < 300; i += 1) {
    const out = simulateT20InningsBallByBall({
      battingTeam: finishersTeam,
      bowlingTeam: opp,
      pitchCondition: 'BALANCED',
      playerForms: {},
      rng,
    });
    const pp = out.scorecard.phaseSplits!.find((s) => s.phase === 'POWERPLAY')!;
    const mid = out.scorecard.phaseSplits!.find((s) => s.phase === 'MIDDLE')!;
    const at15 = pp.runs + mid.runs;
    if (at15 >= 115 && at15 <= 125) {
      reachedWindow += 1;
      if (out.summary.runs >= 175) hit175Plus += 1;
    }
  }
  assert.ok(reachedWindow >= 15, `Expected sample in 115-125 after 15 overs, got ${reachedWindow}`);
  assert.ok(
    hit175Plus / reachedWindow >= 0.4,
    `Expected strong finishers at 115-125/15ov to finish 175+ regularly (${hit175Plus}/${reachedWindow})`
  );
});

test('resolveSituationalPlayerRatings falls back gracefully when detailed attributes are absent', () => {
  const barePlayer = makePlayer('bare', 'AR', 84, 79, 82);
  (barePlayer as { attributes?: PlayerDetailedAttributes }).attributes = undefined;

  const resolved = resolveSituationalPlayerRatings(barePlayer, 'GOOD');
  assert.ok(resolved.batting.powerplay >= 75 && resolved.batting.powerplay <= 99);
  assert.ok(resolved.bowling.deathBowling >= 70 && resolved.bowling.deathBowling <= 99);
  assert.ok(getPhaseBattingRating(barePlayer, 'DEATH', 'NORMAL') >= 75);
  assert.ok(getPhaseBowlingRating(barePlayer, 'POWERPLAY', 'NORMAL') >= 70);
});

test('recommendImpactPlayer picks lower-OVR tactical specialist over higher-OVR generalist across all 5 situations', () => {
  const xi = makeBalancedTeam('YOU', 'xi', 80, 80, 80).players; // 4 overseas at indices 0..3

  // Bench:
  // 1) High-OVR generalist (OVR 88) with moderate 74 specialist numbers
  const highOvrGeneralist = makePlayer('gen', 'AR', 86, 82, 88, {
    overrides: {
      batting: { technique: 74, pressure: 74, spinHitting: 72, finishing: 75, power: 76, deathOvers: 74, strikeRotation: 75, middleOvers: 75 },
      bowling: { wicketTaking: 72, deathBowling: 71, control: 72, variation: 70, economy: 72 },
      other: { consistency: 74, impactAbility: 76 },
    },
  });

  // 2) Lower-OVR Collapse Anchor (OVR 78)
  const anchorSpec = makePlayer('anchor', 'BAT', 81, 22, 78, {
    overrides: {
      batting: { technique: 95, pressure: 94, middleOvers: 90, finishing: 62 },
      other: { consistency: 93 },
    },
  });

  // 3) Lower-OVR Spin Basher (OVR 78)
  const spinBasher = makePlayer('spinbat', 'BAT', 81, 22, 78, {
    overrides: {
      batting: { spinHitting: 96, strikeRotation: 92, middleOvers: 91, technique: 76 },
    },
  });

  // 4) Lower-OVR Death Finisher (OVR 79)
  const finisherSpec = makePlayer('finish', 'BAT', 83, 25, 79, {
    overrides: {
      batting: { finishing: 96, power: 95, deathOvers: 94, pressure: 91, spinHitting: 66 },
      other: { impactAbility: 93 },
    },
  });

  // 5) Lower-OVR Strike Wicket-Taker (OVR 79)
  const strikeBowler = makePlayer('strike', 'BOWL', 30, 84, 79, {
    overrides: {
      bowling: { wicketTaking: 96, variation: 92, deathBowling: 70, control: 72 },
      other: { impactAbility: 92 },
    },
  });

  // 6) Lower-OVR Death Yorker Specialist (OVR 79)
  const deathBowler = makePlayer('deathbwl', 'BOWL', 28, 84, 79, {
    overrides: {
      bowling: { deathBowling: 96, control: 94, variation: 91, economy: 93, wicketTaking: 74 },
    },
  });

  const bench = [highOvrGeneralist, anchorSpec, spinBasher, finisherSpec, strikeBowler, deathBowler];

  const ppCollapseRecs = recommendImpactPlayer({ situation: 'POWERPLAY_COLLAPSE', benchPlayers: bench, activeXi: xi });
  assert.equal(ppCollapseRecs[0].playerId, 'anchor');

  const midSpinRecs = recommendImpactPlayer({ situation: 'MIDDLE_VS_SPIN', benchPlayers: bench, activeXi: xi });
  assert.equal(midSpinRecs[0].playerId, 'spinbat');

  const deathFinRecs = recommendImpactPlayer({ situation: 'DEATH_FINISH', benchPlayers: bench, activeXi: xi });
  assert.equal(deathFinRecs[0].playerId, 'finish');

  const wicketRecs = recommendImpactPlayer({ situation: 'NEED_WICKETS', benchPlayers: bench, activeXi: xi });
  assert.equal(wicketRecs[0].playerId, 'strike');

  const defendDeathRecs = recommendImpactPlayer({ situation: 'DEFENDING_DEATH', benchPlayers: bench, activeXi: xi });
  assert.equal(defendDeathRecs[0].playerId, 'deathbwl');
});

test('All 6 pitch types produce distinct scoring and phase wicket profiles', () => {
  const teamA = makeBalancedTeam('YOU', 'pA', 78, 78, 78);
  const teamB = makeBalancedTeam('CSK', 'pB', 78, 78, 78);

  const avgForPitch = (pitch: Parameters<typeof simulateT20InningsBallByBall>[0]['pitchCondition'], seed: number) => {
    const rng = seededRng(seed);
    let runs = 0;
    let ppWkts = 0;
    const N = 120;
    for (let i = 0; i < N; i += 1) {
      const out = simulateT20InningsBallByBall({
        battingTeam: teamA,
        bowlingTeam: teamB,
        pitchCondition: pitch,
        playerForms: {},
        rng,
      });
      runs += out.summary.runs;
      ppWkts += out.scorecard.phaseSplits!.find((s) => s.phase === 'POWERPLAY')!.wickets;
    }
    return { avgRuns: runs / N, avgPpWkts: ppWkts / N };
  };

  const paradise = avgForPitch('BATTING_PARADISE', 101);
  const balanced = avgForPitch('BALANCED', 102);
  const slowLow = avgForPitch('SLOW_AND_LOW', 103);
  const swinging = avgForPitch('SWINGING', 104);
  const paceSeamer = avgForPitch('PACE_SEAMER', 105);
  const spinFriendly = avgForPitch('SPIN_FRIENDLY', 106);

  assert.ok(
    paradise.avgRuns > balanced.avgRuns + 8,
    `Expected BATTING_PARADISE (${paradise.avgRuns.toFixed(1)}) > BALANCED (${balanced.avgRuns.toFixed(1)})`
  );
  assert.ok(
    slowLow.avgRuns < balanced.avgRuns - 6,
    `Expected SLOW_AND_LOW (${slowLow.avgRuns.toFixed(1)}) < BALANCED (${balanced.avgRuns.toFixed(1)})`
  );
  assert.ok(
    swinging.avgPpWkts > balanced.avgPpWkts,
    `Expected SWINGING PP wickets (${swinging.avgPpWkts.toFixed(2)}) > BALANCED (${balanced.avgPpWkts.toFixed(2)})`
  );
  assert.ok(paceSeamer.avgRuns < paradise.avgRuns);
  assert.ok(spinFriendly.avgRuns < paradise.avgRuns);
});

test('Bowling management enforces 4-over max, no consecutive overs, part-timers, and subbed-out lock', () => {
  const batTeam = makeBalancedTeam('CSK', 'bat', 78, 78, 78);
  const bowlTeam = makeBalancedTeam('YOU', 'bwl', 78, 78, 78);
  // Make BAT at index 4 an eligible part-timer (BOWL >= 42) and WK at index 0 ineligible
  bowlTeam.players[4] = makePlayer('bwl_part', 'BAT', 79, 46, 75, {
    bowlingStyle: 'Right-arm offbreak',
  });

  assert.equal(isBowlerEligible(bowlTeam.players[0]).eligible, false);
  const partElig = isBowlerEligible(bowlTeam.players[4]);
  assert.equal(partElig.eligible, true);
  assert.equal(partElig.isPartTimer, true);

  assert.equal(ballsToCricketOvers(23), 3.5);
  assert.equal(ballsToCricketOvers(24), 4);

  let state = createInitialInningsState({
    battingTeam: batTeam,
    bowlingTeam: bowlTeam,
    pitchCondition: 'BALANCED',
    playerForms: {},
    difficulty: 'EXPERT',
    rng: seededRng(55),
  });

  const opt0 = getBowlerSelectionOptions(state);
  const wkOpt = opt0.find((o) => o.player.playerId === bowlTeam.players[0].playerId)!;
  assert.equal(wkOpt.canBowlNow, false);
  assert.equal(wkOpt.disabledReason, 'NOT ELIGIBLE TO BOWL');
  const partOpt = opt0.find((o) => o.player.playerId === 'bwl_part')!;
  assert.equal(partOpt.canBowlNow, true);
  assert.equal(partOpt.isPartTimer, true);

  // Pick bowler A (index 7) for Over 1, then verify BOWLED PREVIOUS OVER in Over 2
  const bowlerAId = bowlTeam.players[7].playerId;
  const bowlerBId = bowlTeam.players[8].playerId;

  const ov1 = simulateSingleOver(state, { bowlerId: bowlerAId, planId: 'ATTACK_WICKETS', rng: seededRng(1) });
  state = ov1.nextState;
  assert.ok(ov1.overSummary);

  const optAfter1 = getBowlerSelectionOptions(state);
  const aAfter1 = optAfter1.find((o) => o.player.playerId === bowlerAId)!;
  assert.equal(aAfter1.canBowlNow, false);
  assert.equal(aAfter1.disabledReason, 'BOWLED PREVIOUS OVER');
  assert.equal(aAfter1.oversRemaining, 3);

  // Alternate A & B until A completes 4 overs (overs 1, 3, 5, 7)
  state = simulateSingleOver(state, { bowlerId: bowlerBId, rng: seededRng(2) }).nextState;
  state = simulateSingleOver(state, { bowlerId: bowlerAId, rng: seededRng(3) }).nextState;
  state = simulateSingleOver(state, { bowlerId: bowlerBId, rng: seededRng(4) }).nextState;
  state = simulateSingleOver(state, { bowlerId: bowlerAId, rng: seededRng(5) }).nextState;
  state = simulateSingleOver(state, { bowlerId: bowlerBId, rng: seededRng(6) }).nextState;
  state = simulateSingleOver(state, { bowlerId: bowlerAId, rng: seededRng(7) }).nextState;

  // After over 7, A has 4 overs bowled -> MAXIMUM 4 OVERS COMPLETE
  // Bowl over 8 with B so A isn't blocked by BOWLED PREVIOUS OVER
  state = simulateSingleOver(state, { bowlerId: bowlerBId, rng: seededRng(8) }).nextState;
  const optAfter8 = getBowlerSelectionOptions(state);
  const aAfter8 = optAfter8.find((o) => o.player.playerId === bowlerAId)!;
  assert.equal(aAfter8.canBowlNow, false);
  assert.equal(aAfter8.disabledReason, 'MAXIMUM 4 OVERS COMPLETE');
  assert.equal(aAfter8.oversRemaining, 0);

  // Mid-innings Impact Player: sub out bowlerC (index 9) for bench pacer
  const bowlerCId = bowlTeam.players[9].playerId;
  const impactIn = makePlayer('impact_pacer', 'BOWL', 25, 89, 86, { bowlingStyle: 'Right-arm fast' });
  state = applyImpactPlayerToInnings(
    state,
    {
      teamId: 'YOU',
      inPlayerId: impactIn.playerId,
      inPlayerName: impactIn.playerName,
      outPlayerId: bowlerCId,
      outPlayerName: bowlTeam.players[9].playerName,
      overLabel: '8.0',
      wasFifthOverseas: false,
    },
    impactIn
  );

  const optImpact = getBowlerSelectionOptions(state);
  assert.equal(optImpact.find((o) => o.player.playerId === bowlerCId)?.disabledReason, 'SUBSTITUTED OUT');
  assert.equal(optImpact.find((o) => o.player.playerId === impactIn.playerId)?.canBowlNow, true);

  // Finish remaining overs via pickAutoBowler and verify exact totals & overHistory consistency
  const rng = seededRng(99);
  while (!state.isCompleted && state.completedOvers < 20) {
    const auto = pickAutoBowler(state, rng, 'EXPERT');
    state = simulateSingleOver(state, { bowlerId: auto.bowlerId, planId: auto.planId, rng }).nextState;
  }

  const finalOut = finalizeInningsOutput(state);
  const sumOverRuns = finalOut.scorecard.overHistory!.reduce((s, o) => s + o.runs, 0);
  assert.equal(sumOverRuns, finalOut.summary.runs);
  for (const b of finalOut.scorecard.bowling) {
    assert.ok((b.ballsBowled ?? 0) <= 24, `Bowler ${b.playerName} exceeded 4 overs (${b.ballsBowled} balls)`);
  }
});

