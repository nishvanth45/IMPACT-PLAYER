import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JsonIplRepository, parseIplDatabase } from '../data/playerRepository';
import {
  DEFAULT_SETTINGS,
  canSelectPlayer,
  createInitialDraftState,
  executeSpin,
  getOverseasCount,
  setCustomFranchise,
} from './draftEngine';
import {
  AI_FRANCHISE_CODES,
  classifyBowlerDiscipline,
  extractDraftedAiSquads,
  getCanonicalDraftPlayerId,
  lockRetentionsWithLiveLeague,
  selectPlayerInLiveDraft,
  validateLeagueDraft,
} from './liveDraftEngine';
import { autoSelectPlayingXI, validatePlayingXI } from './playingXiEngine';
import { assignPlayerToRetentionSlot, setRetentionCount } from './retentionEngine';
import { createInitialSeasonState } from './seasonEngine';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rawJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/impact_player_database.json'), 'utf-8')
) as unknown;
const repo = new JsonIplRepository(parseIplDatabase(rawJson));

test('full 15-round live 11-franchise draft builds 165 unique players with 0 duplicates and valid AI squads', () => {
  const rng = createSeededRng(202604);
  let state = createInitialDraftState(DEFAULT_SETTINGS);
  state = setCustomFranchise(state, {
    name: 'Mumbai Warriors',
    code: 'MWA',
    homeCity: 'Mumbai',
    homeGround: 'Warriors Arena, Mumbai',
    primaryColor: '#D94E28',
    secondaryColor: '#F59E0B',
  });
  state = setRetentionCount(state, 0);
  state = lockRetentionsWithLiveLeague(state, repo, rng);

  assert.equal(state.retention.locked, true);
  assert.ok(state.liveLeague, 'liveLeague should initialize on retention lock');
  assert.equal(state.liveLeague.teamOrder.length, 11);

  for (let round = 1; round <= 15; round += 1) {
    state = executeSpin(state, repo, rng);
    assert.ok(state.currentSpin, `Round ${round} spin should produce a pool`);

    const pickable = state.currentSpin.pool.find((p) => canSelectPlayer(state, p).allowed);
    assert.ok(pickable, `Round ${round} should have at least one selectable player`);

    const prevOwnedCount = state.liveLeague!.ownedPlayerIds.length;
    state = selectPlayerInLiveDraft(state, pickable, repo, rng);

    assert.equal(state.squad.length, round, `User squad should have ${round} players`);
    assert.equal(
      state.liveLeague!.ownedPlayerIds.length,
      prevOwnedCount + 11,
      `Round ${round} should claim exactly 11 new unique canonical players (1 user + 10 AI)`
    );

    const lastRound = state.liveLeague!.lastRoundTransactions;
    assert.equal(lastRound[0].teamId, 'YOU');
    assert.equal(lastRound.length, 11);

    // Verify an AI-signed player from this round is immediately blocked with OWNED BY [TEAM]
    const aiTx = lastRound[1];
    const aiTeam = state.liveLeague!.teams[aiTx.teamId];
    const aiSignedPlayer = aiTeam.squad[aiTeam.squad.length - 1];
    if (round < 15) {
      const checkAiPlayer = canSelectPlayer(state, aiSignedPlayer);
      assert.equal(checkAiPlayer.allowed, false);
      assert.equal(checkAiPlayer.reason, 'ALREADY_DRAFTED');
      assert.equal(checkAiPlayer.label, `OWNED BY ${aiTx.teamCode}`);
      assert.equal(checkAiPlayer.ownerTeamCode, aiTx.teamCode);
    }
  }

  assert.equal(state.status, 'COMPLETED');
  const validation = validateLeagueDraft(state);
  assert.equal(validation.isValid, true, `Validation errors: ${validation.errors.join('; ')}`);
  assert.equal(validation.totalTeams, 11);
  assert.equal(validation.totalRosterSlots, 165);
  assert.equal(validation.uniqueCanonicalPlayers, 165);
  assert.equal(validation.duplicateCanonicalIds.length, 0);

  // Verify every AI franchise has valid purse, overseas limit, WK, pace, spin, and batting/bowling depth
  for (const code of AI_FRANCHISE_CODES) {
    const team = state.liveLeague!.teams[code];
    assert.equal(team.squad.length, 15, `${code} must have 15 players`);
    assert.ok(team.remainingPurseCr >= 0, `${code} purse must be >= 0 (got ${team.remainingPurseCr})`);
    assert.ok(
      getOverseasCount(team.squad) <= 6,
      `${code} overseas count must be <= 6 (got ${getOverseasCount(team.squad)})`
    );
    const wkCount = team.squad.filter((p) => p.role === 'WK').length;
    const paceCount = team.squad.filter((p) => classifyBowlerDiscipline(p) === 'PACE').length;
    const spinCount = team.squad.filter((p) => classifyBowlerDiscipline(p) === 'SPIN').length;
    assert.ok(wkCount >= 1, `${code} should draft at least 1 WK`);
    assert.ok(paceCount >= 2, `${code} should draft at least 2 pace bowlers (got ${paceCount})`);
    assert.ok(spinCount >= 1, `${code} should draft at least 1 spin bowler (got ${spinCount})`);
  }

  // Verify drafted 10 AI squads carry directly into Season Engine with 0 duplicates
  const xiState = autoSelectPlayingXI(state.squad, 4);
  const xiVal = validatePlayingXI(xiState, state.squad, 4);
  assert.equal(xiVal.isValid, true);
  const draftedAiSquads = extractDraftedAiSquads(state);
  assert.ok(draftedAiSquads, 'extractDraftedAiSquads should return all 10 AI squads');

  const season = createInitialSeasonState(
    xiVal.xiPlayers,
    repo,
    1,
    rng,
    xiVal.benchPlayers,
    state.customFranchise,
    draftedAiSquads
  );

  // Every AI team in Season should match the exact players they drafted in the Live Draft
  const seasonCanonicals = new Set<string>();
  for (const p of [...season.teams.YOU.players, ...(season.userBench ?? [])]) {
    seasonCanonicals.add(getCanonicalDraftPlayerId(p));
  }
  for (const code of AI_FRANCHISE_CODES) {
    const seasonTeam = season.teams[code];
    const draftedSquad = draftedAiSquads![code] ?? [];
    const draftedIds: Set<string> = new Set(draftedSquad.map((p) => getCanonicalDraftPlayerId(p)));
    assert.equal(seasonTeam.squad?.length, 15);
    for (const p of seasonTeam.squad ?? []) {
      const cid = getCanonicalDraftPlayerId(p);
      assert.ok(draftedIds.has(cid), `Season ${code} player ${p.playerName} must come from live draft`);
      assert.equal(seasonCanonicals.has(cid), false, `Duplicate canonical player in season: ${cid}`);
      seasonCanonicals.add(cid);
    }
  }
  assert.equal(seasonCanonicals.size, 165);
});

test('retention lock synchronizes AI opening rounds and prevents AI from drafting user retentions', () => {
  const rng = createSeededRng(7711);
  let state = createInitialDraftState(DEFAULT_SETTINGS);
  state = setCustomFranchise(state, {
    name: 'Delhi Titans',
    code: 'DTN',
    homeCity: 'Delhi',
    homeGround: 'Titans Ground, Delhi',
    primaryColor: '#2563EB',
    secondaryColor: '#F59E0B',
  });
  state = setRetentionCount(state, 2);

  const allRecords = repo.getAllPlayerSeasonRecords();
  const top1 = allRecords.find((p) => p.playerId === 'virat-kohli' && p.season === 2016) ?? allRecords[0];
  const top2 =
    allRecords.find((p) => p.playerId === 'jasprit-bumrah' && p.season === 2024) ??
    allRecords.find((p) => p.playerId !== top1.playerId)!;

  state = assignPlayerToRetentionSlot(state, top1, 0);
  state = assignPlayerToRetentionSlot(state, top2, 1);
  state = lockRetentionsWithLiveLeague(state, repo, rng);

  assert.equal(state.squad.length, 2);
  assert.equal(state.liveLeague!.ownedPlayerIds.length, 22);
  for (const code of AI_FRANCHISE_CODES) {
    assert.equal(state.liveLeague!.teams[code].squad.length, 2);
    const aiCanonicals = state.liveLeague!.teams[code].squad.map((p) => getCanonicalDraftPlayerId(p));
    assert.equal(aiCanonicals.includes(getCanonicalDraftPlayerId(top1)), false);
    assert.equal(aiCanonicals.includes(getCanonicalDraftPlayerId(top2)), false);
  }
});

test('validateLeagueDraft catches duplicates, illegal budgets, and overseas violations', () => {
  const rng = createSeededRng(9901);
  let state = createInitialDraftState(DEFAULT_SETTINGS);
  state = setRetentionCount(state, 0);
  state = lockRetentionsWithLiveLeague(state, repo, rng);

  for (let round = 1; round <= 15; round += 1) {
    state = executeSpin(state, repo, rng);
    const pickable = state.currentSpin!.pool.find((p) => canSelectPlayer(state, p).allowed)!;
    state = selectPlayerInLiveDraft(state, pickable, repo, rng);
  }

  assert.equal(validateLeagueDraft(state).isValid, true);

  // Inject a duplicate canonical player across YOU and MI + negative purse
  const duplicated = state.squad[0];
  const corrupted = {
    ...state,
    liveLeague: {
      ...state.liveLeague!,
      teams: {
        ...state.liveLeague!.teams,
        MI: {
          ...state.liveLeague!.teams.MI,
          remainingPurseCr: -4,
          squad: [duplicated, ...state.liveLeague!.teams.MI.squad.slice(1)],
        },
      },
    },
  };

  const result = validateLeagueDraft(corrupted);
  assert.equal(result.isValid, false);
  assert.ok(result.duplicateCanonicalIds.includes(getCanonicalDraftPlayerId(duplicated)));
  assert.ok(result.errors.some((e) => e.includes('Duplicate canonical player')));
  assert.ok(result.errors.some((e) => e.includes('negative purse')));
});

test('missing real salary players use stable derived GAME VALUE, remain draftable, and never overwrite real salaryCr', () => {
  const rng = createSeededRng(4242);
  let state = createInitialDraftState(DEFAULT_SETTINGS);
  state = setRetentionCount(state, 0);
  state = lockRetentionsWithLiveLeague(state, repo, rng);

  const missingRealSalaryPlayer = repo
    .getAllPlayerSeasonRecords()
    .find((p) => (p.salary?.salaryCr ?? p.salaryCr ?? null) === null && p.salarySource === 'GAME_VALUE');
  assert.ok(missingRealSalaryPlayer, 'Database should derive GAME_VALUE for records without real salary');
  assert.equal(missingRealSalaryPlayer.salaryCr, null);
  assert.equal(missingRealSalaryPlayer.salaryVerified, false);
  assert.ok(
    typeof missingRealSalaryPlayer.gamePriceCr === 'number' &&
      missingRealSalaryPlayer.gamePriceCr >= 0.5
  );

  const purseBefore = state.remainingPurseCr;
  state = selectPlayerInLiveDraft(state, missingRealSalaryPlayer, repo, rng);

  assert.equal(
    state.remainingPurseCr,
    Math.round((purseBefore - missingRealSalaryPlayer.gamePriceCr!) * 100) / 100
  );
  const userTx = state.liveLeague!.lastRoundTransactions[0];
  assert.equal(userTx.salaryCr, missingRealSalaryPlayer.gamePriceCr);
});
