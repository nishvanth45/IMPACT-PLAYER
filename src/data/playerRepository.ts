import { resolvePlayerRatings } from '../game/ratingEngine';
import type {
  FranchiseCode,
  IplDatabaseJson,
  IplDatabasePlayerRaw,
  PlayerOriginType,
  PlayerRole,
  PlayerSeasonRecord,
  RatingStatus,
} from '../types/game';
import { FRANCHISES, makeComboKey, resolveFranchiseCode } from './franchises';

export const IPL_DATABASE_URL = '/assets/aistudio/ipl_database_final_ba929b5d.json';

export interface SpinCombo {
  franchise: FranchiseCode;
  season: number;
  comboKey: string;
}

export interface PlayerRepository {
  getAvailableSpinCombos(seasonStart: number, seasonEnd: number): SpinCombo[];
  getSquad(franchise: FranchiseCode | string, season: number): PlayerSeasonRecord[];
  getAllPlayerSeasonRecords(): PlayerSeasonRecord[];
}

function toPlayerRole(rawRole: unknown): PlayerRole {
  const upper = String(rawRole ?? '').trim().toUpperCase();
  if (upper === 'BAT' || upper === 'BOWL' || upper === 'AR' || upper === 'WK') {
    return upper;
  }
  return 'UNKNOWN';
}

function toPlayerOriginType(rawType: unknown, isOverseas: boolean | null): PlayerOriginType {
  if (rawType === 'Domestic' || rawType === 'Overseas' || rawType === 'Unknown') {
    return rawType;
  }
  if (isOverseas === true) return 'Overseas';
  if (isOverseas === false) return 'Domestic';
  return 'Unknown';
}

function toRatingStatus(rawStatus: unknown): RatingStatus {
  return rawStatus === 'FINAL' ? 'FINAL' : 'PROVISIONAL';
}

function mapJsonPlayerRecord(
  raw: IplDatabasePlayerRaw,
  franchiseCode: FranchiseCode,
  teamName: string,
  season: number
): PlayerSeasonRecord {
  const isOverseas: boolean | null =
    typeof raw.isOverseas === 'boolean' ? raw.isOverseas : null;
  const role = toPlayerRole(raw.role);
  const playerType = toPlayerOriginType(raw.playerType, isOverseas);
  const nationality =
    isOverseas === true ? 'Overseas' : isOverseas === false ? 'India' : 'Unknown';

  const matches = Number.isFinite(raw.matches) ? raw.matches : 0;
  const ratingStatus = toRatingStatus(raw.ratingStatus);
  const resolved = resolvePlayerRatings({
    playerId: raw.id,
    season,
    franchise: franchiseCode,
    role,
    matches,
    priceCr: raw.priceCr,
    ratingStatus,
    rawBattingRating: raw.battingRating,
    rawBowlingRating: raw.bowlingRating,
    rawImpactRating: raw.impactRating,
    rawOverallRating: raw.overallRating,
    rawAttributes: raw.attributes,
  });

  return {
    id: raw.id,
    name: raw.name,
    playerId: raw.id,
    playerName: raw.name,
    season,
    franchise: franchiseCode,
    teamName: raw.teamName || teamName,
    nationality,
    playerType,
    isOverseas,
    role,
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'None',
    matches,
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
    priceCr: raw.priceCr,
    ratingStatus,
  };
}

export function parseIplDatabase(raw: unknown): IplDatabaseJson {
  if (!raw || typeof raw !== 'object') {
    throw new Error('IPL DATABASE FAILED TO LOAD: Invalid JSON root.');
  }

  const candidate = raw as Partial<IplDatabaseJson>;
  if (!candidate.seasons || typeof candidate.seasons !== 'object') {
    throw new Error('IPL DATABASE FAILED TO LOAD: Missing seasons map.');
  }

  let comboCount = 0;
  for (const [seasonKey, teamsMap] of Object.entries(candidate.seasons)) {
    if (!Number.isFinite(Number(seasonKey)) || !teamsMap || typeof teamsMap !== 'object') {
      throw new Error(`IPL DATABASE FAILED TO LOAD: Invalid season entry "${seasonKey}".`);
    }
    for (const [franchiseKey, teamData] of Object.entries(teamsMap)) {
      if (!teamData || typeof teamData !== 'object' || !Array.isArray(teamData.players)) {
        throw new Error(
          `IPL DATABASE FAILED TO LOAD: Invalid players array for ${franchiseKey} ${seasonKey}.`
        );
      }
      for (const p of teamData.players) {
        if (
          !p ||
          typeof p !== 'object' ||
          typeof p.id !== 'string' ||
          typeof p.name !== 'string' ||
          !Number.isFinite(p.battingRating) ||
          !Number.isFinite(p.bowlingRating) ||
          !Number.isFinite(p.overallRating) ||
          !Number.isFinite(p.priceCr)
        ) {
          throw new Error(
            `IPL DATABASE FAILED TO LOAD: Invalid player record in ${franchiseKey} ${seasonKey}.`
          );
        }
      }
      comboCount += 1;
    }
  }

  if (comboCount === 0) {
    throw new Error('IPL DATABASE FAILED TO LOAD: Database contains no franchise-seasons.');
  }

  return candidate as IplDatabaseJson;
}

export class JsonIplRepository implements PlayerRepository {
  private readonly database: IplDatabaseJson;
  private readonly combos: SpinCombo[];

  constructor(database: IplDatabaseJson) {
    this.database = database;
    const list: SpinCombo[] = [];

    const sortedSeasons = Object.keys(database.seasons)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    for (const season of sortedSeasons) {
      const seasonTeams = database.seasons[String(season)];
      if (!seasonTeams) continue;

      for (const franchiseKey of Object.keys(seasonTeams).sort()) {
        const code = resolveFranchiseCode(franchiseKey);
        const team = seasonTeams[franchiseKey];
        if (!code || !team || !Array.isArray(team.players) || team.players.length === 0) {
          continue;
        }
        list.push({
          franchise: code,
          season,
          comboKey: makeComboKey(code, season),
        });
      }
    }

    this.combos = list;
  }

  getAvailableSpinCombos(seasonStart: number, seasonEnd: number): SpinCombo[] {
    return this.combos.filter(
      (combo) => combo.season >= seasonStart && combo.season <= seasonEnd
    );
  }

  getSquad(franchiseInput: FranchiseCode | string, season: number): PlayerSeasonRecord[] {
    const code = resolveFranchiseCode(franchiseInput);
    if (!code) {
      return [];
    }

    const seasonEntry = this.database.seasons[String(season)];
    if (!seasonEntry) {
      return [];
    }

    const teamEntry = seasonEntry[code];
    if (!teamEntry || !Array.isArray(teamEntry.players)) {
      return [];
    }

    // Return EVERY player stored for that exact franchise-season (zero slicing or subsets)
    return teamEntry.players.map((rawPlayer) =>
      mapJsonPlayerRecord(rawPlayer, code, teamEntry.teamName, season)
    );
  }

  getAllPlayerSeasonRecords(): PlayerSeasonRecord[] {
    const all: PlayerSeasonRecord[] = [];
    for (const combo of this.combos) {
      all.push(...this.getSquad(combo.franchise, combo.season));
    }
    return all;
  }
}

let activeRepository: PlayerRepository | null = null;

export function setActivePlayerRepository(repo: PlayerRepository | null): void {
  activeRepository = repo;
}

export function getActivePlayerRepository(): PlayerRepository {
  if (!activeRepository) {
    throw new Error('IPL DATABASE FAILED TO LOAD');
  }
  return activeRepository;
}

export function getSquad(
  franchise: FranchiseCode | string,
  season: number
): PlayerSeasonRecord[] {
  return getActivePlayerRepository().getSquad(franchise, season);
}

export async function loadIplDatabase(url: string = IPL_DATABASE_URL): Promise<PlayerRepository> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`IPL DATABASE FAILED TO LOAD (HTTP ${response.status})`);
  }

  const rawJson: unknown = await response.json();
  const parsed = parseIplDatabase(rawJson);
  const repo = new JsonIplRepository(parsed);
  setActivePlayerRepository(repo);
  return repo;
}

export function getFranchiseMeta(code: FranchiseCode) {
  return FRANCHISES[code];
}
