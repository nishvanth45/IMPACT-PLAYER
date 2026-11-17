import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  canSelectPlayer,
  createInitialDraftState,
  getOverseasCount,
  selectPlayerForDraft,
} from './draftEngine';
import {
  RETENTION_SLOT_COSTS,
  assignPlayerToRetentionSlot,
  canRetainPlayerInSlot,
  clearRetentionSlot,
  getPlayerImpactScore,
  getRetentionSummary,
  lockRetentionsAndStartSpin,
  setRetentionCount,
} from './retentionEngine';
import { JsonIplRepository, parseIplDatabase } from '../data/playerRepository';
import type { IplDatabaseJson } from '../types/game';

const dbPath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/ipl_database_final_ba929b5d.json'
);
const rawDbJson = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as IplDatabaseJson;
const realRepo = new JsonIplRepository(parseIplDatabase(rawDbJson));

test('retention slot costs match ₹18 / ₹15 / ₹12 / ₹10 Cr and deduct immediately', () => {
  assert.deepEqual([...RETENTION_SLOT_COSTS], [18, 15, 12, 10]);

  let state = createInitialDraftState();
  assert.equal(state.retention.locked, false);
  assert.equal(state.retention.targetCount, null);

  // 0 retained -> ₹120 Cr -> 15 to draft
  state = setRetentionCount(state, 0);
  const sum0 = getRetentionSummary(state);
  assert.equal(sum0.remainingPurseCr, 120);
  assert.equal(sum0.playersRemainingToDraft, 15);
  assert.equal(sum0.canLockAndStart, true);

  // Switch to 4 retentions -> assign 4 stars -> ₹120 - (18+15+12+10) = ₹65 Cr, 11 remaining
  state = setRetentionCount(state, 4);
  const rcb2016 = realRepo.getSquad('RCB', 2016);
  const csk2018 = realRepo.getSquad('CSK', 2018);
  const mi2020 = realRepo.getSquad('MI', 2020);
  const kkr2014 = realRepo.getSquad('KKR', 2014);

  const p1 = rcb2016.find((p) => p.id === 'virat-kohli')!;
  const p2 = csk2018.find((p) => p.id === 'ms-dhoni')!;
  const p3 = mi2020.find((p) => p.id === 'jasprit-bumrah')!;
  const p4 = kkr2014.find((p) => p.id === 'sunil-narine')!;
  assert.ok(p1 && p2 && p3 && p4);

  state = assignPlayerToRetentionSlot(state, p1, 0);
  assert.equal(state.remainingPurseCr, 102);
  state = assignPlayerToRetentionSlot(state, p2, 1);
  assert.equal(state.remainingPurseCr, 87);
  state = assignPlayerToRetentionSlot(state, p3, 2);
  assert.equal(state.remainingPurseCr, 75);
  state = assignPlayerToRetentionSlot(state, p4, 3);
  assert.equal(state.remainingPurseCr, 65);

  const sum4 = getRetentionSummary(state);
  assert.equal(sum4.retainedCount, 4);
  assert.equal(sum4.retentionSpendCr, 55);
  assert.equal(sum4.remainingPurseCr, 65);
  assert.equal(sum4.squadCount, 4);
  assert.equal(sum4.overseasCount, 1); // Sunil Narine
  assert.equal(sum4.playersRemainingToDraft, 11);
  assert.equal(sum4.canLockAndStart, true);
  assert.ok(getPlayerImpactScore(p1) > 0);
});

test('same player cannot be retained twice from different seasons and is blocked in Spin Draft', () => {
  let state = createInitialDraftState();
  state = setRetentionCount(state, 2);

  const kohli2016 = realRepo.getSquad('RCB', 2016).find((p) => p.id === 'virat-kohli')!;
  const kohli2024 = realRepo.getSquad('RCB', 2024).find((p) => p.id === 'virat-kohli')!;
  const dhoni2018 = realRepo.getSquad('CSK', 2018).find((p) => p.id === 'ms-dhoni')!;

  state = assignPlayerToRetentionSlot(state, kohli2016, 0);

  // Attempting to retain Virat Kohli (2024) in slot 2 must fail
  const dupCheck = canRetainPlayerInSlot(state, kohli2024, 1);
  assert.equal(dupCheck.allowed, false);
  assert.equal(dupCheck.label, 'ALREADY RETAINED');

  // Fill slot 2 with Dhoni, then lock retentions
  state = assignPlayerToRetentionSlot(state, dhoni2018, 1);
  state = lockRetentionsAndStartSpin(state);

  assert.equal(state.retention.locked, true);
  assert.equal(state.squad.length, 2);
  assert.equal(state.remainingPurseCr, 87);
  assert.equal(state.squad[0].isRetained, true);
  assert.equal(state.squad[0].season, 2016);
  assert.equal(state.squad[0].priceCr, 18); // retention price overrides normal priceCr
  assert.equal(state.squad[1].priceCr, 15);

  // Locked retentions cannot be modified
  const afterAttemptedClear = clearRetentionSlot(state, 0);
  assert.equal(afterAttemptedClear.squad.length, 2);
  assert.equal(afterAttemptedClear.retention.slots[0].player?.id, 'virat-kohli');

  // Kohli 2024 is globally blocked during Spin Draft
  const spinCheck = canSelectPlayer(state, kohli2024);
  assert.equal(spinCheck.allowed, false);
  assert.equal(spinCheck.reason, 'ALREADY_DRAFTED');
});

test('retained overseas players count toward the 6-player overseas squad limit', () => {
  let state = createInitialDraftState();
  state = setRetentionCount(state, 4);

  const rcb2016 = realRepo.getSquad('RCB', 2016);
  const osPlayers = rcb2016.filter((p) => p.isOverseas === true).slice(0, 4);
  assert.equal(osPlayers.length, 4);

  osPlayers.forEach((p, idx) => {
    state = assignPlayerToRetentionSlot(state, p, idx);
  });
  state = lockRetentionsAndStartSpin(state);
  assert.equal(getOverseasCount(state.squad), 4);

  // Add 2 more overseas via Spin Draft -> hits 6/6 cap
  const cskOs = realRepo
    .getSquad('CSK', 2023)
    .filter((p) => p.isOverseas === true && !state.draftedPlayerIds.includes(p.id))
    .slice(0, 3);
  state = selectPlayerForDraft(state, cskOs[0]);
  state = selectPlayerForDraft(state, cskOs[1]);
  assert.equal(getOverseasCount(state.squad), 6);

  // 7th overseas player must be blocked
  const seventhCheck = canSelectPlayer(state, cskOs[2]);
  assert.equal(seventhCheck.allowed, false);
  assert.equal(seventhCheck.reason, 'OVERSEAS_LIMIT');
});

test('₹0.5 Cr minimum purse reserve per remaining position blocks overspending in Spin Draft', () => {
  let state = createInitialDraftState({
    ...DEFAULT_SETTINGS,
    startingPurseCr: 20,
    squadSize: 15,
  });
  state = setRetentionCount(state, 0);
  state = lockRetentionsAndStartSpin(state);

  // At 0/15, 14 positions remain after this pick -> min reserve = 14 * 0.5 = ₹7.0 Cr
  // With ₹20 Cr purse, max spend on pick 1 is ₹13.0 Cr
  const expensive = realRepo.getSquad('RCB', 2016)[0];
  const at8Cr = { ...expensive, id: 'p_8', playerId: 'p_8', priceCr: 8 };
  assert.equal(canSelectPlayer(state, at8Cr).allowed, true);

  const at14Cr = { ...expensive, id: 'p_14', playerId: 'p_14', priceCr: 14 };
  const reserveBlocked = canSelectPlayer(state, at14Cr);
  assert.equal(reserveBlocked.allowed, false);
  assert.equal(reserveBlocked.reason, 'INSUFFICIENT_PURSE');
  assert.equal(reserveBlocked.label, 'Reserve ₹7 Cr');
});
