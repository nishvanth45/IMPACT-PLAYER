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
import { getCanonicalPlayerId } from './leagueOwnershipEngine.mjs';

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
  animationMode: 'FULL',
  skipMatchAnimations: false,
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
  return Math.round(value * 100) / 100;
}

export function formatCr(value: number): string {
  const rounded = roundCr(value);
  return Number.isInteger(rounded) ? `₹${rounded} Cr` : `₹${Number(rounded.toFixed(2))} Cr`;
}

export function formatCrUpper(value: number): string {
  const rounded = roundCr(value);
  return Number.isInteger(rounded) ? `₹${rounded} CR` : `₹${Number(rounded.toFixed(2))} CR`;
}

export function calculateStableGamePriceCr(input: {
  hasRatings?: boolean;
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
  runs?: number;
  wickets?: number;
  matches?: number;
  role: PlayerRole;
  isOverseas: boolean | null;
}): number {
  const hasStoredRatings = input.hasRatings !== false && input.overallRating > 0;
  if (!hasStoredRatings) {
    // Modest, stable base auction value when both real contract and ratings are pending.
    // Never uses a flat ₹8 Cr fallback and keeps every squad player draftable.
    if (input.role === 'AR' || input.role === 'WK') {
      return input.isOverseas === true ? 1.5 : 1.0;
    }
    if (input.role === 'BAT' || input.role === 'BOWL') {
      return input.isOverseas === true ? 1.25 : 0.75;
    }
    return 0.5;
  }

  const primarySkill = Math.max(input.battingRating, input.bowlingRating);
  const composite =
    input.overallRating * 0.58 +
    input.impactRating * 0.27 +
    primarySkill * 0.15;

  const normalized = Math.max(0, (composite - 30) / 62);
  let price = 0.5 + Math.pow(normalized, 2.05) * 14.25;

  const runs = Number.isFinite(input.runs) ? Number(input.runs) : 0;
  const wickets = Number.isFinite(input.wickets) ? Number(input.wickets) : 0;
  if (runs >= 500) price += 1.25;
  else if (runs >= 300) price += 0.5;
  if (wickets >= 18) price += 1.25;
  else if (wickets >= 12) price += 0.5;

  if (input.role === 'AR' || input.role === 'WK') {
    price += 0.5;
  }

  const clamped = Math.max(0.5, Math.min(16.0, price));
  return roundCr(Math.round(clamped * 4) / 4);
}

export interface PlayerDataChecklistItem {
  key: 'identity' | 'squad' | 'role' | 'origin' | 'stats' | 'ratings' | 'salary';
  label: string;
  available: boolean;
  pendingNote?: string;
}

export interface PlayerDataCompleteness {
  hasPendingData: boolean;
  hasRatings: boolean;
  hasRealContract: boolean;
  pendingCount: number;
  items: PlayerDataChecklistItem[];
}

export function getPlayerDataCompleteness(player: PlayerSeasonRecord): PlayerDataCompleteness {
  const hasRatings = player.hasRatings !== false && player.overallRating > 0;
  const hasRealContract =
    Boolean(player.isRetained) ||
    (getPlayerSalaryCr(player) !== null && Boolean(player.salary?.verified ?? player.salaryVerified));
  const identityVerified = player.identityStatus
    ? player.identityStatus === 'RESOLVED'
    : Boolean(player.cricsheetId || player.playerId);
  const hasHistoricalSquad = Boolean(player.franchise && player.season);
  const hasRole = player.role !== 'UNKNOWN';
  const hasOrigin = player.isOverseas !== null;
  const hasStats = Boolean(
    player.matches > 0 || player.runs > 0 || player.wickets > 0 || hasRatings
  );

  const items: PlayerDataChecklistItem[] = [
    {
      key: 'identity',
      label: 'Identity Verified',
      available: identityVerified,
      pendingNote: identityVerified ? undefined : 'PENDING',
    },
    {
      key: 'squad',
      label: 'Historical Squad',
      available: hasHistoricalSquad,
    },
    {
      key: 'role',
      label: 'Role',
      available: hasRole,
      pendingNote: hasRole ? undefined : 'PENDING',
    },
    {
      key: 'origin',
      label: 'Indian / Overseas',
      available: hasOrigin,
      pendingNote: hasOrigin ? undefined : 'PENDING',
    },
    {
      key: 'stats',
      label: 'Performance Stats',
      available: hasStats,
      pendingNote: hasStats ? undefined : 'PENDING',
    },
    {
      key: 'ratings',
      label: 'Ratings',
      available: hasRatings,
      pendingNote: hasRatings ? undefined : 'RATING PENDING',
    },
    {
      key: 'salary',
      label: 'Salary',
      available: hasRealContract,
      pendingNote: hasRealContract ? undefined : 'REAL CONTRACT PENDING',
    },
  ];

  const pendingCount = items.filter((item) => !item.available).length;
  return {
    hasPendingData: pendingCount > 0,
    hasRatings,
    hasRealContract,
    pendingCount,
    items,
  };
}

export function getPlayerSalaryCr(player: PlayerSeasonRecord): number | null {
  if (player.isRetained) {
    return Number.isFinite(player.priceCr) ? player.priceCr : null;
  }
  if (typeof player.salary?.salaryCr === 'number' && Number.isFinite(player.salary.salaryCr)) {
    return player.salary.salaryCr;
  }
  if (typeof player.salaryCr === 'number' && Number.isFinite(player.salaryCr)) {
    return player.salaryCr;
  }
  return null;
}

export function getPlayerGamePriceCr(player: PlayerSeasonRecord): number | null {
  if (
    typeof player.gamePriceCr === 'number' &&
    Number.isFinite(player.gamePriceCr) &&
    player.gamePriceCr > 0
  ) {
    return player.gamePriceCr;
  }
  if (
    typeof player.salary?.gamePriceCr === 'number' &&
    Number.isFinite(player.salary.gamePriceCr) &&
    player.salary.gamePriceCr > 0
  ) {
    return player.salary.gamePriceCr;
  }
  return calculateStableGamePriceCr(player);
}

export function isPlayerSalaryVerified(player: PlayerSeasonRecord): boolean {
  const realSalary = getPlayerSalaryCr(player);
  return realSalary !== null && Boolean(player.salary?.verified ?? player.salaryVerified);
}

export function getPlayerSalarySource(player: PlayerSeasonRecord): import('../types/game').SalarySource {
  const realSalary = getPlayerSalaryCr(player);
  if (realSalary !== null && Boolean(player.salary?.verified ?? player.salaryVerified)) {
    return 'REAL_CONTRACT';
  }
  const gamePrice = getPlayerGamePriceCr(player);
  if (gamePrice !== null) {
    return 'GAME_VALUE';
  }
  if (realSalary !== null) {
    return 'REPORTED';
  }
  return 'UNAVAILABLE';
}

export function isPlayerSalaryReported(player: PlayerSeasonRecord): boolean {
  return !player.isRetained && getPlayerSalarySource(player) === 'REPORTED';
}

export interface PlayerDisplayPriceInfo {
  amountCr: number | null;
  source: import('../types/game').SalarySource | 'RETENTION';
  label: string;
  tag: string | null;
}

export function getPlayerDisplayPriceInfo(player: PlayerSeasonRecord): PlayerDisplayPriceInfo {
  if (player.isRetained && Number.isFinite(player.priceCr)) {
    return {
      amountCr: player.priceCr,
      source: 'RETENTION',
      label: formatCr(player.priceCr),
      tag: 'RETENTION',
    };
  }

  const source = getPlayerSalarySource(player);
  if (source === 'REAL_CONTRACT') {
    const sal = getPlayerSalaryCr(player)!;
    return {
      amountCr: sal,
      source: 'REAL_CONTRACT',
      label: `${formatCrUpper(sal)} · REAL CONTRACT`,
      tag: 'REAL CONTRACT',
    };
  }
  if (source === 'GAME_VALUE') {
    const gp = getPlayerGamePriceCr(player)!;
    return {
      amountCr: gp,
      source: 'GAME_VALUE',
      label: `${formatCrUpper(gp)} · GAME VALUE`,
      tag: 'GAME VALUE',
    };
  }
  if (source === 'REPORTED') {
    const sal = getPlayerSalaryCr(player)!;
    return {
      amountCr: sal,
      source: 'REPORTED',
      label: `${formatCrUpper(sal)} · REPORTED`,
      tag: 'REPORTED',
    };
  }
  return {
    amountCr: null,
    source: 'UNAVAILABLE',
    label: 'DATA PENDING',
    tag: null,
  };
}

export function getPlayerDraftCostCr(player: PlayerSeasonRecord): number {
  if (player.isRetained) {
    return Number.isFinite(player.priceCr) ? player.priceCr : 0;
  }
  const info = getPlayerDisplayPriceInfo(player);
  return info.amountCr ?? 0;
}

export function formatPlayerSalary(player: PlayerSeasonRecord): string {
  return getPlayerDisplayPriceInfo(player).label;
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

  let candidateCombos = eligible;
  if (state.liveLeague) {
    const playable = eligible.filter((combo) => {
      const sq = repo.getSquad(combo.franchise, combo.season);
      return sq.some((p) => canSelectPlayer(state, p).allowed);
    });
    if (playable.length > 0) {
      candidateCombos = playable;
    }
  }

  const index = Math.min(candidateCombos.length - 1, Math.floor(rng() * candidateCombos.length));
  const chosen = candidateCombos[index];
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
  const normalizedCanonicalId = getCanonicalPlayerId(player);

  if (state.liveLeague) {
    const ownerTeamId =
      state.liveLeague.playerOwners[normalizedCanonicalId] ??
      state.liveLeague.playerOwners[canonicalId];
    if (ownerTeamId) {
      const ownerCode =
        state.liveLeague.teams[ownerTeamId]?.code ??
        (ownerTeamId === 'YOU' ? state.customFranchise?.code ?? 'YOU' : ownerTeamId);
      return {
        allowed: false,
        reason: 'ALREADY_DRAFTED',
        label: `OWNED BY ${ownerCode}`,
        ownerTeamId,
        ownerTeamCode: ownerCode,
      };
    }
  }

  if (
    state.draftedPlayerIds.includes(canonicalId) ||
    state.squad.some((p) => getCanonicalPlayerId(p) === normalizedCanonicalId)
  ) {
    if (state.liveLeague) {
      const userCode = state.liveLeague.teams.YOU?.code ?? state.customFranchise?.code ?? 'YOU';
      return {
        allowed: false,
        reason: 'ALREADY_DRAFTED',
        label: `OWNED BY ${userCode}`,
        ownerTeamId: 'YOU',
        ownerTeamCode: userCode,
      };
    }
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

  const playerCostCr = getPlayerDraftCostCr(player);
  const remainingAfterPick = Math.max(0, state.settings.squadSize - state.squad.length - 1);
  const minReserveCr = roundCr(remainingAfterPick * 0.5);
  const maxAllowedSpendCr = roundCr(state.remainingPurseCr - minReserveCr);

  if (roundCr(playerCostCr) > roundCr(state.remainingPurseCr)) {
    return { allowed: false, reason: 'INSUFFICIENT_PURSE', label: 'Low Purse' };
  }

  if (roundCr(playerCostCr) > maxAllowedSpendCr) {
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
  const playerCostCr = getPlayerDraftCostCr(player);
  const nextPurse = roundCr(state.remainingPurseCr - playerCostCr);
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
