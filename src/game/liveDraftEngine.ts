import { FRANCHISES } from '../data/franchises';
import { getActivePlayerRepository, type PlayerRepository } from '../data/playerRepository';
import type {
  DraftSettings,
  DraftState,
  DraftTransaction,
  FranchiseCode,
  LeagueDraftValidation,
  LiveDraftTeamState,
  LiveLeagueDraftState,
  PlayerSeasonRecord,
  SeasonTeamId,
} from '../types/game';
import {
  canSelectPlayer,
  getOverseasCount,
  getPlayerDraftCostCr,
  getPlayerSalaryCr,
  isPlayerSalaryVerified,
  roundCr,
} from './draftEngine';
import { getCanonicalPlayerId } from './leagueOwnershipEngine.mjs';
import { lockRetentionsAndStartSpin } from './retentionEngine';

export const AI_FRANCHISE_CODES: FranchiseCode[] = [
  'MI',
  'CSK',
  'RCB',
  'KKR',
  'SRH',
  'RR',
  'DC',
  'PBKS',
  'GT',
  'LSG',
];

export const ALL_LEAGUE_TEAM_IDS: SeasonTeamId[] = ['YOU', ...AI_FRANCHISE_CODES];

const MAX_FEED_TRANSACTIONS = 20;

export function getCanonicalDraftPlayerId(player: PlayerSeasonRecord): string {
  return getCanonicalPlayerId(player);
}

const KNOWN_SPIN_PATTERNS =
  /rashid|narine|chahal|ashwin|jadeja|kuldeep|chawla|axar|chakravarthy|varun|bishnoi|tahir|harbhajan|mishra|hasaranga|santner|zampa|maharaj|noor|moeen|sundar|krunal|tewatia|markande|suyash|kishore|shahbaz|shamsi|shakib|chahar|karn|gopal|badree|mujeeb|theekshana|brar|sharma.*karn|ojha|kumble|muralitharan|warne|vettori|afridi|swann|botha|powar|murali|kartik|chawla|tambe|neg[iy]|nadeem|gowtham|mayank-markande|murugan|shivil|iqbal-abdulla|bipul|jalaj|sarabjit|shreyas-gopal|manav-suthar|vipraj|digvesh|livingstone|maxwell|abhishek-sharma|parag|nitish-rana/i;

export function classifyBowlerDiscipline(player: PlayerSeasonRecord): 'PACE' | 'SPIN' | 'NONE' {
  const style = (player.bowlingStyle ?? '').toLowerCase();
  const bowlRating = player.ratings?.bowl ?? player.bowlingRating ?? 0;
  const isBowlerCapable = player.role === 'BOWL' || player.role === 'AR' || bowlRating >= 58;
  if (!isBowlerCapable) return 'NONE';

  if (
    style.includes('spin') ||
    style.includes('break') ||
    style.includes('orthodox') ||
    style.includes('chinaman') ||
    style.includes('wrist') ||
    style.includes('slow') ||
    style.includes('googly')
  ) {
    return 'SPIN';
  }
  if (
    style.includes('fast') ||
    style.includes('medium') ||
    style.includes('seam') ||
    style.includes('pace')
  ) {
    return 'PACE';
  }

  // Fallback when runtime JSON has bowlingStyle: 'None'
  const canonical = getCanonicalPlayerId(player);
  const nameKey = `${canonical} ${player.playerName ?? ''}`;
  if (KNOWN_SPIN_PATTERNS.test(nameKey)) {
    return 'SPIN';
  }

  const bowlAttrs = player.attributes?.bowling;
  if (bowlAttrs) {
    const spinSignal = bowlAttrs.middleOversBowling + bowlAttrs.variation;
    const paceSignal = bowlAttrs.powerplayBowling + bowlAttrs.deathBowling;
    if (spinSignal - paceSignal >= 4) return 'SPIN';
    if (paceSignal - spinSignal >= 4) return 'PACE';
  }

  // Stable canonical tie-break (~35% spin / ~65% pace among unspecified bowlers)
  let hash = 0;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = (hash * 31 + canonical.charCodeAt(i)) >>> 0;
  }
  return hash % 10 < 3 ? 'SPIN' : 'PACE';
}

function getUserTeamIdentity(state: DraftState): {
  code: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
} {
  const cf = state.customFranchise;
  if (cf) {
    return {
      code: cf.code.trim().toUpperCase().slice(0, 3) || 'YOU',
      name: cf.name.trim() || state.settings.franchiseName || 'Your Franchise',
      primaryColor: cf.primaryColor || '#D94E28',
      secondaryColor: cf.secondaryColor || '#F59E0B',
    };
  }
  const fallbackName = state.settings.franchiseName?.trim() || 'Mumbai Warriors';
  const fallbackCode =
    fallbackName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3) || 'MWR';
  return {
    code: fallbackCode,
    name: fallbackName,
    primaryColor: '#D94E28',
    secondaryColor: '#F59E0B',
  };
}

export function createInitialLiveLeagueState(state: DraftState): LiveLeagueDraftState {
  const userIdentity = getUserTeamIdentity(state);
  const ownedSet = new Set<string>();
  const playerOwners: Record<string, SeasonTeamId> = {};
  const feed: DraftTransaction[] = [];

  let totalPicks = 0;
  for (const p of state.squad) {
    const cid = getCanonicalDraftPlayerId(p);
    if (!cid || ownedSet.has(cid)) continue;
    ownedSet.add(cid);
    playerOwners[cid] = 'YOU';
    totalPicks += 1;
    feed.push({
      pickNumber: totalPicks,
      roundNumber: 1,
      teamId: 'YOU',
      teamCode: userIdentity.code,
      teamName: userIdentity.name,
      playerId: p.playerId,
      canonicalId: cid,
      playerName: p.playerName || p.name,
      role: p.role,
      sourceFranchise: p.franchise,
      sourceSeason: p.season,
      salaryCr: getPlayerSalaryCr(p),
      isRetained: p.isRetained,
    });
  }

  const teams: Partial<Record<SeasonTeamId, LiveDraftTeamState>> = {
    YOU: {
      teamId: 'YOU',
      code: userIdentity.code,
      name: userIdentity.name,
      primaryColor: userIdentity.primaryColor,
      secondaryColor: userIdentity.secondaryColor,
      isUser: true,
      squad: [...state.squad],
      remainingPurseCr: roundCr(state.remainingPurseCr),
      overseasCount: getOverseasCount(state.squad),
    },
  };

  for (const code of AI_FRANCHISE_CODES) {
    const meta = FRANCHISES[code];
    teams[code] = {
      teamId: code,
      code,
      name: meta.name,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.accentColor,
      isUser: false,
      squad: [],
      remainingPurseCr: roundCr(state.settings.startingPurseCr),
      overseasCount: 0,
    };
  }

  return {
    teams: teams as Record<SeasonTeamId, LiveDraftTeamState>,
    teamOrder: [...ALL_LEAGUE_TEAM_IDS],
    ownedPlayerIds: Array.from(ownedSet),
    playerOwners,
    feed: feed.slice(-MAX_FEED_TRANSACTIONS),
    lastRoundTransactions: feed,
    totalPicks,
    roundNumber: state.squad.length,
    validation: null,
  };
}

export function ensureLiveLeagueInitialized(state: DraftState): DraftState {
  if (state.liveLeague) {
    const userIdentity = getUserTeamIdentity(state);
    const existingYou = state.liveLeague.teams.YOU;
    if (
      existingYou.code !== userIdentity.code ||
      existingYou.name !== userIdentity.name ||
      existingYou.primaryColor !== userIdentity.primaryColor
    ) {
      return {
        ...state,
        liveLeague: {
          ...state.liveLeague,
          teams: {
            ...state.liveLeague.teams,
            YOU: {
              ...existingYou,
              code: userIdentity.code,
              name: userIdentity.name,
              primaryColor: userIdentity.primaryColor,
              secondaryColor: userIdentity.secondaryColor,
            },
          },
        },
      };
    }
    return state;
  }

  return {
    ...state,
    liveLeague: createInitialLiveLeagueState(state),
  };
}

interface CandidateEntry {
  canonicalId: string;
  player: PlayerSeasonRecord;
  bat: number;
  bowl: number;
  imp: number;
  ovr: number;
  salaryCr: number | null;
  draftCostCr: number;
  verifiedSalary: boolean;
  bowlerType: 'PACE' | 'SPIN' | 'NONE';
  estimatedMarketCr: number;
}

/**
 * Builds a clean AI candidate pool from the runtime IPL repository.
 * For each canonical player, keeps up to 3 representative seasons (peak OVR,
 * best verified-salary season, and best affordable value season) so AI evaluates
 * realistic prime & value historical seasons quickly without scanning duplicates.
 */
function buildAiCandidatePool(
  repo: PlayerRepository,
  seasonStart: number,
  seasonEnd: number,
  ownedSet: Set<string>
): CandidateEntry[] {
  const minYear = Math.min(seasonStart, seasonEnd);
  const maxYear = Math.max(seasonStart, seasonEnd);
  const allRecords = repo.getAllPlayerSeasonRecords();
  const byCanonical = new Map<string, PlayerSeasonRecord[]>();

  for (const rec of allRecords) {
    if (rec.season < minYear || rec.season > maxYear) continue;
    const cid = getCanonicalDraftPlayerId(rec);
    if (!cid || ownedSet.has(cid)) continue;
    const list = byCanonical.get(cid);
    if (list) {
      list.push(rec);
    } else {
      byCanonical.set(cid, [rec]);
    }
  }

  const entries: CandidateEntry[] = [];
  for (const [canonicalId, records] of byCanonical.entries()) {
    const ratedRecords = records.filter((r) => r.hasRatings !== false);
    const workingRecords = ratedRecords.length > 0 ? ratedRecords : records;

    workingRecords.sort((a, b) => {
      const ovrA = a.ratings?.overall ?? a.overallRating;
      const ovrB = b.ratings?.overall ?? b.overallRating;
      const impA = a.ratings?.impact ?? a.impactRating;
      const impB = b.ratings?.impact ?? b.impactRating;
      return ovrB - ovrA || impB - impA || b.season - a.season;
    });

    const chosen: PlayerSeasonRecord[] = [];
    const seenKeys = new Set<string>();
    const pushUnique = (rec: PlayerSeasonRecord | undefined) => {
      if (!rec) return;
      const k = `${rec.franchise}-${rec.season}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      chosen.push(rec);
    };

    // 1. Peak overall season
    pushUnique(workingRecords[0]);
    // 2. Best season with known contract or gamePriceCr
    const bestKnownSalary = workingRecords.find((r) => {
      const s = getPlayerSalaryCr(r);
      const gp = r.gamePriceCr ?? r.salary?.gamePriceCr ?? null;
      return s !== null || gp !== null;
    });
    pushUnique(bestKnownSalary);
    // 3. Most affordable priced season (helps AI stay under budget in late rounds)
    const affordable = workingRecords
      .filter((r) => {
        const cost = getPlayerDraftCostCr(r);
        const hasPrice =
          getPlayerSalaryCr(r) !== null || (r.gamePriceCr ?? r.salary?.gamePriceCr ?? null) !== null;
        return hasPrice && cost <= 6;
      })
      .sort((a, b) => (b.ratings?.overall ?? b.overallRating) - (a.ratings?.overall ?? a.overallRating))[0];
    pushUnique(affordable);

    for (const rec of chosen) {
      const bat = rec.ratings?.bat ?? rec.battingRating;
      const bowl = rec.ratings?.bowl ?? rec.bowlingRating;
      const imp = rec.ratings?.impact ?? rec.impactRating;
      const ovr = rec.ratings?.overall ?? rec.overallRating;
      const realSalaryCr = getPlayerSalaryCr(rec);
      const gamePriceCr = rec.gamePriceCr ?? rec.salary?.gamePriceCr ?? null;
      const verifiedSalary = isPlayerSalaryVerified(rec);
      const salaryCr = verifiedSalary ? realSalaryCr : (gamePriceCr ?? realSalaryCr);
      const draftCostCr = getPlayerDraftCostCr(rec);

      // Fair market estimate for unpriced records so AI does NOT exploit null salary as a "free" bonus
      const estimatedMarketCr =
        salaryCr !== null
          ? salaryCr
          : Math.max(1.5, Math.min(18, roundCr(Math.pow(Math.max(0, ovr - 58) / 36, 1.8) * 16 + 1.5)));

      entries.push({
        canonicalId,
        player: rec,
        bat,
        bowl,
        imp,
        ovr,
        salaryCr,
        draftCostCr,
        verifiedSalary,
        bowlerType: classifyBowlerDiscipline(rec),
        estimatedMarketCr,
      });
    }
  }

  return entries;
}

interface RosterProfile {
  wkCount: number;
  pureBatCount: number;
  batDepthCount: number;
  arCount: number;
  pureBowlCount: number;
  bowlingOptionsCount: number;
  paceCount: number;
  spinCount: number;
  finisherCount: number;
}

function analyzeRosterProfile(squad: PlayerSeasonRecord[]): RosterProfile {
  let wkCount = 0;
  let pureBatCount = 0;
  let batDepthCount = 0;
  let arCount = 0;
  let pureBowlCount = 0;
  let bowlingOptionsCount = 0;
  let paceCount = 0;
  let spinCount = 0;
  let finisherCount = 0;

  for (const p of squad) {
    const bat = p.ratings?.bat ?? p.battingRating;
    const bowl = p.ratings?.bowl ?? p.bowlingRating;
    if (p.role === 'WK') wkCount += 1;
    if (p.role === 'BAT') pureBatCount += 1;
    if (p.role === 'AR') arCount += 1;
    if (p.role === 'BOWL') pureBowlCount += 1;

    if (p.role === 'BAT' || p.role === 'WK' || bat >= 70) {
      batDepthCount += 1;
    }
    if (p.role === 'BOWL' || p.role === 'AR' || bowl >= 62) {
      bowlingOptionsCount += 1;
    }
    const disc = classifyBowlerDiscipline(p);
    if (disc === 'PACE') paceCount += 1;
    if (disc === 'SPIN') spinCount += 1;

    if ((p.attributes?.batting?.deathOvers ?? 0) >= 75 && bat >= 68) {
      finisherCount += 1;
    }
  }

  return {
    wkCount,
    pureBatCount,
    batDepthCount,
    arCount,
    pureBowlCount,
    bowlingOptionsCount,
    paceCount,
    spinCount,
    finisherCount,
  };
}

function isLegalForAiTeam(
  team: LiveDraftTeamState,
  candidate: CandidateEntry,
  settings: DraftSettings,
  strictReserve: boolean
): boolean {
  if (team.squad.length >= settings.squadSize) return false;
  if (candidate.player.isOverseas === true && team.overseasCount >= settings.overseasSquadLimit) {
    return false;
  }

  const remainingAfter = Math.max(0, settings.squadSize - team.squad.length - 1);
  const reserveCr = strictReserve ? roundCr(remainingAfter * 0.5) : 0;
  const maxSpendCr = roundCr(team.remainingPurseCr - reserveCr);
  return roundCr(candidate.draftCostCr) <= maxSpendCr;
}

function scoreCandidateForAiTeam(
  team: LiveDraftTeamState,
  profile: RosterProfile,
  candidate: CandidateEntry,
  settings: DraftSettings,
  roundNumber: number
): number {
  const slotsLeft = Math.max(1, settings.squadSize - team.squad.length);
  const isEarlyRound = team.squad.length < 5;
  const isBenchPhase = team.squad.length >= 10;

  // 1. Core playing strength: weighted OVR + Impact + role-relevant BAT/BOWL
  let score =
    candidate.ovr * 1.15 +
    candidate.imp * 0.45 +
    Math.max(candidate.bat, candidate.bowl) * 0.22;

  if (candidate.player.role === 'AR') {
    score += Math.min(candidate.bat, candidate.bowl) * 0.2;
  }

  // 2. Role & Tactical Balance Needs
  const role = candidate.player.role;

  // Wicketkeeper priority: guaranteed >=1 WK, target 2 WKs for backup
  if (role === 'WK') {
    if (profile.wkCount === 0) {
      if (slotsLeft <= 3) score += 95;
      else if (slotsLeft <= 6) score += 42;
      else if (slotsLeft <= 10) score += 20;
      else score += 11;
    } else if (profile.wkCount === 1) {
      score += slotsLeft <= 6 ? 9 : 3;
    } else {
      score -= 28;
    }
  } else if (profile.wkCount === 0 && slotsLeft === 1) {
    // Final slot must be a WK if team still has none
    score -= 120;
  }

  // Pace bowling balance (target >= 3)
  if (candidate.bowlerType === 'PACE') {
    if (profile.paceCount === 0 && slotsLeft <= 6) score += 32;
    else if (profile.paceCount < 2) score += 16;
    else if (profile.paceCount < 3) score += 10;
    else if (profile.paceCount >= 5) score -= 12;
  }

  // Spin bowling balance (target >= 2)
  if (candidate.bowlerType === 'SPIN') {
    if (profile.spinCount === 0 && slotsLeft <= 6) score += 34;
    else if (profile.spinCount === 0) score += 15;
    else if (profile.spinCount < 2) score += 11;
    else if (profile.spinCount >= 4) score -= 14;
  }

  // All-rounder value (target 2–3)
  if (role === 'AR') {
    if (profile.arCount < 2) score += 13;
    else if (profile.arCount === 2) score += 6;
    else if (profile.arCount >= 4) score -= 12;
  }

  // Overall bowling depth (target >= 6 bowling options across 15)
  const isBowlingOption = role === 'BOWL' || role === 'AR' || candidate.bowl >= 62;
  if (isBowlingOption) {
    if (profile.bowlingOptionsCount < 4 && slotsLeft <= 5) score += 30;
    else if (profile.bowlingOptionsCount < 5) score += 10;
    else if (role === 'BOWL' && profile.pureBowlCount >= 6) score -= 16;
  }

  // Batting depth & finishers (target >= 6 batting options)
  const isBatOption = role === 'BAT' || role === 'WK' || candidate.bat >= 70;
  if (isBatOption) {
    if (profile.batDepthCount < 4 && slotsLeft <= 5) score += 28;
    else if (profile.batDepthCount < 6) score += 9;
    else if (role === 'BAT' && profile.pureBatCount >= 6) score -= 16;
  }
  if (
    profile.finisherCount < 2 &&
    (candidate.player.attributes?.batting?.deathOvers ?? 0) >= 76 &&
    candidate.bat >= 68
  ) {
    score += 7;
  }

  // 3. Impact Bench value in picks 11–15
  if (isBenchPhase) {
    score += (candidate.imp - 68) * 0.45;
  }

  // 4. Overseas slot management (max 6 across 15; Indian core is precious)
  const osRemaining = settings.overseasSquadLimit - team.overseasCount;
  if (candidate.player.isOverseas === true) {
    if (osRemaining <= 1 && candidate.ovr < 82) {
      score -= 10;
    } else if (isEarlyRound && candidate.ovr < 78) {
      score -= 5;
    }
  } else if (candidate.player.isOverseas === false) {
    // Indian core value bonus (needed for 7-Indian Starting XI)
    if (candidate.ovr >= 74) score += 4.5;
  }

  // 5. Franchise identity affinity (light tie-breaker, never blocks signing league stars)
  if (candidate.player.franchise === team.teamId) {
    score += 3.5;
  }

  // 6. Purse discipline & fair salary valuation (never reward null salary as free)
  const avgBudgetPerSlot = team.remainingPurseCr / slotsLeft;
  const effectivePriceCr = candidate.estimatedMarketCr;

  if (candidate.salaryCr === null) {
    // Unknown salary: apply normal cost sensitivity using estimatedMarketCr + slight preference for verified records
    score -= effectivePriceCr * 0.55;
    score -= 1.8;
  } else {
    const costRatio = candidate.draftCostCr / Math.max(2, avgBudgetPerSlot);
    if (isEarlyRound) {
      // Early rounds: chase true superstars even at high salary
      score -= candidate.draftCostCr * 0.25;
      if (candidate.ovr >= 86) score += 8;
    } else if (costRatio > 1.75 && slotsLeft >= 3) {
      score -= (costRatio - 1.5) * 9;
    } else {
      score -= candidate.draftCostCr * 0.45;
    }
    if (candidate.verifiedSalary) {
      score += 1.2;
    }
  }

  // Slight round progression emphasis on high OVR stars early so AI never leaves 90+ superstars sitting
  if (roundNumber <= 4 && candidate.ovr >= 85) {
    score += 7;
  }

  return score;
}

function pickBestCandidateForAiTeam(
  team: LiveDraftTeamState,
  pool: CandidateEntry[],
  ownedSet: Set<string>,
  settings: DraftSettings,
  roundNumber: number,
  rng: () => number
): CandidateEntry | null {
  const profile = analyzeRosterProfile(team.squad);

  const evaluate = (strictReserve: boolean): Array<{ candidate: CandidateEntry; score: number }> => {
    const bestByCanonical = new Map<string, { candidate: CandidateEntry; score: number }>();

    for (const cand of pool) {
      if (ownedSet.has(cand.canonicalId)) continue;
      if (!isLegalForAiTeam(team, cand, settings, strictReserve)) continue;
      const sc = scoreCandidateForAiTeam(team, profile, cand, settings, roundNumber);
      const prev = bestByCanonical.get(cand.canonicalId);
      if (!prev || sc > prev.score) {
        bestByCanonical.set(cand.canonicalId, { candidate: cand, score: sc });
      }
    }

    return Array.from(bestByCanonical.values()).sort((a, b) => b.score - a.score);
  };

  let ranked = evaluate(true);
  if (ranked.length === 0) {
    ranked = evaluate(false);
  }
  if (ranked.length === 0) {
    return null;
  }

  // Competitive top-band selection: choose among candidates within 2.5 score points of #1 (max 4)
  const topScore = ranked[0].score;
  const band = ranked.slice(0, 4).filter((r) => topScore - r.score <= 2.5);
  if (band.length <= 1) {
    return ranked[0].candidate;
  }

  // Softmax-like weighting favoring #1 while keeping drafts lively and unpredictable
  const weights = band.map((entry, idx) => Math.max(0.2, 3.2 - idx * 0.7 - (topScore - entry.score) * 0.3));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * totalWeight;
  for (let i = 0; i < band.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return band[i].candidate;
    }
  }
  return band[0].candidate;
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Runs ONE AI draft cycle across all 10 AI franchises (one pick per AI team whose squad < squadSize).
 * Mutates nothing in place; returns updated LiveLeagueDraftState and the transactions made in this cycle.
 */
export function runAiDraftCycle(
  liveLeague: LiveLeagueDraftState,
  settings: DraftSettings,
  repo: PlayerRepository = getActivePlayerRepository(),
  rng: () => number = Math.random,
  roundNumberOverride?: number
): { liveLeague: LiveLeagueDraftState; transactions: DraftTransaction[] } {
  const ownedSet = new Set<string>(liveLeague.ownedPlayerIds);
  const playerOwners: Record<string, SeasonTeamId> = { ...liveLeague.playerOwners };
  const teams: Record<SeasonTeamId, LiveDraftTeamState> = { ...liveLeague.teams };
  const nextRound = roundNumberOverride ?? liveLeague.roundNumber;

  const pool = buildAiCandidatePool(repo, settings.seasonStart, settings.seasonEnd, ownedSet);
  const aiOrder = shuffleArray(AI_FRANCHISE_CODES, rng);
  const transactions: DraftTransaction[] = [];
  let totalPicks = liveLeague.totalPicks;

  for (const code of aiOrder) {
    const currentTeam = teams[code];
    if (!currentTeam || currentTeam.squad.length >= settings.squadSize) {
      continue;
    }

    const picked = pickBestCandidateForAiTeam(
      currentTeam,
      pool,
      ownedSet,
      settings,
      nextRound,
      rng
    );
    if (!picked) {
      continue;
    }

    const cid = picked.canonicalId;
    ownedSet.add(cid);
    playerOwners[cid] = code;
    totalPicks += 1;

    const nextSquad = [...currentTeam.squad, picked.player];
    const nextPurse = roundCr(currentTeam.remainingPurseCr - picked.draftCostCr);
    const nextOs = currentTeam.overseasCount + (picked.player.isOverseas === true ? 1 : 0);

    teams[code] = {
      ...currentTeam,
      squad: nextSquad,
      remainingPurseCr: nextPurse,
      overseasCount: nextOs,
    };

    transactions.push({
      pickNumber: totalPicks,
      roundNumber: nextRound,
      teamId: code,
      teamCode: currentTeam.code,
      teamName: currentTeam.name,
      playerId: picked.player.playerId,
      canonicalId: cid,
      playerName: picked.player.playerName || picked.player.name,
      role: picked.player.role,
      sourceFranchise: picked.player.franchise,
      sourceSeason: picked.player.season,
      salaryCr: picked.salaryCr,
    });
  }

  const nextFeed = [...liveLeague.feed, ...transactions].slice(-MAX_FEED_TRANSACTIONS);

  return {
    liveLeague: {
      ...liveLeague,
      teams,
      ownedPlayerIds: Array.from(ownedSet),
      playerOwners,
      feed: nextFeed,
      lastRoundTransactions: transactions,
      totalPicks,
      roundNumber: nextRound,
    },
    transactions,
  };
}

/**
 * Validates the completed 11-franchise league draft before advancing to Playing XI & Season.
 * Verifies:
 * - 11 teams
 * - squadSize (15) players each (165 assigned roster slots)
 * - 0 canonical player duplicates across all 11 squads
 * - all squad overseas limits valid (<= overseasSquadLimit)
 * - all budgets valid (>= 0)
 */
export function validateLeagueDraft(state: DraftState): LeagueDraftValidation {
  const errors: string[] = [];
  const live = state.liveLeague;
  const targetSize = state.settings.squadSize;
  const maxOs = state.settings.overseasSquadLimit;

  if (!live) {
    return {
      isValid: false,
      errors: ['Live 11-franchise draft state has not been initialized.'],
      totalTeams: 0,
      totalRosterSlots: 0,
      uniqueCanonicalPlayers: 0,
      duplicateCanonicalIds: [],
    };
  }

  const teamIds = live.teamOrder;
  if (teamIds.length !== 11) {
    errors.push(`Expected 11 franchises in league draft, found ${teamIds.length}.`);
  }

  const seenCanonicals = new Map<string, SeasonTeamId>();
  const duplicateCanonicalIds: string[] = [];
  let totalRosterSlots = 0;

  for (const teamId of teamIds) {
    const team = live.teams[teamId];
    if (!team) {
      errors.push(`Missing franchise roster for ${teamId}.`);
      continue;
    }

    totalRosterSlots += team.squad.length;

    if (team.squad.length !== targetSize) {
      errors.push(`${team.code} has ${team.squad.length}/${targetSize} players.`);
    }

    const actualOs = getOverseasCount(team.squad);
    if (actualOs > maxOs) {
      errors.push(`${team.code} exceeds overseas limit (${actualOs}/${maxOs}).`);
    }

    if (roundCr(team.remainingPurseCr) < 0) {
      errors.push(`${team.code} has a negative purse (₹${team.remainingPurseCr} Cr).`);
    }

    for (const player of team.squad) {
      const cid = getCanonicalDraftPlayerId(player);
      if (!cid) {
        errors.push(`${team.code} contains a player with an invalid canonical ID.`);
        continue;
      }
      const existingOwner = seenCanonicals.get(cid);
      if (existingOwner) {
        duplicateCanonicalIds.push(cid);
        errors.push(
          `Duplicate canonical player "${player.playerName}" (${cid}) owned by both ${existingOwner} and ${teamId}.`
        );
      } else {
        seenCanonicals.set(cid, teamId);
      }
    }
  }

  const expectedSlots = teamIds.length * targetSize;
  if (totalRosterSlots !== expectedSlots) {
    errors.push(`Expected ${expectedSlots} total roster slots, found ${totalRosterSlots}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalTeams: teamIds.length,
    totalRosterSlots,
    uniqueCanonicalPlayers: seenCanonicals.size,
    duplicateCanonicalIds: Array.from(new Set(duplicateCanonicalIds)),
  };
}

/**
 * Locks user retentions and immediately initializes the 11-franchise Live Draft.
 * If the user retained K players (1..4), all 10 AI franchises execute K opening rounds
 * so the league enters the Spin Draft synchronized at K/15 each with global ownership active.
 */
export function lockRetentionsWithLiveLeague(
  state: DraftState,
  repo: PlayerRepository = getActivePlayerRepository(),
  rng: () => number = Math.random
): DraftState {
  const lockedState = lockRetentionsAndStartSpin(state);
  if (!lockedState.retention.locked) {
    return state;
  }

  let liveLeague = createInitialLiveLeagueState(lockedState);
  const retainedCount = lockedState.squad.length;

  const openingTransactions: DraftTransaction[] = [...liveLeague.lastRoundTransactions];

  for (let round = 1; round <= retainedCount; round += 1) {
    const cycle = runAiDraftCycle(liveLeague, lockedState.settings, repo, rng, round);
    liveLeague = cycle.liveLeague;
    if (round === retainedCount) {
      // Keep last opening round visible in LIVE DRAFT activity summary
      liveLeague = {
        ...liveLeague,
        lastRoundTransactions: [
          ...openingTransactions.slice(Math.max(0, openingTransactions.length - 1)),
          ...cycle.transactions,
        ],
      };
    }
  }

  return {
    ...lockedState,
    liveLeague,
  };
}

/**
 * User signs 1 player from the spun historical squad, immediately claims global ownership,
 * and triggers 1 AI draft cycle across all 10 AI franchises.
 * When the user completes pick 15/15, ensures all AI franchises finish 15/15 and runs validateLeagueDraft().
 */
export function selectPlayerInLiveDraft(
  state: DraftState,
  player: PlayerSeasonRecord,
  repo: PlayerRepository = getActivePlayerRepository(),
  rng: () => number = Math.random
): DraftState {
  const synced = ensureLiveLeagueInitialized(state);
  const check = canSelectPlayer(synced, player);
  if (!check.allowed || !synced.liveLeague) {
    return state;
  }

  const live = synced.liveLeague;
  const legacyId = player.id ?? player.playerId;
  const canonicalId = getCanonicalDraftPlayerId(player);
  const playerCostCr = getPlayerDraftCostCr(player);
  const nextSquad = [...synced.squad, player];
  const nextPurse = roundCr(synced.remainingPurseCr - playerCostCr);
  const nextDraftedIds = [...synced.draftedPlayerIds, legacyId];
  const nextRound = nextSquad.length;
  const userPickNumber = live.totalPicks + 1;

  const userTeam = live.teams.YOU;
  const userTx: DraftTransaction = {
    pickNumber: userPickNumber,
    roundNumber: nextRound,
    teamId: 'YOU',
    teamCode: userTeam.code,
    teamName: userTeam.name,
    playerId: player.playerId,
    canonicalId,
    playerName: player.playerName || player.name,
    role: player.role,
    sourceFranchise: player.franchise,
    sourceSeason: player.season,
    salaryCr:
      isPlayerSalaryVerified(player)
        ? getPlayerSalaryCr(player)
        : (player.gamePriceCr ?? player.salary?.gamePriceCr ?? getPlayerSalaryCr(player)),
  };

  const ownedAfterUser = Array.from(new Set([...live.ownedPlayerIds, canonicalId]));
  const ownersAfterUser: Record<string, SeasonTeamId> = {
    ...live.playerOwners,
    [canonicalId]: 'YOU',
  };

  let updatedLive: LiveLeagueDraftState = {
    ...live,
    teams: {
      ...live.teams,
      YOU: {
        ...userTeam,
        squad: nextSquad,
        remainingPurseCr: nextPurse,
        overseasCount: getOverseasCount(nextSquad),
      },
    },
    ownedPlayerIds: ownedAfterUser,
    playerOwners: ownersAfterUser,
    feed: [...live.feed, userTx].slice(-MAX_FEED_TRANSACTIONS),
    lastRoundTransactions: [userTx],
    totalPicks: userPickNumber,
    roundNumber: nextRound,
  };

  // Run 1 AI draft cycle across all 10 AI franchises
  const cycle = runAiDraftCycle(updatedLive, synced.settings, repo, rng, nextRound);
  updatedLive = {
    ...cycle.liveLeague,
    lastRoundTransactions: [userTx, ...cycle.transactions],
  };

  const userReachedTarget = nextSquad.length >= synced.settings.squadSize;

  // If the user just completed pick 15/15, finish any AI teams that still need slots
  if (userReachedTarget) {
    let safetyRounds = synced.settings.squadSize + 2;
    while (
      safetyRounds > 0 &&
      AI_FRANCHISE_CODES.some((code) => updatedLive.teams[code].squad.length < synced.settings.squadSize)
    ) {
      safetyRounds -= 1;
      const extraCycle = runAiDraftCycle(updatedLive, synced.settings, repo, rng, nextRound);
      if (extraCycle.transactions.length === 0) break;
      updatedLive = {
        ...extraCycle.liveLeague,
        lastRoundTransactions: [...updatedLive.lastRoundTransactions, ...extraCycle.transactions],
      };
    }
  }

  let nextState: DraftState = {
    ...synced,
    squad: nextSquad,
    remainingPurseCr: nextPurse,
    draftedPlayerIds: nextDraftedIds,
    currentSpin: null,
    liveLeague: updatedLive,
    status: 'READY_TO_SPIN',
  };

  if (userReachedTarget) {
    const validation = validateLeagueDraft(nextState);
    nextState = {
      ...nextState,
      liveLeague: {
        ...updatedLive,
        validation,
      },
      status: validation.isValid ? 'COMPLETED' : 'READY_TO_SPIN',
    };
  }

  return nextState;
}

/**
 * Extracts the 10 AI-drafted 15-player squads from a completed Live Draft
 * so Season Engine uses the exact league squads drafted during the Live Draft.
 */
export function extractDraftedAiSquads(
  state: DraftState
): Partial<Record<FranchiseCode, PlayerSeasonRecord[]>> | undefined {
  if (!state.liveLeague) return undefined;
  const result: Partial<Record<FranchiseCode, PlayerSeasonRecord[]>> = {};
  let validCount = 0;

  for (const code of AI_FRANCHISE_CODES) {
    const team = state.liveLeague.teams[code];
    if (team && team.squad.length >= state.settings.squadSize) {
      result[code] = [...team.squad];
      validCount += 1;
    }
  }

  return validCount === AI_FRANCHISE_CODES.length ? result : undefined;
}
