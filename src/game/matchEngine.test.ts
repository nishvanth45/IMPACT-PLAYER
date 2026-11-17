import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyUserTossDecision,
  checkImpactSubstitution,
  getPitchConditionForVenue,
  resolveToss,
} from './matchEngine';
import { getCapRaceLeaderboards, simulateT20Match, createInitialSeasonState, commitUserFixtureResult } from './seasonEngine';
import { getRatingBand } from './ratingEngine';
import type { PlayerDetailedAttributes, PlayerRole, PlayerSeasonRecord, SeasonTeam } from '../types/game';

function makeAttrs(bat: number, bowl: number, ovr: number): PlayerDetailedAttributes {
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

function makePlayer(
  id: string,
  role: PlayerRole,
  bat: number,
  bowl: number,
  ovr: number,
  isOverseas = false
): PlayerSeasonRecord {
  return {
    id,
    name: `Player ${id}`,
    playerId: id,
    playerName: `Player ${id}`,
    season: 2024,
    franchise: 'RCB',
    teamName: 'Royal Challengers Bengaluru',
    nationality: isOverseas ? 'Australia' : 'India',
    playerType: isOverseas ? 'Overseas' : 'Domestic',
    isOverseas,
    role,
    battingStyle: 'Right-hand bat',
    bowlingStyle: role === 'BOWL' ? 'Right-arm fast' : 'None',
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
    attributes: makeAttrs(bat, bowl, ovr),
    priceCr: 10,
    ratingStatus: 'PROVISIONAL',
  };
}

function makeBalancedXI(prefix: string, overseasCount = 4): PlayerSeasonRecord[] {
  const roles: PlayerRole[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL'];
  return roles.map((role, idx) =>
    makePlayer(`${prefix}-${idx}`, role, role === 'BOWL' ? 38 : 82, role === 'BAT' || role === 'WK' ? 28 : 82, 82, idx < overseasCount)
  );
}

test('resolveToss & applyUserTossDecision handle user and opponent wins deterministically', () => {
  const userWin = resolveToss('YOU', 'CSK', 'HEADS', 'BATTING_PARADISE', () => 0.1);
  assert.equal(userWin.outcome, 'HEADS');
  assert.equal(userWin.winnerTeamId, 'YOU');
  const updated = applyUserTossDecision(userWin, 'BOWL');
  assert.equal(updated.decision, 'BOWL');

  const oppWin = resolveToss('YOU', 'CSK', 'HEADS', 'SPIN_FRIENDLY', () => 0.8);
  assert.equal(oppWin.outcome, 'TAILS');
  assert.equal(oppWin.winnerTeamId, 'CSK');
  assert.ok(oppWin.decision === 'BAT' || oppWin.decision === 'BOWL');
});

test('checkImpactSubstitution allows 5th overseas Impact Player and blocks invalid swaps', () => {
  const xi = makeBalancedXI('u', 4);
  const domesticOut = xi[5]; // Domestic player at index 5
  const overseasIn = makePlayer('bench-os-1', 'BAT', 88, 25, 86, true);
  const res = checkImpactSubstitution(xi, overseasIn, domesticOut, 4);
  assert.equal(res.allowed, true);
  assert.equal(res.wasFifthOverseas, true);

  // If XI somehow already had 5 overseas, swapping domestic out for another overseas is blocked
  const xiFive = makeBalancedXI('f', 5);
  const resBlocked = checkImpactSubstitution(xiFive, overseasIn, xiFive[6], 4);
  assert.equal(resBlocked.allowed, false);
});

test('simulateT20Match generates consistent scorecards, highlights, POTM, Best Impact, and Impact Sub tags', () => {
  const userXi = makeBalancedXI('you', 4);
  const bench = [makePlayer('bench-imp', 'AR', 89, 84, 88, true)];
  const oppXi = makeBalancedXI('opp', 4);

  const homeTeam: SeasonTeam = {
    id: 'YOU',
    code: 'YOU',
    name: 'YOUR FRANCHISE',
    shortName: 'YOUR',
    primaryColor: '#D94E28',
    homeVenue: 'Wankhede Stadium, Mumbai',
    isUser: true,
    players: userXi,
  };
  const awayTeam: SeasonTeam = {
    id: 'MI',
    code: 'MI',
    name: 'Mumbai Indians',
    shortName: 'MI',
    primaryColor: '#004BA0',
    homeVenue: 'Wankhede Stadium, Mumbai',
    isUser: false,
    players: oppXi,
  };

  const toss = applyUserTossDecision(
    resolveToss('YOU', 'MI', 'HEADS', 'BATTING_PARADISE', () => 0.2),
    'BAT'
  );
  const impactSub = {
    teamId: 'YOU' as const,
    inPlayerId: bench[0].playerId,
    inPlayerName: bench[0].playerName,
    outPlayerId: userXi[10].playerId,
    outPlayerName: userXi[10].playerName,
    overLabel: '12.0',
    wasFifthOverseas: true,
  };

  function seededRng(seedInput: number): () => number {
    let s = seedInput >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const result = simulateT20Match(homeTeam, awayTeam, seededRng(42), {}, {
    venue: 'Wankhede Stadium, Mumbai',
    pitchCondition: getPitchConditionForVenue('Wankhede Stadium, Mumbai', seededRng(7)),
    toss,
    impactSub,
    impactInPlayer: bench[0],
  });

  assert.equal(result.battingFirstTeamId, 'YOU');
  assert.ok(result.firstScorecard);
  assert.ok(result.secondScorecard);
  assert.ok((result.highlights?.length ?? 0) >= 2);
  assert.ok(result.highlights?.some((h) => h.badge === 'IMPACT PLAYER ACTIVATED'));
  assert.ok(result.playerOfTheMatch);
  assert.ok(result.bestImpact);
  assert.equal(result.firstScorecard!.runs, result.firstInnings.runs);
  assert.equal(result.secondScorecard!.runs, result.secondInnings.runs);

  // Verify committing result updates playerStats & Cap Race leaderboards & impactHistory & venueStats
  const season = createInitialSeasonState(userXi, null, 1, seededRng(101), bench, 'MUMBAI ROYAL');
  const firstUserFix = season.fixtures.find((f) => f.userMatchNumber === 1)!;
  const updated = commitUserFixtureResult(season, firstUserFix.id, result, seededRng(202));
  assert.equal(updated.impactHistory?.length, 1);
  const caps = getCapRaceLeaderboards(updated);
  assert.ok(caps.orangeCap.length > 0);
  assert.ok(caps.purpleCap.length > 0);
  assert.ok(caps.impactLeaders.length > 0);
  assert.ok(updated.venueStats && updated.venueStats[firstUserFix.venue]?.matches >= 1);
});

test('getPitchConditionForVenue returns valid pitch types across all 6 conditions', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i += 1) {
    const venue = i % 3 === 0 ? 'MA Chidambaram Stadium' : i % 3 === 1 ? 'Wankhede Stadium' : 'Unknown Ground';
    const p = getPitchConditionForVenue(venue, () => (i * 0.137) % 1);
    seen.add(p);
  }
  assert.ok(seen.has('BATTING_PARADISE'));
  assert.ok(seen.has('SPIN_FRIENDLY'));
  assert.ok(seen.has('SLOW_AND_LOW'));
  assert.ok(seen.has('BALANCED'));
});

