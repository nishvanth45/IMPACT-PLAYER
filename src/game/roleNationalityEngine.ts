import type {
  BowlingType,
  CanonicalPlayerRoleNationality,
  CanonicalRole,
  DataQualityStatus,
  PlayerOriginType,
  PlayerRole,
  RoleNationalityValidationReport,
} from '../types/game';

export interface RawRoleNationalityObservation {
  playerId: string;
  season: number;
  role?: unknown;
  primaryRole?: unknown;
  seasonRole?: unknown;
  roleStatus?: unknown;
  nationality?: unknown;
  nationalityStatus?: unknown;
  isOverseas?: unknown;
  playerType?: unknown;
  bowlingStyle?: unknown;
  bowlingType?: unknown;
}

export interface NormalizedNationalityResult {
  nationality: string | null;
  isOverseas: boolean | null;
  nationalityStatus: DataQualityStatus;
}

const VALID_QUALITY_STATUSES = new Set<DataQualityStatus>([
  'VERIFIED',
  'INFERRED',
  'NEEDS_REVIEW',
]);

const CRICKET_COUNTRY_ALIASES: Record<string, string> = {
  india: 'India',
  indian: 'India',
  ind: 'India',
  australia: 'Australia',
  australian: 'Australia',
  aus: 'Australia',
  england: 'England',
  english: 'England',
  eng: 'England',
  'united kingdom': 'England',
  uk: 'England',
  'south africa': 'South Africa',
  'south african': 'South Africa',
  sa: 'South Africa',
  rsa: 'South Africa',
  'west indies': 'West Indies',
  'west indian': 'West Indies',
  wi: 'West Indies',
  windies: 'West Indies',
  'trinidad and tobago': 'West Indies',
  jamaica: 'West Indies',
  barbados: 'West Indies',
  guyana: 'West Indies',
  'new zealand': 'New Zealand',
  'new zealander': 'New Zealand',
  nz: 'New Zealand',
  'sri lanka': 'Sri Lanka',
  'sri lankan': 'Sri Lanka',
  sl: 'Sri Lanka',
  afghanistan: 'Afghanistan',
  afghan: 'Afghanistan',
  afg: 'Afghanistan',
  bangladesh: 'Bangladesh',
  bangladeshi: 'Bangladesh',
  ban: 'Bangladesh',
  zimbabwe: 'Zimbabwe',
  zimbabwean: 'Zimbabwe',
  zim: 'Zimbabwe',
  ireland: 'Ireland',
  irish: 'Ireland',
  ire: 'Ireland',
  netherlands: 'Netherlands',
  dutch: 'Netherlands',
  holland: 'Netherlands',
  ned: 'Netherlands',
  scotland: 'Scotland',
  scottish: 'Scotland',
  sco: 'Scotland',
  namibia: 'Namibia',
  namibian: 'Namibia',
  nam: 'Namibia',
  singapore: 'Singapore',
  sin: 'Singapore',
  pakistan: 'Pakistan',
  pakistani: 'Pakistan',
  pak: 'Pakistan',
  nepal: 'Nepal',
  nepalese: 'Nepal',
  nep: 'Nepal',
  uae: 'UAE',
  'united arab emirates': 'UAE',
  usa: 'USA',
  'united states': 'USA',
  canada: 'Canada',
  canadian: 'Canada',
  can: 'Canada',
  oman: 'Oman',
  italy: 'Italy',
  'papua new guinea': 'Papua New Guinea',
  png: 'Papua New Guinea',
  bermuda: 'Bermuda',
  kenya: 'Kenya',
  hongkong: 'Hong Kong',
  'hong kong': 'Hong Kong',
};

const NON_COUNTRY_PLACEHOLDERS = new Set([
  '',
  'unknown',
  'none',
  'n/a',
  'na',
  'null',
  'undefined',
  'overseas',
  'foreign',
  'international',
  'domestic',
  'local',
  'pending',
  'needs_review',
]);

function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidQualityStatus(val: unknown): val is DataQualityStatus {
  return typeof val === 'string' && VALID_QUALITY_STATUSES.has(val as DataQualityStatus);
}

/**
 * Normalizes any source role string into the four canonical IPL roles:
 * BAT | WK | AR | BOWL, or null if reliable role data is unavailable.
 * Never infers role from ratings or statistics.
 */
export function normalizeRole(rawRole: unknown): CanonicalRole | null {
  const cleaned = cleanText(rawRole).toLowerCase();
  if (!cleaned) return null;

  const compact = cleaned.replace(/[_/]+/g, ' ').replace(/\s*-\s*/g, '-');

  if (
    compact === 'unknown' ||
    compact === 'n/a' ||
    compact === 'na' ||
    compact === 'none' ||
    compact === 'null' ||
    compact === 'pending' ||
    compact === 'needs review' ||
    compact === 'needs-review'
  ) {
    return null;
  }

  // Wicketkeeper variants checked before Batter so "Wicketkeeper Batter" / "WK-Batter" -> WK
  if (
    compact === 'wk' ||
    compact.includes('wicketkeeper') ||
    compact.includes('wicket-keeper') ||
    compact.includes('wicket keeper') ||
    /\bwk\b/.test(compact) ||
    compact.includes('wk-bat') ||
    compact.includes('keeper')
  ) {
    return 'WK';
  }

  // All-rounder variants checked before Batter/Bowler so "Batting Allrounder" / "Bowling Allrounder" -> AR
  if (
    compact === 'ar' ||
    compact.includes('allrounder') ||
    compact.includes('all-rounder') ||
    compact.includes('all rounder') ||
    /\bar\b/.test(compact)
  ) {
    return 'AR';
  }

  // Specialist Batter variants
  if (
    compact === 'bat' ||
    compact.includes('batter') ||
    compact.includes('batsman') ||
    compact.includes('batsmen') ||
    compact === 'opener' ||
    compact === 'opening bat' ||
    compact === 'top order' ||
    compact === 'middle order'
  ) {
    return 'BAT';
  }

  // Specialist Bowler variants
  if (
    compact === 'bowl' ||
    compact.includes('bowler') ||
    compact.includes('pacer') ||
    compact.includes('seamer') ||
    compact.includes('spinner') ||
    compact === 'pace' ||
    compact === 'spin' ||
    compact === 'fast'
  ) {
    return 'BOWL';
  }

  return null;
}

/**
 * Preserves detailed bowling type separately from the 4 canonical roles.
 */
export function normalizeBowlingType(rawBowlingStyle: unknown): BowlingType {
  const cleaned = cleanText(rawBowlingStyle).toLowerCase();
  if (
    !cleaned ||
    cleaned === 'none' ||
    cleaned === 'unknown' ||
    cleaned === 'n/a' ||
    cleaned === 'na' ||
    cleaned === 'null'
  ) {
    return 'Unknown';
  }

  // Direct exact canonical values
  if (cleaned === 'pace') return 'Pace';
  if (cleaned === 'medium pace' || cleaned === 'medium-pace') return 'Medium Pace';
  if (cleaned === 'leg spin' || cleaned === 'leg-spin') return 'Leg Spin';
  if (cleaned === 'off spin' || cleaned === 'off-spin') return 'Off Spin';
  if (cleaned === 'left-arm spin' || cleaned === 'left arm spin') return 'Left-arm Spin';

  // Left-arm spin (orthodox or wrist/chinaman)
  if (
    cleaned.includes('left-arm orthodox') ||
    cleaned.includes('left arm orthodox') ||
    cleaned.includes('slow left-arm') ||
    cleaned.includes('slow left arm') ||
    cleaned.includes('left-arm spin') ||
    cleaned.includes('left arm spin') ||
    cleaned.includes('left-arm wrist') ||
    cleaned.includes('left arm wrist') ||
    cleaned.includes('left-arm unorthodox') ||
    cleaned.includes('chinaman') ||
    /\bsla\b/.test(cleaned)
  ) {
    return 'Left-arm Spin';
  }

  // Leg spin / wrist spin
  if (
    cleaned.includes('legbreak') ||
    cleaned.includes('leg-break') ||
    cleaned.includes('leg break') ||
    cleaned.includes('leg spin') ||
    cleaned.includes('leg-spin') ||
    cleaned.includes('wrist spin') ||
    cleaned.includes('wrist-spin') ||
    cleaned.includes('googly')
  ) {
    return 'Leg Spin';
  }

  // Off spin
  if (
    cleaned.includes('offbreak') ||
    cleaned.includes('off-break') ||
    cleaned.includes('off break') ||
    cleaned.includes('off spin') ||
    cleaned.includes('off-spin')
  ) {
    return 'Off Spin';
  }

  // Medium pace variants (checked before pure fast/pace so "medium-fast" / "medium" map cleanly)
  if (
    cleaned.includes('medium-fast') ||
    cleaned.includes('medium fast') ||
    cleaned.includes('medium pace') ||
    cleaned.includes('medium-pace') ||
    /\bmedium\b/.test(cleaned)
  ) {
    // Distinguish genuine fast-medium (typically 135+ kph pacers) vs medium / medium-fast
    if (cleaned.includes('fast-medium') || cleaned.includes('fast medium')) {
      return 'Pace';
    }
    return 'Medium Pace';
  }

  // Pure fast / pace / seam
  if (
    cleaned.includes('fast') ||
    cleaned.includes('pace') ||
    cleaned.includes('seam') ||
    cleaned.includes('express')
  ) {
    return 'Pace';
  }

  return 'Unknown';
}

/**
 * Resolves a real cricket country string if present.
 * Returns null for generic labels like "Overseas", "Domestic", or "Unknown".
 * Never guesses country from player names.
 */
export function normalizeCountryName(rawNationality: unknown): string | null {
  const cleaned = cleanText(rawNationality).toLowerCase();
  if (!cleaned || NON_COUNTRY_PLACEHOLDERS.has(cleaned)) {
    return null;
  }
  const canonical = CRICKET_COUNTRY_ALIASES[cleaned];
  return canonical ?? null;
}

/**
 * Normalizes nationality & overseas status from explicit source fields only.
 * - Real cricket country -> VERIFIED + derived isOverseas (false for India, true for non-India)
 * - Explicit IPL Domestic / isOverseas === false -> India, isOverseas: false, VERIFIED
 * - Explicit Overseas flag without country -> nationality: null, isOverseas: true, NEEDS_REVIEW
 * - Missing / unknown -> nationality: null, isOverseas: null, NEEDS_REVIEW
 */
export function normalizeNationality(input: {
  nationality?: unknown;
  isOverseas?: unknown;
  playerType?: unknown;
}): NormalizedNationalityResult {
  const country = normalizeCountryName(input.nationality);
  if (country) {
    return {
      nationality: country,
      isOverseas: country !== 'India',
      nationalityStatus: 'VERIFIED',
    };
  }

  const rawNatLower = cleanText(input.nationality).toLowerCase();
  const rawTypeLower = cleanText(input.playerType).toLowerCase();
  const explicitOverseas = typeof input.isOverseas === 'boolean' ? input.isOverseas : null;

  if (
    explicitOverseas === true ||
    rawTypeLower === 'overseas' ||
    rawTypeLower === 'foreign' ||
    rawNatLower === 'overseas' ||
    rawNatLower === 'foreign'
  ) {
    return {
      nationality: null,
      isOverseas: true,
      nationalityStatus: 'NEEDS_REVIEW',
    };
  }

  if (
    explicitOverseas === false ||
    rawTypeLower === 'domestic' ||
    rawTypeLower === 'indian' ||
    rawNatLower === 'domestic'
  ) {
    return {
      nationality: 'India',
      isOverseas: false,
      nationalityStatus: 'VERIFIED',
    };
  }

  return {
    nationality: null,
    isOverseas: null,
    nationalityStatus: 'NEEDS_REVIEW',
  };
}

export function toPlayerRoleOrUnknown(role: CanonicalRole | null): PlayerRole {
  return role ?? 'UNKNOWN';
}

export function toPlayerOriginTypeFromCanonical(isOverseas: boolean | null): PlayerOriginType {
  if (isOverseas === true) return 'Overseas';
  if (isOverseas === false) return 'Domestic';
  return 'Unknown';
}

function pickMajorityKey<T extends string>(
  counts: Map<T, number>,
  latestSeasonByKey: Map<T, number>
): T | null {
  let bestKey: T | null = null;
  let bestCount = -1;
  let bestLatest = -1;

  for (const [key, count] of counts.entries()) {
    const latest = latestSeasonByKey.get(key) ?? -1;
    if (count > bestCount || (count === bestCount && latest > bestLatest)) {
      bestKey = key;
      bestCount = count;
      bestLatest = latest;
    }
  }
  return bestKey;
}

/**
 * Builds the canonical Role + Nationality/Overseas data layer keyed by canonical `playerId`.
 * Guarantees:
 * 1. Canonical nationality and isOverseas are identical across all historical seasons of a player.
 * 2. Cross-season overseas contradictions (e.g. overseas captains marked Domestic in 1-3 seasons)
 *    are resolved consistently to isOverseas: true without fabricating country names.
 * 3. Missing values are never defaulted to Indian or fabricated from names/ratings/salary.
 * 4. Multi-role careers keep `primaryRole` at the canonical level and preserve differing per-season
 *    verified roles in `seasonRoles`.
 */
export function buildCanonicalRoleNationalityLayer(
  observations: RawRoleNationalityObservation[],
  existingCanonical?: Record<string, Partial<CanonicalPlayerRoleNationality>> | null
): Record<string, CanonicalPlayerRoleNationality> {
  const byPlayerId = new Map<string, RawRoleNationalityObservation[]>();

  for (const obs of observations) {
    const pid = cleanText(obs.playerId);
    if (!pid) continue;
    const list = byPlayerId.get(pid);
    if (list) {
      list.push(obs);
    } else {
      byPlayerId.set(pid, [obs]);
    }
  }

  const result: Record<string, CanonicalPlayerRoleNationality> = {};

  for (const [playerId, records] of byPlayerId.entries()) {
    const sorted = [...records].sort((a, b) => a.season - b.season);
    const seed = existingCanonical?.[playerId];

    // --- 1. Role resolution ---
    const roleCounts = new Map<CanonicalRole, number>();
    const roleLatestSeason = new Map<CanonicalRole, number>();
    const verifiedSeasonRoles: Array<{ season: number; role: CanonicalRole }> = [];
    let missingRoleSeasons = 0;

    for (const rec of sorted) {
      const normalized = normalizeRole(rec.seasonRole ?? rec.role ?? rec.primaryRole);
      if (normalized) {
        roleCounts.set(normalized, (roleCounts.get(normalized) ?? 0) + 1);
        roleLatestSeason.set(
          normalized,
          Math.max(roleLatestSeason.get(normalized) ?? -1, rec.season)
        );
        verifiedSeasonRoles.push({ season: rec.season, role: normalized });
      } else {
        missingRoleSeasons += 1;
      }
    }

    let primaryRole: CanonicalRole | null = null;
    let roleStatus: DataQualityStatus = 'NEEDS_REVIEW';
    let seasonRoles: Record<string, CanonicalRole> | undefined;

    if (roleCounts.size === 0) {
      const seedRole = normalizeRole(seed?.primaryRole);
      if (seedRole) {
        primaryRole = seedRole;
        roleStatus = isValidQualityStatus(seed?.roleStatus) ? seed.roleStatus : 'INFERRED';
      } else {
        primaryRole = null;
        roleStatus = 'NEEDS_REVIEW';
      }
    } else if (roleCounts.size === 1) {
      const [onlyRole] = roleCounts.keys();
      primaryRole = onlyRole;
      const hadInferredRole =
        seed?.roleStatus === 'INFERRED' ||
        sorted.some((rec) => rec.roleStatus === 'INFERRED');
      roleStatus = missingRoleSeasons === 0 && !hadInferredRole ? 'VERIFIED' : 'INFERRED';
    } else {
      primaryRole = pickMajorityKey(roleCounts, roleLatestSeason);
      roleStatus = 'INFERRED';
      const overrides: Record<string, CanonicalRole> = {};
      for (const entry of verifiedSeasonRoles) {
        if (entry.role !== primaryRole) {
          overrides[String(entry.season)] = entry.role;
        }
      }
      if (Object.keys(overrides).length > 0) {
        seasonRoles = overrides;
      }
    }

    // --- 2. Nationality + isOverseas canonical resolution ---
    const countryCounts = new Map<string, number>();
    const countryLatestSeason = new Map<string, number>();
    let trueCount = 0;
    let falseCount = 0;
    let unknownOriginSeasons = 0;

    const seedCountry = normalizeCountryName(seed?.nationality);
    if (seedCountry) {
      countryCounts.set(seedCountry, (countryCounts.get(seedCountry) ?? 0) + 1);
      countryLatestSeason.set(seedCountry, 9999);
    }

    for (const rec of sorted) {
      const norm = normalizeNationality({
        nationality: rec.nationality,
        isOverseas: rec.isOverseas,
        playerType: rec.playerType,
      });

      if (norm.nationality) {
        countryCounts.set(norm.nationality, (countryCounts.get(norm.nationality) ?? 0) + 1);
        countryLatestSeason.set(
          norm.nationality,
          Math.max(countryLatestSeason.get(norm.nationality) ?? -1, rec.season)
        );
      }

      if (norm.isOverseas === true) {
        trueCount += 1;
      } else if (norm.isOverseas === false) {
        falseCount += 1;
      } else {
        unknownOriginSeasons += 1;
      }
    }

    let nationality: string | null = null;
    let isOverseas: boolean | null = null;
    let nationalityStatus: DataQualityStatus = 'NEEDS_REVIEW';
    const hadInferredNationality =
      seed?.nationalityStatus === 'INFERRED' ||
      sorted.some((rec) => rec.nationalityStatus === 'INFERRED');

    const nonIndianCountries = new Map<string, number>();
    const nonIndianLatest = new Map<string, number>();
    for (const [country, count] of countryCounts.entries()) {
      if (country !== 'India') {
        nonIndianCountries.set(country, count);
        nonIndianLatest.set(country, countryLatestSeason.get(country) ?? -1);
      }
    }

    if (nonIndianCountries.size > 0) {
      nationality = pickMajorityKey(nonIndianCountries, nonIndianLatest);
      isOverseas = true;
      nationalityStatus =
        nonIndianCountries.size === 1 &&
        falseCount === 0 &&
        unknownOriginSeasons === 0 &&
        !hadInferredNationality
          ? 'VERIFIED'
          : 'INFERRED';
    } else if (trueCount > 0 && falseCount === 0) {
      // Verified overseas across all known seasons, but source lacks specific country
      nationality = null;
      isOverseas = true;
      nationalityStatus = 'NEEDS_REVIEW';
    } else if (trueCount > 0 && falseCount > 0) {
      // Cross-season contradiction (e.g., overseas captains mislabeled Domestic in 1-3 seasons)
      if (trueCount >= falseCount) {
        nationality = null;
        isOverseas = true;
        nationalityStatus = 'NEEDS_REVIEW';
      } else {
        // Conflicting majority-domestic vs minority-overseas: do not fabricate Indian
        nationality = null;
        isOverseas = null;
        nationalityStatus = 'NEEDS_REVIEW';
      }
    } else if (falseCount > 0 && trueCount === 0) {
      // Consistently Domestic / Indian across all known seasons
      nationality = 'India';
      isOverseas = false;
      nationalityStatus =
        unknownOriginSeasons === 0 && !hadInferredNationality ? 'VERIFIED' : 'INFERRED';
    } else {
      // Zero origin data across all seasons: do NOT default to Indian
      nationality = null;
      isOverseas = null;
      nationalityStatus = 'NEEDS_REVIEW';
    }

    // --- 3. Detailed bowling type preservation ---
    const bowlingCounts = new Map<BowlingType, number>();
    const bowlingLatest = new Map<BowlingType, number>();
    if (seed?.bowlingType && seed.bowlingType !== 'Unknown') {
      bowlingCounts.set(seed.bowlingType, 1);
      bowlingLatest.set(seed.bowlingType, 9999);
    }
    for (const rec of sorted) {
      const bType = normalizeBowlingType(rec.bowlingType ?? rec.bowlingStyle);
      if (bType !== 'Unknown') {
        bowlingCounts.set(bType, (bowlingCounts.get(bType) ?? 0) + 1);
        bowlingLatest.set(bType, Math.max(bowlingLatest.get(bType) ?? -1, rec.season));
      }
    }
    const bowlingType: BowlingType = pickMajorityKey(bowlingCounts, bowlingLatest) ?? 'Unknown';

    const canonicalEntry: CanonicalPlayerRoleNationality = {
      playerId,
      primaryRole,
      roleStatus,
      nationality,
      isOverseas,
      nationalityStatus,
      bowlingType,
    };
    if (seasonRoles) {
      canonicalEntry.seasonRoles = seasonRoles;
    }

    result[playerId] = canonicalEntry;
  }

  return result;
}

/**
 * Resolves the effective canonical role for a specific season of a canonical player.
 * Uses verified per-season override (`seasonRoles[season]`) when a player's historical
 * role differed in that season, otherwise falls back to canonical `primaryRole`.
 */
export function resolveEffectiveSeasonRole(
  canonical: CanonicalPlayerRoleNationality | undefined,
  season: number
): { role: PlayerRole; primaryRole: CanonicalRole | null; seasonRole: CanonicalRole | null } {
  if (!canonical) {
    return { role: 'UNKNOWN', primaryRole: null, seasonRole: null };
  }
  const override = canonical.seasonRoles?.[String(season)] ?? null;
  const effective = override ?? canonical.primaryRole;
  return {
    role: toPlayerRoleOrUnknown(effective),
    primaryRole: canonical.primaryRole,
    seasonRole: override,
  };
}

/**
 * Produces the canonical Role + Nationality validation report.
 */
export function buildRoleNationalityValidationReport(
  canonicalMap: Record<string, CanonicalPlayerRoleNationality>
): RoleNationalityValidationReport {
  const entries = Object.values(canonicalMap);
  let roleVerified = 0;
  let roleInferred = 0;
  let roleNeedsReview = 0;
  let nationalityVerified = 0;
  let nationalityInferred = 0;
  let nationalityNeedsReview = 0;
  let indianPlayers = 0;
  let overseasPlayers = 0;
  let unknownOriginPlayers = 0;
  let missingNationality = 0;
  let missingRole = 0;

  for (const entry of entries) {
    if (entry.roleStatus === 'VERIFIED') roleVerified += 1;
    else if (entry.roleStatus === 'INFERRED') roleInferred += 1;
    else roleNeedsReview += 1;

    if (entry.nationalityStatus === 'VERIFIED') nationalityVerified += 1;
    else if (entry.nationalityStatus === 'INFERRED') nationalityInferred += 1;
    else nationalityNeedsReview += 1;

    if (entry.isOverseas === false) indianPlayers += 1;
    else if (entry.isOverseas === true) overseasPlayers += 1;
    else unknownOriginPlayers += 1;

    if (entry.nationality === null) missingNationality += 1;
    if (entry.primaryRole === null) missingRole += 1;
  }

  return {
    totalCanonicalPlayers: entries.length,
    roleVerified,
    roleInferred,
    roleNeedsReview,
    nationalityVerified,
    nationalityInferred,
    nationalityNeedsReview,
    indianPlayers,
    overseasPlayers,
    unknownOriginPlayers,
    missingNationality,
    missingRole,
  };
}
