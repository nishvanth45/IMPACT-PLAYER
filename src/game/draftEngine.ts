import { getActivePlayerRepository, type PlayerRepository } from '../data/playerRepository';
import type {
  CustomFranchise,
  DraftSettings,
  DraftState,
  PlayerRole,
  PlayerSeasonRecord,
  SelectionCheck,
  SpinResult,
} from '../types/game';
import { createInitialRetentionState } from './retentionEngine';

export const DEFAULT_SETTINGS: DraftSettings = {
  franchiseName: 'Mumbai Warriors',
  startingPurseCr: 120,
  squadSize: 15,
  overseasSquadLimit: 6,
  playingXIOverseasLimit: 4,
  seasonStart: 2008,
  seasonEnd: 2026,
  difficulty: 'Standard',
  soundEnabled: true,
  animationEnabled: true,
  simSpeed: 'Normal',
};

export function suggestFranchiseCode(teamName: string): string {
  const words = teamName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'IPL';
  if (words.length >= 3) {
    return `${words[0][0]}${words[1][0]}${words[2][0]}`.slice(0, 3);
  }
  if (words.length === 2) {
    const first = words[0];
    const second = words[1];
    return `${first[0]}${second.slice(0, 2)}`.padEnd(3, first[1] ?? 'X').slice(0, 3);
  }
  return words[0].slice(0, 3).padEnd(3, 'X');
}

export function createDefaultCustomFranchise(name = 'Mumbai Warriors'): CustomFranchise {
  return {
    name,
    code: suggestFranchiseCode(name),
    homeCity: 'Mumbai',
    homeGround: 'Warriors Cricket Ground, Mumbai',
    primaryColor: '#D94E28',
    secondaryColor: '#F59E0B',
  };
}

export function setCustomFranchise(state: DraftState, franchise: CustomFranchise): DraftState {
  const cleanName = franchise.name.trim() || 'Mumbai Warriors';
  const cleanCity = franchise.homeCity.trim() || 'Mumbai';
  const cleanCode =
    franchise.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3) || suggestFranchiseCode(cleanName);
  const cleanGround =
    franchise.homeGround.trim() || `${cleanCity} Cricket Stadium`;

  return {
    ...state,
    settings: {
      ...state.settings,
      franchiseName: cleanName,
    },
    customFranchise: {
      name: cleanName,
      code: cleanCode.padEnd(3, 'X').slice(0, 3),
      homeCity: cleanCity,
      homeGround: cleanGround,
      primaryColor: franchise.primaryColor || '#D94E28',
      secondaryColor: franchise.secondaryColor || '#F59E0B',
    },
  };
}

export function roundCr(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatCr(value: number): string {
  const rounded = roundCr(value);
  return Number.isInteger(rounded) ? `₹${rounded} Cr` : `₹${rounded.toFixed(1)} Cr`;
}

export function createInitialDraftState(settings: DraftSettings = DEFAULT_SETTINGS): DraftState {
  return {
    settings: { ...settings },
    customFranchise: null,
    remainingPurseCr: roundCr(settings.startingPurseCr),
    squad: [],
    draftedPlayerIds: [],
    usedComboKeys: [],
    currentSpin: null,
    retention: createInitialRetentionState(),
    status: 'READY_TO_SPIN',
  };
}

export function getOverseasCount(squad: PlayerSeasonRecord[]): number {
  return squad.reduce((acc, player) => (player.isOverseas === true ? acc + 1 : acc), 0);
}

export function getRoleCounts(squad: PlayerSeasonRecord[]): Record<PlayerRole, number> {
  return squad.reduce<Record<PlayerRole, number>>(
    (acc, player) => {
      acc[player.role] = (acc[player.role] ?? 0) + 1;
      return acc;
    },
    { BAT: 0, BOWL: 0, AR: 0, WK: 0, UNKNOWN: 0 }
  );
}

export function getEligibleSpinCombos(
  state: DraftState,
  repo: PlayerRepository = getActivePlayerRepository()
) {
  const all = repo.getAvailableSpinCombos(
    Math.min(state.settings.seasonStart, state.settings.seasonEnd),
    Math.max(state.settings.seasonStart, state.settings.seasonEnd)
  );
  const used = new Set(state.usedComboKeys);
  return all.filter((combo) => !used.has(combo.comboKey));
}

export function executeSpin(
  state: DraftState,
  repo: PlayerRepository = getActivePlayerRepository(),
  rng: () => number = Math.random
): DraftState {
  if (state.status === 'COMPLETED' || state.squad.length >= state.settings.squadSize) {
    return state;
  }

  const eligible = getEligibleSpinCombos(state, repo);
  if (eligible.length === 0) {
    return state;
  }

  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  const chosen = eligible[index];
  const pool = repo.getSquad(chosen.franchise, chosen.season);

  const spinResult: SpinResult = {
    franchise: chosen.franchise,
    season: chosen.season,
    comboKey: chosen.comboKey,
    pool,
  };

  return {
    ...state,
    usedComboKeys: [...state.usedComboKeys, chosen.comboKey],
    currentSpin: spinResult,
    status: 'PICKING_PLAYER',
  };
}

export function canSelectPlayer(state: DraftState, player: PlayerSeasonRecord): SelectionCheck {
  if (state.squad.length >= state.settings.squadSize) {
    return { allowed: false, reason: 'SQUAD_FULL', label: 'Squad Full' };
  }

  const canonicalId = player.id ?? player.playerId;
  if (state.draftedPlayerIds.includes(canonicalId)) {
    return { allowed: false, reason: 'ALREADY_DRAFTED', label: 'ALREADY DRAFTED' };
  }

  if (
    player.isOverseas === true &&
    getOverseasCount(state.squad) >= state.settings.overseasSquadLimit
  ) {
    return {
      allowed: false,
      reason: 'OVERSEAS_LIMIT',
      label: `OS Cap ${state.settings.overseasSquadLimit}/${state.settings.overseasSquadLimit}`,
    };
  }

  const remainingAfterPick = Math.max(0, state.settings.squadSize - state.squad.length - 1);
  const minReserveCr = roundCr(remainingAfterPick * 0.5);
  const maxAllowedSpendCr = roundCr(state.remainingPurseCr - minReserveCr);

  if (roundCr(player.priceCr) > roundCr(state.remainingPurseCr)) {
    return { allowed: false, reason: 'INSUFFICIENT_PURSE', label: 'Low Purse' };
  }

  if (roundCr(player.priceCr) > maxAllowedSpendCr) {
    return {
      allowed: false,
      reason: 'INSUFFICIENT_PURSE',
      label: `Reserve ₹${minReserveCr} Cr`,
    };
  }

  return { allowed: true };
}

export function selectPlayerForDraft(state: DraftState, player: PlayerSeasonRecord): DraftState {
  const check = canSelectPlayer(state, player);
  if (!check.allowed) {
    return state;
  }

  const canonicalId = player.id ?? player.playerId;
  const nextSquad = [...state.squad, player];
  const nextPurse = roundCr(state.remainingPurseCr - player.priceCr);
  const nextDraftedIds = [...state.draftedPlayerIds, canonicalId];
  const isComplete = nextSquad.length >= state.settings.squadSize;

  return {
    ...state,
    squad: nextSquad,
    remainingPurseCr: nextPurse,
    draftedPlayerIds: nextDraftedIds,
    currentSpin: null,
    status: isComplete ? 'COMPLETED' : 'READY_TO_SPIN',
  };
}

export function canAffordAnyInPool(state: DraftState, pool: PlayerSeasonRecord[]): boolean {
  return pool.some((p) => canSelectPlayer(state, p).allowed);
}
