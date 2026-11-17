import type {
  BowlerType,
  BowlingOptionsBreakdown,
  PlayerSeasonRecord,
  PlayingXIState,
  PlayingXIValidation,
  TeamSummary,
} from '../types/game';

export const PLAYING_XI_SIZE = 11;

export function createInitialPlayingXIState(): PlayingXIState {
  return {
    playingXiIds: [],
    captainId: null,
    wicketkeeperId: null,
    isConfirmed: false,
  };
}

export function classifyBowlingStyle(bowlingStyle: string): BowlerType {
  if (!bowlingStyle || bowlingStyle === 'None') {
    return 'NONE';
  }
  if (/legbreak|offbreak|orthodox|chinaman|wrist-spin|spin/i.test(bowlingStyle)) {
    return 'SPIN';
  }
  return 'PACE';
}

export function syncPlayingXIWithSquad(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[]
): PlayingXIState {
  const squadMap = new Map(squad.map((p) => [p.playerId, p]));
  const validIds = xiState.playingXiIds.filter((id) => squadMap.has(id));
  const idSet = new Set(validIds);

  const captainId = xiState.captainId && idSet.has(xiState.captainId) ? xiState.captainId : null;
  const wksInXi = validIds
    .map((id) => squadMap.get(id)!)
    .filter((p) => p.role === 'WK');

  let wicketkeeperId: string | null =
    xiState.wicketkeeperId && wksInXi.some((wk) => wk.playerId === xiState.wicketkeeperId)
      ? xiState.wicketkeeperId
      : null;

  if (!wicketkeeperId && wksInXi.length === 1) {
    wicketkeeperId = wksInXi[0].playerId;
  }

  return {
    playingXiIds: validIds,
    captainId,
    wicketkeeperId,
    isConfirmed: xiState.isConfirmed && validIds.length === PLAYING_XI_SIZE,
  };
}

export function addPlayerToXI(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[],
  playerId: string
): PlayingXIState {
  if (xiState.playingXiIds.length >= PLAYING_XI_SIZE) {
    return xiState;
  }
  if (xiState.playingXiIds.includes(playerId)) {
    return xiState;
  }
  const player = squad.find((p) => p.playerId === playerId);
  if (!player) {
    return xiState;
  }

  const nextIds = [...xiState.playingXiIds, playerId];
  const squadMap = new Map(squad.map((p) => [p.playerId, p]));
  const wks = nextIds.map((id) => squadMap.get(id)!).filter((p) => p.role === 'WK');

  let wicketkeeperId = xiState.wicketkeeperId;
  if (!wicketkeeperId && player.role === 'WK' && wks.length === 1) {
    wicketkeeperId = player.playerId;
  }

  return {
    playingXiIds: nextIds,
    captainId: xiState.captainId,
    wicketkeeperId,
    isConfirmed: false,
  };
}

export function removePlayerFromXI(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[],
  playerId: string
): PlayingXIState {
  if (!xiState.playingXiIds.includes(playerId)) {
    return xiState;
  }
  const nextIds = xiState.playingXiIds.filter((id) => id !== playerId);
  return syncPlayingXIWithSquad(
    {
      playingXiIds: nextIds,
      captainId: xiState.captainId === playerId ? null : xiState.captainId,
      wicketkeeperId: xiState.wicketkeeperId === playerId ? null : xiState.wicketkeeperId,
      isConfirmed: false,
    },
    squad
  );
}

export function swapXIWithBench(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[],
  xiPlayerId: string,
  benchPlayerId: string
): PlayingXIState {
  const xiIdx = xiState.playingXiIds.indexOf(xiPlayerId);
  if (xiIdx === -1 || xiState.playingXiIds.includes(benchPlayerId)) {
    return xiState;
  }
  const benchPlayer = squad.find((p) => p.playerId === benchPlayerId);
  if (!benchPlayer) {
    return xiState;
  }

  const nextIds = [...xiState.playingXiIds];
  nextIds[xiIdx] = benchPlayerId;

  return syncPlayingXIWithSquad(
    {
      playingXiIds: nextIds,
      captainId: xiState.captainId === xiPlayerId ? null : xiState.captainId,
      wicketkeeperId: xiState.wicketkeeperId === xiPlayerId ? null : xiState.wicketkeeperId,
      isConfirmed: false,
    },
    squad
  );
}

export function reorderBattingOrder(
  xiState: PlayingXIState,
  fromIndex: number,
  toIndex: number
): PlayingXIState {
  const len = xiState.playingXiIds.length;
  if (
    fromIndex < 0 ||
    fromIndex >= len ||
    toIndex < 0 ||
    toIndex >= len ||
    fromIndex === toIndex
  ) {
    return xiState;
  }
  const nextIds = [...xiState.playingXiIds];
  const [moved] = nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, moved);
  return {
    ...xiState,
    playingXiIds: nextIds,
    isConfirmed: false,
  };
}

export function setCaptain(xiState: PlayingXIState, playerId: string): PlayingXIState {
  if (!xiState.playingXiIds.includes(playerId)) {
    return xiState;
  }
  return {
    ...xiState,
    captainId: playerId,
    isConfirmed: false,
  };
}

export function setActiveWicketkeeper(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[],
  playerId: string
): PlayingXIState {
  if (!xiState.playingXiIds.includes(playerId)) {
    return xiState;
  }
  const player = squad.find((p) => p.playerId === playerId);
  if (!player || player.role !== 'WK') {
    return xiState;
  }
  return {
    ...xiState,
    wicketkeeperId: playerId,
    isConfirmed: false,
  };
}

export function validatePlayingXI(
  xiState: PlayingXIState,
  squad: PlayerSeasonRecord[],
  maxOverseas: number = 4
): PlayingXIValidation {
  const squadMap = new Map(squad.map((p) => [p.playerId, p]));
  const xiPlayers = xiState.playingXiIds
    .map((id) => squadMap.get(id))
    .filter((p): p is PlayerSeasonRecord => Boolean(p));
  const xiSet = new Set(xiPlayers.map((p) => p.playerId));
  const benchPlayers = squad.filter((p) => !xiSet.has(p.playerId));

  const overseasCount = xiPlayers.filter((p) => p.isOverseas === true).length;
  const indianCount = xiPlayers.length - overseasCount;
  const wicketkeepersInXI = xiPlayers.filter((p) => p.role === 'WK');

  const errors: string[] = [];

  if (xiPlayers.length !== PLAYING_XI_SIZE) {
    errors.push(
      `Select exactly ${PLAYING_XI_SIZE} players for the Playing XI (${xiPlayers.length}/${PLAYING_XI_SIZE}).`
    );
  }

  if (overseasCount > maxOverseas) {
    errors.push(
      `Maximum ${maxOverseas} overseas players allowed in the Playing XI (${overseasCount}/${maxOverseas}).`
    );
  }

  if (wicketkeepersInXI.length < 1) {
    errors.push('At least 1 wicketkeeper (WK) must be in the Playing XI.');
  }

  if (!xiState.captainId || !xiSet.has(xiState.captainId)) {
    errors.push('Select a Captain (C) from your Playing XI.');
  }

  if (
    !xiState.wicketkeeperId ||
    !wicketkeepersInXI.some((wk) => wk.playerId === xiState.wicketkeeperId)
  ) {
    errors.push('Select an active Wicketkeeper (WK) from your Playing XI.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    xiPlayers,
    benchPlayers,
    overseasCount,
    indianCount,
    wicketkeepersInXI,
  };
}

export function getBowlingOptions(xiPlayers: PlayerSeasonRecord[]): BowlingOptionsBreakdown {
  const primaryBowlers: Array<PlayerSeasonRecord & { bowlerType: BowlerType }> = [];
  const allRounders: Array<PlayerSeasonRecord & { bowlerType: BowlerType }> = [];
  const partTimers: Array<PlayerSeasonRecord & { bowlerType: BowlerType }> = [];

  for (const player of xiPlayers) {
    const bowlerType = classifyBowlingStyle(player.bowlingStyle);
    if (player.role === 'BOWL') {
      primaryBowlers.push({ ...player, bowlerType });
    } else if (player.role === 'AR') {
      allRounders.push({ ...player, bowlerType });
    } else if (bowlerType !== 'NONE' && player.bowlingRating >= 20) {
      partTimers.push({ ...player, bowlerType });
    }
  }

  primaryBowlers.sort((a, b) => b.bowlingRating - a.bowlingRating);
  allRounders.sort((a, b) => b.bowlingRating - a.bowlingRating);
  partTimers.sort((a, b) => b.bowlingRating - a.bowlingRating);

  return { primaryBowlers, allRounders, partTimers };
}

export function calculateTeamSummary(
  xiPlayers: PlayerSeasonRecord[],
  captainId: string | null,
  wicketkeeperId: string | null
): TeamSummary {
  if (xiPlayers.length === 0) {
    return {
      battingRating: 0,
      bowlingRating: 0,
      overallRating: 0,
      indianCount: 0,
      overseasCount: 0,
      captainName: null,
      keeperName: null,
    };
  }

  // Top 7 batting weights determine team batting strength accurately without tailenders skewing it
  const sortedBat = [...xiPlayers].sort((a, b) => b.battingRating - a.battingRating);
  const topBatters = sortedBat.slice(0, Math.min(7, sortedBat.length));
  const battingRating = Math.round(
    topBatters.reduce((sum, p) => sum + p.battingRating, 0) / topBatters.length
  );

  // Top 5 bowling options determine team bowling strength
  const sortedBowl = [...xiPlayers].sort((a, b) => b.bowlingRating - a.bowlingRating);
  const topBowlers = sortedBowl.slice(0, Math.min(5, sortedBowl.length));
  const bowlingRating = Math.round(
    topBowlers.reduce((sum, p) => sum + p.bowlingRating, 0) / topBowlers.length
  );

  const overallRating = Math.round(
    xiPlayers.reduce((sum, p) => sum + p.overallRating, 0) / xiPlayers.length
  );

  const overseasCount = xiPlayers.filter((p) => p.isOverseas === true).length;
  const indianCount = xiPlayers.length - overseasCount;

  const captainName = xiPlayers.find((p) => p.playerId === captainId)?.playerName ?? null;
  const keeperName = xiPlayers.find((p) => p.playerId === wicketkeeperId)?.playerName ?? null;

  return {
    battingRating,
    bowlingRating,
    overallRating,
    indianCount,
    overseasCount,
    captainName,
    keeperName,
  };
}

function scoreBalancedSubset(subset: PlayerSeasonRecord[]): number {
  let score = subset.reduce((sum, p) => sum + p.overallRating, 0);

  let batCount = 0;
  let wkCount = 0;
  let arCount = 0;
  let bowlCount = 0;
  let paceCount = 0;
  let spinCount = 0;

  for (const p of subset) {
    if (p.role === 'BAT') batCount += 1;
    else if (p.role === 'WK') wkCount += 1;
    else if (p.role === 'AR') arCount += 1;
    else if (p.role === 'BOWL') bowlCount += 1;

    if (p.role === 'BOWL' || p.role === 'AR') {
      const bType = classifyBowlingStyle(p.bowlingStyle);
      if (bType === 'PACE') paceCount += 1;
      if (bType === 'SPIN') spinCount += 1;
    }
  }

  const bowlingOptions = bowlCount + arCount;
  const battingCore = batCount + wkCount + arCount;

  // Strongly favor at least 5 genuine bowling options (BOWL + AR)
  if (bowlingOptions >= 5) score += 45;
  else score -= (5 - bowlingOptions) * 28;

  // Reward ideal primary bowler count (3-4)
  if (bowlCount >= 3 && bowlCount <= 4) score += 26;
  else if (bowlCount < 2) score -= 35;

  // Reward all-rounders (2-3)
  if (arCount >= 2 && arCount <= 3) score += 20;
  else if (arCount === 1) score += 8;

  // Reward batting depth (6-8 batters/keepers/all-rounders)
  if (battingCore >= 6 && battingCore <= 8) score += 25;
  else if (battingCore < 6) score -= (6 - battingCore) * 22;

  // Reward pace + spin attack variety
  if (paceCount >= 2) score += 16;
  else if (paceCount === 1) score += 8;
  else score -= 24;

  if (spinCount >= 1) score += 16;
  else score -= 20;

  // Mild preference for 1-2 WKs instead of stacking 4 WKs
  if (wkCount >= 1 && wkCount <= 2) score += 10;
  else if (wkCount > 3) score -= (wkCount - 2) * 12;

  return score;
}

export function sortBalancedBattingOrder(players: PlayerSeasonRecord[]): PlayerSeasonRecord[] {
  const battersAndWks = players
    .filter((p) => p.role === 'BAT' || p.role === 'WK')
    .sort((a, b) => b.battingRating - a.battingRating);

  const allRounders = players
    .filter((p) => p.role === 'AR')
    .sort((a, b) => b.battingRating - a.battingRating);

  const unknownPlayers = players
    .filter((p) => p.role === 'UNKNOWN')
    .sort((a, b) => b.overallRating - a.overallRating);

  const bowlers = players
    .filter((p) => p.role === 'BOWL')
    .sort((a, b) => b.battingRating - a.battingRating);

  // Top order (best batters/WKs), followed by batting ARs, bowling ARs, unknown utility, and bowlers
  const topAndMiddleBat = battersAndWks.slice(0, 5);
  const extraBat = battersAndWks.slice(5);
  const topAr = allRounders.filter((p) => p.battingRating >= 75);
  const lowerAr = allRounders.filter((p) => p.battingRating < 75);

  return [...topAndMiddleBat, ...topAr, ...extraBat, ...lowerAr, ...unknownPlayers, ...bowlers];
}

export function autoSelectPlayingXI(
  squad: PlayerSeasonRecord[],
  maxOverseas: number = 4
): PlayingXIState {
  if (squad.length <= PLAYING_XI_SIZE) {
    const ordered = sortBalancedBattingOrder(squad);
    const wks = ordered.filter((p) => p.role === 'WK');
    const bestCaptain = [...ordered].sort((a, b) => b.overallRating - a.overallRating)[0] ?? null;
    const bestWk = [...wks].sort((a, b) => b.overallRating - a.overallRating)[0] ?? null;
    return {
      playingXiIds: ordered.map((p) => p.playerId),
      captainId: bestCaptain?.playerId ?? null,
      wicketkeeperId: bestWk?.playerId ?? null,
      isConfirmed: false,
    };
  }

  // Cap search pool to top 18 overall if squad settings > 15 to keep combinatorics instant
  const pool =
    squad.length > 18
      ? [...squad].sort((a, b) => b.overallRating - a.overallRating).slice(0, 18)
      : squad;

  let bestSubset: PlayerSeasonRecord[] | null = null;
  let bestScore = -Infinity;

  const n = pool.length;
  const current: PlayerSeasonRecord[] = [];

  function dfs(startIdx: number, overseasUsed: number, hasWk: boolean) {
    const needed = PLAYING_XI_SIZE - current.length;
    if (needed === 0) {
      if (!hasWk || overseasUsed > maxOverseas) return;
      const sc = scoreBalancedSubset(current);
      if (sc > bestScore) {
        bestScore = sc;
        bestSubset = [...current];
      }
      return;
    }

    if (n - startIdx < needed) return;

    for (let i = startIdx; i <= n - needed; i += 1) {
      const candidate = pool[i];
      const nextOs = overseasUsed + (candidate.isOverseas === true ? 1 : 0);
      if (nextOs > maxOverseas) continue;
      current.push(candidate);
      dfs(i + 1, nextOs, hasWk || candidate.role === 'WK');
      current.pop();
    }
  }

  dfs(0, 0, false);

  // Fallback if squad had 0 WKs or too few Indian players to meet overseas cap
  if (!bestSubset) {
    const fallback: PlayerSeasonRecord[] = [];
    let os = 0;
    const sorted = [...pool].sort((a, b) => b.overallRating - a.overallRating);
    for (const p of sorted) {
      if (fallback.length >= PLAYING_XI_SIZE) break;
      if (p.isOverseas === true && os >= maxOverseas) continue;
      if (p.isOverseas === true) os += 1;
      fallback.push(p);
    }
    for (const p of sorted) {
      if (fallback.length >= PLAYING_XI_SIZE) break;
      if (!fallback.some((x) => x.playerId === p.playerId)) {
        fallback.push(p);
      }
    }
    bestSubset = fallback;
  }

  const ordered = sortBalancedBattingOrder(bestSubset);
  const captain = [...ordered].sort((a, b) => b.overallRating - a.overallRating)[0] ?? null;
  const wk =
    ordered
      .filter((p) => p.role === 'WK')
      .sort((a, b) => b.overallRating - a.overallRating)[0] ?? null;

  return {
    playingXiIds: ordered.map((p) => p.playerId),
    captainId: captain?.playerId ?? null,
    wicketkeeperId: wk?.playerId ?? null,
    isConfirmed: false,
  };
}

export interface FieldZones {
  top: PlayerSeasonRecord[];
  middle: PlayerSeasonRecord[];
  bottom: PlayerSeasonRecord[];
}

export function partitionFieldZones(xiPlayers: PlayerSeasonRecord[]): FieldZones {
  const top: PlayerSeasonRecord[] = [];
  const middle: PlayerSeasonRecord[] = [];
  const bottom: PlayerSeasonRecord[] = [];

  // Role-based field placement: Batters top (up to 4), WK/AR/overflow-BAT middle, Bowlers bottom
  for (const player of xiPlayers) {
    if (player.role === 'BAT' && top.length < 4) {
      top.push(player);
    } else if (player.role === 'BOWL') {
      bottom.push(player);
    } else {
      middle.push(player);
    }
  }

  return { top, middle, bottom };
}
