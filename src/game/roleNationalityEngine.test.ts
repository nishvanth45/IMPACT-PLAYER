import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCanonicalRoleNationalityLayer,
  buildRoleNationalityValidationReport,
  normalizeBowlingType,
  normalizeCountryName,
  normalizeNationality,
  normalizeRole,
  resolveEffectiveSeasonRole,
} from './roleNationalityEngine';
import { JsonIplRepository, parseIplDatabase } from '../data/playerRepository';
import { canSelectPlayer, createInitialDraftState } from './draftEngine';
import { autoSelectPlayingXI, validatePlayingXI } from './playingXiEngine';
import { checkImpactSubstitution } from './matchEngine';
import type { PlayerSeasonRecord } from '../types/game';

const MASTER_DB_PATH = path.resolve(process.cwd(), 'public/impact_player_database.json');

function loadMasterRepo(): JsonIplRepository {
  const raw = JSON.parse(fs.readFileSync(MASTER_DB_PATH, 'utf8'));
  const parsed = parseIplDatabase(raw);
  return new JsonIplRepository(parsed);
}

test('normalizeRole maps all source role variants into BAT | WK | AR | BOWL | null', () => {
  assert.equal(normalizeRole('Batter'), 'BAT');
  assert.equal(normalizeRole('Batsman'), 'BAT');
  assert.equal(normalizeRole('Top-order Batter'), 'BAT');
  assert.equal(normalizeRole('BAT'), 'BAT');

  assert.equal(normalizeRole('Wicketkeeper'), 'WK');
  assert.equal(normalizeRole('Wicketkeeper Batter'), 'WK');
  assert.equal(normalizeRole('WK-Batter'), 'WK');
  assert.equal(normalizeRole('Keeper-Batter'), 'WK');
  assert.equal(normalizeRole('WK'), 'WK');

  assert.equal(normalizeRole('Allrounder'), 'AR');
  assert.equal(normalizeRole('All-Rounder'), 'AR');
  assert.equal(normalizeRole('Batting Allrounder'), 'AR');
  assert.equal(normalizeRole('Bowling Allrounder'), 'AR');
  assert.equal(normalizeRole('AR'), 'AR');

  assert.equal(normalizeRole('Bowler'), 'BOWL');
  assert.equal(normalizeRole('Pacer'), 'BOWL');
  assert.equal(normalizeRole('Spinner'), 'BOWL');
  assert.equal(normalizeRole('Fast Bowler'), 'BOWL');
  assert.equal(normalizeRole('BOWL'), 'BOWL');

  // Missing or unknown values must remain null (never fabricated)
  assert.equal(normalizeRole('UNKNOWN'), null);
  assert.equal(normalizeRole(''), null);
  assert.equal(normalizeRole(null), null);
  assert.equal(normalizeRole(undefined), null);
  assert.equal(normalizeRole('N/A'), null);
});

test('normalizeBowlingType preserves detailed bowling types separately', () => {
  assert.equal(normalizeBowlingType('Right-arm fast'), 'Pace');
  assert.equal(normalizeBowlingType('Left-arm fast-medium'), 'Pace');
  assert.equal(normalizeBowlingType('Pace'), 'Pace');

  assert.equal(normalizeBowlingType('Right-arm medium'), 'Medium Pace');
  assert.equal(normalizeBowlingType('Right-arm medium-fast'), 'Medium Pace');
  assert.equal(normalizeBowlingType('Medium Pace'), 'Medium Pace');

  assert.equal(normalizeBowlingType('Legbreak'), 'Leg Spin');
  assert.equal(normalizeBowlingType('Legbreak googly'), 'Leg Spin');
  assert.equal(normalizeBowlingType('Wrist-spin'), 'Leg Spin');

  assert.equal(normalizeBowlingType('Right-arm offbreak'), 'Off Spin');
  assert.equal(normalizeBowlingType('Off Spin'), 'Off Spin');

  assert.equal(normalizeBowlingType('Slow left-arm orthodox'), 'Left-arm Spin');
  assert.equal(normalizeBowlingType('Left-arm wrist-spin'), 'Left-arm Spin');
  assert.equal(normalizeBowlingType('Chinaman'), 'Left-arm Spin');

  assert.equal(normalizeBowlingType('None'), 'Unknown');
  assert.equal(normalizeBowlingType(''), 'Unknown');
  assert.equal(normalizeBowlingType(undefined), 'Unknown');
});

test('normalizeNationality handles real countries accurately and never fabricates missing data', () => {
  assert.deepEqual(normalizeNationality({ nationality: 'India' }), {
    nationality: 'India',
    isOverseas: false,
    nationalityStatus: 'VERIFIED',
  });

  const overseasCountries = [
    'Australia',
    'England',
    'South Africa',
    'West Indies',
    'New Zealand',
    'Sri Lanka',
    'Afghanistan',
    'Bangladesh',
  ];
  for (const country of overseasCountries) {
    assert.deepEqual(normalizeNationality({ nationality: country }), {
      nationality: country,
      isOverseas: true,
      nationalityStatus: 'VERIFIED',
    });
  }

  // Generic "Overseas" label preserves isOverseas: true without inventing a country
  assert.deepEqual(normalizeNationality({ nationality: 'Overseas', isOverseas: true }), {
    nationality: null,
    isOverseas: true,
    nationalityStatus: 'NEEDS_REVIEW',
  });
  assert.equal(normalizeCountryName('Overseas'), null);

  // Completely missing nationality must NEVER default to Indian
  assert.deepEqual(normalizeNationality({ nationality: null, isOverseas: null, playerType: 'Unknown' }), {
    nationality: null,
    isOverseas: null,
    nationalityStatus: 'NEEDS_REVIEW',
  });
});

test('buildCanonicalRoleNationalityLayer resolves contradictions, propagates partial seasons, and preserves seasonRoles', () => {
  const layer = buildCanonicalRoleNationalityLayer([
    // Overseas player with 1 corrupted Domestic season
    { playerId: 'star-aus', season: 2021, role: 'Batter', isOverseas: true, nationality: 'Overseas' },
    { playerId: 'star-aus', season: 2022, role: 'Batter', isOverseas: true, nationality: 'Overseas' },
    { playerId: 'star-aus', season: 2023, role: 'Batter', isOverseas: false, playerType: 'Domestic' },
    // Partial missing season
    { playerId: 'partial-ar', season: 2023, role: 'Allrounder', isOverseas: true, nationality: 'Sri Lanka' },
    { playerId: 'partial-ar', season: 2024, role: 'UNKNOWN', isOverseas: null, nationality: null },
    // Multi-role player across career
    { playerId: 'multi-role', season: 2019, role: 'AR', isOverseas: false, nationality: 'India' },
    { playerId: 'multi-role', season: 2020, role: 'AR', isOverseas: false, nationality: 'India' },
    { playerId: 'multi-role', season: 2024, role: 'BOWL', isOverseas: false, nationality: 'India' },
    // Truly unknown player
    { playerId: 'mystery-player', season: 2026, role: 'UNKNOWN', isOverseas: null, nationality: null },
  ]);

  assert.equal(layer['star-aus'].primaryRole, 'BAT');
  assert.equal(layer['star-aus'].roleStatus, 'VERIFIED');
  assert.equal(layer['star-aus'].isOverseas, true);
  assert.equal(layer['star-aus'].nationality, null);
  assert.equal(layer['star-aus'].nationalityStatus, 'NEEDS_REVIEW');

  assert.equal(layer['partial-ar'].primaryRole, 'AR');
  assert.equal(layer['partial-ar'].roleStatus, 'INFERRED');
  assert.equal(layer['partial-ar'].nationality, 'Sri Lanka');
  assert.equal(layer['partial-ar'].isOverseas, true);
  assert.equal(layer['partial-ar'].nationalityStatus, 'INFERRED');

  assert.equal(layer['multi-role'].primaryRole, 'AR');
  assert.equal(layer['multi-role'].roleStatus, 'INFERRED');
  assert.deepEqual(layer['multi-role'].seasonRoles, { '2024': 'BOWL' });
  assert.equal(resolveEffectiveSeasonRole(layer['multi-role'], 2019).role, 'AR');
  assert.equal(resolveEffectiveSeasonRole(layer['multi-role'], 2024).role, 'BOWL');

  assert.equal(layer['mystery-player'].primaryRole, null);
  assert.equal(layer['mystery-player'].roleStatus, 'NEEDS_REVIEW');
  assert.equal(layer['mystery-player'].nationality, null);
  assert.equal(layer['mystery-player'].isOverseas, null);
  assert.equal(layer['mystery-player'].nationalityStatus, 'NEEDS_REVIEW');

  const report = buildRoleNationalityValidationReport(layer);
  assert.equal(report.totalCanonicalPlayers, 4);
  assert.equal(report.missingRole, 1);
  assert.equal(report.indianPlayers, 1);
  assert.equal(report.overseasPlayers, 2);
  assert.equal(report.unknownOriginPlayers, 1);
});

test('master /public/impact_player_database.json passes canonical role & nationality integrity checks', () => {
  const repo = loadMasterRepo();
  const report = repo.getRoleNationalityReport();
  const allRecords = repo.getAllPlayerSeasonRecords();

  assert.equal(report.totalCanonicalPlayers, 757);
  assert.equal(allRecords.length, 3552);
  assert.equal(report.indianPlayers + report.overseasPlayers + report.unknownOriginPlayers, 757);
  assert.equal(report.roleVerified + report.roleInferred + report.roleNeedsReview, 757);

  // Every player-season record must share canonical nationality and isOverseas across seasons
  const byPid = new Map<string, PlayerSeasonRecord[]>();
  for (const rec of allRecords) {
    // Never store generic "Overseas" or "Unknown" as a country name
    assert.notEqual(rec.nationality, 'Overseas', `${rec.playerId} must not have fake country "Overseas"`);
    assert.notEqual(rec.nationality, 'Unknown', `${rec.playerId} must not have fake country "Unknown"`);
    const list = byPid.get(rec.playerId) ?? [];
    list.push(rec);
    byPid.set(rec.playerId, list);
  }

  for (const [pid, seasons] of byPid.entries()) {
    const origins = new Set(seasons.map((s) => s.isOverseas));
    const nats = new Set(seasons.map((s) => s.nationality));
    assert.equal(origins.size, 1, `Canonical player ${pid} has inconsistent isOverseas across seasons`);
    assert.equal(nats.size, 1, `Canonical player ${pid} has inconsistent nationality across seasons`);
  }

  // All 5 previously corrupted overseas captains are now consistently isOverseas: true in every season
  const fixedCaptains = [
    'david-warner',
    'faf-du-plessis',
    'pat-cummins',
    'kane-williamson',
    'aiden-markram',
  ];
  for (const pid of fixedCaptains) {
    const seasons = repo.getPlayerSeasons(pid);
    assert.ok(seasons.length >= 5, `Expected multiple seasons for ${pid}`);
    for (const s of seasons) {
      assert.equal(s.isOverseas, true, `${pid} ${s.season} must be isOverseas: true`);
      assert.equal(s.nationality, null, `${pid} nationality should stay null until real country source is added`);
      assert.equal(s.nationalityStatus, 'NEEDS_REVIEW');
    }
  }

  // Partial-season gaps fixed by canonical propagation
  const shanaka = repo.getCanonicalRoleNationality('dasun-shanaka');
  assert.equal(shanaka?.primaryRole, 'AR');
  assert.equal(shanaka?.roleStatus, 'INFERRED');
  assert.equal(shanaka?.isOverseas, true);

  const spencer = repo.getCanonicalRoleNationality('spencer-johnson');
  assert.equal(spencer?.primaryRole, 'BOWL');
  assert.equal(spencer?.roleStatus, 'INFERRED');
  assert.equal(spencer?.isOverseas, true);

  // Shreyas Gopal preserves career AR primaryRole + 2024-2026 BOWL seasonRole
  const gopal = repo.getCanonicalRoleNationality('shreyas-gopal');
  assert.equal(gopal?.primaryRole, 'AR');
  assert.equal(gopal?.roleStatus, 'INFERRED');
  const gopal2024 = repo.getPlayerSeasons('shreyas-gopal').find((s) => s.season === 2024);
  assert.equal(gopal2024?.role, 'BOWL');
  assert.equal(gopal2024?.seasonRole, 'BOWL');

  // The 4 truly unknown players remain null + NEEDS_REVIEW (never defaulted to Indian)
  for (const pid of ['lhuan-dre-pretorious', 'auqib-nabi', 'saurabh-dubey', 'david-payne']) {
    const entry = repo.getCanonicalRoleNationality(pid);
    assert.equal(entry?.primaryRole, null);
    assert.equal(entry?.roleStatus, 'NEEDS_REVIEW');
    assert.equal(entry?.nationality, null);
    assert.equal(entry?.isOverseas, null);
    assert.equal(entry?.nationalityStatus, 'NEEDS_REVIEW');
  }
});

test('game rule compatibility: 6 overseas squad cap, 4 overseas XI cap, 5th overseas Impact Player, mandatory WK & Auto XI', () => {
  const repo = loadMasterRepo();
  const canonical = repo.getUniqueCanonicalPlayers();

  const overseasPlayers = canonical
    .filter((c) => c.isOverseas === true && c.bestRecord.role !== 'UNKNOWN')
    .map((c) => c.bestRecord);
  const indianWks = canonical
    .filter((c) => c.isOverseas === false && c.bestRecord.role === 'WK')
    .map((c) => c.bestRecord);
  const indianBats = canonical
    .filter((c) => c.isOverseas === false && c.bestRecord.role === 'BAT')
    .map((c) => c.bestRecord);
  const indianArs = canonical
    .filter((c) => c.isOverseas === false && c.bestRecord.role === 'AR')
    .map((c) => c.bestRecord);
  const indianBowls = canonical
    .filter((c) => c.isOverseas === false && c.bestRecord.role === 'BOWL')
    .map((c) => c.bestRecord);

  // 1. 15-player squad max 6 overseas (using fixed captain Pat Cummins 2024 as 7th overseas)
  const patCummins2024 = repo
    .getPlayerSeasons('pat-cummins')
    .find((s) => s.season === 2024)!;
  assert.equal(patCummins2024.isOverseas, true);

  const sixOverseasSquad = overseasPlayers
    .filter((p) => p.playerId !== 'pat-cummins')
    .slice(0, 6);
  const draftState = {
    ...createInitialDraftState(),
    squad: sixOverseasSquad,
    draftedPlayerIds: sixOverseasSquad.map((p) => p.playerId),
    remainingPurseCr: 60,
  };
  const check7thOs = canSelectPlayer(draftState, patCummins2024);
  assert.equal(check7thOs.allowed, false);
  assert.equal(check7thOs.reason, 'OVERSEAS_LIMIT');

  // 2. Starting XI: max 4 overseas, mandatory >= 1 WK, Auto XI balance
  const squad15: PlayerSeasonRecord[] = [
    ...overseasPlayers.slice(0, 6),
    indianWks[0],
    indianBats[0],
    indianBats[1],
    indianBats[2],
    indianArs[0],
    indianArs[1],
    indianBowls[0],
    indianBowls[1],
    indianBowls[2],
  ];

  const autoXi = autoSelectPlayingXI(squad15, 4);
  const xiValidation = validatePlayingXI(autoXi, squad15, 4);
  assert.equal(xiValidation.isValid, true, `Auto XI should be valid: ${xiValidation.errors.join('; ')}`);
  assert.equal(xiValidation.xiPlayers.length, 11);
  assert.ok(xiValidation.overseasCount <= 4);
  assert.ok(xiValidation.wicketkeepersInXI.length >= 1);

  // 2b. Unknown-origin player must NOT be counted as Indian in validatePlayingXI
  const unknownOriginPlayer = repo.getPlayerSeasons('auqib-nabi')[0];
  assert.equal(unknownOriginPlayer.isOverseas, null);
  const squadWithUnknown = [...xiValidation.xiPlayers.slice(0, 10), unknownOriginPlayer];
  const unknownCheck = validatePlayingXI(
    {
      playingXiIds: squadWithUnknown.map((p) => p.playerId),
      captainId: squadWithUnknown[0].playerId,
      wicketkeeperId: squadWithUnknown.find((p) => p.role === 'WK')?.playerId ?? null,
      isConfirmed: false,
    },
    squadWithUnknown,
    4
  );
  assert.equal(
    unknownCheck.indianCount + unknownCheck.overseasCount,
    10,
    'Unknown origin player must not be counted as Indian or Overseas'
  );

  // 3. Mandatory WK validation fails when 0 WKs in XI
  const noWkXi = [...indianBats.slice(0, 5), ...indianArs.slice(0, 3), ...indianBowls.slice(0, 3)];
  const noWkValidation = validatePlayingXI(
    {
      playingXiIds: noWkXi.map((p) => p.playerId),
      captainId: noWkXi[0].playerId,
      wicketkeeperId: null,
      isConfirmed: false,
    },
    noWkXi,
    4
  );
  assert.equal(noWkValidation.isValid, false);
  assert.ok(noWkValidation.errors.some((e) => e.includes('wicketkeeper')));

  // 4. Impact Player: 1 overseas Impact Player may become 5th overseas participant under custom rule
  const fourOsXi: PlayerSeasonRecord[] = [
    ...overseasPlayers.slice(0, 4),
    indianWks[0],
    indianBats[0],
    indianBats[1],
    indianArs[0],
    indianBowls[0],
    indianBowls[1],
    indianBowls[2],
  ];
  const fifthOsBench = overseasPlayers[4];
  const indianOut = indianBowls[2];
  const impactAllowed = checkImpactSubstitution(fourOsXi, fifthOsBench, indianOut, 4);
  assert.equal(impactAllowed.allowed, true);
  assert.equal(impactAllowed.wasFifthOverseas, true);

  // 6th overseas participant must be blocked
  const fiveOsXi = [...fourOsXi.slice(0, 10), fifthOsBench];
  const sixthOsBench = overseasPlayers[5];
  const impactBlocked = checkImpactSubstitution(fiveOsXi, sixthOsBench, indianBowls[1], 4);
  assert.equal(impactBlocked.allowed, false);
});
