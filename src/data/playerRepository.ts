import {
  RATING_MIN,
  buildAttributesForStoredRatings,
  clampRating,
  getRatingBand,
} from '../game/ratingEngine';
import { calculateStableGamePriceCr } from '../game/draftEngine';
import {
  buildCanonicalRoleNationalityLayer,
  buildRoleNationalityValidationReport,
  normalizeBowlingType,
  normalizeNationality,
  normalizeRole,
  resolveEffectiveSeasonRole,
  toPlayerOriginTypeFromCanonical,
  toPlayerRoleOrUnknown,
  type RawRoleNationalityObservation,
} from '../game/roleNationalityEngine';
import type {
  BowlingType,
  CanonicalPlayerRoleNationality,
  CanonicalPlayerSummary,
  CanonicalRole,
  DataQualityStatus,
  FranchiseCode,
  IplDatabaseJson,
  IplDatabasePlayerRaw,
  IplDatabaseTeamRaw,
  PlayerOriginType,
  PlayerRole,
  PlayerSeasonRecord,
  RatingStatus,
  RoleNationalityValidationReport,
  SalarySource,
} from '../types/game';
import { FRANCHISES, makeComboKey, resolveFranchiseCode } from './franchises';

export const IPL_DATABASE_URL = '/impact_player_database.json';

export interface DatabaseValidationReport {
  totalPlayerRecords: number;
  uniqueCanonicalPlayers: number;
  salaryValuesFound: number;
  verifiedSalariesFound: number;
  gameValuesFound: number;
  unknownSalaries: number;
  performanceRatingsFound: number;
  incompleteRecordsFound: number;
}

export interface SpinCombo {
  franchise: FranchiseCode;
  season: number;
  comboKey: string;
}

export interface PlayerRepository {
  getAvailableSpinCombos(seasonStart: number, seasonEnd: number): SpinCombo[];
  getSquad(franchise: FranchiseCode | string, season: number): PlayerSeasonRecord[];
  getPlayerSeasons(playerId: string): PlayerSeasonRecord[];
  getUniqueCanonicalPlayers(): CanonicalPlayerSummary[];
  getAllPlayerSeasonRecords(): PlayerSeasonRecord[];
  getCanonicalRoleNationality?(playerId: string): CanonicalPlayerRoleNationality | null;
  getRoleNationalityReport?(): RoleNationalityValidationReport;
}

function toPlayerRole(rawRole: unknown): PlayerRole {
  return toPlayerRoleOrUnknown(normalizeRole(rawRole));
}

export function isProvisionalStatus(status: unknown): boolean {
  const upper = String(status ?? '').toUpperCase();
  return upper.includes('PROVISIONAL') || upper.includes('INCOMPLETE');
}

function toRatingStatusFromQuality(qualityStatus: unknown, hasRatings: boolean): RatingStatus {
  if (!hasRatings) return 'PROVISIONAL';
  return isProvisionalStatus(qualityStatus) ? 'PROVISIONAL' : 'FINAL';
}

function toFiniteNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function extractCanonicalPlayerId(raw: IplDatabasePlayerRaw): string {
  const candidate = raw.playerId ?? raw.sourcePlayerId ?? raw.id;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function extractPlayerName(raw: IplDatabasePlayerRaw): string {
  const candidate = raw.playerName ?? raw.name;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function extractAliases(raw: IplDatabasePlayerRaw, primaryName: string): string[] {
  const seen = new Set<string>();
  const primaryLower = primaryName.trim().toLowerCase();
  const list: string[] = [];

  const pushAlias = (val: unknown) => {
    if (typeof val !== 'string') return;
    const clean = val.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (lower === primaryLower || seen.has(lower)) return;
    seen.add(lower);
    list.push(clean);
  };

  if (Array.isArray(raw.aliases)) {
    for (const a of raw.aliases) pushAlias(a);
  }
  pushAlias(raw.cricsheetName);
  pushAlias(raw.cricsheetUniqueName);

  return list;
}

function extractStoredRatings(raw: IplDatabasePlayerRaw): {
  bat: number;
  bowl: number;
  impact: number;
  overall: number;
} | null {
  // Primary: nested ratings object { bat, bowl, impact|imp, overall|ovr }
  if (raw.ratings && typeof raw.ratings === 'object') {
    const bat = toFiniteNumber(raw.ratings.bat);
    const bowl = toFiniteNumber(raw.ratings.bowl);
    const overall = toFiniteNumber(raw.ratings.overall ?? raw.ratings.ovr);
    const impact = toFiniteNumber(raw.ratings.impact ?? raw.ratings.imp);
    if (bat !== null && bowl !== null && overall !== null) {
      return {
        bat: clampRating(bat),
        bowl: clampRating(bowl),
        impact: clampRating(impact ?? overall),
        overall: clampRating(overall),
      };
    }
  }

  // Secondary: explicit flat database columns { bat, bowl, imp, ovr } (only when stored in JSON)
  const flatBat = toFiniteNumber(raw.bat);
  const flatBowl = toFiniteNumber(raw.bowl);
  const flatOvr = toFiniteNumber(raw.ovr);
  const flatImp = toFiniteNumber(raw.imp);
  if (flatBat !== null && flatBowl !== null && flatOvr !== null) {
    return {
      bat: clampRating(flatBat),
      bowl: clampRating(flatBowl),
      impact: clampRating(flatImp ?? flatOvr),
      overall: clampRating(flatOvr),
    };
  }

  return null;
}

function mapJsonPlayerRecord(
  raw: IplDatabasePlayerRaw,
  franchiseCode: FranchiseCode,
  teamName: string,
  season: number,
  canonicalMeta?: CanonicalPlayerRoleNationality
): PlayerSeasonRecord {
  const playerId = extractCanonicalPlayerId(raw);
  const playerName = extractPlayerName(raw);
  const aliases = extractAliases(raw, playerName);

  let isOverseas: boolean | null;
  let nationality: string | null;
  let nationalityStatus: DataQualityStatus;
  let role: PlayerRole;
  let primaryRole: CanonicalRole | null;
  let seasonRole: CanonicalRole | null;
  let roleStatus: DataQualityStatus;
  let bowlingType: BowlingType;

  if (canonicalMeta) {
    isOverseas = canonicalMeta.isOverseas;
    nationality = canonicalMeta.nationality;
    nationalityStatus = canonicalMeta.nationalityStatus;
    const resolvedRole = resolveEffectiveSeasonRole(canonicalMeta, season);
    role = resolvedRole.role;
    primaryRole = resolvedRole.primaryRole;
    seasonRole = resolvedRole.seasonRole;
    roleStatus = canonicalMeta.roleStatus;
    bowlingType =
      normalizeBowlingType(raw.bowlingType ?? raw.bowlingStyle) !== 'Unknown'
        ? normalizeBowlingType(raw.bowlingType ?? raw.bowlingStyle)
        : canonicalMeta.bowlingType;
  } else {
    const normNat = normalizeNationality({
      nationality: raw.nationality,
      isOverseas: raw.isOverseas,
      playerType: raw.playerType,
    });
    isOverseas = normNat.isOverseas;
    nationality = normNat.nationality;
    nationalityStatus = normNat.nationalityStatus;
    const normalized = normalizeRole(raw.seasonRole ?? raw.role ?? raw.primaryRole);
    primaryRole = normalized;
    seasonRole = null;
    role = toPlayerRole(normalized);
    roleStatus = normalized ? 'VERIFIED' : 'NEEDS_REVIEW';
    bowlingType = normalizeBowlingType(raw.bowlingType ?? raw.bowlingStyle);
  }

  const playerType = toPlayerOriginTypeFromCanonical(isOverseas);

  // Use ONLY ratings stored in the JSON database — never invent or fabricate ratings in React.
  const storedRatings = extractStoredRatings(raw);
  const hasRatings = storedRatings !== null;

  const qualityStatusStr =
    raw.ratingQuality &&
    typeof raw.ratingQuality.status === 'string' &&
    raw.ratingQuality.status.trim()
      ? raw.ratingQuality.status.trim()
      : typeof raw.ratingStatus === 'string' && raw.ratingStatus.trim()
        ? raw.ratingStatus.trim()
        : hasRatings
          ? 'VERIFIED_STATS_DERIVED'
          : 'INCOMPLETE_NO_PERFORMANCE_MATCH';
  const ratingStatus = toRatingStatusFromQuality(qualityStatusStr, hasRatings);

  // Salary / Contract Value — strictly separate verified historical contracts from gamePriceCr.
  // Never invent a real historical salary and never use a flat ₹8 Cr fallback.
  const rawSalaryObj = raw.salary && typeof raw.salary === 'object' ? raw.salary : null;
  const salaryCr: number | null = rawSalaryObj
    ? toFiniteNumber(rawSalaryObj.salaryCr)
    : raw.salaryVerified === true
      ? toFiniteNumber(raw.salaryCr)
      : null;

  const salaryVerified = rawSalaryObj
    ? Boolean(rawSalaryObj.verified) && salaryCr !== null
    : Boolean(raw.salaryVerified) && salaryCr !== null;

  const batStats = raw.stats?.batting ?? null;
  const bowlStats = raw.stats?.bowling ?? null;
  const matchesFromStats = Math.max(
    Number.isFinite(batStats?.innings) ? Number(batStats?.innings) : 0,
    Number.isFinite(bowlStats?.innings) ? Number(bowlStats?.innings) : 0
  );
  const matches =
    matchesFromStats > 0
      ? matchesFromStats
      : Number.isFinite(raw.matches)
        ? Number(raw.matches)
        : 0;

  const runs =
    toFiniteNumber(batStats?.runs_scored) ??
    toFiniteNumber(raw.runs) ??
    0;
  const wickets =
    toFiniteNumber(bowlStats?.total_wickets) ??
    toFiniteNumber(raw.wickets) ??
    0;

  const battingRating = storedRatings ? storedRatings.bat : 0;
  const bowlingRating = storedRatings ? storedRatings.bowl : 0;
  const impactRating = storedRatings ? storedRatings.impact : 0;
  const overallRating = storedRatings ? storedRatings.overall : 0;

  const explicitGamePriceCr: number | null =
    toFiniteNumber(raw.gamePriceCr) ??
    (rawSalaryObj ? toFiniteNumber(rawSalaryObj.gamePriceCr) : null);

  const gamePriceCr: number | null =
    salaryVerified && salaryCr !== null
      ? explicitGamePriceCr
      : explicitGamePriceCr ??
        calculateStableGamePriceCr({
          hasRatings,
          battingRating,
          bowlingRating,
          impactRating,
          overallRating,
          runs,
          wickets,
          matches,
          role,
          isOverseas,
        });

  let salarySource: SalarySource;
  if (salaryVerified && salaryCr !== null) {
    salarySource = 'REAL_CONTRACT';
  } else if (gamePriceCr !== null) {
    salarySource = 'GAME_VALUE';
  } else if (salaryCr !== null) {
    salarySource = 'REPORTED';
  } else {
    salarySource = 'UNAVAILABLE';
  }

  const salaryType =
    rawSalaryObj && typeof rawSalaryObj.type === 'string' && rawSalaryObj.type.trim()
      ? rawSalaryObj.type.trim()
      : salarySource === 'REAL_CONTRACT'
        ? 'CONTRACT'
        : salarySource === 'GAME_VALUE'
          ? 'GAME_VALUE'
          : 'UNKNOWN';

  const salaryStatus =
    rawSalaryObj && typeof rawSalaryObj.status === 'string' && rawSalaryObj.status.trim()
      ? rawSalaryObj.status.trim()
      : salarySource === 'REAL_CONTRACT'
        ? 'verified'
        : salarySource === 'GAME_VALUE'
          ? 'game_value'
          : salarySource === 'REPORTED'
            ? 'reported'
            : 'unknown';

  // Engine sub-attributes anchored to the stored database ratings (or safe baseline if unrated),
  // never mutating the stored BAT/BOWL/IMP/OVR numbers.
  const attributes = buildAttributesForStoredRatings({
    playerId,
    season,
    franchise: franchiseCode,
    role,
    battingRating: storedRatings ? storedRatings.bat : RATING_MIN,
    bowlingRating: storedRatings ? storedRatings.bowl : RATING_MIN,
    impactRating: storedRatings ? storedRatings.impact : RATING_MIN,
    overallRating: storedRatings ? storedRatings.overall : RATING_MIN,
    rawAttributes: raw.attributes,
  });

  const isIncomplete = Boolean(
    raw.dataIncomplete ||
      !hasRatings ||
      !salaryVerified ||
      salaryCr === null ||
      role === 'UNKNOWN' ||
      isOverseas === null ||
      (raw.identityStatus && raw.identityStatus !== 'RESOLVED')
  );

  const effectiveDraftCostCr =
    salarySource === 'REAL_CONTRACT'
      ? (salaryCr ?? 0)
      : salarySource === 'GAME_VALUE'
        ? (gamePriceCr ?? 0)
        : salarySource === 'REPORTED'
          ? (salaryCr ?? 0)
          : 0;

  return {
    id: playerId,
    name: playerName,
    playerId,
    playerName,
    aliases,
    cricsheetId: raw.cricsheetId ?? null,
    identityStatus: raw.identityStatus,
    season,
    franchise: franchiseCode,
    teamName: raw.teamName || teamName || FRANCHISES[franchiseCode]?.name || franchiseCode,
    nationality,
    nationalityStatus,
    playerType,
    isOverseas,
    role,
    primaryRole,
    seasonRole,
    roleStatus,
    battingStyle:
      typeof raw.battingStyle === 'string' && raw.battingStyle.trim()
        ? raw.battingStyle.trim()
        : 'Right-hand bat',
    bowlingStyle:
      typeof raw.bowlingStyle === 'string' && raw.bowlingStyle.trim()
        ? raw.bowlingStyle.trim()
        : 'None',
    bowlingType,
    matches,
    runs,
    battingAverage:
      toFiniteNumber(batStats?.batting_average) ??
      toFiniteNumber(raw.battingAverage) ??
      0,
    strikeRate:
      toFiniteNumber(batStats?.batting_strike_rate) ??
      toFiniteNumber(raw.strikeRate) ??
      0,
    wickets,
    economy:
      toFiniteNumber(bowlStats?.economy_rate) ??
      toFiniteNumber(raw.economy) ??
      0,
    hasRatings,
    isIncomplete,
    ratings: storedRatings,
    salaryCr,
    gamePriceCr,
    salarySource,
    salaryType,
    salaryVerified,
    salaryStatus,
    salary: {
      salaryCr,
      gamePriceCr,
      verified: salaryVerified,
      type: salaryType,
      status: salaryStatus,
      sourceIds: rawSalaryObj?.sourceIds,
      valueBasis: rawSalaryObj?.valueBasis,
    },
    ratingQuality: {
      status: qualityStatusStr,
      battingReliability: raw.ratingQuality?.battingReliability,
      bowlingReliability: raw.ratingQuality?.bowlingReliability,
    },
    battingRating,
    bowlingRating,
    impactRating,
    overallRating,
    ratingBand: getRatingBand(storedRatings ? storedRatings.overall : RATING_MIN),
    form: 'NORMAL',
    attributes,
    priceCr: effectiveDraftCostCr,
    ratingStatus,
  };
}

function validateRawPlayerRecord(
  p: unknown,
  contextLabel: string
): IplDatabasePlayerRaw {
  if (!p || typeof p !== 'object') {
    throw new Error(`PLAYER DATABASE FAILED TO LOAD: Invalid player record in ${contextLabel}.`);
  }
  const rec = p as IplDatabasePlayerRaw;
  const pid = extractCanonicalPlayerId(rec);
  const name = extractPlayerName(rec);
  if (!pid || !name) {
    throw new Error(
      `PLAYER DATABASE FAILED TO LOAD: Missing playerId or playerName in ${contextLabel}.`
    );
  }

  if (
    rec.salary !== undefined &&
    rec.salary !== null &&
    (typeof rec.salary !== 'object' ||
      (rec.salary.salaryCr !== null &&
        rec.salary.salaryCr !== undefined &&
        !(typeof rec.salary.salaryCr === 'number' && Number.isFinite(rec.salary.salaryCr))))
  ) {
    throw new Error(
      `PLAYER DATABASE FAILED TO LOAD: Invalid salary record in ${contextLabel} (${pid}).`
    );
  }

  return rec;
}

function normalizeFlatRecordsToSeasons(
  records: unknown[]
): Record<string, Record<string, IplDatabaseTeamRaw>> {
  const seasons: Record<string, Record<string, IplDatabaseTeamRaw>> = {};

  for (let i = 0; i < records.length; i += 1) {
    const rec = validateRawPlayerRecord(records[i], `record[${i}]`);
    const seasonNum = Number(rec.season);
    const franchiseCode = resolveFranchiseCode(rec.franchise);
    if (!Number.isFinite(seasonNum) || !franchiseCode) {
      throw new Error(
        `PLAYER DATABASE FAILED TO LOAD: Invalid franchise or season in record[${i}] (${extractCanonicalPlayerId(rec)}).`
      );
    }

    const seasonKey = String(seasonNum);
    if (!seasons[seasonKey]) {
      seasons[seasonKey] = {};
    }
    if (!seasons[seasonKey][franchiseCode]) {
      seasons[seasonKey][franchiseCode] = {
        teamName: rec.teamName || FRANCHISES[franchiseCode]?.name || franchiseCode,
        players: [],
      };
    }
    seasons[seasonKey][franchiseCode].players.push(rec);
  }

  return seasons;
}

export function parseIplDatabase(raw: unknown): IplDatabaseJson {
  if (!raw || typeof raw !== 'object') {
    throw new Error('PLAYER DATABASE FAILED TO LOAD: Invalid JSON root.');
  }

  // Support flat root array format
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error('PLAYER DATABASE FAILED TO LOAD: Database contains no player records.');
    }
    return {
      seasons: normalizeFlatRecordsToSeasons(raw),
    };
  }

  const root = raw as Record<string, unknown>;

  // Support flat wrapped arrays: { players: [...] } | { records: [...] } | { memberships: [...] } | { playerSeasons: [...] }
  const flatArray = Array.isArray(root.players)
    ? root.players
    : Array.isArray(root.records)
      ? root.records
      : Array.isArray(root.playerSeasons)
        ? root.playerSeasons
        : Array.isArray(root.memberships)
          ? root.memberships
          : null;

  if (!root.seasons && flatArray) {
    if (flatArray.length === 0) {
      throw new Error('PLAYER DATABASE FAILED TO LOAD: Database contains no player records.');
    }
    return {
      meta: (root.meta as IplDatabaseJson['meta']) ?? undefined,
      gameDefaults: (root.gameDefaults as IplDatabaseJson['gameDefaults']) ?? undefined,
      seasons: normalizeFlatRecordsToSeasons(flatArray),
    };
  }

  const candidate = raw as Partial<IplDatabaseJson>;
  if (!candidate.seasons || typeof candidate.seasons !== 'object') {
    throw new Error('PLAYER DATABASE FAILED TO LOAD: Missing seasons or records collection.');
  }

  let comboCount = 0;
  for (const [seasonKey, teamsMap] of Object.entries(candidate.seasons)) {
    if (!Number.isFinite(Number(seasonKey)) || !teamsMap || typeof teamsMap !== 'object') {
      throw new Error(`PLAYER DATABASE FAILED TO LOAD: Invalid season entry "${seasonKey}".`);
    }
    for (const [franchiseKey, teamData] of Object.entries(teamsMap)) {
      if (!teamData || typeof teamData !== 'object' || !Array.isArray(teamData.players)) {
        throw new Error(
          `PLAYER DATABASE FAILED TO LOAD: Invalid players array for ${franchiseKey} ${seasonKey}.`
        );
      }
      for (const p of teamData.players) {
        validateRawPlayerRecord(p, `${franchiseKey} ${seasonKey}`);
      }
      comboCount += 1;
    }
  }

  if (comboCount === 0) {
    throw new Error('PLAYER DATABASE FAILED TO LOAD: Database contains no franchise-seasons.');
  }

  return candidate as IplDatabaseJson;
}

function makeSeasonKey(rec: PlayerSeasonRecord): string {
  return `${rec.franchise}-${rec.season}`;
}

export class JsonIplRepository implements PlayerRepository {
  private readonly combos: SpinCombo[];
  private readonly byFranchiseSeason: Map<string, PlayerSeasonRecord[]>;
  private readonly byPlayerId: Map<string, PlayerSeasonRecord[]>;
  private readonly uniqueCanonicalPlayers: CanonicalPlayerSummary[];
  private readonly allRecords: PlayerSeasonRecord[];
  private readonly canonicalRoleNationality: Record<string, CanonicalPlayerRoleNationality>;
  private readonly roleNationalityReport: RoleNationalityValidationReport;

  constructor(database: IplDatabaseJson) {
    const comboList: SpinCombo[] = [];
    const byCombo = new Map<string, PlayerSeasonRecord[]>();
    const byPid = new Map<string, PlayerSeasonRecord[]>();
    const flatAll: PlayerSeasonRecord[] = [];

    const sortedSeasons = Object.keys(database.seasons)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    // Pass 1: Build canonical Role + Nationality/Overseas layer across all seasons of each canonical playerId
    const observations: RawRoleNationalityObservation[] = [];
    for (const season of sortedSeasons) {
      const seasonTeams = database.seasons[String(season)];
      if (!seasonTeams) continue;

      for (const franchiseKey of Object.keys(seasonTeams).sort()) {
        const code = resolveFranchiseCode(franchiseKey);
        const team = seasonTeams[franchiseKey];
        if (!code || !team || !Array.isArray(team.players) || team.players.length === 0) {
          continue;
        }
        for (const rawPlayer of team.players) {
          const pid = extractCanonicalPlayerId(rawPlayer);
          if (!pid) continue;
          observations.push({
            playerId: pid,
            season,
            role: rawPlayer.role,
            primaryRole: rawPlayer.primaryRole,
            seasonRole: rawPlayer.seasonRole,
            roleStatus: rawPlayer.roleStatus,
            nationality: rawPlayer.nationality,
            nationalityStatus: rawPlayer.nationalityStatus,
            isOverseas: rawPlayer.isOverseas,
            playerType: rawPlayer.playerType,
            bowlingStyle: rawPlayer.bowlingStyle,
            bowlingType: rawPlayer.bowlingType,
          });
        }
      }
    }

    const canonicalRoleNationality = buildCanonicalRoleNationalityLayer(
      observations,
      database.canonicalPlayers
    );
    const roleNationalityReport = buildRoleNationalityValidationReport(canonicalRoleNationality);

    // Pass 2: Map EVERY player stored for each exact franchise-season using canonical Role + Nationality
    for (const season of sortedSeasons) {
      const seasonTeams = database.seasons[String(season)];
      if (!seasonTeams) continue;

      for (const franchiseKey of Object.keys(seasonTeams).sort()) {
        const code = resolveFranchiseCode(franchiseKey);
        const team = seasonTeams[franchiseKey];
        if (!code || !team || !Array.isArray(team.players) || team.players.length === 0) {
          continue;
        }

        const comboKey = makeComboKey(code, season);
        // Map EVERY player stored for this exact franchise-season (zero slicing or subsets)
        const squadRecords = team.players.map((rawPlayer) => {
          const pid = extractCanonicalPlayerId(rawPlayer);
          return mapJsonPlayerRecord(
            rawPlayer,
            code,
            team.teamName,
            season,
            canonicalRoleNationality[pid]
          );
        });

        comboList.push({ franchise: code, season, comboKey });
        byCombo.set(comboKey, squadRecords);

        for (const rec of squadRecords) {
          flatAll.push(rec);
          const list = byPid.get(rec.playerId);
          if (list) {
            list.push(rec);
          } else {
            byPid.set(rec.playerId, [rec]);
          }
        }
      }
    }

    // Build pre-indexed unique canonical player summaries for instant Retention & global lookup
    const canonicalList: CanonicalPlayerSummary[] = [];
    for (const [playerId, seasonRecords] of byPid.entries()) {
      const sortedSeasonsForPlayer = [...seasonRecords].sort((a, b) => {
        const aHas = a.hasRatings ? 1 : 0;
        const bHas = b.hasRatings ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        if (b.overallRating !== a.overallRating) return b.overallRating - a.overallRating;
        if (b.impactRating !== a.impactRating) return b.impactRating - a.impactRating;
        return b.season - a.season;
      });
      byPid.set(playerId, sortedSeasonsForPlayer);

      const best = sortedSeasonsForPlayer[0];
      const canonical = canonicalRoleNationality[playerId];
      const aliasSet = new Set<string>();
      for (const rec of sortedSeasonsForPlayer) {
        for (const a of rec.aliases ?? []) {
          if (a && a.toLowerCase() !== best.playerName.toLowerCase()) {
            aliasSet.add(a);
          }
        }
      }

      canonicalList.push({
        playerId,
        playerName: best.playerName,
        aliases: Array.from(aliasSet),
        role: canonical ? toPlayerRoleOrUnknown(canonical.primaryRole) : best.role,
        primaryRole: canonical?.primaryRole ?? null,
        roleStatus: canonical?.roleStatus ?? 'NEEDS_REVIEW',
        bowlingStyle: best.bowlingStyle,
        bowlingType: canonical?.bowlingType ?? 'Unknown',
        nationality: canonical?.nationality ?? null,
        nationalityStatus: canonical?.nationalityStatus ?? 'NEEDS_REVIEW',
        isOverseas: canonical ? canonical.isOverseas : best.isOverseas,
        hasRatings: Boolean(best.hasRatings),
        bestOvr: best.overallRating,
        bestImp: best.impactRating,
        bestSeasonKey: makeSeasonKey(best),
        bestRecord: best,
        seasons: sortedSeasonsForPlayer,
      });
    }

    canonicalList.sort((a, b) => {
      const aHas = a.hasRatings ? 1 : 0;
      const bHas = b.hasRatings ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return (
        b.bestOvr - a.bestOvr ||
        b.bestImp - a.bestImp ||
        a.playerName.localeCompare(b.playerName)
      );
    });

    this.combos = comboList;
    this.byFranchiseSeason = byCombo;
    this.byPlayerId = byPid;
    this.uniqueCanonicalPlayers = canonicalList;
    this.allRecords = flatAll;
    this.canonicalRoleNationality = canonicalRoleNationality;
    this.roleNationalityReport = roleNationalityReport;
  }

  getAvailableSpinCombos(seasonStart: number, seasonEnd: number): SpinCombo[] {
    return this.combos.filter(
      (combo) => combo.season >= seasonStart && combo.season <= seasonEnd
    );
  }

  getSquad(franchiseInput: FranchiseCode | string, season: number): PlayerSeasonRecord[] {
    const code = resolveFranchiseCode(franchiseInput);
    if (!code) return [];
    const squad = this.byFranchiseSeason.get(makeComboKey(code, season));
    // Return EVERY player stored for that exact franchise-season (zero slicing or subsets)
    return squad ? [...squad] : [];
  }

  getPlayerSeasons(playerId: string): PlayerSeasonRecord[] {
    const records = this.byPlayerId.get(playerId);
    return records ? [...records] : [];
  }

  getUniqueCanonicalPlayers(): CanonicalPlayerSummary[] {
    return this.uniqueCanonicalPlayers;
  }

  getAllPlayerSeasonRecords(): PlayerSeasonRecord[] {
    return this.allRecords;
  }

  getCanonicalRoleNationality(playerId: string): CanonicalPlayerRoleNationality | null {
    return this.canonicalRoleNationality[playerId] ?? null;
  }

  getRoleNationalityReport(): RoleNationalityValidationReport {
    return this.roleNationalityReport;
  }
}

let activeRepository: PlayerRepository | null = null;
let lastValidationReport: DatabaseValidationReport | null = null;
let cachedLoadUrl: string | null = null;
let inflightLoadPromise: Promise<PlayerRepository> | null = null;

export function setActivePlayerRepository(repo: PlayerRepository | null): void {
  activeRepository = repo;
  if (repo === null) {
    cachedLoadUrl = null;
    inflightLoadPromise = null;
  }
}

export function getActivePlayerRepository(): PlayerRepository {
  if (!activeRepository) {
    throw new Error('PLAYER DATABASE FAILED TO LOAD');
  }
  return activeRepository;
}

export function getLastDatabaseValidationReport(): DatabaseValidationReport | null {
  return lastValidationReport;
}

export function getSquad(
  franchise: FranchiseCode | string,
  season: number
): PlayerSeasonRecord[] {
  return getActivePlayerRepository().getSquad(franchise, season);
}

export function buildDatabaseValidationReport(repo: PlayerRepository): DatabaseValidationReport {
  const records = repo.getAllPlayerSeasonRecords();
  const uniqueCanonicalPlayers = repo.getUniqueCanonicalPlayers().length;
  let salaryValuesFound = 0;
  let verifiedSalariesFound = 0;
  let gameValuesFound = 0;
  let unknownSalaries = 0;
  let performanceRatingsFound = 0;
  let incompleteRecordsFound = 0;

  for (const record of records) {
    if (record.salarySource === 'REAL_CONTRACT') {
      salaryValuesFound += 1;
      verifiedSalariesFound += 1;
    } else if (record.salarySource === 'GAME_VALUE') {
      gameValuesFound += 1;
      if (record.salaryCr === null) {
        unknownSalaries += 1;
      }
    } else if (record.salarySource === 'REPORTED') {
      salaryValuesFound += 1;
    } else {
      unknownSalaries += 1;
    }

    if (record.hasRatings) {
      performanceRatingsFound += 1;
    }
    if (record.isIncomplete) {
      incompleteRecordsFound += 1;
    }
  }

  return {
    totalPlayerRecords: records.length,
    uniqueCanonicalPlayers,
    salaryValuesFound,
    verifiedSalariesFound,
    gameValuesFound,
    unknownSalaries,
    performanceRatingsFound,
    incompleteRecordsFound,
  };
}

export function validateAndReportLoadedDatabase(
  repo: PlayerRepository,
  _rawJson?: unknown,
  options: { logReport?: boolean } = {}
): DatabaseValidationReport {
  const report = buildDatabaseValidationReport(repo);
  lastValidationReport = report;

  const isDevEnv =
    typeof import.meta !== 'undefined' &&
    Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  const shouldLog = options.logReport ?? isDevEnv;

  if (shouldLog) {
    const rnReport = repo.getRoleNationalityReport?.();
    const lines = [
      '[IMPACT PLAYER MASTER DATABASE REPORT]',
      `TOTAL PLAYER-SEASON RECORDS: ${report.totalPlayerRecords}`,
      `UNIQUE CANONICAL PLAYERS: ${report.uniqueCanonicalPlayers}`,
      `REAL CONTRACTS FOUND: ${report.verifiedSalariesFound}`,
      `GAME VALUES FOUND: ${report.gameValuesFound}`,
      `UNAVAILABLE SALARIES: ${report.unknownSalaries}`,
      `STORED RATINGS FOUND: ${report.performanceRatingsFound}`,
      `INCOMPLETE RECORDS: ${report.incompleteRecordsFound}`,
    ];
    if (rnReport) {
      lines.push(
        `ROLE VERIFIED: ${rnReport.roleVerified} | INFERRED: ${rnReport.roleInferred} | NEEDS REVIEW: ${rnReport.roleNeedsReview}`,
        `NATIONALITY VERIFIED: ${rnReport.nationalityVerified} | NEEDS REVIEW: ${rnReport.nationalityNeedsReview}`,
        `INDIAN PLAYERS: ${rnReport.indianPlayers} | OVERSEAS PLAYERS: ${rnReport.overseasPlayers} | UNKNOWN ORIGIN: ${rnReport.unknownOriginPlayers}`
      );
    }
    console.info(lines.join('\n'));
  }

  return report;
}

export async function loadIplDatabase(
  url: string = IPL_DATABASE_URL,
  options: { forceReload?: boolean } = {}
): Promise<PlayerRepository> {
  if (!options.forceReload) {
    if (activeRepository && cachedLoadUrl === url) {
      return activeRepository;
    }
    if (inflightLoadPromise && cachedLoadUrl === url) {
      return inflightLoadPromise;
    }
  }

  cachedLoadUrl = url;
  inflightLoadPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`PLAYER DATABASE FAILED TO LOAD (HTTP ${response.status})`);
      }

      const rawJson: unknown = await response.json();
      const parsed = parseIplDatabase(rawJson);
      const repo = new JsonIplRepository(parsed);
      validateAndReportLoadedDatabase(repo, rawJson);
      activeRepository = repo;
      return repo;
    } catch (err) {
      inflightLoadPromise = null;
      cachedLoadUrl = null;
      if (err instanceof Error && err.message.includes('PLAYER DATABASE FAILED TO LOAD')) {
        throw err;
      }
      throw new Error(
        `PLAYER DATABASE FAILED TO LOAD: ${err instanceof Error ? err.message : 'Unable to parse JSON.'}`
      );
    }
  })();

  return inflightLoadPromise;
}

export function getFranchiseMeta(code: FranchiseCode) {
  return FRANCHISES[code];
}
