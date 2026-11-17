import type {
  DraftState,
  PlayerSeasonRecord,
  RetentionSlot,
  RetentionState,
  SelectionCheck,
} from '../types/game';
import { getOverseasCount, roundCr } from './draftEngine';

export const RETENTION_SLOT_COSTS = [18, 15, 12, 10] as const;

export function createInitialRetentionState(): RetentionState {
  return {
    targetCount: null,
    slots: [],
    locked: false,
  };
}

export function getRetentionSlotCost(slotNumber: 1 | 2 | 3 | 4): number {
  return RETENTION_SLOT_COSTS[slotNumber - 1];
}

export function getPlayerImpactScore(player: PlayerSeasonRecord): number {
  if (Number.isFinite(player.impactRating)) {
    return player.impactRating;
  }
  const peak =
    player.role === 'AR'
      ? (player.battingRating + player.bowlingRating) * 0.5
      : Math.max(player.battingRating, player.bowlingRating);
  return Math.round(player.overallRating * 0.6 + peak * 0.4);
}

function getFilledRetentionPlayers(slots: RetentionSlot[]): PlayerSeasonRecord[] {
  return slots
    .map((s) => s.player)
    .filter((p): p is PlayerSeasonRecord => p !== null);
}

export function computeRetentionSpend(slots: RetentionSlot[]): number {
  return roundCr(
    slots.reduce((sum, slot) => (slot.player ? sum + slot.costCr : sum), 0)
  );
}

export function setRetentionCount(
  state: DraftState,
  count: 0 | 1 | 2 | 3 | 4
): DraftState {
  if (state.retention.locked) {
    return state;
  }

  const nextSlots: RetentionSlot[] = Array.from({ length: count }, (_, idx) => {
    const slotNumber = (idx + 1) as 1 | 2 | 3 | 4;
    const costCr = getRetentionSlotCost(slotNumber);
    const existing = state.retention.slots[idx]?.player ?? null;
    const preservedPlayer = existing
      ? {
          ...existing,
          isRetained: true,
          retentionSlot: slotNumber,
          priceCr: costCr,
        }
      : null;

    return {
      slotNumber,
      costCr,
      player: preservedPlayer,
    };
  });

  const spend = computeRetentionSpend(nextSlots);
  const remainingPurseCr = roundCr(state.settings.startingPurseCr - spend);

  return {
    ...state,
    remainingPurseCr,
    retention: {
      targetCount: count,
      slots: nextSlots,
      locked: false,
    },
  };
}

export function canRetainPlayerInSlot(
  state: DraftState,
  player: PlayerSeasonRecord,
  slotIndex: number
): SelectionCheck {
  if (state.retention.locked) {
    return { allowed: false, label: 'Locked' };
  }

  const slot = state.retention.slots[slotIndex];
  if (!slot) {
    return { allowed: false, label: 'Invalid Slot' };
  }

  const canonicalId = player.id ?? player.playerId;

  // Same player cannot be retained twice (even across different seasons)
  const duplicateInOtherSlot = state.retention.slots.some(
    (s, idx) =>
      idx !== slotIndex &&
      s.player !== null &&
      (s.player.id ?? s.player.playerId) === canonicalId
  );
  if (duplicateInOtherSlot) {
    return {
      allowed: false,
      reason: 'ALREADY_DRAFTED',
      label: 'ALREADY RETAINED',
    };
  }

  const otherPlayers = state.retention.slots
    .filter((_, idx) => idx !== slotIndex)
    .map((s) => s.player)
    .filter((p): p is PlayerSeasonRecord => p !== null);

  if (
    player.isOverseas === true &&
    getOverseasCount(otherPlayers) >= state.settings.overseasSquadLimit
  ) {
    return {
      allowed: false,
      reason: 'OVERSEAS_LIMIT',
      label: `OS Cap ${state.settings.overseasSquadLimit}/${state.settings.overseasSquadLimit}`,
    };
  }

  const otherSpend = otherPlayers.reduce((sum, p) => sum + p.priceCr, 0);
  const projectedRemaining = roundCr(
    state.settings.startingPurseCr - otherSpend - slot.costCr
  );
  const filledAfter = otherPlayers.length + 1;
  const remainingSpotsAfter = Math.max(0, state.settings.squadSize - filledAfter);
  const minReserve = roundCr(remainingSpotsAfter * 0.5);

  if (projectedRemaining < minReserve) {
    return {
      allowed: false,
      reason: 'INSUFFICIENT_PURSE',
      label: 'Low Purse',
    };
  }

  return { allowed: true };
}

export function assignPlayerToRetentionSlot(
  state: DraftState,
  player: PlayerSeasonRecord,
  slotIndex: number
): DraftState {
  const check = canRetainPlayerInSlot(state, player, slotIndex);
  if (!check.allowed) {
    return state;
  }

  const slot = state.retention.slots[slotIndex];
  const retainedRecord: PlayerSeasonRecord = {
    ...player,
    isRetained: true,
    retentionSlot: slot.slotNumber,
    priceCr: slot.costCr,
  };

  const nextSlots = state.retention.slots.map((s, idx) =>
    idx === slotIndex ? { ...s, player: retainedRecord } : s
  );
  const spend = computeRetentionSpend(nextSlots);

  return {
    ...state,
    remainingPurseCr: roundCr(state.settings.startingPurseCr - spend),
    retention: {
      ...state.retention,
      slots: nextSlots,
    },
  };
}

export function clearRetentionSlot(state: DraftState, slotIndex: number): DraftState {
  if (state.retention.locked || !state.retention.slots[slotIndex]) {
    return state;
  }

  const nextSlots = state.retention.slots.map((s, idx) =>
    idx === slotIndex ? { ...s, player: null } : s
  );
  const spend = computeRetentionSpend(nextSlots);

  return {
    ...state,
    remainingPurseCr: roundCr(state.settings.startingPurseCr - spend),
    retention: {
      ...state.retention,
      slots: nextSlots,
    },
  };
}

export interface RetentionSummaryInfo {
  targetCount: 0 | 1 | 2 | 3 | 4 | null;
  retainedCount: number;
  retentionSpendCr: number;
  remainingPurseCr: number;
  squadCount: number;
  squadSize: number;
  overseasCount: number;
  overseasLimit: number;
  playersRemainingToDraft: number;
  allSlotsFilled: boolean;
  canLockAndStart: boolean;
}

export function getRetentionSummary(state: DraftState): RetentionSummaryInfo {
  const retainedPlayers = getFilledRetentionPlayers(state.retention.slots);
  const retentionSpendCr = computeRetentionSpend(state.retention.slots);
  const remainingPurseCr = roundCr(state.settings.startingPurseCr - retentionSpendCr);
  const retainedCount = retainedPlayers.length;
  const overseasCount = getOverseasCount(retainedPlayers);
  const targetCount = state.retention.targetCount;
  const allSlotsFilled =
    targetCount !== null && state.retention.slots.every((s) => s.player !== null);

  return {
    targetCount,
    retainedCount,
    retentionSpendCr,
    remainingPurseCr,
    squadCount: retainedCount,
    squadSize: state.settings.squadSize,
    overseasCount,
    overseasLimit: state.settings.overseasSquadLimit,
    playersRemainingToDraft: Math.max(0, state.settings.squadSize - retainedCount),
    allSlotsFilled,
    canLockAndStart: targetCount !== null && allSlotsFilled && !state.retention.locked,
  };
}

export function lockRetentionsAndStartSpin(state: DraftState): DraftState {
  if (state.retention.locked) {
    return state;
  }
  const summary = getRetentionSummary(state);
  if (!summary.canLockAndStart) {
    return state;
  }

  const retainedSquad = getFilledRetentionPlayers(state.retention.slots);
  const draftedPlayerIds = retainedSquad.map((p) => p.id ?? p.playerId);

  return {
    ...state,
    squad: retainedSquad,
    draftedPlayerIds,
    remainingPurseCr: summary.remainingPurseCr,
    currentSpin: null,
    retention: {
      ...state.retention,
      locked: true,
    },
    status:
      retainedSquad.length >= state.settings.squadSize ? 'COMPLETED' : 'READY_TO_SPIN',
  };
}
