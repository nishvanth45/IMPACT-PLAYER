import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialCareerStats,
  recordCompletedSeasonInCareer,
  unlockAchievement,
} from './careerEngine';
import { createInitialSeasonState, quickSimPlayoffMatch, quickSimUserFixture, getUserFixtures } from './seasonEngine';
import { getRatingBand } from './ratingEngine';
import type { PlayerDetailedAttributes, PlayerRole, PlayerSeasonRecord } from '../types/game';

function makeAttrs(val: number): PlayerDetailedAttributes {
  return {
    batting: {
      power: val,
      timing: val,
      technique: val,
      strikeRotation: val,
      paceHitting: val,
      spinHitting: val,
      powerplay: val,
      middleOvers: val,
      deathOvers: val,
      chase: val,
      pressure: val,
      finishing: val,
    },
    bowling: {
      wicketTaking: val,
      economy: val,
      powerplayBowling: val,
      middleOversBowling: val,
      deathBowling: val,
      control: val,
      variation: val,
      pressure: val,
    },
    other: {
      fielding: val,
      captaincy: val,
      consistency: val,
      fitness: val,
      impactAbility: val,
    },
  };
}

function makeXI(): PlayerSeasonRecord[] {
  const roles: PlayerRole[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL'];
  return roles.map((role, idx) => ({
    id: `c-${idx}`,
    name: `Career Player ${idx}`,
    playerId: `c-${idx}`,
    playerName: `Career Player ${idx}`,
    season: 2024,
    franchise: 'MI',
    teamName: 'Mumbai Indians',
    nationality: 'India',
    playerType: 'Domestic',
    isOverseas: false,
    role,
    battingStyle: 'Right-hand bat',
    bowlingStyle: role === 'BOWL' ? 'Right-arm fast' : 'None',
    matches: 14,
    runs: 0,
    battingAverage: 0,
    strikeRate: 0,
    wickets: 0,
    economy: 0,
    battingRating: 85,
    bowlingRating: 85,
    impactRating: 85,
    overallRating: 85,
    ratingBand: getRatingBand(85),
    form: 'NORMAL',
    attributes: makeAttrs(85),
    priceCr: 10,
    ratingStatus: 'PROVISIONAL',
  }));
}

test('careerEngine unlocks achievements idempotently and tracks completed seasons', () => {
  let career = createInitialCareerStats();
  assert.equal(career.seasonsPlayed, 0);
  assert.equal(career.bestFinish, '—');

  career = unlockAchievement(career, 'complete_draft');
  assert.equal(career.achievements.find((a) => a.id === 'complete_draft')?.unlocked, true);

  let season = createInitialSeasonState(makeXI(), null, 1, () => 0.4, [], 'TEST XI');
  for (const fix of getUserFixtures(season)) {
    season = quickSimUserFixture(season, fix.id, () => 0.45);
  }
  assert.equal(season.phase, 'PLAYOFFS');
  season = quickSimPlayoffMatch(season, 'Q1', () => 0.45);
  season = quickSimPlayoffMatch(season, 'ELIM', () => 0.45);
  season = quickSimPlayoffMatch(season, 'Q2', () => 0.45);
  season = quickSimPlayoffMatch(season, 'FINAL', () => 0.45);
  assert.equal(season.phase, 'COMPLETED');

  const updated = recordCompletedSeasonInCareer(career, season);
  assert.equal(updated.seasonsPlayed, 1);
  assert.notEqual(updated.bestFinish, '—');
  assert.ok(updated.bestPosition !== null);
});
