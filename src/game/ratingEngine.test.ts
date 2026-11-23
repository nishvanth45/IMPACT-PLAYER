import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateRoleOverallRating,
  clampRating,
  getEffectiveMatchRatings,
  getPlayerFormMeta,
  getPlayerFormModifier,
  getRatingBand,
  shiftPlayerForm,
} from './ratingEngine';
import {
  calculateXiStrength,
  createInitialSeasonState,
  getUserFixtures,
  quickSimUserFixture,
} from './seasonEngine';
import { JsonIplRepository, isProvisionalStatus, parseIplDatabase } from '../data/playerRepository';
import type { IplDatabaseJson, PlayerForm, PlayerSeasonRecord } from '../types/game';

const dbPath = path.resolve(process.cwd(), 'public/impact_player_database.json');
const rawDbJson = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as IplDatabaseJson;
const realRepo = new JsonIplRepository(parseIplDatabase(rawDbJson));
const realRepoReloaded = new JsonIplRepository(parseIplDatabase(rawDbJson));

function seededRng(seedInput: number): () => number {
  let s = seedInput >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('rating bands cover the exact 20-99 scale with clamping', () => {
  assert.equal(clampRating(5), 20);
  assert.equal(clampRating(120), 99);

  assert.equal(getRatingBand(99), 'Historic');
  assert.equal(getRatingBand(95), 'Historic');
  assert.equal(getRatingBand(94), 'Elite');
  assert.equal(getRatingBand(90), 'Elite');
  assert.equal(getRatingBand(89), 'Excellent');
  assert.equal(getRatingBand(84), 'Excellent');
  assert.equal(getRatingBand(83), 'Strong');
  assert.equal(getRatingBand(76), 'Strong');
  assert.equal(getRatingBand(75), 'Useful');
  assert.equal(getRatingBand(67), 'Useful');
  assert.equal(getRatingBand(66), 'Average/Limited');
  assert.equal(getRatingBand(55), 'Average/Limited');
  assert.equal(getRatingBand(54), 'Weak');
  assert.equal(getRatingBand(40), 'Weak');
  assert.equal(getRatingBand(39), 'Non-specialist');
  assert.equal(getRatingBand(20), 'Non-specialist');
});

test('role-based OVR never punishes BAT/WK/BOWL specialists for off-discipline ratings and balances AR', () => {
  // Elite batter with minimal bowling stays Elite (not dragged down by BOWL=20)
  const eliteBatOvr = calculateRoleOverallRating('BAT', 94, 20, 90);
  assert.ok(eliteBatOvr >= 90, `Expected elite BAT OVR >= 90, got ${eliteBatOvr}`);

  // Elite WK with minimal bowling stays Elite
  const eliteWkOvr = calculateRoleOverallRating('WK', 92, 20, 90);
  assert.ok(eliteWkOvr >= 90, `Expected elite WK OVR >= 90, got ${eliteWkOvr}`);

  // Elite bowler with minimal batting stays Elite (not dragged down by BAT=22)
  const eliteBowlOvr = calculateRoleOverallRating('BOWL', 22, 95, 92);
  assert.ok(eliteBowlOvr >= 92, `Expected elite BOWL OVR >= 92, got ${eliteBowlOvr}`);

  // All-rounder balances BAT + BOWL + IMP
  const strongArOvr = calculateRoleOverallRating('AR', 84, 84, 90);
  assert.ok(strongArOvr >= 86, `Expected two-way AR OVR >= 86, got ${strongArOvr}`);
});

test('ratings across all 3,552 database records preserve stored JSON ratings verbatim and never fabricate 58/20/58 placeholders', () => {
  const allPlayers = realRepo.getAllPlayerSeasonRecords();
  const reloadedPlayers = realRepoReloaded.getAllPlayerSeasonRecords();
  assert.equal(allPlayers.length, 3552);

  const distinctOvrSet = new Set<number>();
  const distinctSalarySet = new Set<number>();
  let unknownSalaryCount = 0;
  let ratedCount = 0;
  let unratedCount = 0;

  for (let i = 0; i < allPlayers.length; i += 1) {
    const p = allPlayers[i];
    const p2 = reloadedPlayers[i];

    // Deterministic across loads (never random)
    assert.equal(p.battingRating, p2.battingRating);
    assert.equal(p.bowlingRating, p2.bowlingRating);
    assert.equal(p.impactRating, p2.impactRating);
    assert.equal(p.overallRating, p2.overallRating);

    if (p.hasRatings) {
      ratedCount += 1;
      assert.ok(p.battingRating >= 20 && p.battingRating <= 99);
      assert.ok(p.bowlingRating >= 20 && p.bowlingRating <= 99);
      assert.ok(p.impactRating >= 20 && p.impactRating <= 99);
      assert.ok(p.overallRating >= 20 && p.overallRating <= 99);
      distinctOvrSet.add(p.overallRating);
    } else {
      unratedCount += 1;
      assert.equal(p.ratings, null);
      assert.equal(p.battingRating, 0);
      assert.equal(p.bowlingRating, 0);
      assert.equal(p.impactRating, 0);
      assert.equal(p.overallRating, 0);
      assert.equal(p.isIncomplete, true);
    }

    assert.equal(
      p.ratingStatus,
      !p.hasRatings || isProvisionalStatus(p.ratingQuality?.status) ? 'PROVISIONAL' : 'FINAL'
    );
    assert.equal(p.form, 'NORMAL');

    if (p.salary?.salaryCr === null) {
      unknownSalaryCount += 1;
    } else if (typeof p.salary?.salaryCr === 'number') {
      distinctSalarySet.add(p.salary.salaryCr);
    }

    // All 25 attributes present and within 20-99
    const batVals = Object.values(p.attributes.batting);
    const bowlVals = Object.values(p.attributes.bowling);
    const otherVals = Object.values(p.attributes.other);
    assert.equal(batVals.length, 12);
    assert.equal(bowlVals.length, 8);
    assert.equal(otherVals.length, 5);
    for (const v of [...batVals, ...bowlVals, ...otherVals]) {
      assert.ok(v >= 20 && v <= 99, `Out of range attr ${v} for ${p.playerName}`);
    }
  }

  assert.equal(ratedCount, 2025, 'Expected 2,025 stats-derived rated records');
  assert.equal(unratedCount, 1527, 'Expected 1,527 unrated records with ratings: null (no 58/20/58 placeholders)');
  assert.ok(unknownSalaryCount > 0, 'Expected unknown salary records to remain null');
  assert.ok(distinctSalarySet.size >= 20, 'Expected real verified salaries to vary');
  assert.ok(distinctOvrSet.size >= 35, `Expected wide OVR spread, got ${distinctOvrSet.size}`);
});

test('same player varies across historical seasons, lower-OVR/higher-IMP exists, and nested salary stays verbatim', () => {
  const kohli2016 = realRepo.getSquad('RCB', 2016).find((p) => p.playerId === 'virat-kohli')!;
  const kohli2010 = realRepo.getSquad('RCB', 2010).find((p) => p.playerId === 'virat-kohli')!;
  assert.ok(kohli2016 && kohli2010);
  assert.equal(kohli2016.battingRating, 87);
  assert.equal(kohli2016.impactRating, 93);
  assert.equal(kohli2016.overallRating, 88);
  assert.ok(kohli2016.battingRating > kohli2010.battingRating);
  assert.ok(kohli2016.overallRating > kohli2010.overallRating);

  // High-impact finisher can have higher IMP than a higher-OVR anchor
  const rinku2023 = realRepo.getSquad('KKR', 2023).find((p) => p.playerId === 'rinku-singh')!;
  const kl2020 = realRepo.getSquad('PBKS', 2020).find((p) => p.playerId === 'kl-rahul')!;
  assert.ok(rinku2023 && kl2020);
  assert.ok(rinku2023.overallRating < kl2020.overallRating);
  assert.ok(
    rinku2023.impactRating > kl2020.impactRating,
    `Expected finisher Rinku 2023 IMP (${rinku2023.impactRating}) > KL 2020 IMP (${kl2020.impactRating})`
  );

  // Nested salary & ratings remain verbatim from raw JSON (including null ratings when absent)
  const rawRcb2016 = rawDbJson.seasons['2016']['RCB'].players;
  const loadedRcb2016 = realRepo.getSquad('RCB', 2016);
  for (const raw of rawRcb2016) {
    const rawId = raw.playerId ?? raw.id;
    const loaded = loadedRcb2016.find((p) => p.playerId === rawId)!;
    assert.equal(loaded.salary?.salaryCr, raw.salary?.salaryCr ?? null);
    if (raw.ratings) {
      assert.equal(loaded.hasRatings, true);
      assert.equal(loaded.battingRating, raw.ratings.bat);
      assert.equal(loaded.bowlingRating, raw.ratings.bowl);
      assert.equal(loaded.overallRating, raw.ratings.overall);
    } else {
      assert.equal(loaded.hasRatings, false);
      assert.equal(loaded.overallRating, 0);
    }
  }
});

test('FORM modifiers (+4/+2/0/-2/-4) temporarily shift match strength and evolve during season without mutating historical OVR', () => {
  assert.equal(getPlayerFormModifier('EXCELLENT'), 4);
  assert.equal(getPlayerFormModifier('GOOD'), 2);
  assert.equal(getPlayerFormModifier('NORMAL'), 0);
  assert.equal(getPlayerFormModifier('POOR'), -2);
  assert.equal(getPlayerFormModifier('VERY_POOR'), -4);

  assert.equal(getPlayerFormMeta('EXCELLENT').icon, '🔥');
  assert.equal(getPlayerFormMeta('VERY_POOR').icon, '❄');
  assert.equal(shiftPlayerForm('NORMAL', 1), 'GOOD');
  assert.equal(shiftPlayerForm('EXCELLENT', 1), 'EXCELLENT');
  assert.equal(shiftPlayerForm('VERY_POOR', -1), 'VERY_POOR');

  const rcb2016 = realRepo.getSquad('RCB', 2016).filter((p) => p.hasRatings);
  const sampleXi: PlayerSeasonRecord[] = [
    ...rcb2016.filter((p) => p.role === 'BAT' || p.role === 'WK').slice(0, 5),
    ...rcb2016.filter((p) => p.role === 'AR').slice(0, 2),
    ...rcb2016.filter((p) => p.role === 'BOWL').slice(0, 4),
  ];
  assert.equal(sampleXi.length, 11);

  const kohli = rcb2016.find((p) => p.playerId === 'virat-kohli')!;
  const effCold = getEffectiveMatchRatings(kohli, 'VERY_POOR');
  assert.equal(effCold.battingRating, kohli.battingRating - 4);
  assert.equal(kohli.overallRating, 88); // historical OVR untouched

  const normalForms: Record<string, PlayerForm> = {};
  const hotForms: Record<string, PlayerForm> = {};
  const coldForms: Record<string, PlayerForm> = {};
  for (const p of sampleXi) {
    normalForms[p.playerId] = 'NORMAL';
    hotForms[p.playerId] = 'EXCELLENT';
    coldForms[p.playerId] = 'VERY_POOR';
  }

  const sNormal = calculateXiStrength(sampleXi, normalForms);
  const sHot = calculateXiStrength(sampleXi, hotForms);
  const sCold = calculateXiStrength(sampleXi, coldForms);

  assert.ok(sHot.overallStrength > sNormal.overallStrength);
  assert.ok(sNormal.overallStrength > sCold.overallStrength);

  // Simulating league matches evolves playerForms while leaving historical player.overallRating untouched
  const beforeOvrs = sampleXi.map((p) => p.overallRating);
  let season = createInitialSeasonState(sampleXi, realRepo, 1, seededRng(11));
  const rng = seededRng(2026);
  const fixtures = getUserFixtures(season);
  for (let i = 0; i < 6; i += 1) {
    season = quickSimUserFixture(season, fixtures[i].id, rng);
  }

  const formValuesAfter = sampleXi.map((p) => season.playerForms[p.playerId]);
  const anyShifted = formValuesAfter.some((f) => f !== 'NORMAL');
  assert.equal(anyShifted, true, 'Expected some player forms to shift after 6 matches');
  assert.deepEqual(
    season.teams.YOU.players.map((p) => p.overallRating),
    beforeOvrs,
    'Historical OVR must remain unchanged as form evolves'
  );
});
