import { FRANCHISES } from '../data/franchises';
import type { PlayerRepository } from '../data/playerRepository';
import type {
  CaptaincyDifficulty,
  Challenge14Status,
  CustomFranchise,
  FranchiseCode,
  ImpactSubstitution,
  InningsScorecard,
  InningsSummary,
  MatchResult,
  PitchCondition,
  PlayerForm,
  PlayerSeasonRecord,
  PlayerSeasonStats,
  PlayoffFixture,
  PlayoffRoundId,
  PointsTableRow,
  SeasonFixture,
  SeasonState,
  SeasonTeam,
  SeasonTeamId,
  TossInfo,
  TransferImpactNotice,
  VenueMemoryStats,
} from '../types/game';
import {
  SIMULATION_VERSION,
  simulateFullMatch,
} from './cricketMatchEngine';
import {
  getPitchConditionForVenue,
} from './matchEngine';
import {
  SQUAD_RULES,
  getCanonicalPlayerId,
  isEligibleBowler as isOwnershipBowler,
  selectMatchXIAndBench,
} from './leagueOwnershipEngine.mjs';
import { SIM_CONFIG } from './simConfig';
import { autoSelectPlayingXI } from './playingXiEngine';
import {
  getEffectiveMatchRatings,
  resolvePlayerRatings,
  shiftPlayerForm,
} from './ratingEngine';

export const CPU_FRANCHISE_POOL: FranchiseCode[] = [
  'CSK',
  'MI',
  'RCB',
  'KKR',
  'SRH',
  'RR',
  'DC',
  'PBKS',
  'GT',
  'LSG',
];

export const TEAM_VENUES: Record<SeasonTeamId, string> = {
  YOU: 'Warriors Cricket Ground, Mumbai',
  CSK: 'MA Chidambaram Stadium, Chennai',
  MI: 'Wankhede Stadium, Mumbai',
  RCB: 'M. Chinnaswamy Stadium, Bengaluru',
  KKR: 'Eden Gardens, Kolkata',
  SRH: 'Rajiv Gandhi Intl. Stadium, Hyderabad',
  RR: 'Sawai Mansingh Stadium, Jaipur',
  DC: 'Arun Jaitley Stadium, Delhi',
  PBKS: 'Maharaja Yadavindra Singh Stadium, Mullanpur',
  GT: 'Narendra Modi Stadium, Ahmedabad',
  LSG: 'BRSABV Ekana Stadium, Lucknow',
  DCH: 'Rajiv Gandhi Intl. Stadium, Hyderabad',
  PWI: 'MCA Stadium, Pune',
  RPS: 'MCA Stadium, Pune',
  GL: 'Saurashtra Cricket Association Stadium, Rajkot',
};

export interface XiStrengthMetrics {
  battingStrength: number;
  bowlingStrength: number;
  impactStrength: number;
  overallStrength: number;
  balanceBonus: number;
  bowlerCount: number;
  allRounderCount: number;
  wkCount: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function cricketOversToDecimal(oversFloat: number): number {
  const whole = Math.floor(oversFloat);
  const balls = Math.round((oversFloat - whole) * 10);
  const clampedBalls = clamp(balls, 0, 5);
  return whole + clampedBalls / 6;
}

export function decimalToCricketOvers(decimalOvers: number): number {
  const clamped = clamp(decimalOvers, 0.1, 20);
  const whole = Math.floor(clamped);
  let balls = Math.round((clamped - whole) * 6);
  if (balls >= 6) {
    return Math.min(20, whole + 1);
  }
  return Number((whole + balls / 10).toFixed(1));
}

export function formatOversDisplay(overs: number): string {
  return Number.isInteger(overs) ? String(overs) : overs.toFixed(1);
}

export function formatNrr(nrr: number): string {
  const rounded = Number.isFinite(nrr) ? nrr : 0;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(3)}`;
}

export function calculateNrr(
  runsFor: number,
  oversFor: number,
  runsAgainst: number,
  oversAgainst: number
): number {
  const runRateFor = oversFor > 0 ? runsFor / oversFor : 0;
  const runRateAgainst = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
  return Number((runRateFor - runRateAgainst).toFixed(3));
}

export function calculateXiStrength(
  players: PlayerSeasonRecord[],
  playerForms: Record<string, PlayerForm> = {}
): XiStrengthMetrics {
  if (players.length === 0) {
    return {
      battingStrength: 45,
      bowlingStrength: 45,
      impactStrength: 45,
      overallStrength: 45,
      balanceBonus: -8,
      bowlerCount: 0,
      allRounderCount: 0,
      wkCount: 0,
    };
  }

  const effectivePlayers = players.map((p) => {
    const form = playerForms[p.playerId] ?? p.form ?? 'NORMAL';
    const eff = getEffectiveMatchRatings(
      {
        battingRating: p.battingRating,
        bowlingRating: p.bowlingRating,
        impactRating: p.impactRating ?? p.overallRating,
        overallRating: p.overallRating,
      },
      form
    );
    return { player: p, eff };
  });

  const topBatters = [...effectivePlayers]
    .sort((a, b) => b.eff.battingRating - a.eff.battingRating)
    .slice(0, Math.min(7, effectivePlayers.length));
  const battingStrength =
    topBatters.reduce((sum, item) => sum + item.eff.battingRating, 0) / topBatters.length;

  const topBowlers = [...effectivePlayers]
    .sort((a, b) => b.eff.bowlingRating - a.eff.bowlingRating)
    .slice(0, Math.min(5, effectivePlayers.length));
  const bowlingStrength =
    topBowlers.reduce((sum, item) => sum + item.eff.bowlingRating, 0) / topBowlers.length;

  const topImpact = [...effectivePlayers]
    .sort((a, b) => b.eff.impactRating - a.eff.impactRating)
    .slice(0, Math.min(4, effectivePlayers.length));
  const impactStrength =
    topImpact.reduce((sum, item) => sum + item.eff.impactRating, 0) / topImpact.length;

  const overallStrength =
    effectivePlayers.reduce((sum, item) => sum + item.eff.overallRating, 0) /
    effectivePlayers.length;

  let bowlerCount = 0;
  let allRounderCount = 0;
  let battingCoreCount = 0;
  let wkCount = 0;

  for (const p of players) {
    if (p.role === 'BOWL') bowlerCount += 1;
    else if (p.role === 'AR') {
      allRounderCount += 1;
      battingCoreCount += 1;
    } else if (p.role === 'WK') {
      wkCount += 1;
      battingCoreCount += 1;
    } else if (p.role === 'BAT') {
      battingCoreCount += 1;
    }
  }

  const bowlingOptions = bowlerCount + allRounderCount;
  let balanceBonus = 0;

  if (bowlingOptions >= 5) balanceBonus += 2.5;
  else balanceBonus -= (5 - bowlingOptions) * 3.0;

  if (bowlerCount >= 3) balanceBonus += 1.5;
  else if (bowlerCount < 2) balanceBonus -= 3.5;

  if (battingCoreCount >= 6 && battingCoreCount <= 8) balanceBonus += 1.5;
  else if (battingCoreCount < 6) balanceBonus -= (6 - battingCoreCount) * 2.5;

  if (wkCount >= 1) balanceBonus += 0.5;
  else balanceBonus -= 3.0;

  return {
    battingStrength,
    bowlingStrength,
    impactStrength,
    overallStrength,
    balanceBonus: clamp(balanceBonus, -12, 6),
    bowlerCount,
    allRounderCount,
    wkCount,
  };
}

export interface SimulateMatchOptions {
  matchId?: string;
  matchSeed?: string | number;
  venue?: string;
  pitchCondition?: PitchCondition;
  toss?: TossInfo;
  impactSub?: ImpactSubstitution;
  impactInPlayer?: PlayerSeasonRecord;
  difficulty?: CaptaincyDifficulty;
  injuredPlayerIds?: string[];
}

export function simulateT20Match(
  homeTeam: SeasonTeam,
  awayTeam: SeasonTeam,
  rng: () => number = Math.random,
  playerForms: Record<string, PlayerForm> = {},
  options?: SimulateMatchOptions
): MatchResult {
  const pitchCondition =
    options?.pitchCondition ??
    getPitchConditionForVenue(options?.venue ?? homeTeam.homeVenue, rng);

  const toss: TossInfo = options?.toss ?? (() => {
    const firstIsHome = rng() < 0.5;
    return {
      callerTeamId: homeTeam.id,
      call: 'HEADS',
      outcome: 'HEADS',
      winnerTeamId: firstIsHome ? homeTeam.id : awayTeam.id,
      decision: 'BAT',
    };
  })();

  const matchSeed =
    options?.matchSeed ?? Math.floor(rng() * 0xffffffff);

  const resolveMatchTeam = (team: SeasonTeam, salt: number): SeasonTeam => {
    if (team.isUser || !team.squad || team.squad.length < SQUAD_RULES.SQUAD_SIZE) {
      return team;
    }
    const sel = selectMatchXIAndBench(team.squad, {
      pitch: pitchCondition,
      seed: ((Number(matchSeed) || 1) + salt) >>> 0,
    });
    return {
      ...team,
      players: sel.startingXI,
      impactBench: sel.impactBench,
    };
  };

  const effHomeTeam = resolveMatchTeam(homeTeam, 17);
  const effAwayTeam = resolveMatchTeam(awayTeam, 53);

  const { result } = simulateFullMatch({
    matchId: options?.matchId,
    matchSeed,
    teamA: effHomeTeam,
    teamB: effAwayTeam,
    pitchCondition,
    toss,
    playerForms,
    injuredPlayerIds: options?.injuredPlayerIds,
    difficulty: options?.difficulty ?? 'STANDARD',
    impactSub: options?.impactSub,
    impactInPlayer: options?.impactInPlayer,
  });

  return result;
}

function makeFallbackCpuSquad(code: FranchiseCode, squadSize = 15): PlayerSeasonRecord[] {
  const roles: Array<{ role: 'BAT' | 'WK' | 'AR' | 'BOWL'; count: number }> = [
    { role: 'BAT', count: 5 },
    { role: 'WK', count: 2 },
    { role: 'AR', count: 3 },
    { role: 'BOWL', count: 5 },
  ];
  const players: PlayerSeasonRecord[] = [];
  let idx = 1;
  let osCount = 0;
  for (const group of roles) {
    for (let i = 0; i < group.count; i += 1) {
      if (players.length >= squadSize) break;
      const playerId = `${code.toLowerCase()}-cpu-${idx}`;
      const isOS = idx % 3 === 0 && osCount < SQUAD_RULES.MAX_OVERSEAS_SQUAD;
      if (isOS) osCount += 1;
      const resolved = resolvePlayerRatings({
        playerId,
        season: 2024,
        franchise: code,
        role: group.role,
        matches: 10,
        priceCr: 8,
        ratingStatus: 'PROVISIONAL',
        rawBattingRating: group.role === 'BOWL' ? 35 : 70,
        rawBowlingRating: group.role === 'BAT' || group.role === 'WK' ? 24 : 72,
        rawOverallRating: 71,
      });
      players.push({
        id: playerId,
        name: `${code} Player ${idx}`,
        playerId,
        playerName: `${code} Player ${idx}`,
        season: 2024,
        franchise: code,
        teamName: FRANCHISES[code].name,
        nationality: isOS ? 'Overseas' : 'India',
        playerType: isOS ? 'Overseas' : 'Domestic',
        isOverseas: isOS,
        role: group.role,
        battingStyle: 'Right-hand bat',
        bowlingStyle:
          group.role === 'BOWL'
            ? idx % 2 === 0
              ? 'Right-arm fast'
              : 'Right-arm legbreak'
            : group.role === 'AR'
              ? 'Slow left-arm orthodox'
              : 'None',
        matches: 10,
        runs: 0,
        battingAverage: 0,
        strikeRate: 0,
        wickets: 0,
        economy: 0,
        battingRating: resolved.battingRating,
        bowlingRating: resolved.bowlingRating,
        impactRating: resolved.impactRating,
        overallRating: resolved.overallRating,
        ratingBand: resolved.ratingBand,
        form: 'NORMAL',
        attributes: resolved.attributes,
        priceCr: 8,
        ratingStatus: 'PROVISIONAL',
      });
      idx += 1;
    }
  }
  return players;
}

export function evolveMatchForms(
  forms: Record<string, PlayerForm>,
  winnerTeam: SeasonTeam,
  loserTeam: SeasonTeam,
  rng: () => number
): Record<string, PlayerForm> {
  const next = { ...forms };
  const regressChance = SIM_CONFIG.formRegression.towardNormalChance;

  const stepTowardNormal = (cur: PlayerForm): PlayerForm => {
    if (cur === 'EXCELLENT' || cur === 'GOOD') return shiftPlayerForm(cur, -1);
    if (cur === 'POOR' || cur === 'VERY_POOR') return shiftPlayerForm(cur, 1);
    return cur;
  };

  for (const p of winnerTeam.players) {
    const cur = next[p.playerId] ?? p.form ?? 'NORMAL';
    const consistencyBonus = (p.attributes?.other?.consistency ?? 70) >= 82 ? 0.08 : 0;
    const roll = rng();
    if (roll < 0.34 + consistencyBonus) {
      next[p.playerId] = shiftPlayerForm(cur, 1);
    } else if (roll > 0.92) {
      next[p.playerId] = shiftPlayerForm(cur, -1);
    } else if (cur !== 'NORMAL' && rng() < regressChance) {
      next[p.playerId] = stepTowardNormal(cur);
    } else {
      next[p.playerId] = cur;
    }
  }

  for (const p of loserTeam.players) {
    const cur = next[p.playerId] ?? p.form ?? 'NORMAL';
    const roll = rng();
    if (roll < 0.32) {
      next[p.playerId] = shiftPlayerForm(cur, -1);
    } else if (roll > 0.88) {
      next[p.playerId] = shiftPlayerForm(cur, 1);
    } else if (cur !== 'NORMAL' && rng() < regressChance) {
      next[p.playerId] = stepTowardNormal(cur);
    } else {
      next[p.playerId] = cur;
    }
  }

  return next;
}

export function buildSeasonTeams(
  userXi: PlayerSeasonRecord[],
  repository?: PlayerRepository | null,
  rng: () => number = Math.random,
  customFranchise?: CustomFranchise | string | null
): { teams: Record<SeasonTeamId, SeasonTeam>; teamOrder: SeasonTeamId[] } {
  const cf: CustomFranchise =
    typeof customFranchise === 'string'
      ? {
          name: customFranchise.trim() || 'Mumbai Warriors',
          code:
            customFranchise
              .trim()
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 3) || 'MWR',
          homeCity: 'Mumbai',
          homeGround: TEAM_VENUES.YOU,
          primaryColor: '#D94E28',
          secondaryColor: '#F59E0B',
        }
      : customFranchise ?? {
          name: 'Mumbai Warriors',
          code: 'MWR',
          homeCity: 'Mumbai',
          homeGround: TEAM_VENUES.YOU,
          primaryColor: '#D94E28',
          secondaryColor: '#F59E0B',
        };

  const cleanName = cf.name.trim() || 'Mumbai Warriors';
  const cleanCode = cf.code.trim().toUpperCase().slice(0, 3) || 'MWR';
  const cleanGround = cf.homeGround.trim() || `${cf.homeCity || 'Home'} Cricket Stadium`;

  const userTeam: SeasonTeam = {
    id: 'YOU',
    code: cleanCode,
    name: cleanName,
    shortName: cleanName,
    primaryColor: cf.primaryColor || '#D94E28',
    secondaryColor: cf.secondaryColor || '#F59E0B',
    homeCity: cf.homeCity || 'Mumbai',
    homeVenue: cleanGround,
    homePitch: getPitchConditionForVenue(cleanGround, rng),
    isUser: true,
    players: [...userXi],
  };

  const teams: Partial<Record<SeasonTeamId, SeasonTeam>> = {
    YOU: userTeam,
  };

  const claimedCanonicals = new Set<string>(
    userXi.map((p) => getCanonicalPlayerId(p)).filter(Boolean)
  );
  const allCombos = repository ? repository.getAvailableSpinCombos(2008, 2026) : [];

  for (let cIdx = 0; cIdx < CPU_FRANCHISE_POOL.length; cIdx += 1) {
    const code = CPU_FRANCHISE_POOL[cIdx];
    const meta = FRANCHISES[code];
    const homeVenue = TEAM_VENUES[code];
    const homePitch = getPitchConditionForVenue(homeVenue, rng);
    const teamSeed = Math.floor(rng() * 0xfffffff) + (cIdx + 1) * 97;

    let chosenSeason: number | undefined;
    const rawCandidates: PlayerSeasonRecord[] = [];

    if (repository) {
      const franchiseCombos = allCombos.filter((c) => c.franchise === code);
      if (franchiseCombos.length > 0) {
        const picked =
          franchiseCombos[Math.min(franchiseCombos.length - 1, Math.floor(rng() * franchiseCombos.length))];
        chosenSeason = picked.season;
        rawCandidates.push(...repository.getSquad(code, picked.season));

        // Add depth from adjacent historical seasons of this franchise to guarantee 15 unique players
        const recentCombos = [...franchiseCombos]
          .sort((a, b) => Math.abs(b.season - picked.season) - Math.abs(a.season - picked.season))
          .reverse();
        for (const extraCombo of recentCombos.slice(0, 6)) {
          if (extraCombo.season === picked.season) continue;
          rawCandidates.push(...repository.getSquad(code, extraCombo.season));
        }
      }
    }

    const squad15: PlayerSeasonRecord[] = [];
    const localCanonicals = new Set<string>();
    let osCount = 0;

    const tryAdd = (cand: PlayerSeasonRecord): boolean => {
      if (squad15.length >= SQUAD_RULES.SQUAD_SIZE) return false;
      const cid = getCanonicalPlayerId(cand);
      if (!cid || claimedCanonicals.has(cid) || localCanonicals.has(cid)) return false;
      if (cand.isOverseas === true && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD) return false;
      squad15.push(cand);
      localCanonicals.add(cid);
      claimedCanonicals.add(cid);
      if (cand.isOverseas === true) osCount += 1;
      return true;
    };

    // Prioritize >=1 WK and >=5 bowlers first, then top OVR from franchise pool
    const wkFirst = rawCandidates.find((p) => p.role === 'WK' && !p.isOverseas) ?? rawCandidates.find((p) => p.role === 'WK');
    if (wkFirst) tryAdd(wkFirst);

    const bowlers = rawCandidates.filter((p) => isOwnershipBowler(p));
    for (const bw of bowlers.slice(0, 6)) {
      tryAdd(bw);
    }

    for (const cand of rawCandidates) {
      if (squad15.length >= SQUAD_RULES.SQUAD_SIZE) break;
      tryAdd(cand);
    }

    if (squad15.length < SQUAD_RULES.SQUAD_SIZE) {
      const fallback = makeFallbackCpuSquad(code, SQUAD_RULES.SQUAD_SIZE);
      for (const fb of fallback) {
        if (squad15.length >= SQUAD_RULES.SQUAD_SIZE) break;
        const needWK = !squad15.some((p) => p.role === 'WK');
        if (needWK && fb.role !== 'WK' && SQUAD_RULES.SQUAD_SIZE - squad15.length <= 1) continue;
        tryAdd(fb);
      }
      let repSlot = 1;
      while (squad15.length < SQUAD_RULES.SQUAD_SIZE) {
        const needWK = !squad15.some((p) => p.role === 'WK');
        const needBowlers = squad15.filter((p) => isOwnershipBowler(p)).length < 5;
        const role = needWK ? 'WK' : needBowlers ? 'BOWL' : 'BAT';
        const rep = makeUniqueReplacementPlayer(code, role, repSlot++, claimedCanonicals);
        tryAdd(rep);
      }
    }

    const matchSel = selectMatchXIAndBench(squad15, {
      pitch: homePitch,
      seed: teamSeed,
    });

    let cpuPlayers = matchSel.startingXI;
    if (cpuPlayers.length < 11) {
      const xi = autoSelectPlayingXI(squad15, 4);
      const byId = new Map(squad15.map((p) => [p.playerId, p]));
      cpuPlayers = xi.playingXiIds
        .map((id) => byId.get(id))
        .filter((p): p is PlayerSeasonRecord => Boolean(p));
    }
    const xiSet = new Set(cpuPlayers.map((p) => getCanonicalPlayerId(p)));
    const impactBench = squad15
      .filter((p) => !xiSet.has(getCanonicalPlayerId(p)))
      .slice(0, SQUAD_RULES.IMPACT_BENCH_SIZE);

    teams[code] = {
      id: code,
      code,
      name: meta.name,
      shortName: meta.shortName,
      primaryColor: meta.primaryColor,
      homeVenue,
      homePitch,
      isUser: false,
      sourceSeason: chosenSeason,
      players: cpuPlayers,
      squad: squad15,
      impactBench,
    };
  }

  return {
    teams: teams as Record<SeasonTeamId, SeasonTeam>,
    teamOrder: ['YOU', ...CPU_FRANCHISE_POOL],
  };
}

function makeUniqueReplacementPlayer(
  code: FranchiseCode,
  role: PlayerSeasonRecord['role'],
  slotNum: number,
  usedIds: Set<string>
): PlayerSeasonRecord {
  let candidateId = `${code.toLowerCase()}-rep-${slotNum}`;
  let counter = slotNum;
  while (usedIds.has(candidateId) || usedIds.has(getCanonicalPlayerId(candidateId))) {
    counter += 1;
    candidateId = `${code.toLowerCase()}-rep-${counter}`;
  }
  const resolved = resolvePlayerRatings({
    playerId: candidateId,
    season: 2024,
    franchise: code,
    role,
    matches: 10,
    priceCr: 6,
    ratingStatus: 'PROVISIONAL',
    rawBattingRating: role === 'BOWL' ? 38 : 66,
    rawBowlingRating: role === 'BAT' || role === 'WK' ? 28 : 66,
    rawOverallRating: 66,
  });
  return {
    id: candidateId,
    name: `${code} Reserve ${counter}`,
    playerId: candidateId,
    playerName: `${code} Reserve ${counter}`,
    season: 2024,
    franchise: code,
    teamName: FRANCHISES[code].name,
    nationality: 'India',
    playerType: 'Domestic',
    isOverseas: false,
    role,
    battingStyle: 'Right-hand bat',
    bowlingStyle:
      role === 'BOWL' ? 'Right-arm fast' : role === 'AR' ? 'Right-arm offbreak' : 'None',
    matches: 10,
    runs: 0,
    battingAverage: 0,
    strikeRate: 0,
    wickets: 0,
    economy: 0,
    battingRating: resolved.battingRating,
    bowlingRating: resolved.bowlingRating,
    impactRating: resolved.impactRating,
    overallRating: resolved.overallRating,
    ratingBand: resolved.ratingBand,
    form: 'NORMAL',
    attributes: resolved.attributes,
    priceCr: 6,
    ratingStatus: 'PROVISIONAL',
  };
}

/**
 * Enforces global league ownership: every canonical playerId belongs to at most
 * 1 franchise across all 11 teams (User XI + User Bench + 10 AI teams).
 * Repairs any AI duplicates or overseas overflows cleanly without touching the user team.
 */
export function validateLeagueOwnership(
  teams: Record<SeasonTeamId, SeasonTeam>,
  userBench: PlayerSeasonRecord[] = [],
  repository?: PlayerRepository | null
): {
  teams: Record<SeasonTeamId, SeasonTeam>;
  isValid: boolean;
  duplicateIds: string[];
  repairedCount: number;
} {
  const usedCanonicals = new Set<string>();
  const duplicateIds: string[] = [];
  let repairedCount = 0;

  // User XI and User Bench claim ownership unconditionally
  for (const p of teams.YOU.players) {
    usedCanonicals.add(getCanonicalPlayerId(p));
  }
  for (const b of userBench) {
    usedCanonicals.add(getCanonicalPlayerId(b));
  }

  const nextTeams: Record<SeasonTeamId, SeasonTeam> = {
    ...teams,
    YOU: { ...teams.YOU, players: [...teams.YOU.players] },
  };

  const allCombos = repository ? repository.getAvailableSpinCombos(2008, 2026) : [];

  for (const code of CPU_FRANCHISE_POOL) {
    const team = teams[code];
    if (!team) continue;

    // Collect candidate pool from this franchise's historical squads
    const franchisePool: PlayerSeasonRecord[] = [];
    if (repository) {
      const combos = allCombos.filter((c) => c.franchise === code);
      for (const combo of combos.slice(0, 8)) {
        for (const cand of repository.getSquad(code, combo.season)) {
          franchisePool.push(cand);
        }
      }
    }

    const xiCanonicals = new Set(team.players.map((p) => getCanonicalPlayerId(p)));
    const extraSquadPlayers = (team.squad ?? []).filter(
      (p) => !xiCanonicals.has(getCanonicalPlayerId(p))
    );
    const baseRoster = [...team.players, ...extraSquadPlayers];
    const updatedRoster: PlayerSeasonRecord[] = [];
    let osCount = 0;
    let repCounter = 1;
    let teamChanged = false;

    for (const player of baseRoster) {
      const cid = getCanonicalPlayerId(player);
      const osOverflow = player.isOverseas === true && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD;
      if (!usedCanonicals.has(cid) && !osOverflow) {
        usedCanonicals.add(cid);
        if (player.isOverseas === true) osCount += 1;
        updatedRoster.push(player);
        continue;
      }

      if (usedCanonicals.has(cid)) {
        duplicateIds.push(player.playerId);
      }
      teamChanged = true;

      const replacement =
        franchisePool.find((cand) => {
          const candCid = getCanonicalPlayerId(cand);
          return (
            !usedCanonicals.has(candCid) &&
            cand.role === player.role &&
            !(cand.isOverseas === true && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD)
          );
        }) ??
        franchisePool.find((cand) => {
          const candCid = getCanonicalPlayerId(cand);
          return (
            !usedCanonicals.has(candCid) &&
            !(cand.isOverseas === true && osCount >= SQUAD_RULES.MAX_OVERSEAS_SQUAD)
          );
        }) ??
        makeUniqueReplacementPlayer(code, player.role, repCounter++, usedCanonicals);

      usedCanonicals.add(getCanonicalPlayerId(replacement));
      if (replacement.isOverseas === true) osCount += 1;
      updatedRoster.push(replacement);
      repairedCount += 1;
    }

    if (team.squad && team.squad.length >= SQUAD_RULES.SQUAD_SIZE) {
      const sel = teamChanged
        ? selectMatchXIAndBench(updatedRoster, {
            pitch: team.homePitch ?? 'BALANCED',
            seed: 101,
          })
        : null;

      nextTeams[code] = {
        ...team,
        squad: updatedRoster,
        players: sel ? sel.startingXI : team.players,
        impactBench: sel ? sel.impactBench : team.impactBench,
      };
    } else {
      nextTeams[code] = {
        ...team,
        players: updatedRoster,
      };
    }
  }

  return {
    teams: nextTeams,
    isValid: duplicateIds.length === 0,
    duplicateIds,
    repairedCount,
  };
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateLeagueSchedule(
  teams: Record<SeasonTeamId, SeasonTeam>,
  rng: () => number = Math.random
): SeasonFixture[] {
  // 11 teams total: user franchise + 10 real IPL franchises.
  // Double round-robin via Circle Method with 1 BYE slot (12 slots -> 11 rounds per cycle).
  // Cycle 1 = 11 rounds (each team plays every other team once: 5H/5A).
  // Cycle 2 = 11 rounds (reversed Home/Away: 5A/5H).
  // Total = 22 rounds * 5 matches = 110 league matches (20 matches per team: 10 Home, 10 Away).
  type SlotId = SeasonTeamId | 'BYE';
  const shuffledCpu = shuffleArray(CPU_FRANCHISE_POOL, rng);
  const participants: SlotId[] = ['YOU', ...shuffledCpu, 'BYE'];

  interface RawPairing {
    home: SeasonTeamId;
    away: SeasonTeamId;
  }

  interface RoundMeta {
    pairings: RawPairing[];
    userRest: boolean;
  }

  const fixed = participants[0]; // 'YOU'
  const rotating = participants.slice(1); // 11 items
  const cycle1Rounds: RoundMeta[] = [];

  const homeCounts: Record<string, number> = {};
  const awayCounts: Record<string, number> = {};

  for (let r = 0; r < 11; r += 1) {
    const order: SlotId[] = [fixed, ...rotating];
    const pairings: RawPairing[] = [];
    let userRest = false;

    for (let i = 0; i < 6; i += 1) {
      const t1 = order[i];
      const t2 = order[11 - i];
      if (t1 === 'BYE' || t2 === 'BYE') {
        if (t1 === 'YOU' || t2 === 'YOU') userRest = true;
        continue;
      }

      // Balance home/away in cycle 1 (targets 5H/5A per team)
      const h1 = homeCounts[t1] ?? 0;
      const a1 = awayCounts[t1] ?? 0;
      const h2 = homeCounts[t2] ?? 0;
      const a2 = awayCounts[t2] ?? 0;

      let home: SeasonTeamId;
      let away: SeasonTeamId;
      if (h1 - a1 < h2 - a2) {
        home = t1;
        away = t2;
      } else if (h2 - a2 < h1 - a1) {
        home = t2;
        away = t1;
      } else if ((r + i) % 2 === 0) {
        home = t1;
        away = t2;
      } else {
        home = t2;
        away = t1;
      }

      homeCounts[home] = (homeCounts[home] ?? 0) + 1;
      awayCounts[away] = (awayCounts[away] ?? 0) + 1;
      pairings.push({ home, away });
    }

    cycle1Rounds.push({ pairings, userRest });
    // Rotate clockwise: move last element to front
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  // Order Cycle 1 so the user's bye round is at the end of Cycle 1 (Round 11)
  const c1Active = shuffleArray(
    cycle1Rounds.filter((r) => !r.userRest),
    rng
  );
  const c1Bye = cycle1Rounds.filter((r) => r.userRest);
  const orderedCycle1 = [...c1Active, ...c1Bye];

  // Cycle 2 reverses Home/Away cleanly so every opponent pair plays 1 Home & 1 Away
  const orderedCycle2: RoundMeta[] = orderedCycle1.map((rm) => ({
    userRest: rm.userRest,
    pairings: rm.pairings.map((m) => ({
      home: m.away,
      away: m.home,
    })),
  }));

  const allRounds = [...orderedCycle1, ...orderedCycle2];
  const fixtures: SeasonFixture[] = [];
  let matchCounter = 1;
  let userCounter = 1;

  allRounds.forEach((roundMeta, rIdx) => {
    const roundNumber = rIdx + 1;
    const ordered = [...roundMeta.pairings].sort((a, b) => {
      const aUser = a.home === 'YOU' || a.away === 'YOU' ? 0 : 1;
      const bUser = b.home === 'YOU' || b.away === 'YOU' ? 0 : 1;
      return aUser - bUser;
    });

    for (const pair of ordered) {
      const involvesUser = pair.home === 'YOU' || pair.away === 'YOU';
      const userMatchNumber = involvesUser ? userCounter++ : null;
      fixtures.push({
        id: `league-r${roundNumber}-m${matchCounter}`,
        round: roundNumber,
        matchNumber: matchCounter,
        userMatchNumber,
        homeTeamId: pair.home,
        awayTeamId: pair.away,
        venue: teams[pair.home].homeVenue,
        status: 'SCHEDULED',
        result: null,
      });
      matchCounter += 1;
    }
  });

  return fixtures;
}

export function sortPointsTable(rows: PointsTableRow[]): PointsTableRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.nrr - a.nrr ||
      b.won - a.won ||
      b.runsFor - a.runsFor ||
      a.teamId.localeCompare(b.teamId)
  );
}

function applyMatchToPointsTable(
  rows: PointsTableRow[],
  result: MatchResult
): PointsTableRow[] {
  const map = new Map(rows.map((r) => [r.teamId, { ...r }]));
  const firstRow = map.get(result.firstInnings.teamId);
  const secondRow = map.get(result.secondInnings.teamId);

  if (firstRow && secondRow) {
    firstRow.played += 1;
    secondRow.played += 1;

    firstRow.runsFor += result.firstInnings.runs;
    firstRow.oversFor += result.firstInnings.oversForNrr;
    firstRow.runsAgainst += result.secondInnings.runs;
    firstRow.oversAgainst += result.secondInnings.oversForNrr;

    secondRow.runsFor += result.secondInnings.runs;
    secondRow.oversFor += result.secondInnings.oversForNrr;
    secondRow.runsAgainst += result.firstInnings.runs;
    secondRow.oversAgainst += result.firstInnings.oversForNrr;

    if (result.winnerId === firstRow.teamId) {
      firstRow.won += 1;
      firstRow.points += 2;
      secondRow.lost += 1;
    } else {
      secondRow.won += 1;
      secondRow.points += 2;
      firstRow.lost += 1;
    }

    firstRow.nrr = calculateNrr(
      firstRow.runsFor,
      firstRow.oversFor,
      firstRow.runsAgainst,
      firstRow.oversAgainst
    );
    secondRow.nrr = calculateNrr(
      secondRow.runsFor,
      secondRow.oversFor,
      secondRow.runsAgainst,
      secondRow.oversAgainst
    );
  }

  return sortPointsTable(Array.from(map.values()));
}

function createInitialPlayoffs(): Record<PlayoffRoundId, PlayoffFixture> {
  return {
    Q1: {
      id: 'Q1',
      label: 'Qualifier 1',
      subtitle: '1st Place vs 2nd Place · Winner advances to Final',
      venue: TEAM_VENUES.MI,
      homeTeamId: null,
      awayTeamId: null,
      homeSeedLabel: '#1 Seed',
      awaySeedLabel: '#2 Seed',
      status: 'LOCKED',
      result: null,
    },
    ELIM: {
      id: 'ELIM',
      label: 'Eliminator',
      subtitle: '3rd Place vs 4th Place · Winner advances to Qualifier 2',
      venue: TEAM_VENUES.RCB,
      homeTeamId: null,
      awayTeamId: null,
      homeSeedLabel: '#3 Seed',
      awaySeedLabel: '#4 Seed',
      status: 'LOCKED',
      result: null,
    },
    Q2: {
      id: 'Q2',
      label: 'Qualifier 2',
      subtitle: 'Loser of Q1 vs Winner of Eliminator',
      venue: TEAM_VENUES.CSK,
      homeTeamId: null,
      awayTeamId: null,
      homeSeedLabel: 'Loser Q1',
      awaySeedLabel: 'Winner Eliminator',
      status: 'LOCKED',
      result: null,
    },
    FINAL: {
      id: 'FINAL',
      label: 'IPL Final',
      subtitle: 'Championship Decider · Winner of Q1 vs Winner of Q2',
      venue: TEAM_VENUES.GT,
      homeTeamId: null,
      awayTeamId: null,
      homeSeedLabel: 'Winner Q1',
      awaySeedLabel: 'Winner Q2',
      status: 'LOCKED',
      result: null,
    },
  };
}

function accumulateMatchPlayerStats(
  currentStats: Record<string, PlayerSeasonStats>,
  result: MatchResult,
  teams: Record<SeasonTeamId, SeasonTeam>,
  userBench: PlayerSeasonRecord[] = []
): Record<string, PlayerSeasonStats> {
  const next: Record<string, PlayerSeasonStats> = { ...currentStats };
  const playerLookup = new Map<string, { player: PlayerSeasonRecord; teamId: SeasonTeamId }>();

  (Object.keys(teams) as SeasonTeamId[]).forEach((teamId) => {
    const roster = teams[teamId].squad ?? teams[teamId].players;
    for (const p of roster) {
      playerLookup.set(p.playerId, { player: p, teamId });
    }
    for (const p of teams[teamId].players) {
      playerLookup.set(p.playerId, { player: p, teamId });
    }
  });
  for (const b of userBench) {
    if (!playerLookup.has(b.playerId)) {
      playerLookup.set(b.playerId, { player: b, teamId: 'YOU' });
    }
  }

  const ensureEntry = (playerId: string, playerName: string, teamId: SeasonTeamId, role: PlayerSeasonStats['role']): PlayerSeasonStats => {
    const existing = next[playerId];
    if (existing) return { ...existing };
    const meta = playerLookup.get(playerId)?.player;
    return {
      playerId,
      playerName,
      teamId,
      role: meta?.role ?? role,
      isOverseas: meta?.isOverseas ?? null,
      matches: 0,
      innings: 0,
      notOuts: 0,
      runs: 0,
      balls: 0,
      highestScore: 0,
      fifties: 0,
      hundreds: 0,
      fours: 0,
      sixes: 0,
      oversBowled: 0,
      maidens: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
      runsConceded: 0,
      wickets: 0,
      bestBowlingWickets: 0,
      bestBowlingRuns: 0,
      impactPoints: 0,
      potmCount: 0,
    };
  };

  const participants = new Set<string>();
  const registerMatchParticipants = (teamId: SeasonTeamId) => {
    for (const p of teams[teamId].players) {
      const entry = ensureEntry(p.playerId, p.playerName, teamId, p.role);
      if (!participants.has(p.playerId)) {
        entry.matches += 1;
        participants.add(p.playerId);
      }
      next[p.playerId] = entry;
    }
  };

  registerMatchParticipants(result.firstInnings.teamId);
  registerMatchParticipants(result.secondInnings.teamId);

  const applyScorecard = (card: InningsScorecard | undefined, bowlingTeamId: SeasonTeamId) => {
    if (!card) return;
    for (const bat of card.batting) {
      const entry = ensureEntry(bat.playerId, bat.playerName, card.teamId, bat.role);
      if (!participants.has(bat.playerId)) {
        entry.matches += 1;
        participants.add(bat.playerId);
      }
      entry.innings += 1;
      if (!bat.out) entry.notOuts += 1;
      entry.runs += bat.runs;
      entry.balls += bat.balls;
      entry.fours += bat.fours;
      entry.sixes += bat.sixes;
      if (bat.runs > entry.highestScore) entry.highestScore = bat.runs;
      if (bat.runs >= 100) entry.hundreds += 1;
      else if (bat.runs >= 50) entry.fifties += 1;
      entry.impactPoints = Number((entry.impactPoints + bat.impactPoints).toFixed(1));
      next[bat.playerId] = entry;
    }

    for (const bowl of card.bowling) {
      const entry = ensureEntry(bowl.playerId, bowl.playerName, bowlingTeamId, bowl.role);
      if (!participants.has(bowl.playerId)) {
        entry.matches += 1;
        participants.add(bowl.playerId);
      }
      entry.oversBowled = Number((entry.oversBowled + cricketOversToDecimal(bowl.overs)).toFixed(2));
      entry.maidens = (entry.maidens ?? 0) + (bowl.maidens ?? 0);
      entry.dots = (entry.dots ?? 0) + (bowl.dots ?? 0);
      entry.wides = (entry.wides ?? 0) + (bowl.wides ?? 0);
      entry.noBalls = (entry.noBalls ?? 0) + (bowl.noBalls ?? 0);
      entry.runsConceded += bowl.runsConceded;
      entry.wickets += bowl.wickets;
      if (
        bowl.wickets > entry.bestBowlingWickets ||
        (bowl.wickets === entry.bestBowlingWickets &&
          bowl.wickets > 0 &&
          (entry.bestBowlingRuns === 0 || bowl.runsConceded < entry.bestBowlingRuns))
      ) {
        entry.bestBowlingWickets = bowl.wickets;
        entry.bestBowlingRuns = bowl.runsConceded;
      }
      entry.impactPoints = Number((entry.impactPoints + bowl.impactPoints).toFixed(1));
      next[bowl.playerId] = entry;
    }
  };

  applyScorecard(result.firstScorecard, result.secondInnings.teamId);
  applyScorecard(result.secondScorecard, result.firstInnings.teamId);

  if (result.playerOfTheMatch) {
    const potm = result.playerOfTheMatch;
    if (next[potm.playerId]) {
      next[potm.playerId] = {
        ...next[potm.playerId],
        potmCount: next[potm.playerId].potmCount + 1,
      };
    }
  }

  return next;
}

export function createInitialSeasonState(
  userXi: PlayerSeasonRecord[],
  repository?: PlayerRepository | null,
  seasonNumber: number = 1,
  rng: () => number = Math.random,
  userBench: PlayerSeasonRecord[] = [],
  customFranchise?: CustomFranchise | string | null
): SeasonState {
  const raw = buildSeasonTeams(userXi, repository, rng, customFranchise);
  const { teams } = validateLeagueOwnership(raw.teams, userBench, repository);
  const teamOrder = raw.teamOrder;
  const fixtures = generateLeagueSchedule(teams, rng);
  const pointsTable: PointsTableRow[] = teamOrder.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    runsFor: 0,
    oversFor: 0,
    runsAgainst: 0,
    oversAgainst: 0,
    nrr: 0,
  }));

  const playerForms: Record<string, PlayerForm> = {};
  for (const teamId of teamOrder) {
    const roster = teams[teamId].squad ?? teams[teamId].players;
    for (const p of roster) {
      playerForms[p.playerId] = p.form ?? 'NORMAL';
    }
  }
  for (const p of userBench) {
    playerForms[p.playerId] = p.form ?? 'NORMAL';
  }

  const userTeamName = teams.YOU.name;
  const transferImpactNotices: TransferImpactNotice[] = [];
  const seenNotices = new Set<string>();
  for (const p of [...userXi, ...userBench]) {
    if (CPU_FRANCHISE_POOL.includes(p.franchise)) {
      const cid = getCanonicalPlayerId(p);
      if (seenNotices.has(cid)) continue;
      seenNotices.add(cid);
      transferImpactNotices.push({
        playerCanonicalId: cid,
        playerName: p.playerName,
        originalFranchise: p.franchise,
        draftedByFranchise: teams.YOU.code,
        draftedByName: userTeamName,
        isInformationalOnly: true,
        message: `${p.playerName} drafted from ${p.franchise}; ${p.franchise} signed a replacement for its 15-man squad.`,
      });
    }
  }

  return {
    simulationVersion: SIMULATION_VERSION,
    seasonNumber,
    teams,
    teamOrder,
    fixtures,
    pointsTable,
    playoffs: createInitialPlayoffs(),
    phase: 'LEAGUE',
    championTeamId: null,
    userQualified: null,
    challenge14Status: 'ALIVE',
    challengeBrokenAtMatch: null,
    playerForms,
    stats: {
      matchesSimulated: 0,
      highestUserScore: 0,
      playerStats: {},
    },
    venueStats: {},
    userBench: [...userBench],
    transferImpactNotices,
    impactHistory: [],
  };
}

export function recordVenueMemory(
  currentVenueStats: Record<string, VenueMemoryStats> | undefined,
  venue: string,
  result: MatchResult
): Record<string, VenueMemoryStats> {
  const next = { ...(currentVenueStats ?? {}) };
  const existing = next[venue] ?? {
    venue,
    matches: 0,
    totalFirstInnRuns: 0,
    totalFirstInnWkts: 0,
    totalSecondInnRuns: 0,
    batFirstWins: 0,
    chaseWins: 0,
    highestScore: 0,
    lowestDefended: null,
  };
  const batFirstWon = result.winnerId === result.battingFirstTeamId;
  const prevLowestDef = existing.lowestDefended ?? null;
  const nextLowestDefended = batFirstWon
    ? prevLowestDef === null
      ? result.firstInnings.runs
      : Math.min(prevLowestDef, result.firstInnings.runs)
    : prevLowestDef;

  next[venue] = {
    venue,
    matches: existing.matches + 1,
    totalFirstInnRuns: existing.totalFirstInnRuns + result.firstInnings.runs,
    totalFirstInnWkts: existing.totalFirstInnWkts + result.firstInnings.wickets,
    totalSecondInnRuns: existing.totalSecondInnRuns + result.secondInnings.runs,
    batFirstWins: existing.batFirstWins + (batFirstWon ? 1 : 0),
    chaseWins: existing.chaseWins + (batFirstWon ? 0 : 1),
    highestScore: Math.max(
      existing.highestScore,
      result.firstInnings.runs,
      result.secondInnings.runs
    ),
    lowestDefended: nextLowestDefended,
  };
  return next;
}

export function syncUserXiInSeason(
  season: SeasonState,
  userXi: PlayerSeasonRecord[],
  userBench?: PlayerSeasonRecord[],
  customFranchise?: CustomFranchise | string | null
): SeasonState {
  if (userXi.length === 0) return season;
  const cf =
    typeof customFranchise === 'object' && customFranchise !== null ? customFranchise : null;
  const cleanName =
    (cf ? cf.name : typeof customFranchise === 'string' ? customFranchise : season.teams.YOU.name)
      .trim() || season.teams.YOU.name;
  const cleanCode =
    (cf
      ? cf.code
      : cleanName
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 3)) || season.teams.YOU.code;

  return {
    ...season,
    teams: {
      ...season.teams,
      YOU: {
        ...season.teams.YOU,
        name: cleanName,
        shortName: cleanName,
        code: cleanCode.toUpperCase().slice(0, 3),
        primaryColor: cf?.primaryColor || season.teams.YOU.primaryColor,
        secondaryColor: cf?.secondaryColor || season.teams.YOU.secondaryColor,
        homeCity: cf?.homeCity || season.teams.YOU.homeCity,
        homeVenue: cf?.homeGround || season.teams.YOU.homeVenue,
        players: [...userXi],
      },
    },
    userBench: userBench ? [...userBench] : season.userBench,
  };
}

export function getUserFixtures(season: SeasonState): SeasonFixture[] {
  return season.fixtures
    .filter((f) => f.userMatchNumber !== null)
    .sort((a, b) => (a.userMatchNumber ?? 0) - (b.userMatchNumber ?? 0));
}

export function getNextScheduledUserFixture(season: SeasonState): SeasonFixture | null {
  return getUserFixtures(season).find((f) => f.status === 'SCHEDULED') ?? null;
}

export function commitUserFixtureResult(
  season: SeasonState,
  fixtureId: string,
  userResult: MatchResult,
  rng: () => number = Math.random
): SeasonState {
  const target = season.fixtures.find((f) => f.id === fixtureId);
  if (!target || target.status === 'COMPLETED') {
    return season;
  }

  let nextTable = [...season.pointsTable];
  let nextForms = { ...(season.playerForms ?? {}) };
  let nextPlayerStats = { ...(season.stats.playerStats ?? {}) };
  let nextVenueStats = { ...(season.venueStats ?? {}) };
  let matchesSimulated = season.stats.matchesSimulated;
  let highestUserScore = season.stats.highestUserScore;
  let challenge14Status: Challenge14Status = season.challenge14Status;
  let challengeBrokenAtMatch = season.challengeBrokenAtMatch;
  const nextImpactHistory = [...(season.impactHistory ?? [])];

  const targetRound = target.round;
  const hasMoreUserMatchesAfterTarget = season.fixtures.some(
    (f) => f.userMatchNumber !== null && f.id !== fixtureId && f.status === 'SCHEDULED'
  );

  const nextFixtures = season.fixtures.map((fix) => {
    if (fix.status === 'COMPLETED') {
      return fix;
    }
    const shouldSimulateNow =
      fix.round <= targetRound || !hasMoreUserMatchesAfterTarget;
    if (!shouldSimulateNow) {
      return fix;
    }

    const homeTeam = season.teams[fix.homeTeamId];
    const awayTeam = season.teams[fix.awayTeamId];
    const isTargetFix = fix.id === fixtureId;
    const result = isTargetFix
      ? userResult
      : simulateT20Match(homeTeam, awayTeam, rng, nextForms, { venue: fix.venue });

    nextTable = applyMatchToPointsTable(nextTable, result);
    nextPlayerStats = accumulateMatchPlayerStats(
      nextPlayerStats,
      result,
      season.teams,
      season.userBench
    );
    nextVenueStats = recordVenueMemory(nextVenueStats, fix.venue, result);
    const winnerTeam = result.winnerId === homeTeam.id ? homeTeam : awayTeam;
    const loserTeam = result.loserId === homeTeam.id ? homeTeam : awayTeam;
    nextForms = evolveMatchForms(nextForms, winnerTeam, loserTeam, rng);
    matchesSimulated += 1;

    if (fix.homeTeamId === 'YOU' || fix.awayTeamId === 'YOU') {
      const userInnings =
        result.firstInnings.teamId === 'YOU' ? result.firstInnings : result.secondInnings;
      if (userInnings.runs > highestUserScore) {
        highestUserScore = userInnings.runs;
      }
      if (result.loserId === 'YOU' && challenge14Status === 'ALIVE') {
        challenge14Status = 'FAILED';
        challengeBrokenAtMatch = fix.userMatchNumber;
      }
      if (result.impactSub && result.impactSub.teamId === 'YOU') {
        nextImpactHistory.push({
          matchId: fix.id,
          matchLabel: `Match ${fix.userMatchNumber ?? fix.round}`,
          inPlayerId: result.impactSub.inPlayerId,
          inPlayerName: result.impactSub.inPlayerName,
          outPlayerId: result.impactSub.outPlayerId,
          outPlayerName: result.impactSub.outPlayerName,
          overLabel: result.impactSub.overLabel,
        });
      }
    }

    return {
      ...fix,
      status: 'COMPLETED' as const,
      result,
    };
  });

  const allLeagueDone = nextFixtures.every((f) => f.status === 'COMPLETED');
  let phase = season.phase;
  let playoffs = { ...season.playoffs };
  let userQualified = season.userQualified;

  if (allLeagueDone) {
    if (challenge14Status === 'ALIVE') {
      challenge14Status = 'COMPLETED';
    }
    phase = 'PLAYOFFS';
    const top4 = nextTable.slice(0, 4).map((r) => r.teamId);
    userQualified = top4.includes('YOU');

    playoffs = {
      ...playoffs,
      Q1: {
        ...playoffs.Q1,
        homeTeamId: top4[0],
        awayTeamId: top4[1],
        status: 'READY',
      },
      ELIM: {
        ...playoffs.ELIM,
        homeTeamId: top4[2],
        awayTeamId: top4[3],
        status: 'READY',
      },
    };
  }

  return {
    ...season,
    fixtures: nextFixtures,
    pointsTable: nextTable,
    playoffs,
    phase,
    userQualified,
    challenge14Status,
    challengeBrokenAtMatch,
    playerForms: nextForms,
    venueStats: nextVenueStats,
    impactHistory: nextImpactHistory,
    stats: {
      ...season.stats,
      matchesSimulated,
      highestUserScore,
      playerStats: nextPlayerStats,
    },
  };
}

export function quickSimUserFixture(
  season: SeasonState,
  fixtureId: string,
  rng: () => number = Math.random,
  difficulty: CaptaincyDifficulty = 'STANDARD'
): SeasonState {
  const target = season.fixtures.find((f) => f.id === fixtureId);
  if (!target || target.status === 'COMPLETED') {
    return season;
  }
  const homeTeam = season.teams[target.homeTeamId];
  const awayTeam = season.teams[target.awayTeamId];
  const result = simulateT20Match(homeTeam, awayTeam, rng, season.playerForms ?? {}, {
    venue: target.venue,
    difficulty,
  });
  return commitUserFixtureResult(season, fixtureId, result, rng);
}

export function commitPlayoffMatchResult(
  season: SeasonState,
  playoffId: PlayoffRoundId,
  result: MatchResult,
  rng: () => number = Math.random
): SeasonState {
  const match = season.playoffs[playoffId];
  if (!match || match.status !== 'READY' || !match.homeTeamId || !match.awayTeamId) {
    return season;
  }

  const homeTeam = season.teams[match.homeTeamId];
  const awayTeam = season.teams[match.awayTeamId];
  const currentForms = season.playerForms ?? {};
  const winnerTeam = result.winnerId === homeTeam.id ? homeTeam : awayTeam;
  const loserTeam = result.loserId === homeTeam.id ? homeTeam : awayTeam;
  const nextForms = evolveMatchForms(currentForms, winnerTeam, loserTeam, rng);
  const nextPlayerStats = accumulateMatchPlayerStats(
    season.stats.playerStats ?? {},
    result,
    season.teams,
    season.userBench
  );
  const nextImpactHistory = [...(season.impactHistory ?? [])];
  if (result.impactSub && result.impactSub.teamId === 'YOU') {
    nextImpactHistory.push({
      matchId: match.id,
      matchLabel: match.label,
      inPlayerId: result.impactSub.inPlayerId,
      inPlayerName: result.impactSub.inPlayerName,
      outPlayerId: result.impactSub.outPlayerId,
      outPlayerName: result.impactSub.outPlayerName,
      overLabel: result.impactSub.overLabel,
    });
  }

  const nextPlayoffs: Record<PlayoffRoundId, PlayoffFixture> = {
    ...season.playoffs,
    [playoffId]: {
      ...match,
      status: 'COMPLETED',
      result,
    },
  };

  let phase = season.phase;
  let championTeamId = season.championTeamId;
  let highestUserScore = season.stats.highestUserScore;

  if (homeTeam.id === 'YOU' || awayTeam.id === 'YOU') {
    const userInnings =
      result.firstInnings.teamId === 'YOU' ? result.firstInnings : result.secondInnings;
    if (userInnings.runs > highestUserScore) {
      highestUserScore = userInnings.runs;
    }
  }

  if (
    nextPlayoffs.Q1.status === 'COMPLETED' &&
    nextPlayoffs.ELIM.status === 'COMPLETED' &&
    nextPlayoffs.Q2.status === 'LOCKED'
  ) {
    const q1Loser = nextPlayoffs.Q1.result!.loserId;
    const elimWinner = nextPlayoffs.ELIM.result!.winnerId;
    nextPlayoffs.Q2 = {
      ...nextPlayoffs.Q2,
      homeTeamId: q1Loser,
      awayTeamId: elimWinner,
      status: 'READY',
    };
  }

  if (
    nextPlayoffs.Q1.status === 'COMPLETED' &&
    nextPlayoffs.Q2.status === 'COMPLETED' &&
    nextPlayoffs.FINAL.status === 'LOCKED'
  ) {
    const q1Winner = nextPlayoffs.Q1.result!.winnerId;
    const q2Winner = nextPlayoffs.Q2.result!.winnerId;
    nextPlayoffs.FINAL = {
      ...nextPlayoffs.FINAL,
      homeTeamId: q1Winner,
      awayTeamId: q2Winner,
      status: 'READY',
    };
  }

  if (playoffId === 'FINAL') {
    phase = 'COMPLETED';
    championTeamId = result.winnerId;
  }

  const nextVenueStats = recordVenueMemory(season.venueStats, match.venue, result);

  return {
    ...season,
    playoffs: nextPlayoffs,
    phase,
    championTeamId,
    playerForms: nextForms,
    venueStats: nextVenueStats,
    impactHistory: nextImpactHistory,
    stats: {
      ...season.stats,
      matchesSimulated: season.stats.matchesSimulated + 1,
      highestUserScore,
      playerStats: nextPlayerStats,
    },
  };
}

export function quickSimPlayoffMatch(
  season: SeasonState,
  playoffId: PlayoffRoundId,
  rng: () => number = Math.random,
  difficulty: CaptaincyDifficulty = 'STANDARD'
): SeasonState {
  const match = season.playoffs[playoffId];
  if (
    !match ||
    match.status !== 'READY' ||
    !match.homeTeamId ||
    !match.awayTeamId
  ) {
    return season;
  }

  const homeTeam = season.teams[match.homeTeamId];
  const awayTeam = season.teams[match.awayTeamId];
  const result = simulateT20Match(homeTeam, awayTeam, rng, season.playerForms ?? {}, {
    venue: match.venue,
    difficulty,
  });
  return commitPlayoffMatchResult(season, playoffId, result, rng);
}

export function getCapRaceLeaderboards(season: SeasonState) {
  const all = Object.values(season.stats.playerStats ?? {});
  const orangeCap = [...all]
    .filter((p) => p.runs > 0)
    .sort((a, b) => b.runs - a.runs || b.highestScore - a.highestScore || a.balls - b.balls)
    .slice(0, 15);
  const purpleCap = [...all]
    .filter((p) => p.wickets > 0)
    .sort((a, b) => {
      const aEcon = a.oversBowled > 0 ? a.runsConceded / a.oversBowled : 99;
      const bEcon = b.oversBowled > 0 ? b.runsConceded / b.oversBowled : 99;
      return b.wickets - a.wickets || aEcon - bEcon;
    })
    .slice(0, 15);
  const impactLeaders = [...all]
    .filter((p) => p.impactPoints > 0)
    .sort((a, b) => b.impactPoints - a.impactPoints || b.runs - a.runs || b.wickets - a.wickets)
    .slice(0, 15);

  return { orangeCap, purpleCap, impactLeaders };
}

export function getUserStandingsInfo(season: SeasonState) {
  const index = season.pointsTable.findIndex((r) => r.teamId === 'YOU');
  const row = index >= 0 ? season.pointsTable[index] : null;
  const position = index >= 0 ? index + 1 : season.pointsTable.length || 11;
  return {
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    lost: row?.lost ?? 0,
    points: row?.points ?? 0,
    nrr: row?.nrr ?? 0,
    position,
    challenge14Status: season.challenge14Status,
    challengeBrokenAtMatch: season.challengeBrokenAtMatch,
    nextFixture: getNextScheduledUserFixture(season),
  };
}
