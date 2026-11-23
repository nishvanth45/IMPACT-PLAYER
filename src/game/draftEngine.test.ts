import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  calculateStableGamePriceCr,
  canSelectPlayer,
  createInitialDraftState,
  executeSpin,
  formatPlayerSalary,
  getEligibleSpinCombos,
  getOverseasCount,
  getPlayerDataCompleteness,
  getPlayerDisplayPriceInfo,
  getPlayerDraftCostCr,
  getPlayerSalaryCr,
  getRoleCounts,
  selectPlayerForDraft,
} from './draftEngine';
import {
  IPL_DATABASE_URL,
  JsonIplRepository,
  buildDatabaseValidationReport,
  getActivePlayerRepository,
  getSquad,
  isProvisionalStatus,
  loadIplDatabase,
  parseIplDatabase,
  setActivePlayerRepository,
} from '../data/playerRepository';
import { resolveFranchiseCode } from '../data/franchises';
import { getRatingBand } from './ratingEngine';
import type { IplDatabaseJson, PlayerDetailedAttributes, PlayerSeasonRecord } from '../types/game';

const dbPath = path.resolve(process.cwd(), 'public/impact_player_database.json');
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
  const salCr =
    overrides.salary !== undefined
      ? overrides.salary.salaryCr
      : overrides.salaryCr !== undefined
        ? overrides.salaryCr
        : 8.5;
  const salVerified = overrides.salaryVerified ?? overrides.salary?.verified ?? true;
  const salType = overrides.salaryType ?? overrides.salary?.type ?? 'AUCTION';

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
    hasRatings: true,
    isIncomplete: false,
    battingRating: 85,
    bowlingRating: 20,
    impactRating: overrides.impactRating ?? 82,
    overallRating: ovr,
    ratingBand: overrides.ratingBand ?? getRatingBand(ovr),
    form: overrides.form ?? 'NORMAL',
    attributes: overrides.attributes ?? DEFAULT_TEST_ATTRIBUTES,
    salaryCr: salCr,
    salaryType: salType,
    salaryVerified: salVerified,
    salary: overrides.salary ?? {
      salaryCr: salCr,
      verified: salVerified,
      type: salType,
      status: salCr === null ? 'unknown' : salVerified ? 'verified' : 'reported',
    },
    priceCr: salCr ?? 0,
    ratingStatus: 'FINAL',
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

test('selecting a player deducts exact salary.salaryCr, increments squad and overseas count, and returns to READY_TO_SPIN', () => {
  let state = createInitialDraftState();
  const overseasStar = makePlayer({
    playerId: 'ab-de-villiers',
    playerName: 'AB de Villiers',
    nationality: 'Overseas',
    playerType: 'Overseas',
    isOverseas: true,
    salaryCr: 16.5,
    salary: { salaryCr: 16.5, verified: true, type: 'RETAINED', status: 'verified' },
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
  const expensive = makePlayer({
    playerId: 'jasprit-bumrah',
    salaryCr: 12.0,
    salary: { salaryCr: 12.0, verified: true, type: 'RETAINED', status: 'verified' },
  });
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
        salaryCr: 5.0,
        salary: { salaryCr: 5.0, verified: true, type: 'AUCTION', status: 'verified' },
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
    salaryCr: 5.0,
    salary: { salaryCr: 5.0, verified: true, type: 'AUCTION', status: 'verified' },
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
    salaryCr: 5.0,
    salary: { salaryCr: 5.0, verified: true, type: 'AUCTION', status: 'verified' },
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
        salaryCr: 4.0,
        salary: { salaryCr: 4.0, verified: true, type: 'AUCTION', status: 'verified' },
      })
    );
  }
  assert.equal(state.squad.length, 15);
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.remainingPurseCr, 60);
});

test('impact_player_database.json yields exact full squads (CSK 2018, PBKS 2022, KKR 2014) with zero slicing and indexed lookups', () => {
  setActivePlayerRepository(realRepo);

  const csk2018 = getSquad('CSK', 2018);
  assert.equal(csk2018.length, 24);

  const pbks2022 = getSquad('PBKS', 2022);
  const pbksByFullName = getSquad('Punjab Kings', 2022);
  assert.equal(pbks2022.length, 25);
  assert.equal(pbksByFullName.length, 25);

  const kkr2014 = getSquad('KKR', 2014);
  assert.equal(kkr2014.length, 20);

  // Verify indexed lookup by playerId and unique canonical players (with Cricsheet aliases)
  const kohliSeasons = realRepo.getPlayerSeasons('virat-kohli');
  assert.ok(kohliSeasons.length >= 15, 'Expected full multi-season history for Virat Kohli');

  const uniquePlayers = realRepo.getUniqueCanonicalPlayers();
  assert.equal(uniquePlayers.length, 757);
  const ruturaj = uniquePlayers.find((u) => u.playerId === 'ruturaj-gaikwad');
  assert.ok(ruturaj, 'Expected Ruturaj Gaikwad in unique canonical players');
  assert.ok(
    ruturaj.aliases.some((a) => a.toLowerCase().includes('rd gaikwad')),
    `Expected alias RD Gaikwad, got ${JSON.stringify(ruturaj.aliases)}`
  );

  // Verify nested ratings, salary, and ratingQuality are preserved verbatim; missing real salary derives stable GAME VALUE
  const rawGambhir = rawDbJson.seasons['2014']['KKR'].players.find(
    (p) => (p.playerId ?? p.id) === 'gautam-gambhir'
  )!;
  const loadedGambhir = kkr2014.find((p) => p.playerId === 'gautam-gambhir')!;
  assert.equal(loadedGambhir.playerName, rawGambhir.name);
  assert.equal(loadedGambhir.role, rawGambhir.role);
  assert.equal(loadedGambhir.isOverseas, rawGambhir.isOverseas);
  assert.equal(loadedGambhir.hasRatings, true);
  assert.equal(loadedGambhir.battingRating, rawGambhir.ratings!.bat);
  assert.equal(loadedGambhir.bowlingRating, rawGambhir.ratings!.bowl);
  assert.equal(loadedGambhir.impactRating, rawGambhir.ratings!.impact);
  assert.equal(loadedGambhir.overallRating, rawGambhir.ratings!.overall);
  assert.equal(getPlayerSalaryCr(loadedGambhir), null);
  assert.equal(loadedGambhir.salaryVerified, false);
  assert.equal(loadedGambhir.salarySource, 'GAME_VALUE');
  assert.ok(
    typeof loadedGambhir.gamePriceCr === 'number' && loadedGambhir.gamePriceCr >= 0.5
  );
  assert.equal(
    formatPlayerSalary(loadedGambhir),
    `₹${loadedGambhir.gamePriceCr} CR · GAME VALUE`
  );
  assert.equal(isProvisionalStatus(loadedGambhir.ratingQuality?.status), false);
  assert.equal(loadedGambhir.ratingStatus, 'FINAL');
  assert.equal(loadedGambhir.form, 'NORMAL');

  // Verify verified salary player (Rinku 2023 = ₹0.55 CR · REAL CONTRACT) & game-value deduction
  const rinku2023 = getSquad('KKR', 2023).find((p) => p.playerId === 'rinku-singh')!;
  assert.equal(getPlayerSalaryCr(rinku2023), 0.55);
  assert.equal(rinku2023.salaryCr, 0.55);
  assert.equal(rinku2023.salaryVerified, true);
  assert.equal(rinku2023.salarySource, 'REAL_CONTRACT');
  assert.equal(formatPlayerSalary(rinku2023), '₹0.55 CR · REAL CONTRACT');

  let draft = createInitialDraftState();
  const gambhirCost = getPlayerDraftCostCr(loadedGambhir);
  draft = selectPlayerForDraft(draft, loadedGambhir); // deducts stable GAME VALUE
  assert.equal(draft.remainingPurseCr, Math.round((120 - gambhirCost) * 100) / 100);
  draft = selectPlayerForDraft(draft, rinku2023); // ₹0.55 Cr REAL CONTRACT deduction
  assert.equal(draft.remainingPurseCr, Math.round((120 - gambhirCost - 0.55) * 100) / 100);

  // Verify all 153 franchise-seasons exist and have non-empty, duplicate-free squads
  const allCombos = realRepo.getAvailableSpinCombos(2008, 2026);
  assert.equal(allCombos.length, 153);
  for (const combo of allCombos) {
    const pool = realRepo.getSquad(combo.franchise, combo.season);
    assert.ok(pool.length > 0, `Expected non-empty squad for ${combo.comboKey}`);
    const ids = new Set(pool.map((p) => p.playerId));
    assert.equal(ids.size, pool.length, `Duplicate player in ${combo.comboKey}`);
  }
});

test('salary rules distinguish REAL CONTRACT vs stable GAME VALUE, keep pending players draftable, and expose 7-item PLAYER DATA checklist', () => {
  assert.equal(IPL_DATABASE_URL, '/impact_player_database.json');

  const rawFlatRecords = {
    records: [
      {
        playerId: 'real-contract-star',
        playerName: 'Real Contract Star',
        franchise: 'CSK',
        season: 2024,
        role: 'BAT',
        isOverseas: false,
        identityStatus: 'RESOLVED',
        priceCr: 8,
        ratings: { bat: 89, bowl: 24, impact: 92, overall: 90 },
        salary: { salaryCr: 14.5, verified: true, type: 'AUCTION', status: 'verified' },
        ratingQuality: { status: 'VERIFIED_STATS_DERIVED' },
      },
      {
        playerId: 'game-value-player',
        playerName: 'Game Value Player',
        franchise: 'CSK',
        season: 2024,
        role: 'AR',
        isOverseas: false,
        identityStatus: 'RESOLVED',
        gamePriceCr: 6.5,
        ratings: { bat: 75, bowl: 72, impact: 78, overall: 77 },
        salary: { salaryCr: null, verified: false, type: 'UNKNOWN', status: 'unknown' },
        ratingQuality: { status: 'VERIFIED_STATS_DERIVED' },
      },
      {
        playerId: 'pending-ratings-and-salary',
        playerName: 'Pending Data Player',
        franchise: 'CSK',
        season: 2024,
        role: 'BOWL',
        isOverseas: false,
        identityStatus: 'UNRESOLVED',
        priceCr: 8,
        salaryCr: 12,
        contractValue: 15,
        ratings: null,
        salary: { salaryCr: null, verified: false, type: 'UNKNOWN', status: 'unknown' },
        ratingQuality: { status: 'INCOMPLETE_NO_PERFORMANCE_MATCH' },
      },
    ],
  };

  const customRepo = new JsonIplRepository(parseIplDatabase(rawFlatRecords));
  const squad = customRepo.getSquad('CSK', 2024);
  assert.equal(squad.length, 3);

  const pReal = squad.find((p) => p.playerId === 'real-contract-star')!;
  assert.equal(pReal.battingRating, 89);
  assert.equal(pReal.bowlingRating, 24);
  assert.equal(pReal.impactRating, 92);
  assert.equal(pReal.overallRating, 90);
  assert.equal(pReal.salarySource, 'REAL_CONTRACT');
  assert.equal(getPlayerDraftCostCr(pReal), 14.5);
  assert.equal(formatPlayerSalary(pReal), '₹14.5 CR · REAL CONTRACT');
  assert.equal(getPlayerDisplayPriceInfo(pReal).tag, 'REAL CONTRACT');
  const realChecklist = getPlayerDataCompleteness(pReal);
  assert.equal(realChecklist.hasPendingData, false);
  assert.equal(realChecklist.items.length, 7);

  const pGameVal = squad.find((p) => p.playerId === 'game-value-player')!;
  assert.equal(pGameVal.salaryCr, null);
  assert.equal(pGameVal.gamePriceCr, 6.5);
  assert.equal(pGameVal.salarySource, 'GAME_VALUE');
  assert.equal(getPlayerDraftCostCr(pGameVal), 6.5);
  assert.equal(formatPlayerSalary(pGameVal), '₹6.5 CR · GAME VALUE');
  assert.equal(getPlayerDisplayPriceInfo(pGameVal).tag, 'GAME VALUE');
  const gameValChecklist = getPlayerDataCompleteness(pGameVal);
  assert.equal(gameValChecklist.hasPendingData, true);
  assert.equal(gameValChecklist.items.find((i) => i.key === 'salary')?.available, false);
  assert.equal(gameValChecklist.items.find((i) => i.key === 'ratings')?.available, true);

  const pPending = squad.find((p) => p.playerId === 'pending-ratings-and-salary')!;
  assert.equal(pPending.salaryCr, null); // real historical salary stays null (never reads legacy priceCr=8 or salaryCr=12)
  assert.equal(pPending.salaryVerified, false);
  assert.equal(pPending.salarySource, 'GAME_VALUE');
  assert.equal(pPending.gamePriceCr, 0.75); // modest stable base value for domestic unrated BOWL (not ₹8 Cr)
  assert.equal(pPending.hasRatings, false);
  assert.equal(pPending.overallRating, 0); // zero fake 58/20/58 ratings
  assert.equal(formatPlayerSalary(pPending), '₹0.75 CR · GAME VALUE');
  assert.equal(canSelectPlayer(createInitialDraftState(), pPending).allowed, true);

  const pendingChecklist = getPlayerDataCompleteness(pPending);
  assert.equal(pendingChecklist.hasPendingData, true);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'identity')?.available, false);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'squad')?.available, true);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'role')?.available, true);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'origin')?.available, true);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'stats')?.available, false);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'ratings')?.available, false);
  assert.equal(pendingChecklist.items.find((i) => i.key === 'salary')?.available, false);

  // Verify calculateStableGamePriceCr scales monotonically with ratings and is deterministic
  const lowPrice = calculateStableGamePriceCr({
    hasRatings: true,
    battingRating: 46,
    bowlingRating: 20,
    impactRating: 45,
    overallRating: 46,
    role: 'BAT',
    isOverseas: false,
  });
  const elitePrice = calculateStableGamePriceCr({
    hasRatings: true,
    battingRating: 88,
    bowlingRating: 20,
    impactRating: 92,
    overallRating: 88,
    runs: 600,
    role: 'BAT',
    isOverseas: false,
  });
  assert.ok(elitePrice > lowPrice && lowPrice >= 0.5 && elitePrice <= 16);

  // Verify real database validation report counts
  const report = buildDatabaseValidationReport(realRepo);
  assert.equal(report.totalPlayerRecords, 3552);
  assert.equal(report.uniqueCanonicalPlayers, 757);
  assert.equal(report.verifiedSalariesFound, 2081);
  assert.equal(report.gameValuesFound, 1471);
  assert.equal(report.unknownSalaries, 1471);
  assert.equal(report.performanceRatingsFound, 2025);
});

test('UNKNOWN role and isOverseas: null records from JSON stay draftable with modest GAME VALUE and zero fabricated ratings', () => {
  const rr2026 = realRepo.getSquad('RR', 2026);
  const pretorious = rr2026.find((p) => p.playerId === 'lhuan-dre-pretorious');
  assert.ok(pretorious);
  assert.equal(pretorious.role, 'UNKNOWN');
  assert.equal(pretorious.isOverseas, null);
  assert.equal(pretorious.playerType, 'Unknown');
  assert.equal(pretorious.hasRatings, false);
  assert.equal(pretorious.isIncomplete, true);
  assert.equal(pretorious.overallRating, 0);
  assert.equal(pretorious.salaryCr, null);
  assert.equal(pretorious.salarySource, 'GAME_VALUE');
  assert.equal(formatPlayerSalary(pretorious), '₹0.5 CR · GAME VALUE');
  assert.equal(canSelectPlayer(createInitialDraftState(), pretorious).allowed, true);

  const counts = getRoleCounts([pretorious]);
  assert.equal(counts.UNKNOWN, 1);
  assert.equal(getOverseasCount([pretorious]), 0);
  assert.equal(resolveFranchiseCode('Punjab Kings'), 'PBKS');
});

test('database loader throws PLAYER DATABASE FAILED TO LOAD without mock fallback and caches single runtime fetch', async () => {
  setActivePlayerRepository(null);
  assert.throws(() => getActivePlayerRepository(), /PLAYER DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase(null), /PLAYER DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase({}), /PLAYER DATABASE FAILED TO LOAD/);
  assert.throws(() => parseIplDatabase({ seasons: {} }), /PLAYER DATABASE FAILED TO LOAD/);

  // Verify loadIplDatabase fetches once and reuses cache across subsequent calls
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => rawDbJson,
    } as Response;
  }) as typeof fetch;

  try {
    const repo1 = await loadIplDatabase('/impact_player_database.json');
    const repo2 = await loadIplDatabase('/impact_player_database.json');
    assert.equal(fetchCalls, 1, 'Database should be fetched only once on app start');
    assert.strictEqual(repo1, repo2);
  } finally {
    globalThis.fetch = originalFetch;
    setActivePlayerRepository(realRepo);
  }
});
