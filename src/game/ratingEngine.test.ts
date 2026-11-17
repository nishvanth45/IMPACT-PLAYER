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
import { JsonIplRepository, parseIplDatabase } from '../data/playerRepository';
import type { IplDatabaseJson, PlayerForm, PlayerSeasonRecord } from '../types/game';

const dbPath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/ipl_database_final_ba929b5d.json'
);
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

test('ratings across all 3,552 database records are deterministic, season-specific, PROVISIONAL, and have no 58/20/58 clones', () => {
  const allPlayers = realRepo.getAllPlayerSeasonRecords();
  const reloadedPlayers = realRepoReloaded.getAllPlayerSeasonRecords();
  assert.equal(allPlayers.length, 3552);

  let clone58Count = 0;
  const distinctOvrSet = new Set<number>();

  for (let i = 0; i < allPlayers.length; i += 1) {
    const p = allPlayers[i];
    const p2 = reloadedPlayers[i];

    // Deterministic across loads (never random)
    assert.equal(p.battingRating, p2.battingRating);
    assert.equal(p.bowlingRating, p2.bowlingRating);
    assert.equal(p.impactRating, p2.impactRating);
    assert.equal(p.overallRating, p2.overallRating);

    // Bounds 20-99 & PROVISIONAL preserved
    assert.ok(p.battingRating >= 20 && p.battingRating <= 99);
    assert.ok(p.bowlingRating >= 20 && p.bowlingRating <= 99);
    assert.ok(p.impactRating >= 20 && p.impactRating <= 99);
    assert.ok(p.overallRating >= 20 && p.overallRating <= 99);
    assert.equal(p.ratingStatus, 'PROVISIONAL');
    assert.equal(p.form, 'NORMAL');

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

    if (p.battingRating === 58 && p.bowlingRating === 20 && p.overallRating === 58) {
      clone58Count += 1;
    }
    distinctOvrSet.add(p.overallRating);
  }

  assert.equal(clone58Count, 0, 'Must not mass-assign placeholder 58/20/58 ratings');
  assert.ok(distinctOvrSet.size >= 35, `Expected wide OVR spread, got ${distinctOvrSet.size}`);
});

test('same player varies across historical seasons, lower-OVR/higher-IMP exists, and salary stays independent', () => {
  const kohli2016 = realRepo.getSquad('RCB', 2016).find((p) => p.id === 'virat-kohli')!;
  const kohli2010 = realRepo.getSquad('RCB', 2010).find((p) => p.id === 'virat-kohli')!;
  assert.ok(kohli2016 && kohli2010);
  assert.ok(kohli2016.battingRating > kohli2010.battingRating);
  assert.ok(kohli2016.overallRating > kohli2010.overallRating);
  assert.equal(kohli2016.ratingBand, 'Historic');

  // High-impact finisher can have higher IMP than a higher-OVR anchor
  const rinku2023 = realRepo.getSquad('KKR', 2023).find((p) => p.id === 'rinku-singh')!;
  const kl2020 = realRepo.getSquad('PBKS', 2020).find((p) => p.id === 'kl-rahul')!;
  assert.ok(rinku2023 && kl2020);
  assert.ok(rinku2023.overallRating < kl2020.overallRating);
  assert.ok(
    rinku2023.impactRating > kl2020.impactRating,
    `Expected finisher Rinku 2023 IMP (${rinku2023.impactRating}) > KL 2020 IMP (${kl2020.impactRating})`
  );

  // Salary remains verbatim from raw JSON and completely independent of OVR
  const rawRcb2016 = rawDbJson.seasons['2016']['RCB'].players;
  const loadedRcb2016 = realRepo.getSquad('RCB', 2016);
  for (const raw of rawRcb2016) {
    const loaded = loadedRcb2016.find((p) => p.id === raw.id)!;
    assert.equal(loaded.priceCr, raw.priceCr);
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

  const rcb2016 = realRepo.getSquad('RCB', 2016);
  const sampleXi: PlayerSeasonRecord[] = [
    ...rcb2016.filter((p) => p.role === 'BAT' || p.role === 'WK').slice(0, 5),
    ...rcb2016.filter((p) => p.role === 'AR').slice(0, 2),
    ...rcb2016.filter((p) => p.role === 'BOWL').slice(0, 4),
  ];
  assert.equal(sampleXi.length, 11);

  const kohli = rcb2016.find((p) => p.id === 'virat-kohli')!;
  const effCold = getEffectiveMatchRatings(kohli, 'VERY_POOR');
  assert.equal(effCold.battingRating, kohli.battingRating - 4);
  assert.equal(kohli.overallRating, 97); // historical OVR untouched

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
