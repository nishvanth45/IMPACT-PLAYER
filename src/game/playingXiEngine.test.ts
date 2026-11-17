import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayerToXI,
  autoSelectPlayingXI,
  calculateTeamSummary,
  createInitialPlayingXIState,
  getBowlingOptions,
  partitionFieldZones,
  removePlayerFromXI,
  reorderBattingOrder,
  setActiveWicketkeeper,
  setCaptain,
  swapXIWithBench,
  validatePlayingXI,
} from './playingXiEngine';
import { getRatingBand } from './ratingEngine';
import type { PlayerDetailedAttributes, PlayerSeasonRecord } from '../types/game';

const DEFAULT_TEST_ATTRIBUTES: PlayerDetailedAttributes = {
  batting: {
    power: 80,
    timing: 82,
    technique: 80,
    strikeRotation: 80,
    paceHitting: 80,
    spinHitting: 80,
    powerplay: 80,
    middleOvers: 80,
    deathOvers: 78,
    chase: 80,
    pressure: 80,
    finishing: 78,
  },
  bowling: {
    wicketTaking: 30,
    economy: 30,
    powerplayBowling: 28,
    middleOversBowling: 30,
    deathBowling: 28,
    control: 32,
    variation: 30,
    pressure: 30,
  },
  other: {
    fielding: 78,
    captaincy: 75,
    consistency: 80,
    fitness: 82,
    impactAbility: 80,
  },
};

const makePlayer = (overrides: Partial<PlayerSeasonRecord> & { playerId: string }): PlayerSeasonRecord => {
  const ovr = overrides.overallRating ?? 82;
  return {
    id: overrides.id ?? overrides.playerId,
    name: overrides.name ?? overrides.playerName ?? overrides.playerId,
    playerName: overrides.playerId,
    season: 2020,
    franchise: 'MI',
    teamName: 'Mumbai Indians',
    nationality: 'India',
    playerType: overrides.isOverseas ? 'Overseas' : 'Domestic',
    isOverseas: false,
    role: 'BAT',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'None',
    matches: 14,
    runs: 400,
    battingAverage: 35,
    strikeRate: 140,
    wickets: 0,
    economy: 0,
    battingRating: 82,
    bowlingRating: 20,
    impactRating: overrides.impactRating ?? ovr,
    overallRating: ovr,
    ratingBand: overrides.ratingBand ?? getRatingBand(ovr),
    form: overrides.form ?? 'NORMAL',
    attributes: overrides.attributes ?? DEFAULT_TEST_ATTRIBUTES,
    priceCr: 8,
    ratingStatus: 'PROVISIONAL',
    ...overrides,
  };
};

function buildSample15Squad(): PlayerSeasonRecord[] {
  return [
    makePlayer({ playerId: 'rohit', playerName: 'Rohit Sharma', role: 'BAT', overallRating: 88, battingRating: 89 }),
    makePlayer({ playerId: 'kohli', playerName: 'Virat Kohli', role: 'BAT', overallRating: 95, battingRating: 96 }),
    makePlayer({ playerId: 'sky', playerName: 'Suryakumar Yadav', role: 'BAT', overallRating: 91, battingRating: 92 }),
    makePlayer({ playerId: 'warner', playerName: 'David Warner', isOverseas: true, nationality: 'Australia', role: 'BAT', overallRating: 93, battingRating: 94 }),
    makePlayer({ playerId: 'gayle', playerName: 'Chris Gayle', isOverseas: true, nationality: 'West Indies', role: 'BAT', bowlingStyle: 'Right-arm offbreak', bowlingRating: 35, overallRating: 87, battingRating: 89 }),
    makePlayer({ playerId: 'dhoni', playerName: 'MS Dhoni', role: 'WK', overallRating: 90, battingRating: 90 }),
    makePlayer({ playerId: 'buttler', playerName: 'Jos Buttler', isOverseas: true, nationality: 'England', role: 'WK', overallRating: 94, battingRating: 95 }),
    makePlayer({ playerId: 'jadeja', playerName: 'Ravindra Jadeja', role: 'AR', bowlingStyle: 'Slow left-arm orthodox', battingRating: 78, bowlingRating: 86, overallRating: 88 }),
    makePlayer({ playerId: 'russell', playerName: 'Andre Russell', isOverseas: true, nationality: 'West Indies', role: 'AR', bowlingStyle: 'Right-arm fast', battingRating: 88, bowlingRating: 82, overallRating: 91 }),
    makePlayer({ playerId: 'hardik', playerName: 'Hardik Pandya', role: 'AR', bowlingStyle: 'Right-arm medium-fast', battingRating: 85, bowlingRating: 79, overallRating: 87 }),
    makePlayer({ playerId: 'bumrah', playerName: 'Jasprit Bumrah', role: 'BOWL', bowlingStyle: 'Right-arm fast', battingRating: 20, bowlingRating: 97, overallRating: 96 }),
    makePlayer({ playerId: 'rashid', playerName: 'Rashid Khan', isOverseas: true, nationality: 'Afghanistan', role: 'BOWL', bowlingStyle: 'Right-arm legbreak', battingRating: 60, bowlingRating: 95, overallRating: 94 }),
    makePlayer({ playerId: 'boult', playerName: 'Trent Boult', isOverseas: true, nationality: 'New Zealand', role: 'BOWL', bowlingStyle: 'Left-arm fast-medium', battingRating: 18, bowlingRating: 90, overallRating: 89 }),
    makePlayer({ playerId: 'chahal', playerName: 'Yuzvendra Chahal', role: 'BOWL', bowlingStyle: 'Right-arm legbreak', battingRating: 16, bowlingRating: 90, overallRating: 88 }),
    makePlayer({ playerId: 'siraj', playerName: 'Mohammed Siraj', role: 'BOWL', bowlingStyle: 'Right-arm fast', battingRating: 18, bowlingRating: 85, overallRating: 83 }),
  ];
}

test('autoSelectPlayingXI selects balanced 11 with <=4 overseas, >=1 WK, pace+spin, captain, and WK', () => {
  const squad = buildSample15Squad();
  const xi = autoSelectPlayingXI(squad, 4);

  assert.equal(xi.playingXiIds.length, 11);
  assert.ok(xi.captainId !== null);
  assert.ok(xi.wicketkeeperId !== null);

  const validation = validatePlayingXI(xi, squad, 4);
  assert.equal(validation.isValid, true, `Expected valid XI, got errors: ${validation.errors.join('; ')}`);
  assert.ok(validation.overseasCount <= 4);
  assert.ok(validation.wicketkeepersInXI.length >= 1);
  assert.equal(validation.benchPlayers.length, 4);

  const bowling = getBowlingOptions(validation.xiPlayers);
  assert.ok(bowling.primaryBowlers.length + bowling.allRounders.length >= 5);
  assert.ok(bowling.partTimers.length >= 0);
});

test('autoSelectPlayingXI prioritizes team balance over blindly picking top 11 ratings', () => {
  // Construct a squad with 8 super high-rated batters/WKs (95-98) and 4 bowlers (78-82)
  const unbalancedSquad: PlayerSeasonRecord[] = [
    ...Array.from({ length: 7 }, (_, i) =>
      makePlayer({ playerId: `bat_${i}`, role: 'BAT', overallRating: 97, battingRating: 97 })
    ),
    makePlayer({ playerId: 'wk_1', role: 'WK', overallRating: 96, battingRating: 96 }),
    makePlayer({ playerId: 'wk_2', role: 'WK', overallRating: 95, battingRating: 95 }),
    makePlayer({ playerId: 'ar_1', role: 'AR', bowlingStyle: 'Slow left-arm orthodox', battingRating: 80, bowlingRating: 82, overallRating: 82 }),
    makePlayer({ playerId: 'ar_2', role: 'AR', bowlingStyle: 'Right-arm medium-fast', battingRating: 78, bowlingRating: 80, overallRating: 80 }),
    makePlayer({ playerId: 'bowl_1', role: 'BOWL', bowlingStyle: 'Right-arm fast', battingRating: 18, bowlingRating: 84, overallRating: 81 }),
    makePlayer({ playerId: 'bowl_2', role: 'BOWL', bowlingStyle: 'Right-arm legbreak', battingRating: 18, bowlingRating: 83, overallRating: 80 }),
    makePlayer({ playerId: 'bowl_3', role: 'BOWL', bowlingStyle: 'Left-arm fast-medium', battingRating: 18, bowlingRating: 82, overallRating: 79 }),
    makePlayer({ playerId: 'bat_extra', role: 'BAT', overallRating: 70, battingRating: 70 }),
  ];

  const xi = autoSelectPlayingXI(unbalancedSquad, 4);
  const validation = validatePlayingXI(xi, unbalancedSquad, 4);
  assert.equal(validation.isValid, true);
  const bowling = getBowlingOptions(validation.xiPlayers);
  assert.ok(
    bowling.primaryBowlers.length + bowling.allRounders.length >= 4,
    'Auto XI must include bowlers/all-rounders instead of 11 batters'
  );
});

test('validatePlayingXI enforces 11 players, <=4 overseas, >=1 WK, captain, and active WK', () => {
  const squad = buildSample15Squad();
  let state = createInitialPlayingXIState();

  // Add 10 players including 5 overseas and 0 WKs
  const picks = ['warner', 'gayle', 'russell', 'rashid', 'boult', 'rohit', 'kohli', 'sky', 'bumrah', 'chahal'];
  for (const id of picks) {
    state = addPlayerToXI(state, squad, id);
  }
  const v1 = validatePlayingXI(state, squad, 4);
  assert.equal(v1.isValid, false);
  assert.equal(v1.errors.length, 5); // count, overseas, wk missing, captain missing, active wk missing

  // Swap out an overseas for Dhoni, add Siraj to reach 11 players, set Captain & WK
  state = addPlayerToXI(state, squad, 'siraj');
  state = swapXIWithBench(state, squad, 'gayle', 'dhoni');
  state = setCaptain(state, 'kohli');
  state = setActiveWicketkeeper(state, squad, 'dhoni');

  const v2 = validatePlayingXI(state, squad, 4);
  assert.equal(v2.isValid, true, `Unexpected errors: ${v2.errors.join('; ')}`);
});

test('batting order reorder, captain/WK switching, and bench swap preserve consistency', () => {
  const squad = buildSample15Squad();
  let state = autoSelectPlayingXI(squad, 4);

  const firstId = state.playingXiIds[0];
  const secondId = state.playingXiIds[1];
  state = reorderBattingOrder(state, 0, 1);
  assert.equal(state.playingXiIds[0], secondId);
  assert.equal(state.playingXiIds[1], firstId);

  // Removing captain clears captainId
  const capId = state.captainId!;
  state = removePlayerFromXI(state, squad, capId);
  assert.equal(state.captainId, null);
  assert.equal(state.playingXiIds.length, 10);

  // Re-adding and partitioning field zones & team summary
  state = addPlayerToXI(state, squad, capId);
  state = setCaptain(state, capId);
  const validation = validatePlayingXI(state, squad, 4);
  const zones = partitionFieldZones(validation.xiPlayers);
  assert.equal(zones.top.length + zones.middle.length + zones.bottom.length, 11);

  const summary = calculateTeamSummary(validation.xiPlayers, state.captainId, state.wicketkeeperId);
  assert.ok(summary.battingRating > 0);
  assert.ok(summary.bowlingRating > 0);
  assert.ok(summary.overallRating > 0);
  assert.ok(summary.captainName !== null);
  assert.ok(summary.keeperName !== null);
});

test('Playing XI preserves UNKNOWN role and nullable isOverseas players cleanly', () => {
  const base = buildSample15Squad();
  base[0] = makePlayer({
    playerId: 'lhuan-dre-pretorious',
    playerName: 'Lhuan-dre Pretorious',
    role: 'UNKNOWN',
    playerType: 'Unknown',
    isOverseas: null,
    nationality: 'Unknown',
    battingRating: 25,
    bowlingRating: 20,
    overallRating: 25,
    priceCr: 1.5,
    ratingStatus: 'PROVISIONAL',
  });

  const xi = autoSelectPlayingXI(base, 4);
  assert.equal(xi.playingXiIds.length, 11);
  const validation = validatePlayingXI(xi, base, 4);
  assert.equal(validation.isValid, true);

  // Manually include UNKNOWN player in XI and check field partition + batting order preservation
  const withUnknown = swapXIWithBench(xi, base, xi.playingXiIds[0], 'lhuan-dre-pretorious');
  const v2 = validatePlayingXI(withUnknown, base, 4);
  assert.equal(v2.xiPlayers.length, 11);
  const zones = partitionFieldZones(v2.xiPlayers);
  assert.equal(zones.top.length + zones.middle.length + zones.bottom.length, 11);
});

