import type {
  CareerStats,
  DraftSettings,
  DraftState,
  PlayingXIState,
  PlayoffRoundId,
  SeasonState,
} from '../types/game';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const BLUEPRINT_UID_MAX_LENGTH = 128;
export const BLUEPRINT_DISPLAY_NAME_MIN_LENGTH = 1;
export const BLUEPRINT_DISPLAY_NAME_MAX_LENGTH = 120;
export const BLUEPRINT_EMAIL_MIN_LENGTH = 3;
export const BLUEPRINT_EMAIL_MAX_LENGTH = 254;
export const BLUEPRINT_PHOTO_URL_MAX_LENGTH = 512;
export const BLUEPRINT_FRANCHISE_NAME_MIN_LENGTH = 1;
export const BLUEPRINT_FRANCHISE_NAME_MAX_LENGTH = 80;
export const BLUEPRINT_DRAFT_STATUS_MAX_LENGTH = 32;
export const BLUEPRINT_VALID_DRAFT_STATUSES = [
  'READY_TO_SPIN',
  'PICKING_PLAYER',
  'COMPLETED',
] as const;

export const GAME_SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_CLOUD_SAVE_ID = 'current';
const MAX_SAFE_DOCUMENT_BYTES = 850_000;

export type ActiveMatchRef =
  | { type: 'LEAGUE'; fixtureId: string }
  | { type: 'PLAYOFF'; playoffId: PlayoffRoundId };

export interface UserProfileMutableFields {
  displayName: string;
  email: string;
  photoURL: string;
}

export interface GameSaveMutableFields {
  schemaVersion: number;
  franchiseName: string;
  squadCount: number;
  draftStatus: DraftState['status'];
  settings: DraftSettings;
  draft: DraftState;
  playingXi: PlayingXIState;
  career: CareerStats;
  season: SeasonState | null;
  activeMatch: ActiveMatchRef | null;
}

export function isValidBlueprintId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_UID_MAX_LENGTH &&
    BLUEPRINT_ID_PATTERN.test(id)
  );
}

/**
 * Recursively strips keys with `undefined` values so native Firestore Maps
 * never fail with "Unsupported field value: undefined".
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const proto = Object.getPrototypeOf(value);
  // Preserve non-plain objects (Dates, Firestore FieldValue/Timestamp sentinels)
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) {
      clean[key] = stripUndefinedDeep(val);
    }
  }
  return clean as T;
}

export function sanitizeUserProfileFields(input: {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}): UserProfileMutableFields {
  const rawEmail = (input.email ?? '').trim().slice(0, BLUEPRINT_EMAIL_MAX_LENGTH);
  const email = rawEmail.length >= BLUEPRINT_EMAIL_MIN_LENGTH ? rawEmail : 'user@example.com';

  const fallbackName = email.split('@')[0] || 'Franchise Manager';
  const rawName = (input.displayName ?? '').trim() || fallbackName;
  const displayName = rawName.slice(0, BLUEPRINT_DISPLAY_NAME_MAX_LENGTH);

  const photoURL = (input.photoURL ?? '').trim().slice(0, BLUEPRINT_PHOTO_URL_MAX_LENGTH);

  return {
    displayName: displayName.length >= BLUEPRINT_DISPLAY_NAME_MIN_LENGTH ? displayName : 'Manager',
    email,
    photoURL,
  };
}

function compactSeasonForCloud(season: SeasonState | null, aggressive: boolean): SeasonState | null {
  if (!season) return null;
  if (!aggressive) {
    return stripUndefinedDeep(season);
  }
  // Keep full standings, stats, playoffs, and scorecards; trim verbose per-over logs if near 1MB limit
  const compactedFixtures = season.fixtures.map((fix) => {
    if (!fix.result) return fix;
    return {
      ...fix,
      result: {
        ...fix.result,
        highlights: fix.result.highlights?.slice(0, 6),
        firstScorecard: fix.result.firstScorecard
          ? { ...fix.result.firstScorecard, overHistory: undefined }
          : undefined,
        secondScorecard: fix.result.secondScorecard
          ? { ...fix.result.secondScorecard, overHistory: undefined }
          : undefined,
      },
    };
  });
  return stripUndefinedDeep({
    ...season,
    fixtures: compactedFixtures,
  });
}

export function buildGameSaveMutableFields(input: {
  settings: DraftSettings;
  draft: DraftState;
  playingXi: PlayingXIState;
  career: CareerStats;
  season: SeasonState | null;
  activeMatch: ActiveMatchRef | null;
}): GameSaveMutableFields {
  const rawFranchiseName =
    input.draft.customFranchise?.name?.trim() ||
    input.settings.franchiseName?.trim() ||
    'Mumbai Warriors';
  const franchiseName =
    rawFranchiseName.slice(0, BLUEPRINT_FRANCHISE_NAME_MAX_LENGTH) || 'Mumbai Warriors';

  const squadCount = Math.max(0, Math.min(30, Math.trunc(input.draft.squad.length)));
  const draftStatus: DraftState['status'] = BLUEPRINT_VALID_DRAFT_STATUSES.includes(
    input.draft.status
  )
    ? input.draft.status
    : 'READY_TO_SPIN';

  // Omit static 25-player spin pool from Firestore save; App re-hydrates pool from repository on load
  const compactDraft: DraftState = stripUndefinedDeep({
    ...input.draft,
    currentSpin: input.draft.currentSpin
      ? {
          ...input.draft.currentSpin,
          pool: [],
        }
      : null,
  });

  const cleanSettings = stripUndefinedDeep(input.settings);
  const cleanPlayingXi = stripUndefinedDeep(input.playingXi);
  const cleanCareer = stripUndefinedDeep(input.career);
  const cleanActiveMatch = input.activeMatch ? stripUndefinedDeep(input.activeMatch) : null;
  let cleanSeason = compactSeasonForCloud(input.season, false);

  const payload: GameSaveMutableFields = {
    schemaVersion: GAME_SAVE_SCHEMA_VERSION,
    franchiseName,
    squadCount,
    draftStatus,
    settings: cleanSettings,
    draft: compactDraft,
    playingXi: cleanPlayingXi,
    career: cleanCareer,
    season: cleanSeason,
    activeMatch: cleanActiveMatch,
  };

  // Guard against Firestore 1MB document limit
  try {
    let estimatedBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (estimatedBytes > MAX_SAFE_DOCUMENT_BYTES && input.season) {
      cleanSeason = compactSeasonForCloud(input.season, true);
      payload.season = cleanSeason;
      estimatedBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    }
    if (estimatedBytes > MAX_SAFE_DOCUMENT_BYTES && payload.draft.liveLeague) {
      payload.draft = {
        ...payload.draft,
        liveLeague: {
          ...payload.draft.liveLeague,
          feed: payload.draft.liveLeague.feed.slice(-10),
          lastRoundTransactions: payload.draft.liveLeague.lastRoundTransactions.slice(0, 11),
          // Once season has already absorbed all 11 teams, trim duplicate AI squad blobs in draft if near 1MB
          ...(input.season
            ? {
                teams: Object.fromEntries(
                  Object.entries(payload.draft.liveLeague.teams).map(([id, t]) => [
                    id,
                    id === 'YOU' ? t : { ...t, squad: [] },
                  ])
                ) as NonNullable<DraftState['liveLeague']>['teams'],
              }
            : {}),
        },
      };
    }
  } catch {
    // Fallback safely if size check throws
  }

  return payload;
}
