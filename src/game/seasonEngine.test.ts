import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateNrr,
  calculateXiStrength,
  createInitialSeasonState,
  getUserFixtures,
  getUserStandingsInfo,
  quickSimPlayoffMatch,
  quickSimUserFixture,
  simulateT20Match,
  sortPointsTable,
} from './seasonEngine';
import { JsonIplRepository, parseIplDatabase } from '../data/playerRepository';
import { getRatingBand } from './ratingEngine';
import type {
  IplDatabaseJson,
  PlayerDetailedAttributes,
  PlayerRole,
  PlayerSeasonRecord,
  SeasonTeam,
} from '../types/game';

const dbPath = path.resolve(process.cwd(), 'public/impact_player_database.json');
const rawDbJson = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as IplDatabaseJson;
const realRepo = new JsonIplRepository(parseIplDatabase(rawDbJson));

function makeTestAttrs(bat: number, bowl: number, ovr: number): PlayerDetailedAttributes {
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

function makeXi(
  prefix: string,
  bat: number,
  bowl: number,
  ovr: number,
  balanced: boolean = true
): PlayerSeasonRecord[] {
  const roles: PlayerRole[] = balanced
    ? ['BAT', 'BAT', 'BAT', 'WK', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL']
    : ['BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT', 'BAT'];

  return roles.map((role, idx) => {
    const b = role === 'BOWL' ? Math.max(20, bat - 35) : bat;
    const bw = role === 'BAT' || role === 'WK' ? Math.max(20, bowl - 35) : bowl;
    return {
      id: `${prefix}_${idx}`,
      name: `${prefix} ${idx + 1}`,
      playerId: `${prefix}_${idx}`,
      playerName: `${prefix} ${idx + 1}`,
      season: 2024,
      franchise: 'MI',
      teamName: 'Mumbai Indians',
      nationality: idx < 4 ? 'Overseas' : 'India',
      playerType: idx < 4 ? 'Overseas' : 'Domestic',
      isOverseas: idx < 4,
      role,
      battingStyle: 'Right-hand bat',
      bowlingStyle: 'None',
      matches: 0,
      runs: 0,
      battingAverage: 0,
      strikeRate: 0,
      wickets: 0,
      economy: 0,
      battingRating: b,
      bowlingRating: bw,
      impactRating: ovr,
      overallRating: ovr,
      ratingBand: getRatingBand(ovr),
      form: 'NORMAL',
      attributes: makeTestAttrs(b, bw, ovr),
      priceCr: 8,
      ratingStatus: 'PROVISIONAL',
    };
  });
}

function seededRng(seedInput: number): () => number {
  let s = seedInput >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('createInitialSeasonState builds 11 teams, 110 league matches, and 20 user fixtures (10 Home / 10 Away)', () => {
  const userXi = makeXi('user', 58, 58, 58, true);
  const customFranchise = {
    name: 'Mumbai Warriors',
    code: 'MWR',
    homeCity: 'Mumbai',
    homeGround: 'Wankhede Stadium',
    primaryColor: '#D94E28',
    secondaryColor: '#0E1C36',
  };
  const season = createInitialSeasonState(userXi, realRepo, 1, seededRng(42), [], customFranchise);

  assert.equal(season.teamOrder.length, 11);
  assert.equal(season.pointsTable.length, 11);
  assert.equal(season.fixtures.length, 110);
  assert.equal(season.teams.YOU.name, 'Mumbai Warriors');
  assert.equal(season.teams.YOU.code, 'MWR');
  assert.equal(season.teams.YOU.primaryColor, '#D94E28');

  // Check every team received an 11-player XI
  for (const id of season.teamOrder) {
    assert.equal(season.teams[id].players.length, 11, `Expected 11 players for ${id}`);
  }

  // Verify every team plays 20 matches (10 home, 10 away) and plays every other team once home & once away
  const homeCounts = new Map<string, number>();
  const awayCounts = new Map<string, number>();
  const pairSet = new Set<string>();
  for (const fix of season.fixtures) {
    homeCounts.set(fix.homeTeamId, (homeCounts.get(fix.homeTeamId) ?? 0) + 1);
    awayCounts.set(fix.awayTeamId, (awayCounts.get(fix.awayTeamId) ?? 0) + 1);
    const key = `${fix.homeTeamId}->${fix.awayTeamId}`;
    assert.equal(pairSet.has(key), false, `Duplicate matchup ${key}`);
    pairSet.add(key);
  }
  for (const id of season.teamOrder) {
    assert.equal(homeCounts.get(id), 10, `Expected 10 home matches for ${id}`);
    assert.equal(awayCounts.get(id), 10, `Expected 10 away matches for ${id}`);
  }

  const userFixtures = getUserFixtures(season);
  assert.equal(userFixtures.length, 20);
  assert.equal(userFixtures.filter((f) => f.homeTeamId === 'YOU').length, 10);
  assert.equal(userFixtures.filter((f) => f.awayTeamId === 'YOU').length, 10);
  assert.deepEqual(
    userFixtures.map((f) => f.userMatchNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  );
});

test('simulateT20Match favors stronger balanced XI statistically while allowing upsets', () => {
  const strongTeam: SeasonTeam = {
    id: 'YOU',
    code: 'YOU',
    name: 'Strong XI',
    shortName: 'Strong',
    primaryColor: '#2563EB',
    homeVenue: 'Stadium A',
    isUser: true,
    players: makeXi('strong', 82, 80, 82, true),
  };
  const weakUnbalancedTeam: SeasonTeam = {
    id: 'PBKS',
    code: 'PBKS',
    name: 'Unbalanced XI',
    shortName: 'Punjab',
    primaryColor: '#E11D48',
    homeVenue: 'Stadium B',
    isUser: false,
    players: makeXi('weak', 62, 58, 62, false),
  };

  assert.ok(
    calculateXiStrength(strongTeam.players).balanceBonus >
      calculateXiStrength(weakUnbalancedTeam.players).balanceBonus
  );

  // Now test slightly closer ratings (provisional range 58 balanced vs 52 unbalanced) to confirm upsets happen
  const midWeakTeam: SeasonTeam = {
    ...weakUnbalancedTeam,
    players: makeXi('midweak', 52, 50, 52, true),
  };
  const midStrongTeam: SeasonTeam = {
    ...strongTeam,
    players: makeXi('midstrong', 60, 60, 60, true),
  };

  const rng = seededRng(1337);
  let strongWins = 0;
  let weakWins = 0;
  let minRuns = 999;
  let maxRuns = 0;
  for (let i = 0; i < 300; i += 1) {
    const res = simulateT20Match(midStrongTeam, midWeakTeam, rng);
    assert.ok(res.firstInnings.runs >= 20 && res.firstInnings.runs <= 285);
    assert.ok(res.secondInnings.runs >= 20 && res.secondInnings.runs <= 285);
    assert.ok(res.firstInnings.wickets >= 0 && res.firstInnings.wickets <= 10);
    assert.ok(res.secondInnings.wickets >= 0 && res.secondInnings.wickets <= 10);
    minRuns = Math.min(minRuns, res.firstInnings.runs);
    maxRuns = Math.max(maxRuns, res.firstInnings.runs);
    if (res.winnerId === 'YOU') strongWins += 1;
    else weakWins += 1;
  }

  assert.ok(minRuns < 140, `Expected occasional collapses/low totals, min was ${minRuns}`);
  assert.ok(maxRuns > 190, `Expected occasional high-scoring innings, max was ${maxRuns}`);
  assert.ok(strongWins > weakWins, `Expected strong team to win more (${strongWins} vs ${weakWins})`);
  assert.ok(weakWins > 0, `Expected upsets to still be possible, got ${weakWins} weak wins`);
});

test('NRR calculation and Points Table sorting (PTS then NRR) follow IPL rules', () => {
  // 184 runs in 20 overs vs 171 runs in 20 overs => +0.650 NRR
  assert.equal(calculateNrr(184, 20, 171, 20), 0.65);

  const sorted = sortPointsTable([
    {
      teamId: 'MI',
      played: 2,
      won: 1,
      lost: 1,
      points: 2,
      runsFor: 340,
      oversFor: 40,
      runsAgainst: 350,
      oversAgainst: 40,
      nrr: -0.25,
    },
    {
      teamId: 'CSK',
      played: 2,
      won: 1,
      lost: 1,
      points: 2,
      runsFor: 360,
      oversFor: 40,
      runsAgainst: 330,
      oversAgainst: 40,
      nrr: 0.75,
    },
    {
      teamId: 'YOU',
      played: 2,
      won: 2,
      lost: 0,
      points: 4,
      runsFor: 370,
      oversFor: 40,
      runsAgainst: 340,
      oversAgainst: 40,
      nrr: 0.75,
    },
  ]);

  assert.deepEqual(
    sorted.map((r) => r.teamId),
    ['YOU', 'CSK', 'MI']
  );
});

test('simulating 20 league matches completes league, updates all 11 teams to P=20, and unlocks Playoffs', () => {
  const userXi = makeXi('user', 85, 85, 85, true);
  let season = createInitialSeasonState(userXi, realRepo, 1, seededRng(99));
  const rng = seededRng(2026);

  const userFixtures = getUserFixtures(season);
  for (const fix of userFixtures) {
    season = quickSimUserFixture(season, fix.id, rng);
  }

  assert.equal(season.phase, 'PLAYOFFS');
  assert.equal(season.fixtures.every((f) => f.status === 'COMPLETED'), true);
  assert.equal(season.pointsTable.every((r) => r.played === 20), true);

  // Sum of points across 110 matches * 2 pts = 220
  const totalPts = season.pointsTable.reduce((acc, r) => acc + r.points, 0);
  assert.equal(totalPts, 220);

  assert.equal(season.playoffs.Q1.status, 'READY');
  assert.equal(season.playoffs.ELIM.status, 'READY');
  assert.equal(season.playoffs.Q2.status, 'LOCKED');
  assert.equal(season.playoffs.FINAL.status, 'LOCKED');

  const top4 = season.pointsTable.slice(0, 4).map((r) => r.teamId);
  assert.equal(season.playoffs.Q1.homeTeamId, top4[0]);
  assert.equal(season.playoffs.Q1.awayTeamId, top4[1]);
  assert.equal(season.playoffs.ELIM.homeTeamId, top4[2]);
  assert.equal(season.playoffs.ELIM.awayTeamId, top4[3]);

  const standings = getUserStandingsInfo(season);
  assert.equal(standings.played, 20);
  assert.equal(standings.won * 2, standings.points);
  assert.ok(['COMPLETED', 'FAILED'].includes(standings.challenge14Status));
});

test('playoff bracket Q1 -> ELIM -> Q2 -> FINAL crowns championship winner', () => {
  // Give user ultra-dominant XI so user finishes #1, goes 14-0 or top seed, and wins championship
  const eliteUserXi = makeXi('champ', 98, 98, 98, true);
  let season = createInitialSeasonState(eliteUserXi, null, 1, seededRng(7));
  const rng = seededRng(777);

  for (const fix of getUserFixtures(season)) {
    season = quickSimUserFixture(season, fix.id, rng);
  }

  assert.equal(season.phase, 'PLAYOFFS');
  assert.equal(season.userQualified, true);

  season = quickSimPlayoffMatch(season, 'Q1', rng);
  assert.equal(season.playoffs.Q1.status, 'COMPLETED');
  assert.equal(season.playoffs.Q2.status, 'LOCKED');

  season = quickSimPlayoffMatch(season, 'ELIM', rng);
  assert.equal(season.playoffs.ELIM.status, 'COMPLETED');
  assert.equal(season.playoffs.Q2.status, 'READY');

  season = quickSimPlayoffMatch(season, 'Q2', rng);
  assert.equal(season.playoffs.Q2.status, 'COMPLETED');
  assert.equal(season.playoffs.FINAL.status, 'READY');

  season = quickSimPlayoffMatch(season, 'FINAL', rng);
  assert.equal(season.playoffs.FINAL.status, 'COMPLETED');
  assert.equal(season.phase, 'COMPLETED');
  assert.equal(season.championTeamId, season.playoffs.FINAL.result!.winnerId);
  assert.equal(season.championTeamId, 'YOU');
});
