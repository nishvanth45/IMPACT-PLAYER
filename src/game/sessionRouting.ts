import type {
  CareerStats,
  DraftSettings,
  DraftState,
  PlayingXIState,
  PlayoffRoundId,
  SeasonState,
} from '../types/game';

export const GUEST_STORAGE_KEY = 'impact_player_guest_save_v1';
export const SESSION_MODE_KEY = 'impact_player_session_mode_v1';

export type ActiveMatchRef =
  | { type: 'LEAGUE'; fixtureId: string }
  | { type: 'PLAYOFF'; playoffId: PlayoffRoundId };

export type AppRoute = 'LOADING' | 'ENTRY' | 'CREATE_FRANCHISE' | 'OWNER_DASHBOARD';

export interface SavedCareerBundle {
  settings?: DraftSettings;
  draft?: DraftState;
  playingXi?: PlayingXIState;
  season?: SeasonState | null;
  activeMatch?: ActiveMatchRef | null;
  career?: CareerStats;
}

export interface GuestCareerSummary {
  franchiseName: string;
  franchiseCode: string;
  primaryColor: string;
  secondaryColor: string;
  squadCount: number;
  squadLimit: number;
  seasonNumber: number | null;
  remainingPurseCr: number;
}

export function hasFranchiseCareer(
  draft: DraftState | null | undefined,
  season?: SeasonState | null
): boolean {
  if (!draft) return Boolean(season);
  return Boolean(draft.customFranchise) || draft.squad.length > 0 || Boolean(season);
}

export function resolveAppRoute(params: {
  authReady: boolean;
  isGoogleAuthenticated: boolean;
  isGuestSession: boolean;
  isHydratingSession: boolean;
  hasCareer: boolean;
}): AppRoute {
  if (!params.authReady) {
    return 'LOADING';
  }
  if (!params.isGoogleAuthenticated && !params.isGuestSession) {
    return 'ENTRY';
  }
  if (params.isHydratingSession) {
    return 'LOADING';
  }
  return params.hasCareer ? 'OWNER_DASHBOARD' : 'CREATE_FRANCHISE';
}

export type GuestMigrationAction = 'AUTO_MIGRATE_TO_CLOUD' | 'PROMPT_CONFLICT' | 'NONE';

export function resolveGuestLinkMigration(params: {
  pendingGuestCareer: SavedCareerBundle | null;
  cloudSave: SavedCareerBundle | null;
}): GuestMigrationAction {
  if (!params.pendingGuestCareer) {
    return 'NONE';
  }
  const guestHasCareer = hasFranchiseCareer(
    params.pendingGuestCareer.draft,
    params.pendingGuestCareer.season
  );
  if (!guestHasCareer) {
    return 'NONE';
  }
  const cloudHasCareer = hasFranchiseCareer(params.cloudSave?.draft, params.cloudSave?.season);
  return cloudHasCareer ? 'PROMPT_CONFLICT' : 'AUTO_MIGRATE_TO_CLOUD';
}

export function readStoredSessionMode(storage?: Pick<Storage, 'getItem'>): 'GUEST' | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return null;
    return store.getItem(SESSION_MODE_KEY) === 'GUEST' ? 'GUEST' : null;
  } catch {
    return null;
  }
}

export function writeStoredSessionMode(
  mode: 'GUEST' | null,
  storage?: Pick<Storage, 'setItem' | 'removeItem'>
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    if (mode === 'GUEST') {
      store.setItem(SESSION_MODE_KEY, 'GUEST');
    } else {
      store.removeItem(SESSION_MODE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function readGuestSaveBundle(storage?: Pick<Storage, 'getItem'>): SavedCareerBundle | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return null;
    const raw = store.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCareerBundle;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGuestSaveBundle(
  bundle: SavedCareerBundle,
  storage?: Pick<Storage, 'setItem'>
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    store.setItem(GUEST_STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    // ignore storage quota errors
  }
}

export function clearGuestSaveBundle(storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    store.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function extractGuestCareerSummary(
  bundle: SavedCareerBundle | null
): GuestCareerSummary | null {
  if (!bundle || !hasFranchiseCareer(bundle.draft, bundle.season)) {
    return null;
  }
  const franchise = bundle.draft?.customFranchise;
  return {
    franchiseName: franchise?.name ?? bundle.settings?.franchiseName ?? 'Guest Franchise',
    franchiseCode: franchise?.code ?? 'GST',
    primaryColor: franchise?.primaryColor ?? '#D94E28',
    secondaryColor: franchise?.secondaryColor ?? '#F59E0B',
    squadCount: bundle.draft?.squad?.length ?? 0,
    squadLimit: bundle.draft?.settings?.squadSize ?? bundle.settings?.squadSize ?? 15,
    seasonNumber: bundle.season?.seasonNumber ?? null,
    remainingPurseCr: bundle.draft?.remainingPurseCr ?? 120,
  };
}
