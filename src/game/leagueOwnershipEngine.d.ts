export const PITCH_TYPES: {
  readonly BALANCED: 'BALANCED';
  readonly BATTING_PARADISE: 'BATTING_PARADISE';
  readonly SPIN_FRIENDLY: 'SPIN_FRIENDLY';
  readonly PACE_AND_BOUNCE: 'PACE_AND_BOUNCE';
  readonly SLOW_AND_LOW: 'SLOW_AND_LOW';
  readonly SWINGING: 'SWINGING';
};

export const ROLES: {
  readonly WK: 'WK';
  readonly TOP_BAT: 'TOP_BAT';
  readonly MID_BAT: 'MID_BAT';
  readonly FINISHER: 'FINISHER';
  readonly BAT: 'BAT';
  readonly AR: 'AR';
  readonly PACE: 'PACE';
  readonly SPIN: 'SPIN';
  readonly BOWL: 'BOWL';
};

export const SQUAD_RULES: {
  readonly SQUAD_SIZE: 15;
  readonly STARTING_XI_SIZE: 11;
  readonly IMPACT_BENCH_SIZE: 4;
  readonly MAX_OVERSEAS_SQUAD: 6;
  readonly MAX_OVERSEAS_XI: 4;
  readonly MAX_OVERSEAS_MATCH_WITH_IMPACT: 5;
  readonly MIN_WICKETKEEPERS_XI: 1;
  readonly MIN_BOWLERS_XI: 5;
};

export const AI_FRANCHISES: readonly string[];

export interface OwnershipPlayerLike {
  canonicalId?: string;
  id?: string;
  playerId?: string;
  name?: string;
  playerName?: string;
  franchise?: string;
  season?: number;
  role?: string;
  isOverseas?: boolean | null;
  bat?: number;
  bowl?: number;
  imp?: number;
  ovr?: number;
  battingRating?: number;
  bowlingRating?: number;
  impactRating?: number;
  overallRating?: number;
  bowlingStyle?: string;
  bowlingType?: string;
  battingStyle?: string;
  isSpinner?: boolean;
  isPacer?: boolean;
  canBowl?: boolean;
  spinSkill?: number;
  paceSkill?: number;
  powerplay?: number;
  middle?: number;
  death?: number;
  impactAbility?: number;
  [key: string]: unknown;
}

export interface TransferImpactNotice {
  playerCanonicalId: string;
  playerName: string;
  originalFranchise: string;
  draftedByFranchise: string;
  draftedByName: string;
  isInformationalOnly: true;
  message: string;
}

export interface LeagueTeamRoster<T extends OwnershipPlayerLike = OwnershipPlayerLike> {
  id: string;
  name: string;
  isUser: boolean;
  homePitch: string;
  squad: T[];
  startingXI: T[];
  impactBench: T[];
  captainId: string | null;
  wicketkeeperId: string | null;
}

export interface LeagueOwnershipState<T extends OwnershipPlayerLike = OwnershipPlayerLike> {
  simulationVersion: string;
  seasonSeed: number;
  userTeam: LeagueTeamRoster<T>;
  opponentTeams: Array<LeagueTeamRoster<T>>;
  transferImpactNotices: TransferImpactNotice[];
}

export interface LeagueOwnershipAudit {
  isValid: boolean;
  teamsCount: number;
  uniqueCanonicalPlayers: number;
  duplicatePlayerIds: string[];
  invalidSquadSizes: string[];
  invalidOverseasCounts: string[];
  invalidXIs: string[];
  invalidImpactBenches: string[];
}

export interface AIImpactDecisionContext {
  impactSubUsed: boolean;
  isBatting: boolean;
  phase: string;
  wickets: number;
  requiredRate: number;
  pitch: string;
  overseasUsedInMatch?: number;
}

export interface AIImpactDecision<T extends OwnershipPlayerLike = OwnershipPlayerLike> {
  incomingPlayer: T;
  outgoingPlayer: T;
  incomingCanonicalId: string;
  outgoingCanonicalId: string;
  reason: string;
}

export function getCanonicalPlayerId(playerOrId: string | OwnershipPlayerLike | null | undefined): string;
export function normalizePitchType(pitch?: string | null): string;
export function isEligibleBowler(player: OwnershipPlayerLike | null | undefined): boolean;
export function classifyBowlerKind(player: OwnershipPlayerLike | null | undefined): 'SPIN' | 'PACE' | 'NONE';
export function createDefaultPlayerPool(): OwnershipPlayerLike[];
export function selectMatchXIAndBench<T extends OwnershipPlayerLike>(
  squad: T[],
  options?: { pitch?: string; seed?: number }
): {
  startingXI: T[];
  impactBench: T[];
  captainId: string | null;
  wicketkeeperId: string | null;
  pitch: string;
};
export function buildLeagueAfterUserDraft<T extends OwnershipPlayerLike>(params: {
  userFranchise?: { id?: string; name?: string };
  userSquad: T[];
  playerPool?: T[];
  seasonSeed?: number;
}): LeagueOwnershipState<T>;
export function validateLeagueOwnership(league: LeagueOwnershipState): LeagueOwnershipAudit;
export function decideAIImpactSubstitution<T extends OwnershipPlayerLike>(
  context: AIImpactDecisionContext,
  startingXI: T[],
  impactBench: T[]
): AIImpactDecision<T> | null;
export function serializeLeagueState(league: LeagueOwnershipState): string;
export function restoreLeagueState(serialized: string | LeagueOwnershipState): LeagueOwnershipState;
export function repairAIDuplicates<T extends OwnershipPlayerLike>(
  league: LeagueOwnershipState<T>,
  playerPool?: T[],
  seed?: number
): LeagueOwnershipState<T>;
