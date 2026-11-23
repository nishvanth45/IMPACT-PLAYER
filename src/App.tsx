import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CloudUpload, Loader2, RotateCcw } from 'lucide-react';
import { GameButton, GameShell } from './components/ui';
import { DraftScreen } from './components/DraftScreen';
import { FixturesScreen } from './components/FixturesScreen';
import { FranchiseCreator } from './components/FranchiseCreator';
import { HomeScreen } from './components/HomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { MatchCenter, type MatchContext } from './components/MatchCenter';
import { useAnimationPreferences } from './components/MotionPrimitives';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { PlayingXIScreen } from './components/PlayingXIScreen';
import { SettingsModal } from './components/SettingsModal';
import { StandingsScreen } from './components/StandingsScreen';
import { StatsScreen } from './components/StatsScreen';
import { loadIplDatabase, type PlayerRepository } from './data/playerRepository';
import { useFirebaseAuth } from './firebase/FirebaseProvider';
import {
  ensureUserProfile,
  loadUserGameSave,
  saveUserGameSave,
} from './firebase/userCloudStore';
import {
  createInitialCareerStats,
  mergeCareerAchievements,
  recordCompletedSeasonInCareer,
  unlockAchievement,
} from './game/careerEngine';
import {
  DEFAULT_SETTINGS,
  createDefaultCustomFranchise,
  createInitialDraftState,
  executeSpin,
  setCustomFranchise,
} from './game/draftEngine';
import {
  ensureLiveLeagueInitialized,
  extractDraftedAiSquads,
  lockRetentionsWithLiveLeague,
  selectPlayerInLiveDraft,
  validateLeagueDraft,
} from './game/liveDraftEngine';
import {
  addPlayerToXI,
  autoSelectPlayingXI,
  createInitialPlayingXIState,
  removePlayerFromXI,
  reorderBattingOrder,
  setActiveWicketkeeper,
  setCaptain,
  swapXIWithBench,
  syncPlayingXIWithSquad,
  validatePlayingXI,
} from './game/playingXiEngine';
import {
  assignPlayerToRetentionSlot,
  clearRetentionSlot,
  createInitialRetentionState,
  setRetentionCount,
} from './game/retentionEngine';
import { resolvePlayerRatings } from './game/ratingEngine';
import {
  commitPlayoffMatchResult,
  commitUserFixtureResult,
  createInitialSeasonState,
  quickSimPlayoffMatch,
  quickSimUserFixture,
  syncUserXiInSeason,
} from './game/seasonEngine';
import {
  clearGuestSaveBundle,
  extractGuestCareerSummary,
  hasFranchiseCareer,
  readGuestSaveBundle,
  readStoredSessionMode,
  resolveAppRoute,
  resolveGuestLinkMigration,
  writeGuestSaveBundle,
  writeStoredSessionMode,
  type ActiveMatchRef,
  type GuestCareerSummary,
  type SavedCareerBundle,
} from './game/sessionRouting';
import { mapSettingsDifficulty } from './game/simConfig';
import type {
  CareerStats,
  CustomFranchise,
  DraftSettings,
  DraftState,
  MatchResult,
  PlayerSeasonRecord,
  PlayingXIState,
  PlayoffRoundId,
  ScreenTab,
  SeasonState,
} from './types/game';

const STORAGE_KEY = 'ipl_legacy_draft_phase1_v1';
const CAREER_STORAGE_KEY = 'impact_player_career_v1';
export const ACTIVE_MATCH_STORAGE_KEY = 'impact_player_active_match_v1';

type DatabaseLoadState =
  | { status: 'LOADING' }
  | { status: 'READY'; repo: PlayerRepository }
  | { status: 'ERROR'; message: string };

interface CloudConflictState {
  guestBundle: SavedCareerBundle;
  cloudBundle: SavedCareerBundle;
  uid: string;
}

function hydrateLegacyPlayer(p: PlayerSeasonRecord): PlayerSeasonRecord {
  const normalizedSalaryCr =
    typeof p.salary?.salaryCr === 'number' && Number.isFinite(p.salary.salaryCr)
      ? p.salary.salaryCr
      : typeof p.salaryCr === 'number' && Number.isFinite(p.salaryCr)
        ? p.salaryCr
        : null;
  const normalizedGamePriceCr =
    typeof p.gamePriceCr === 'number' && Number.isFinite(p.gamePriceCr)
      ? p.gamePriceCr
      : typeof p.salary?.gamePriceCr === 'number' && Number.isFinite(p.salary.gamePriceCr)
        ? p.salary.gamePriceCr
        : null;
  const normalizedSalaryType = p.salaryType ?? p.salary?.type ?? 'UNKNOWN';
  const normalizedSalaryVerified = Boolean(p.salaryVerified ?? p.salary?.verified) && normalizedSalaryCr !== null;

  if (
    p.attributes &&
    typeof p.impactRating === 'number' &&
    p.ratingBand &&
    p.form &&
    p.salaryCr !== undefined &&
    p.salaryType !== undefined &&
    p.salaryVerified !== undefined
  ) {
    return p;
  }
  const hasExplicitRatings = Boolean(p.ratings) || (p.hasRatings !== false && p.overallRating > 0);
  const resolved = resolvePlayerRatings({
    playerId: p.playerId,
    season: p.season,
    franchise: p.franchise,
    role: p.role,
    matches: p.matches ?? 0,
    priceCr: p.isRetained ? p.priceCr : (normalizedSalaryCr ?? normalizedGamePriceCr ?? 0),
    ratingStatus: p.ratingStatus ?? 'PROVISIONAL',
    hasExplicitRatings,
    rawBattingRating: p.ratings?.bat ?? p.battingRating,
    rawBowlingRating: p.ratings?.bowl ?? p.bowlingRating,
    rawImpactRating: p.ratings?.impact ?? p.impactRating,
    rawOverallRating: p.ratings?.overall ?? p.overallRating,
    rawAttributes: p.attributes,
  });
  return {
    ...p,
    ...resolved,
    hasRatings: hasExplicitRatings,
    salaryCr: normalizedSalaryCr,
    gamePriceCr: normalizedGamePriceCr,
    salaryType: normalizedSalaryType,
    salaryVerified: normalizedSalaryVerified,
    form: p.form ?? 'NORMAL',
  };
}

function loadSavedCareer(): CareerStats {
  if (typeof window === 'undefined') {
    return createInitialCareerStats();
  }
  try {
    const raw = window.localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return createInitialCareerStats();
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    const base = createInitialCareerStats();
    return {
      seasonsPlayed: parsed.seasonsPlayed ?? base.seasonsPlayed,
      titlesWon: parsed.titlesWon ?? base.titlesWon,
      bestFinish: parsed.bestFinish ?? base.bestFinish,
      bestPosition: parsed.bestPosition ?? base.bestPosition,
      achievements: mergeCareerAchievements(parsed.achievements),
    };
  } catch {
    return createInitialCareerStats();
  }
}

function normalizeSavedGameBundle(parsed: SavedCareerBundle): {
  settings: DraftSettings;
  draft: DraftState;
  playingXi: PlayingXIState;
  season: SeasonState | null;
  activeMatch: ActiveMatchRef | null;
  career?: CareerStats;
} {
  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) };
  const rawDraft = parsed.draft;
  const hydratedRetention = rawDraft?.retention
    ? {
        ...rawDraft.retention,
        slots: rawDraft.retention.slots.map((slot) => ({
          ...slot,
          player: slot.player ? hydrateLegacyPlayer(slot.player) : null,
        })),
      }
    : rawDraft && rawDraft.squad.length > 0
      ? { targetCount: 0 as const, slots: [], locked: true }
      : createInitialRetentionState();

  const hydratedLiveLeague = rawDraft?.liveLeague
    ? {
        ...rawDraft.liveLeague,
        teams: Object.fromEntries(
          Object.entries(rawDraft.liveLeague.teams).map(([tid, team]) => [
            tid,
            {
              ...team,
              squad: (team.squad ?? []).map(hydrateLegacyPlayer),
            },
          ])
        ) as NonNullable<DraftState['liveLeague']>['teams'],
      }
    : null;

  const draft: DraftState = rawDraft
    ? {
        ...rawDraft,
        customFranchise:
          rawDraft.customFranchise ??
          (rawDraft.squad?.length > 0
            ? createDefaultCustomFranchise(settings.franchiseName)
            : null),
        squad: (rawDraft.squad ?? []).map(hydrateLegacyPlayer),
        currentSpin: rawDraft.currentSpin
          ? {
              ...rawDraft.currentSpin,
              pool: (rawDraft.currentSpin.pool ?? []).map(hydrateLegacyPlayer),
            }
          : null,
        retention: hydratedRetention,
        liveLeague: hydratedLiveLeague,
      }
    : createInitialDraftState(settings);
  const playingXi = syncPlayingXIWithSquad(
    parsed.playingXi ?? createInitialPlayingXIState(),
    draft.squad
  );
  const rawSeason = parsed.season ?? null;
  const season: SeasonState | null = rawSeason
    ? {
        ...rawSeason,
        playerForms: rawSeason.playerForms ?? {},
        userBench: (rawSeason.userBench ?? []).map(hydrateLegacyPlayer),
        impactHistory: rawSeason.impactHistory ?? [],
        venueStats: rawSeason.venueStats ?? {},
        stats: {
          matchesSimulated: rawSeason.stats?.matchesSimulated ?? 0,
          highestUserScore: rawSeason.stats?.highestUserScore ?? 0,
          playerStats: rawSeason.stats?.playerStats ?? {},
        },
        teams: Object.fromEntries(
          Object.entries(rawSeason.teams).map(([id, team]) => [
            id,
            { ...team, players: team.players.map(hydrateLegacyPlayer) },
          ])
        ) as SeasonState['teams'],
      }
    : null;

  const baseCareer = createInitialCareerStats();
  const career = parsed.career
    ? {
        seasonsPlayed: parsed.career.seasonsPlayed ?? baseCareer.seasonsPlayed,
        titlesWon: parsed.career.titlesWon ?? baseCareer.titlesWon,
        bestFinish: parsed.career.bestFinish ?? baseCareer.bestFinish,
        bestPosition: parsed.career.bestPosition ?? baseCareer.bestPosition,
        achievements: mergeCareerAchievements(parsed.career.achievements),
      }
    : undefined;

  return {
    settings,
    draft,
    playingXi,
    season,
    activeMatch: parsed.activeMatch ?? null,
    career,
  };
}

function loadSavedState(): {
  ownerUid?: string | null;
  settings: DraftSettings;
  draft: DraftState;
  playingXi: PlayingXIState;
  season: SeasonState | null;
  activeMatch: ActiveMatchRef | null;
  career: CareerStats;
} {
  if (typeof window === 'undefined') {
    return {
      ownerUid: null,
      settings: DEFAULT_SETTINGS,
      draft: createInitialDraftState(DEFAULT_SETTINGS),
      playingXi: createInitialPlayingXIState(),
      season: null,
      activeMatch: null,
      career: createInitialCareerStats(),
    };
  }

  // If returning to an active Guest session on refresh, hydrate directly from Guest storage
  if (readStoredSessionMode() === 'GUEST') {
    const guestBundle = readGuestSaveBundle();
    if (guestBundle) {
      const normalized = normalizeSavedGameBundle(guestBundle);
      return {
        ownerUid: null,
        settings: normalized.settings,
        draft: normalized.draft,
        playingXi: normalized.playingXi,
        season: normalized.season,
        activeMatch: normalized.activeMatch,
        career: normalized.career ?? createInitialCareerStats(),
      };
    }
    return {
      ownerUid: null,
      settings: DEFAULT_SETTINGS,
      draft: createInitialDraftState(DEFAULT_SETTINGS),
      playingXi: createInitialPlayingXIState(),
      season: null,
      activeMatch: null,
      career: createInitialCareerStats(),
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ownerUid: null,
        settings: DEFAULT_SETTINGS,
        draft: createInitialDraftState(DEFAULT_SETTINGS),
        playingXi: createInitialPlayingXIState(),
        season: null,
        activeMatch: null,
        career: loadSavedCareer(),
      };
    }
    const parsed = JSON.parse(raw) as SavedCareerBundle & { ownerUid?: string | null };
    const normalized = normalizeSavedGameBundle(parsed);
    return {
      ownerUid: parsed.ownerUid ?? null,
      settings: normalized.settings,
      draft: normalized.draft,
      playingXi: normalized.playingXi,
      season: normalized.season,
      activeMatch: normalized.activeMatch,
      career: normalized.career ?? loadSavedCareer(),
    };
  } catch {
    return {
      ownerUid: null,
      settings: DEFAULT_SETTINGS,
      draft: createInitialDraftState(DEFAULT_SETTINGS),
      playingXi: createInitialPlayingXIState(),
      season: null,
      activeMatch: null,
      career: loadSavedCareer(),
    };
  }
}

export default function App() {
  const {
    user,
    authReady,
    isSigningIn,
    authError,
    signInWithGoogle,
    signOutUser,
    clearAuthError,
  } = useFirebaseAuth();

  const initial = loadSavedState();
  const [isGuestSession, setIsGuestSession] = useState<boolean>(
    () => readStoredSessionMode() === 'GUEST'
  );
  const [guestSummary, setGuestSummary] = useState<GuestCareerSummary | null>(() =>
    extractGuestCareerSummary(readGuestSaveBundle())
  );
  const [settings, setSettings] = useState<DraftSettings>(initial.settings);
  const [draftState, setDraftState] = useState<DraftState>(initial.draft);
  const [playingXiState, setPlayingXiState] = useState<PlayingXIState>(initial.playingXi);
  const [seasonState, setSeasonState] = useState<SeasonState | null>(initial.season);
  const [careerStats, setCareerStats] = useState<CareerStats>(initial.career);
  const [activeMatch, setActiveMatch] = useState<ActiveMatchRef | null>(initial.activeMatch);
  const [dbState, setDbState] = useState<DatabaseLoadState>({ status: 'LOADING' });
  const [cloudHydratedUid, setCloudHydratedUid] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [fatalCloudError, setFatalCloudError] = useState<Error | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [cloudConflict, setCloudConflict] = useState<CloudConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const hasCloudSaveDocRef = useRef(false);
  const activeRepoRef = useRef<PlayerRepository | null>(null);
  const dbFetchedRef = useRef(false);
  const pendingGuestMigrationRef = useRef<SavedCareerBundle | null>(null);

  const [activeTab, setActiveTab] = useState<ScreenTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'DRAFT';
      }
      if (initial.activeMatch && initial.season) {
        return 'FIXTURES';
      }
    }
    return 'HOME';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PlayerSeasonRecord | null>(null);

  const applyNormalizedBundle = useCallback(
    (bundle: SavedCareerBundle, preserveTab = false) => {
      const normalized = normalizeSavedGameBundle(bundle);
      const repo = activeRepoRef.current;
      const hydratedDraft: DraftState =
        normalized.draft.currentSpin && repo
          ? {
              ...normalized.draft,
              currentSpin: {
                ...normalized.draft.currentSpin,
                pool: repo.getSquad(
                  normalized.draft.currentSpin.franchise,
                  normalized.draft.currentSpin.season
                ),
              },
            }
          : normalized.draft;

      setSettings(normalized.settings);
      setDraftState(hydratedDraft);
      setPlayingXiState(normalized.playingXi);
      setSeasonState(normalized.season);
      setActiveMatch(normalized.activeMatch);
      setCareerStats(normalized.career ?? createInitialCareerStats());
      if (!preserveTab) {
        if (normalized.activeMatch && normalized.season) {
          setActiveTab('FIXTURES');
        } else {
          setActiveTab('HOME');
        }
      }
    },
    []
  );

  const fetchDatabase = useCallback(async (forceReload = false) => {
    setDbState({ status: 'LOADING' });
    try {
      const repo = await loadIplDatabase(undefined, { forceReload });
      activeRepoRef.current = repo;
      setDbState({ status: 'READY', repo });
      setDraftState((prev) => {
        if (!prev.currentSpin) return prev;
        const freshPool = repo.getSquad(prev.currentSpin.franchise, prev.currentSpin.season);
        if (freshPool.length === 0) {
          return {
            ...prev,
            currentSpin: null,
            status: prev.squad.length >= prev.settings.squadSize ? 'COMPLETED' : 'READY_TO_SPIN',
          };
        }
        return {
          ...prev,
          currentSpin: {
            ...prev.currentSpin,
            pool: freshPool,
          },
        };
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to fetch /impact_player_database.json.';
      setDbState({ status: 'ERROR', message });
    }
  }, []);

  // Load IPL runtime database whenever a Google OR Guest session is active
  useEffect(() => {
    if (!authReady) return;
    if (!user && !isGuestSession) return;
    if (dbFetchedRef.current) return;
    dbFetchedRef.current = true;
    void fetchDatabase();
  }, [authReady, user, isGuestSession, fetchDatabase]);

  // Hydrate user profile and cloud save from Firestore once Google authenticated
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudHydratedUid(null);
      setCloudLoading(false);
      hasCloudSaveDocRef.current = false;
      return;
    }

    // Google authentication always supersedes Guest session mode cleanly
    if (isGuestSession) {
      setIsGuestSession(false);
      writeStoredSessionMode(null);
    }

    let cancelled = false;
    setCloudLoading(true);
    setFatalCloudError(null);

    (async () => {
      try {
        await ensureUserProfile(user);
        const cloudSave = await loadUserGameSave(user.uid);
        if (cancelled) return;

        const pendingGuest = pendingGuestMigrationRef.current;
        pendingGuestMigrationRef.current = null;
        const migrationAction = resolveGuestLinkMigration({
          pendingGuestCareer: pendingGuest,
          cloudSave,
        });

        if (migrationAction === 'AUTO_MIGRATE_TO_CLOUD' && pendingGuest) {
          const normalizedGuest = normalizeSavedGameBundle(pendingGuest);
          const nextCareer = normalizedGuest.career ?? createInitialCareerStats();
          await saveUserGameSave(
            user.uid,
            {
              settings: normalizedGuest.settings,
              draft: normalizedGuest.draft,
              playingXi: normalizedGuest.playingXi,
              career: nextCareer,
              season: normalizedGuest.season,
              activeMatch: normalizedGuest.activeMatch,
            },
            Boolean(cloudSave)
          );
          if (cancelled) return;
          hasCloudSaveDocRef.current = true;
          applyNormalizedBundle({ ...normalizedGuest, career: nextCareer });
          setLinkNotice('Guest career migrated to your Google Cloud Save.');
        } else if (migrationAction === 'PROMPT_CONFLICT' && pendingGuest && cloudSave) {
          hasCloudSaveDocRef.current = true;
          applyNormalizedBundle(cloudSave);
          setCloudConflict({
            guestBundle: pendingGuest,
            cloudBundle: cloudSave,
            uid: user.uid,
          });
        } else if (cloudSave) {
          hasCloudSaveDocRef.current = true;
          applyNormalizedBundle(cloudSave);
        } else {
          hasCloudSaveDocRef.current = false;
          // Preserve existing local save only if it belongs to this same Google user (or legacy unowned pre-login data)
          let cachedOwnerUid: string | null = null;
          let localParsed: SavedCareerBundle | null = null;
          try {
            const rawLocal = window.localStorage.getItem(STORAGE_KEY);
            if (rawLocal) {
              const parsedLocal = JSON.parse(rawLocal) as SavedCareerBundle & {
                ownerUid?: string | null;
              };
              cachedOwnerUid = parsedLocal.ownerUid ?? null;
              localParsed = parsedLocal;
            }
          } catch {
            // ignore
          }

          if (localParsed && (!cachedOwnerUid || cachedOwnerUid === user.uid)) {
            applyNormalizedBundle({
              ...localParsed,
              career: localParsed.career ?? loadSavedCareer(),
            });
          } else {
            setSettings(DEFAULT_SETTINGS);
            setDraftState(createInitialDraftState(DEFAULT_SETTINGS));
            setPlayingXiState(createInitialPlayingXIState());
            setSeasonState(null);
            setActiveMatch(null);
            setCareerStats(createInitialCareerStats());
            setActiveTab('HOME');
          }
        }
        setCloudHydratedUid(user.uid);
      } catch (error) {
        if (!cancelled) {
          setFatalCloudError(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        if (!cancelled) {
          setCloudLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, isGuestSession, applyNormalizedBundle]);

  // Persist Google user progress to Firestore (debounced) whenever authenticated & hydrated
  useEffect(() => {
    if (!authReady || !user || cloudHydratedUid !== user.uid || cloudConflict) return;

    const uid = user.uid;
    const timer = window.setTimeout(() => {
      void saveUserGameSave(
        uid,
        {
          settings,
          draft: draftState,
          playingXi: playingXiState,
          career: careerStats,
          season: seasonState,
          activeMatch,
        },
        hasCloudSaveDocRef.current
      )
        .then(() => {
          hasCloudSaveDocRef.current = true;
        })
        .catch((error) => {
          setFatalCloudError(error instanceof Error ? error : new Error(String(error)));
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    authReady,
    user,
    cloudHydratedUid,
    cloudConflict,
    settings,
    draftState,
    playingXiState,
    careerStats,
    seasonState,
    activeMatch,
  ]);

  // Mirror Google user state to local cache
  useEffect(() => {
    if (!user || cloudHydratedUid !== user.uid) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ownerUid: user.uid,
          settings,
          draft: draftState,
          playingXi: playingXiState,
          season: seasonState,
          activeMatch,
        })
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [user, cloudHydratedUid, settings, draftState, playingXiState, seasonState, activeMatch]);

  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(careerStats));
    } catch {
      // Ignore storage quota issues
    }
  }, [user, careerStats]);

  // Persist Guest Mode career to device localStorage so it survives browser refresh
  useEffect(() => {
    if (!isGuestSession || user) return;
    const bundle: SavedCareerBundle = {
      settings,
      draft: draftState,
      playingXi: playingXiState,
      season: seasonState,
      activeMatch,
      career: careerStats,
    };
    writeGuestSaveBundle(bundle);
    setGuestSummary(extractGuestCareerSummary(bundle));
  }, [
    isGuestSession,
    user,
    settings,
    draftState,
    playingXiState,
    seasonState,
    activeMatch,
    careerStats,
  ]);

  useEffect(() => {
    if (draftState.squad.length >= draftState.settings.squadSize) {
      setCareerStats((prev) => unlockAchievement(prev, 'complete_draft'));
    }
  }, [draftState.squad.length, draftState.settings.squadSize]);

  useEffect(() => {
    document.body.dataset.state = activeTab === 'HOME' ? 'title' : 'playing';
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'HOME' || isSettingsOpen || dbState.status !== 'READY') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
        if (
          (draftState.customFranchise !== null || draftState.squad.length > 0) &&
          draftState.status !== 'COMPLETED'
        ) {
          setActiveTab('DRAFT');
        } else {
          setDraftState(createInitialDraftState(settings));
          setPlayingXiState(createInitialPlayingXIState());
          setSeasonState(null);
          setActiveMatch(null);
          setActiveTab('DRAFT');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    isSettingsOpen,
    dbState.status,
    draftState.customFranchise,
    draftState.squad.length,
    draftState.status,
    settings,
  ]);

  const handleContinueAsGuest = () => {
    clearAuthError();
    const existingGuest = readGuestSaveBundle();
    writeStoredSessionMode('GUEST');
    setIsGuestSession(true);
    if (existingGuest && hasFranchiseCareer(existingGuest.draft, existingGuest.season)) {
      applyNormalizedBundle(existingGuest);
    } else {
      setSettings(DEFAULT_SETTINGS);
      setDraftState(createInitialDraftState(DEFAULT_SETTINGS));
      setPlayingXiState(createInitialPlayingXIState());
      setSeasonState(null);
      setActiveMatch(null);
      setCareerStats(createInitialCareerStats());
      setActiveTab('HOME');
    }
  };

  const handleContinueGuestCareer = () => {
    clearAuthError();
    const existingGuest = readGuestSaveBundle();
    writeStoredSessionMode('GUEST');
    setIsGuestSession(true);
    if (existingGuest) {
      applyNormalizedBundle(existingGuest);
    }
  };

  const handleStartNewGuestFranchise = () => {
    clearAuthError();
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    clearGuestSaveBundle();
    setGuestSummary(null);
    writeStoredSessionMode('GUEST');
    setIsGuestSession(true);
    setSettings(DEFAULT_SETTINGS);
    setDraftState(createInitialDraftState(DEFAULT_SETTINGS));
    setPlayingXiState(createInitialPlayingXIState());
    setSeasonState(null);
    setActiveMatch(null);
    setCareerStats(createInitialCareerStats());
    setActiveTab('HOME');
  };

  const handleLinkGoogleAccount = () => {
    pendingGuestMigrationRef.current = {
      settings,
      draft: draftState,
      playingXi: playingXiState,
      season: seasonState,
      activeMatch,
      career: careerStats,
    };
    void signInWithGoogle();
  };

  const handleResolveCloudConflict = async (choice: 'KEEP_CLOUD' | 'USE_GUEST') => {
    if (!cloudConflict) return;
    setIsResolvingConflict(true);
    try {
      if (choice === 'USE_GUEST') {
        const normalizedGuest = normalizeSavedGameBundle(cloudConflict.guestBundle);
        const nextCareer = normalizedGuest.career ?? createInitialCareerStats();
        await saveUserGameSave(
          cloudConflict.uid,
          {
            settings: normalizedGuest.settings,
            draft: normalizedGuest.draft,
            playingXi: normalizedGuest.playingXi,
            career: nextCareer,
            season: normalizedGuest.season,
            activeMatch: normalizedGuest.activeMatch,
          },
          true
        );
        hasCloudSaveDocRef.current = true;
        applyNormalizedBundle({ ...normalizedGuest, career: nextCareer });
        setLinkNotice('Replaced cloud career with your Guest career.');
      } else {
        applyNormalizedBundle(cloudConflict.cloudBundle);
        setLinkNotice('Loaded your existing Google Cloud career.');
      }
      setCloudConflict(null);
    } catch (error) {
      setFatalCloudError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleNavigate = (tab: ScreenTab) => {
    setActiveMatch(null);
    setActiveTab(tab);
  };

  const handleStartNewDraft = () => {
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraftState(createInitialDraftState(settings));
    setPlayingXiState(createInitialPlayingXIState());
    setSeasonState(null);
    setActiveMatch(null);
    setActiveTab('HOME');
  };

  const handleResumeDraft = () => {
    setActiveTab('DRAFT');
  };

  const handleCreateFranchise = (franchise: CustomFranchise) => {
    setDraftState((prev) => setCustomFranchise(prev, franchise));
    setActiveTab('HOME');
  };

  const handleSetRetentionCount = (count: 0 | 1 | 2 | 3 | 4) => {
    setDraftState((prev) => setRetentionCount(prev, count));
  };

  const handleAssignRetention = (player: PlayerSeasonRecord, slotIndex: number) => {
    setDraftState((prev) => assignPlayerToRetentionSlot(prev, player, slotIndex));
  };

  const handleClearRetentionSlot = (slotIndex: number) => {
    setDraftState((prev) => clearRetentionSlot(prev, slotIndex));
  };

  const handleLockRetentions = () => {
    if (dbState.status !== 'READY') return;
    setDraftState((prev) => lockRetentionsWithLiveLeague(prev, dbState.repo));
  };

  const handleSpin = () => {
    if (dbState.status !== 'READY') return;
    setDraftState((prev) => executeSpin(ensureLiveLeagueInitialized(prev), dbState.repo));
  };

  const handleSelectPlayer = (player: PlayerSeasonRecord) => {
    if (dbState.status !== 'READY') return;
    setDraftState((prev) => selectPlayerInLiveDraft(prev, player, dbState.repo));
  };

  const xiValidation = validatePlayingXI(
    playingXiState,
    draftState.squad,
    draftState.settings.playingXIOverseasLimit
  );

  const handleSaveSettings = (nextSettings: DraftSettings, resetDraft: boolean) => {
    setSettings(nextSettings);
    if (resetDraft) {
      try {
        window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
      } catch {
        // ignore
      }
      setDraftState(createInitialDraftState(nextSettings));
      setPlayingXiState(createInitialPlayingXIState());
      setSeasonState(null);
      setActiveMatch(null);
    } else {
      setDraftState((prev) => ({
        ...prev,
        settings: nextSettings,
      }));
      if (seasonState) {
        const franchiseIdentity = draftState.customFranchise ?? nextSettings.franchiseName;
        setSeasonState((prev) =>
          prev
            ? syncUserXiInSeason(
                prev,
                xiValidation.xiPlayers,
                xiValidation.benchPlayers,
                franchiseIdentity
              )
            : prev
        );
      }
    }
    setIsSettingsOpen(false);
  };

  const handleAutoSelectXI = () => {
    setPlayingXiState(
      autoSelectPlayingXI(draftState.squad, draftState.settings.playingXIOverseasLimit)
    );
  };

  const handleAddToXI = (playerId: string) => {
    setPlayingXiState((prev) => addPlayerToXI(prev, draftState.squad, playerId));
  };

  const handleRemoveFromXI = (playerId: string) => {
    setPlayingXiState((prev) => removePlayerFromXI(prev, draftState.squad, playerId));
  };

  const handleSwapXI = (xiPlayerId: string, benchPlayerId: string) => {
    setPlayingXiState((prev) =>
      swapXIWithBench(prev, draftState.squad, xiPlayerId, benchPlayerId)
    );
  };

  const handleReorderBatting = (fromIndex: number, toIndex: number) => {
    setPlayingXiState((prev) => reorderBattingOrder(prev, fromIndex, toIndex));
  };

  const handleSelectCaptain = (playerId: string) => {
    setPlayingXiState((prev) => setCaptain(prev, playerId));
  };

  const handleSelectWicketkeeper = (playerId: string) => {
    setPlayingXiState((prev) => setActiveWicketkeeper(prev, draftState.squad, playerId));
  };

  const handleConfirmXI = () => {
    setPlayingXiState((prev) => ({
      ...prev,
      isConfirmed: true,
    }));
    if (seasonState) {
      const franchiseIdentity = draftState.customFranchise ?? settings.franchiseName;
      setSeasonState((prev) =>
        prev
          ? syncUserXiInSeason(
              prev,
              xiValidation.xiPlayers,
              xiValidation.benchPlayers,
              franchiseIdentity
            )
          : prev
      );
    }
  };

  const handleStartNewSeason = () => {
    if (!xiValidation.isValid || dbState.status !== 'READY') return;
    if (draftState.liveLeague) {
      const leagueCheck = validateLeagueDraft(draftState);
      if (!leagueCheck.isValid) return;
    }
    const nextNumber = seasonState ? seasonState.seasonNumber + 1 : 1;
    const franchiseIdentity = draftState.customFranchise ?? settings.franchiseName;
    const draftedAiSquads = extractDraftedAiSquads(draftState);
    const nextSeason = createInitialSeasonState(
      xiValidation.xiPlayers,
      dbState.repo,
      nextNumber,
      Math.random,
      xiValidation.benchPlayers,
      franchiseIdentity,
      draftedAiSquads
    );
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSeasonState(nextSeason);
    setActiveMatch(null);
    setActiveTab('FIXTURES');
  };

  const handleOpenOrStartSeasonFromXI = () => {
    if (seasonState) {
      const franchiseIdentity = draftState.customFranchise ?? settings.franchiseName;
      setSeasonState((prev) =>
        prev
          ? syncUserXiInSeason(
              prev,
              xiValidation.xiPlayers,
              xiValidation.benchPlayers,
              franchiseIdentity
            )
          : prev
      );
      setActiveTab('FIXTURES');
    } else {
      handleStartNewSeason();
    }
  };

  const applySeasonUpdateWithCareer = (updater: (prev: SeasonState) => SeasonState) => {
    setSeasonState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (prev.phase !== 'COMPLETED' && next.phase === 'COMPLETED') {
        setCareerStats((c) => recordCompletedSeasonInCareer(c, next));
      } else if (prev.phase === 'LEAGUE' && next.phase === 'PLAYOFFS' && next.userQualified) {
        setCareerStats((c) => unlockAchievement(c, 'playoff_bound', next.seasonNumber));
      }
      return next;
    });
  };

  const mappedDifficulty = mapSettingsDifficulty(settings.difficulty);

  const handleQuickSimFixture = (fixtureId: string) => {
    applySeasonUpdateWithCareer((prev) =>
      quickSimUserFixture(prev, fixtureId, Math.random, mappedDifficulty)
    );
  };

  const handleQuickSimPlayoff = (playoffId: PlayoffRoundId) => {
    applySeasonUpdateWithCareer((prev) =>
      quickSimPlayoffMatch(prev, playoffId, Math.random, mappedDifficulty)
    );
  };

  const handleAdjustPreMatchXI = (nextXiState: PlayingXIState) => {
    const validated = validatePlayingXI(
      nextXiState,
      draftState.squad,
      draftState.settings.playingXIOverseasLimit
    );
    if (!validated.isValid) return;
    const confirmed: PlayingXIState = { ...nextXiState, isConfirmed: true };
    setPlayingXiState(confirmed);
    const franchiseIdentity = draftState.customFranchise ?? settings.franchiseName;
    setSeasonState((prev) =>
      prev
        ? syncUserXiInSeason(
            prev,
            validated.xiPlayers,
            validated.benchPlayers,
            franchiseIdentity
          )
        : prev
    );
  };

  const handleCompleteActiveMatch = (
    result: MatchResult,
    destinationTab: ScreenTab = 'FIXTURES'
  ) => {
    if (!activeMatch) return;
    if (result.impactSub?.teamId === 'YOU') {
      setCareerStats((c) =>
        unlockAchievement(c, 'impact_tactician', seasonState?.seasonNumber)
      );
    }
    if (activeMatch.type === 'LEAGUE') {
      const fixId = activeMatch.fixtureId;
      applySeasonUpdateWithCareer((prev) => commitUserFixtureResult(prev, fixId, result));
    } else {
      const poId = activeMatch.playoffId;
      applySeasonUpdateWithCareer((prev) => commitPlayoffMatchResult(prev, poId, result));
    }
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setActiveMatch(null);
    setActiveTab(destinationTab);
  };

  const resolveMatchContext = (): MatchContext | null => {
    if (!seasonState || !activeMatch) return null;
    if (activeMatch.type === 'LEAGUE') {
      const fix = seasonState.fixtures.find((f) => f.id === activeMatch.fixtureId);
      if (!fix || fix.status === 'COMPLETED') return null;
      return { type: 'LEAGUE', fixture: fix };
    }
    const po = seasonState.playoffs[activeMatch.playoffId];
    if (!po || po.status !== 'READY') return null;
    return { type: 'PLAYOFF', playoff: po };
  };

  const activeMatchContext = resolveMatchContext();

  const hasActiveDraft =
    (draftState.customFranchise !== null ||
      draftState.squad.length > 0 ||
      (draftState.retention.targetCount !== null && !draftState.retention.locked)) &&
    draftState.status !== 'COMPLETED';
  const navSquadCount = draftState.retention.locked
    ? draftState.squad.length
    : draftState.retention.slots.filter((s) => s.player !== null).length;

  const handleSignOut = async () => {
    setIsSettingsOpen(false);
    setInspectedPlayer(null);
    setActiveMatch(null);
    setLinkNotice(null);
    setCloudConflict(null);
    setActiveTab('HOME');

    if (isGuestSession && !user) {
      // Preserve Guest Career on device so CONTINUE CAREER works from Entry, only exit active guest session
      writeStoredSessionMode(null);
      setIsGuestSession(false);
      setGuestSummary(extractGuestCareerSummary(readGuestSaveBundle()));
      return;
    }

    // Disarm cloud persistence before resetting local state so we never overwrite the user's cloud save
    setCloudHydratedUid(null);
    hasCloudSaveDocRef.current = false;
    setSettings(DEFAULT_SETTINGS);
    setDraftState(createInitialDraftState(DEFAULT_SETTINGS));
    setPlayingXiState(createInitialPlayingXIState());
    setSeasonState(null);
    setCareerStats(createInitialCareerStats());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(CAREER_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    await signOutUser();
    setGuestSummary(extractGuestCareerSummary(readGuestSaveBundle()));
  };

  if (fatalCloudError) {
    throw fatalCloudError;
  }

  const animPrefs = useAnimationPreferences(settings);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.animationMode =
        animPrefs.effectiveMode.toLowerCase();
    }
  }, [animPrefs.effectiveMode]);

  const isWaitingForCloud = Boolean(user && (cloudLoading || cloudHydratedUid !== user.uid));
  const route = resolveAppRoute({
    authReady,
    isGoogleAuthenticated: Boolean(user),
    isGuestSession: Boolean(!user && isGuestSession),
    isHydratingSession: isWaitingForCloud,
    hasCareer: hasFranchiseCareer(draftState, seasonState),
  });

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080B0D] px-4 text-[#F5F2EA]">
        <div
          data-testid="auth-loading"
          className="w-full max-w-sm border border-[#263039] bg-[#0E1318] p-8 text-center"
        >
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#22D36B]" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-wider text-[#F5F2EA] uppercase">
            IMPACT PLAYER
          </h1>
          <p className="mt-1.5 font-mono text-xs text-[#9DA8B3]">
            Checking your franchise session...
          </p>
        </div>
      </div>
    );
  }

  if (route === 'ENTRY') {
    return (
      <LoginScreen
        isSigningIn={isSigningIn}
        authError={authError}
        guestCareerSummary={guestSummary}
        onSignInWithGoogle={() => void signInWithGoogle()}
        onContinueAsGuest={handleContinueAsGuest}
        onContinueCareer={handleContinueGuestCareer}
        onStartNewFranchise={handleStartNewGuestFranchise}
        onDismissError={clearAuthError}
      />
    );
  }

  const isActiveGuestMode = Boolean(!user && isGuestSession);
  const needsFranchiseOnboarding = route === 'CREATE_FRANCHISE' && dbState.status === 'READY';

  return (
    <GameShell
      activeTab={activeTab}
      squadCount={navSquadCount}
      squadLimit={draftState.settings.squadSize}
      remainingPurseCr={draftState.remainingPurseCr}
      seasonNumber={seasonState?.seasonNumber ?? null}
      customFranchise={draftState.customFranchise}
      hideNavigation={needsFranchiseOnboarding || route === 'LOADING'}
      isGuestMode={isActiveGuestMode}
      isLinkingGoogle={isSigningIn}
      linkNotice={linkNotice}
      userDisplayName={user?.displayName ?? user?.email}
      userPhotoUrl={user?.photoURL}
      animateNumbers={animPrefs.isFull}
      onNavigate={handleNavigate}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLinkGoogleAccount={isActiveGuestMode ? handleLinkGoogleAccount : undefined}
      onDismissLinkNotice={() => setLinkNotice(null)}
      onSignOut={() => void handleSignOut()}
    >
      {dbState.status === 'ERROR' ? (
        <section
          role="alert"
          data-testid="database-error"
          className="mx-auto mt-10 w-full max-w-xl px-4"
        >
          <div className="border border-[#263039] bg-[#0E1318] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#E44949]/50 bg-[#231012] text-[#E44949]">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-3xl">
              PLAYER DATABASE FAILED TO LOAD
            </h1>
            <p className="mt-2 text-xs text-[#9DA8B3] sm:text-sm">{dbState.message}</p>
            <div className="mt-6 flex justify-center">
              <GameButton
                variant="primary"
                size="md"
                onClick={() => void fetchDatabase(true)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Retry Loading Database</span>
              </GameButton>
            </div>
          </div>
        </section>
      ) : dbState.status === 'LOADING' || route === 'LOADING' ? (
        <section
          data-testid="database-loading"
          className="mx-auto mt-10 w-full max-w-xl px-4"
        >
          <div className="border border-[#263039] bg-[#0E1318] p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#22D36B]" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-extrabold text-[#F5F2EA] uppercase">
              Loading Franchise Headquarters...
            </h1>
            <p className="mt-1.5 text-xs text-[#9DA8B3]">
              Preparing 2008–2026 historical franchise squads and saved career data.
            </p>
          </div>
        </section>
      ) : needsFranchiseOnboarding ? (
        <FranchiseCreator
          defaultName={settings.franchiseName}
          onCreateFranchise={handleCreateFranchise}
        />
      ) : activeMatchContext && seasonState ? (
        <MatchCenter
          season={seasonState}
          matchContext={activeMatchContext}
          squad={draftState.squad}
          playingXiState={playingXiState}
          benchPlayers={
            xiValidation.benchPlayers.length > 0
              ? xiValidation.benchPlayers
              : seasonState.userBench ?? []
          }
          maxStandardOverseas={settings.playingXIOverseasLimit}
          simSpeed={settings.simSpeed}
          difficulty={mappedDifficulty}
          animationPrefs={animPrefs}
          onAdjustPreMatchXI={handleAdjustPreMatchXI}
          onCompleteMatch={(result) => handleCompleteActiveMatch(result, 'FIXTURES')}
          onCompleteToStandings={(result) => handleCompleteActiveMatch(result, 'STANDINGS')}
          onCancel={() => {
            try {
              window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
            } catch {
              // ignore
            }
            setActiveMatch(null);
          }}
          onInspectPlayer={setInspectedPlayer}
        />
      ) : (
        <div key={activeTab} className="ip-page-enter">
          {activeTab === 'HOME' && (
            <HomeScreen
              settings={settings}
              draftState={draftState}
              seasonState={seasonState}
              customFranchise={draftState.customFranchise}
              career={careerStats}
              hasActiveDraft={hasActiveDraft}
              hasActiveSeason={seasonState !== null}
              draftedCount={draftState.squad.length}
              onStartNewDraft={handleStartNewDraft}
              onResumeDraft={handleResumeDraft}
              onPrepareTeam={() => setActiveTab('SQUAD')}
              onPlayFixture={(fixtureId) => {
                setActiveMatch({ type: 'LEAGUE', fixtureId });
                setActiveTab('FIXTURES');
              }}
              onPlayPlayoff={(playoffId) => {
                setActiveMatch({ type: 'PLAYOFF', playoffId });
                setActiveTab('FIXTURES');
              }}
              onOpenFixtures={() => setActiveTab('FIXTURES')}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'DRAFT' && (
            <DraftScreen
              state={draftState}
              repository={dbState.repo}
              onCreateFranchise={handleCreateFranchise}
              onSetRetentionCount={handleSetRetentionCount}
              onAssignRetention={handleAssignRetention}
              onClearRetentionSlot={handleClearRetentionSlot}
              onLockRetentions={handleLockRetentions}
              onSpin={handleSpin}
              onSelectPlayer={handleSelectPlayer}
              onGoToSquad={() => setActiveTab('SQUAD')}
              onStartNewDraft={handleStartNewDraft}
              onInspectPlayer={setInspectedPlayer}
            />
          )}

          {activeTab === 'SQUAD' && (
            <PlayingXIScreen
              draftState={draftState}
              xiState={playingXiState}
              onAutoSelectXI={handleAutoSelectXI}
              onAddPlayer={handleAddToXI}
              onRemovePlayer={handleRemoveFromXI}
              onSwapPlayers={handleSwapXI}
              onReorderBatting={handleReorderBatting}
              onSelectCaptain={handleSelectCaptain}
              onSelectWicketkeeper={handleSelectWicketkeeper}
              onConfirmXI={handleConfirmXI}
              onStartSeason={handleOpenOrStartSeasonFromXI}
              hasActiveSeason={seasonState !== null}
              onGoToDraft={() => setActiveTab('DRAFT')}
              onInspectPlayer={setInspectedPlayer}
            />
          )}

          {activeTab === 'FIXTURES' && (
            <FixturesScreen
              season={seasonState}
              xiConfirmed={playingXiState.isConfirmed}
              xiValid={xiValidation.isValid}
              animateNumbers={animPrefs.isFull}
              onStartSeason={handleStartNewSeason}
              onQuickSimFixture={handleQuickSimFixture}
              onPlayFixture={(fixtureId) => setActiveMatch({ type: 'LEAGUE', fixtureId })}
              onQuickSimPlayoff={handleQuickSimPlayoff}
              onPlayPlayoff={(playoffId) => setActiveMatch({ type: 'PLAYOFF', playoffId })}
              onPrepareTeam={() => setActiveTab('SQUAD')}
              onOpenStandings={() => setActiveTab('STANDINGS')}
            />
          )}

          {activeTab === 'STANDINGS' && (
            <StandingsScreen
              season={seasonState}
              xiConfirmed={playingXiState.isConfirmed}
              xiValid={xiValidation.isValid}
              animateNumbers={animPrefs.isFull}
              onStartSeason={handleStartNewSeason}
              onPrepareTeam={() => setActiveTab('SQUAD')}
              onOpenFixtures={() => setActiveTab('FIXTURES')}
            />
          )}

          {activeTab === 'STATS' && (
            <StatsScreen
              season={seasonState}
              xiConfirmed={playingXiState.isConfirmed}
              xiValid={xiValidation.isValid}
              onStartSeason={handleStartNewSeason}
              onPrepareTeam={() => setActiveTab('SQUAD')}
              onInspectPlayer={setInspectedPlayer}
            />
          )}
        </div>
      )}

      {cloudConflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose franchise career to keep"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B0D]/85 p-4"
        >
          <div className="w-full max-w-lg border border-[#263039] bg-[#0E1318] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
              <CloudUpload className="h-4 w-4 text-[#F5B942]" aria-hidden="true" />
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase">
                EXISTING CLOUD FRANCHISE FOUND
              </h2>
            </div>
            <div className="space-y-3 p-4 text-xs text-[#9DA8B3]">
              <p>
                Your Google account already has a saved franchise in the cloud. Choose which career
                you want active — nothing will be overwritten without your choice.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="border border-[#263039] bg-[#111820] p-3">
                  <div className="font-mono text-[10px] font-bold text-[#22D36B] uppercase">
                    CLOUD SAVE
                  </div>
                  <div className="mt-1 font-display text-lg font-extrabold text-[#F5F2EA] uppercase">
                    {cloudConflict.cloudBundle.draft?.customFranchise?.name ?? 'Saved Franchise'}
                  </div>
                  <div className="font-mono text-[11px] text-[#9DA8B3]">
                    {cloudConflict.cloudBundle.draft?.squad?.length ?? 0}/15 Squad
                  </div>
                </div>
                <div className="border border-[#263039] bg-[#111820] p-3">
                  <div className="font-mono text-[10px] font-bold text-[#F05A32] uppercase">
                    GUEST DEVICE SAVE
                  </div>
                  <div className="mt-1 font-display text-lg font-extrabold text-[#F5F2EA] uppercase">
                    {cloudConflict.guestBundle.draft?.customFranchise?.name ?? 'Guest Franchise'}
                  </div>
                  <div className="font-mono text-[11px] text-[#9DA8B3]">
                    {cloudConflict.guestBundle.draft?.squad?.length ?? 0}/15 Squad
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <GameButton
                  variant="secondary"
                  size="sm"
                  disabled={isResolvingConflict}
                  onClick={() => void handleResolveCloudConflict('KEEP_CLOUD')}
                >
                  KEEP CLOUD CAREER
                </GameButton>
                <GameButton
                  variant="primary"
                  size="sm"
                  disabled={isResolvingConflict}
                  onClick={() => void handleResolveCloudConflict('USE_GUEST')}
                >
                  UPLOAD GUEST CAREER
                </GameButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      <PlayerProfileModal
        player={inspectedPlayer}
        activeForm={
          inspectedPlayer
            ? (seasonState?.playerForms?.[inspectedPlayer.playerId] ?? inspectedPlayer.form)
            : undefined
        }
        onClose={() => setInspectedPlayer(null)}
      />
    </GameShell>
  );
}
