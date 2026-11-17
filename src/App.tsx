import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { DraftScreen } from './components/DraftScreen';
import { HomeScreen } from './components/HomeScreen';
import { MatchCenter, type MatchContext } from './components/MatchCenter';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { PlayingXIScreen } from './components/PlayingXIScreen';
import { SeasonScreen } from './components/SeasonScreen';
import { SettingsModal } from './components/SettingsModal';
import { SquadScreen } from './components/SquadScreen';
import { loadIplDatabase, type PlayerRepository } from './data/playerRepository';
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
  selectPlayerForDraft,
  setCustomFranchise,
} from './game/draftEngine';
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
  lockRetentionsAndStartSpin,
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

type ActiveMatchRef =
  | { type: 'LEAGUE'; fixtureId: string }
  | { type: 'PLAYOFF'; playoffId: PlayoffRoundId };

type DatabaseLoadState =
  | { status: 'LOADING' }
  | { status: 'READY'; repo: PlayerRepository }
  | { status: 'ERROR'; message: string };

function hydrateLegacyPlayer(p: PlayerSeasonRecord): PlayerSeasonRecord {
  if (p.attributes && typeof p.impactRating === 'number' && p.ratingBand && p.form) {
    return p;
  }
  const resolved = resolvePlayerRatings({
    playerId: p.playerId,
    season: p.season,
    franchise: p.franchise,
    role: p.role,
    matches: p.matches ?? 0,
    priceCr: p.priceCr,
    ratingStatus: p.ratingStatus ?? 'PROVISIONAL',
    rawBattingRating: p.battingRating,
    rawBowlingRating: p.bowlingRating,
    rawImpactRating: p.impactRating,
    rawOverallRating: p.overallRating,
    rawAttributes: p.attributes,
  });
  return {
    ...p,
    ...resolved,
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

function loadSavedState(): {
  settings: DraftSettings;
  draft: DraftState;
  playingXi: PlayingXIState;
  season: SeasonState | null;
  activeMatch: ActiveMatchRef | null;
} {
  if (typeof window === 'undefined') {
    return {
      settings: DEFAULT_SETTINGS,
      draft: createInitialDraftState(DEFAULT_SETTINGS),
      playingXi: createInitialPlayingXIState(),
      season: null,
      activeMatch: null,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        settings: DEFAULT_SETTINGS,
        draft: createInitialDraftState(DEFAULT_SETTINGS),
        playingXi: createInitialPlayingXIState(),
        season: null,
        activeMatch: null as ActiveMatchRef | null,
      };
    }
    const parsed = JSON.parse(raw) as {
      settings?: DraftSettings;
      draft?: DraftState;
      playingXi?: PlayingXIState;
      season?: SeasonState | null;
      activeMatch?: ActiveMatchRef | null;
    };
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
    return {
      settings,
      draft,
      playingXi,
      season,
      activeMatch: parsed.activeMatch ?? null,
    };
  } catch {
    return {
      settings: DEFAULT_SETTINGS,
      draft: createInitialDraftState(DEFAULT_SETTINGS),
      playingXi: createInitialPlayingXIState(),
      season: null,
      activeMatch: null as ActiveMatchRef | null,
    };
  }
}

export default function App() {
  const initial = loadSavedState();
  const [settings, setSettings] = useState<DraftSettings>(initial.settings);
  const [draftState, setDraftState] = useState<DraftState>(initial.draft);
  const [playingXiState, setPlayingXiState] = useState<PlayingXIState>(initial.playingXi);
  const [seasonState, setSeasonState] = useState<SeasonState | null>(initial.season);
  const [careerStats, setCareerStats] = useState<CareerStats>(loadSavedCareer);
  const [activeMatch, setActiveMatch] = useState<ActiveMatchRef | null>(initial.activeMatch);
  const [dbState, setDbState] = useState<DatabaseLoadState>({ status: 'LOADING' });
  const [activeTab, setActiveTab] = useState<ScreenTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'DRAFT';
      }
      if (initial.activeMatch && initial.season) {
        return 'SEASON';
      }
    }
    return 'HOME';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PlayerSeasonRecord | null>(null);

  const fetchDatabase = useCallback(async () => {
    setDbState({ status: 'LOADING' });
    try {
      const repo = await loadIplDatabase();
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
        err instanceof Error && err.message ? err.message : 'Unable to fetch IPL database JSON.';
      setDbState({ status: 'ERROR', message });
    }
  }, []);

  useEffect(() => {
    void fetchDatabase();
  }, [fetchDatabase]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
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
  }, [settings, draftState, playingXiState, seasonState, activeMatch]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(careerStats));
    } catch {
      // Ignore storage quota issues
    }
  }, [careerStats]);

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

  const handleNavigate = (tab: ScreenTab) => {
    if (tab !== 'SEASON') {
      setActiveMatch(null);
    }
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
    setActiveTab('DRAFT');
  };

  const handleResumeDraft = () => {
    setActiveTab('DRAFT');
  };

  const handleCreateFranchise = (franchise: CustomFranchise) => {
    setDraftState((prev) => setCustomFranchise(prev, franchise));
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
    setDraftState((prev) => lockRetentionsAndStartSpin(prev));
  };

  const handleSpin = () => {
    if (dbState.status !== 'READY') return;
    setDraftState((prev) => executeSpin(prev, dbState.repo));
  };

  const handleSelectPlayer = (player: PlayerSeasonRecord) => {
    setDraftState((prev) => selectPlayerForDraft(prev, player));
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
    const nextNumber = seasonState ? seasonState.seasonNumber + 1 : 1;
    const franchiseIdentity = draftState.customFranchise ?? settings.franchiseName;
    const nextSeason = createInitialSeasonState(
      xiValidation.xiPlayers,
      dbState.repo,
      nextNumber,
      Math.random,
      xiValidation.benchPlayers,
      franchiseIdentity
    );
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSeasonState(nextSeason);
    setActiveMatch(null);
    setActiveTab('SEASON');
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
      setActiveTab('SEASON');
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

  const handleCompleteActiveMatch = (result: MatchResult) => {
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

  return (
    <AppShell
      activeTab={activeTab}
      squadCount={navSquadCount}
      squadLimit={draftState.settings.squadSize}
      onNavigate={handleNavigate}
      onOpenSettings={() => setIsSettingsOpen(true)}
    >
      {dbState.status === 'ERROR' ? (
        <section
          role="alert"
          data-testid="database-error"
          className="mx-auto mt-10 w-full max-w-xl px-4"
        >
          <div className="border-2 border-[#141619] bg-[#FAF8F3] p-7 text-center shadow-[4px_4px_0px_#141619]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center border border-[#D94E28] bg-[#FFF1EE] text-[#D94E28]">
              <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase sm:text-3xl">
              IPL DATABASE FAILED TO LOAD
            </h1>
            <p className="mt-2 text-xs text-[#4A4E54] sm:text-sm">{dbState.message}</p>
            <button
              type="button"
              onClick={() => void fetchDatabase()}
              className="mt-6 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2.5 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Retry Loading Database</span>
            </button>
          </div>
        </section>
      ) : dbState.status === 'LOADING' ? (
        <section
          data-testid="database-loading"
          className="mx-auto mt-10 w-full max-w-xl px-4"
        >
          <div className="border-2 border-[#141619] bg-[#FAF8F3] p-8 text-center shadow-[4px_4px_0px_#141619]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D94E28]" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-extrabold text-[#141619] uppercase">
              Loading IPL Database...
            </h1>
            <p className="mt-1.5 text-xs text-[#4A4E54]">
              Preparing 2008–2026 historical franchise squads.
            </p>
          </div>
        </section>
      ) : (
        <>
          {activeTab === 'HOME' && (
            <HomeScreen
              settings={settings}
              customFranchise={draftState.customFranchise}
              career={careerStats}
              hasActiveDraft={hasActiveDraft}
              hasActiveSeason={seasonState !== null}
              draftedCount={draftState.squad.length}
              onStartNewDraft={handleStartNewDraft}
              onResumeDraft={handleResumeDraft}
              onOpenSeason={() => setActiveTab('SEASON')}
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
              onContinueToPlayingXI={() => setActiveTab('PLAYING_XI')}
              onStartNewDraft={handleStartNewDraft}
              onInspectPlayer={setInspectedPlayer}
            />
          )}

          {activeTab === 'SQUAD' && (
            <SquadScreen
              state={draftState}
              onGoToDraft={() => setActiveTab('DRAFT')}
              onGoToPlayingXI={() => setActiveTab('PLAYING_XI')}
              onStartNewDraft={handleStartNewDraft}
              onInspectPlayer={setInspectedPlayer}
            />
          )}

          {activeTab === 'PLAYING_XI' && (
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
            />
          )}

          {activeTab === 'SEASON' && (
            activeMatchContext && seasonState ? (
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
                onAdjustPreMatchXI={handleAdjustPreMatchXI}
                onCompleteMatch={handleCompleteActiveMatch}
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
              <SeasonScreen
                season={seasonState}
                xiConfirmed={playingXiState.isConfirmed}
                xiValid={xiValidation.isValid}
                benchPlayers={xiValidation.benchPlayers}
                onStartSeason={handleStartNewSeason}
                onQuickSimFixture={handleQuickSimFixture}
                onPlayFixture={(fixtureId) => setActiveMatch({ type: 'LEAGUE', fixtureId })}
                onQuickSimPlayoff={handleQuickSimPlayoff}
                onPlayPlayoff={(playoffId) => setActiveMatch({ type: 'PLAYOFF', playoffId })}
                onGoToPlayingXI={() => setActiveTab('PLAYING_XI')}
                onInspectPlayer={setInspectedPlayer}
              />
            )
          )}
        </>
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
    </AppShell>
  );
}
