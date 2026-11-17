import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  canSelectPlayer,
  createInitialDraftState,
  executeSpin,
  getEligibleSpinCombos,
  getOverseasCount,
  getRoleCounts,
  selectPlayerForDraft,
} from './draftEngine';
import {
  JsonIplRepository,
  getActivePlayerRepository,
  getSquad,
  parseIplDatabase,
  setActivePlayerRepository,
} from '../data/playerRepository';
import { resolveFranchiseCode } from '../data/franchises';
import { getRatingBand } from './ratingEngine';
import type { IplDatabaseJson, PlayerDetailedAttributes, PlayerSeasonRecord } from '../types/game';

const dbPath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/ipl_database_final_ba929b5d.json'
);
const rawDbJson = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as IplDatabaseJson;
const parsedDb = parseIplDatabase(rawDbJson);
const realRepo = new JsonIplRepository(parsedDb);

const DEFAULT_TEST_ATTRIBUTES: PlayerDetailedAttributes = {
  batting: {
    power: 82,
    timing: 84,
    technique: 83,
    strikeRotation: 82,
    paceHitting: 81,
    spinHitting: 80,
    powerplay: 82,
    middleOvers: 83,
    deathOvers: 79,
    chase: 84,
    pressure: 82,
    finishing: 78,
  },
  bowling: {
    wicketTaking: 24,
    economy: 25,
    powerplayBowling: 22,
    middleOversBowling: 24,
    deathBowling: 22,
    control: 26,
    variation: 24,
    pressure: 24,
  },
  other: {
    fielding: 80,
    captaincy: 75,
    consistency: 82,
    fitness: 84,
    impactAbility: 82,
  },
};

const makePlayer = (overrides: Partial<PlayerSeasonRecord> = {}): PlayerSeasonRecord => {
  const ovr = overrides.overallRating ?? 84;
  return {
    id: overrides.playerId ?? 'test_player',
    name: overrides.playerName ?? 'Test Player',
    playerId: 'test_player',
    playerName: 'Test Player',
    season: 2016,
    franchise: 'RCB',
    teamName: 'Royal Challengers Bengaluru',
    nationality: 'India',
    playerType: overrides.isOverseas ? 'Overseas' : 'Domestic',
    isOverseas: false,
    role: 'BAT',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'None',
    matches: 0,
    runs: 0,
    battingAverage: 0,
    strikeRate: 0,
    wickets: 0,
    economy: 0,
    battingRating: 85,
    bowlingRating: 20,
    impactRating: overrides.impactRating ?? 82,
    overallRating: ovr,
    ratingBand: overrides.ratingBand ?? getRatingBand(ovr),
    form: overrides.form ?? 'NORMAL',
    attributes: overrides.attributes ?? DEFAULT_TEST_ATTRIBUTES,
    priceCr: 8.5,
    ratingStatus: 'PROVISIONAL',
    ...overrides,
  };
};

test('initial draft state starts with ₹120 Cr, 0/15 squad, and READY_TO_SPIN', () => {
  const state = createInitialDraftState();
  assert.equal(state.remainingPurseCr, 120);
  assert.equal(state.squad.length, 0);
  assert.equal(getOverseasCount(state.squad), 0);
  assert.equal(state.status, 'READY_TO_SPIN');
});

test('executeSpin only picks franchise-seasons in database and never repeats in one draft', () => {
  let state = createInitialDraftState({
    ...DEFAULT_SETTINGS,
    seasonStart: 2016,
    seasonEnd: 2016,
  });

  const totalEligible = getEligibleSpinCombos(state, realRepo).length;
  // In 2016, CSK and RR are absent from database.seasons['2016'] -> 6 franchises
  assert.equal(totalEligible, 6);

  const seenCombos = new Set<string>();
  for (let i = 0; i < totalEligible; i += 1) {
    state = executeSpin(
      { ...state, status: 'READY_TO_SPIN', currentSpin: null },
      realRepo,
      () => 0
    );
    assert.ok(state.currentSpin !== null);
    assert.equal(seenCombos.has(state.currentSpin.comboKey), false);
    seenCombos.add(state.currentSpin.comboKey);
  }

  assert.equal(seenCombos.has('CSK-2016'), false);
  assert.equal(seenCombos.has('RR-2016'), false);
  assert.equal(getEligibleSpinCombos(state, realRepo).length, 0);
});

test('selecting a player deducts exact priceCr, increments squad and overseas count, and returns to READY_TO_SPIN', () => {
  let state = createInitialDraftState();
  const overseasStar = makePlayer({
    playerId: 'ab-de-villiers',
    playerName: 'AB de Villiers',
    nationality: 'Overseas',
    playerType: 'Overseas',
    isOverseas: true,
    priceCr: 16.5,
  });

  state = selectPlayerForDraft(state, overseasStar);
  assert.equal(state.squad.length, 1);
  assert.equal(getOverseasCount(state.squad), 1);
  assert.equal(state.remainingPurseCr, 103.5);
  assert.equal(state.status, 'READY_TO_SPIN');
  assert.equal(state.currentSpin, null);
});

test('same playerId cannot be drafted twice even from another season or franchise and shows ALREADY DRAFTED', () => {
  let state = createInitialDraftState();
  const kkr2014 = realRepo.getSquad('KKR', 2014);
  const gambhir2014 = kkr2014.find((p) => p.id === 'gautam-gambhir');
  assert.ok(gambhir2014);

  const kkr2015 = realRepo.getSquad('KKR', 2015);
  const gambhir2015 = kkr2015.find((p) => p.id === 'gautam-gambhir');
  assert.ok(gambhir2015);

  state = selectPlayerForDraft(state, gambhir2014);
  const check = canSelectPlayer(state, gambhir2015);
  assert.equal(check.allowed, false);
  assert.equal(check.reason, 'ALREADY_DRAFTED');
  assert.equal(check.label, 'ALREADY DRAFTED');
});

test('insufficient purse blocks purchase cleanly', () => {
  const state = {
    ...createInitialDraftState(),
    remainingPurseCr: 5.0,
  };
  const expensive = makePlayer({ playerId: 'jasprit-bumrah', priceCr: 12.0 });
  const check = canSelectPlayer(state, expensive);
  assert.equal(check.allowed, false);
  assert.equal(check.reason, 'INSUFFICIENT_PURSE');
});

test('overseas limit (6/6) blocks 7th overseas player while still allowing Domestic and Unknown', () => {
  let state = createInitialDraftState();
  for (let i = 1; i <= 6; i += 1) {
    state = selectPlayerForDraft(
      state,
      makePlayer({
        id: `os_${i}`,
        playerId: `os_${i}`,
        isOverseas: true,
        playerType: 'Overseas',
        nationality: 'Overseas',
        priceCr: 5.0,
      })
    );
  }
  assert.equal(getOverseasCount(state.squad), 6);

  const seventhOs = makePlayer({
    id: 'os_7',
    playerId: 'os_7',
    isOverseas: true,
    playerType: 'Overseas',
    nationality: 'Overseas',
    priceCr: 5.0,
  });
  const osCheck = canSelectPlayer(state, seventhOs);
  assert.equal(osCheck.allowed, false);
  assert.equal(osCheck.reason, 'OVERSEAS_LIMIT');

  const indianPlayer = makePlayer({
    id: 'ind_1',
    playerId: 'ind_1',
    isOverseas: false,
    playerType: 'Domestic',
    nationality: 'India',
    priceCr: 5.0,
  });
  assert.equal(canSelectPlayer(state, indianPlayer).allowed, true);
});

test('draft transitions to COMPLETED when squad reaches 15 players', () => {
  let state = createInitialDraftState();
  for (let i = 1; i <= 15; i += 1) {
    state = selectPlayerForDraft(
      state,
      makePlayer({
        id: `p_${i}`,
        playerId: `p_${i}`,
        isOverseas: i <= 4,
        playerType: i <= 4 ? 'Overseas' : 'Domestic',
        nationality: i <= 4 ? 'Overseas' : 'India',
        priceCr: 4.0,
      })
    );
  }
  assert.equal(state.squad.length, 15);
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.remainingPurseCr, 60);
});

test('ipl_database_final.json yields exact PBKS 2022 (25 players) and KKR 2014 (20 players) without slicing', () => {
  setActivePlayerRepository(realRepo);

  const pbks2022 = getSquad('PBKS', 2022);
  const pbksByFullName = getSquad('Punjab Kings', 2022);
  assert.equal(pbks2022.length, 25);
  assert.equal(pbksByFullName.length, 25);

  const kkr2014 = getSquad('KKR', 2014);
  assert.equal(kkr2014.length, 20);

  // Verify JSON metadata & independent priceCr are preserved verbatim while ratings use upgraded 20-99 architecture
  const rawGambhir = rawDbJson.seasons['2014']['KKR'].players.find(
    (p) => p.id === 'gautam-gambhir'
  )!;
  const loadedGambhir = kkr2014.find((p) => p.id === 'gautam-gambhir')!;
  assert.equal(loadedGambhir.name, rawGambhir.name);
  assert.equal(loadedGambhir.role, rawGambhir.role);
  assert.equal(loadedGambhir.isOverseas, rawGambhir.isOverseas);
  assert.ok(loadedGambhir.battingRating >= 20 && loadedGambhir.battingRating <= 99);
  assert.ok(loadedGambhir.bowlingRating >= 20 && loadedGambhir.bowlingRating <= 99);
  assert.ok(loadedGambhir.impactRating >= 20 && loadedGambhir.impactRating <= 99);
  assert.ok(loadedGambhir.overallRating >= 20 && loadedGambhir.overallRating <= 99);
  assert.ok(loadedGambhir.overallRating > 75);
  assert.equal(loadedGambhir.priceCr, rawGambhir.priceCr);
  assert.equal(loadedGambhir.ratingStatus, 'PROVISIONAL');
  assert.equal(loadedGambhir.form, 'NORMAL');
  assert.ok(loadedGambhir.attributes && loadedGambhir.attributes.batting.technique >= 20);

  // Verify all 153 franchise-seasons exist and have non-empty, duplicate-free squads
  const allCombos = realRepo.getAvailableSpinCombos(2008, 2026);
  assert.equal(allCombos.length, 153);
  for (const combo of allCombos) {
    const pool = realRepo.getSquad(combo.franchise, combo.season);
    assert.ok(pool.length > 0, `Expected non-empty squad for ${combo.comboKey}`);
    const ids = new Set(pool.map((p) => p.id));
    assert.equal(ids.size, pool.length, `Duplicate player in ${combo.comboKey}`);
  }
});

test('UNKNOWN role and isOverseas: null records from JSON are safely counted and handled', () => {
  const rr2026 = realRepo.getSquad('RR', 2026);
  const pretorious = rr2026.find((p) => p.id === 'lhuan-dre-pretorious');
  assert.ok(pretorious);
  assert.equal(pretorious.role, 'UNKNOWN');
  assert.equal(pretorious.isOverseas, null);
  assert.equal(pretorious.playerType, 'Unknown');

  const counts = getRoleCounts([pretorious]);
  assert.equal(counts.UNKNOWN, 1);
  assert.equal(getOverseasCount([pretorious]), 0);
  assert.equal(resolveFranchiseCode('Punjab Kings'), 'PBKS');
});

test('database loader throws explicit error and never falls back to sample data when unloaded or malformed', () => {
  setActivePlayerRepository(null);
  assert.throws(() => getActivePlayerRepository(), /IPL DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase(null), /IPL DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase({}), /IPL DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase({ seasons: {} }), /IPL DATABASE FAILED TO LOAD/);

  // Restore active repository for any subsequent tests
  setActivePlayerRepository(realRepo);
});
