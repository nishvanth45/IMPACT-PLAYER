import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Disc3,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { FRANCHISES } from '../data/franchises';
import type { PlayerRepository } from '../data/playerRepository';
import {
  canAffordAnyInPool,
  canSelectPlayer,
  formatCr,
  getEligibleSpinCombos,
  getOverseasCount,
} from '../game/draftEngine';
import { getRetentionSummary } from '../game/retentionEngine';
import type {
  CustomFranchise,
  DraftState,
  FranchiseCode,
  PlayerRole,
  PlayerSeasonRecord,
} from '../types/game';
import { playDraftConfirm, playSpinLock, playSpinTick } from '../utils/sound';
import { FranchiseCreator } from './FranchiseCreator';
import { DRAFT_TABLE_GRID_COLS, PlayerCard } from './PlayerCard';
import { RetentionScreen } from './RetentionScreen';

interface DraftScreenProps {
  state: DraftState;
  repository: PlayerRepository;
  onCreateFranchise: (franchise: CustomFranchise) => void;
  onSetRetentionCount: (count: 0 | 1 | 2 | 3 | 4) => void;
  onAssignRetention: (player: PlayerSeasonRecord, slotIndex: number) => void;
  onClearRetentionSlot: (slotIndex: number) => void;
  onLockRetentions: () => void;
  onSpin: () => void;
  onSelectPlayer: (player: PlayerSeasonRecord) => void;
  onGoToSquad: () => void;
  onContinueToPlayingXI: () => void;
  onStartNewDraft: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

type RoleFilter = 'ALL' | Exclude<PlayerRole, 'UNKNOWN'>;
type OriginFilter = 'ALL' | 'INDIAN' | 'OVERSEAS';
type SortOption =
  | 'DEFAULT'
  | 'OVERALL_DESC'
  | 'IMPACT_DESC'
  | 'PRICE_DESC'
  | 'PRICE_ASC'
  | 'BATTING_DESC'
  | 'BOWLING_DESC';

const SORT_OPTIONS: Array<{ id: SortOption; label: string }> = [
  { id: 'DEFAULT', label: 'Default' },
  { id: 'OVERALL_DESC', label: 'OVR ↓' },
  { id: 'IMPACT_DESC', label: 'IMP ↓' },
  { id: 'PRICE_DESC', label: '₹ ↓' },
  { id: 'PRICE_ASC', label: '₹ ↑' },
  { id: 'BATTING_DESC', label: 'BAT ↓' },
  { id: 'BOWLING_DESC', label: 'BWL ↓' },
];

export function DraftScreen({
  state,
  repository,
  onCreateFranchise,
  onSetRetentionCount,
  onAssignRetention,
  onClearRetentionSlot,
  onLockRetentions,
  onSpin,
  onSelectPlayer,
  onGoToSquad,
  onContinueToPlayingXI,
  onStartNewDraft,
  onInspectPlayer,
}: DraftScreenProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelPreview, setReelPreview] = useState<{ franchise: FranchiseCode; season: number }>({
    franchise: 'RCB',
    season: 2016,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');

  const timerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const spinComboKey = state.currentSpin?.comboKey ?? null;
  useEffect(() => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setOriginFilter('ALL');
  }, [spinComboKey]);

  const retentionSummary = getRetentionSummary(state);
  const isRetentionPhase = !state.retention.locked;
  const overseasCount = isRetentionPhase
    ? retentionSummary.overseasCount
    : getOverseasCount(state.squad);
  const displaySquadCount = isRetentionPhase
    ? retentionSummary.retainedCount
    : state.squad.length;
  const playersRemaining = Math.max(0, state.settings.squadSize - displaySquadCount);
  const eligibleCombos = getEligibleSpinCombos(state, repository);
  const currentSpin = state.currentSpin;
  const activeFranchiseMeta = currentSpin
    ? FRANCHISES[currentSpin.franchise]
    : FRANCHISES[reelPreview.franchise];

  const handleSpinClick = () => {
    if (isSpinning || state.status === 'COMPLETED' || eligibleCombos.length === 0) {
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!state.settings.animationEnabled || reducedMotion) {
      playSpinLock(state.settings.soundEnabled);
      onSpin();
      return;
    }

    setIsSpinning(true);

    timerRef.current = window.setInterval(() => {
      const randomCombo =
        eligibleCombos[Math.floor(Math.random() * eligibleCombos.length)];
      if (randomCombo) {
        setReelPreview({
          franchise: randomCombo.franchise,
          season: randomCombo.season,
        });
      }
      playSpinTick(state.settings.soundEnabled);
    }, 70);

    timeoutRef.current = window.setTimeout(() => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsSpinning(false);
      playSpinLock(state.settings.soundEnabled);
      onSpin();
    }, 760);
  };

  const handleSelect = (player: PlayerSeasonRecord) => {
    playDraftConfirm(state.settings.soundEnabled);
    onSelectPlayer(player);
  };

  const poolHasSelectable = currentSpin ? canAffordAnyInPool(state, currentSpin.pool) : true;

  const filteredAndSortedPool = useMemo(() => {
    if (!currentSpin) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = currentSpin.pool.filter((player) => {
      if (roleFilter !== 'ALL' && player.role !== roleFilter) return false;
      if (originFilter === 'INDIAN' && player.isOverseas !== false) return false;
      if (originFilter === 'OVERSEAS' && player.isOverseas !== true) return false;
      const nameLower = (player.name || player.playerName).toLowerCase();
      if (
        normalizedQuery &&
        !nameLower.includes(normalizedQuery) &&
        !player.nationality.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'DEFAULT') {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'OVERALL_DESC':
          return b.overallRating - a.overallRating || b.impactRating - a.impactRating;
        case 'IMPACT_DESC':
          return b.impactRating - a.impactRating || b.overallRating - a.overallRating;
        case 'PRICE_DESC':
          return b.priceCr - a.priceCr || b.overallRating - a.overallRating;
        case 'PRICE_ASC':
          return a.priceCr - b.priceCr || b.overallRating - a.overallRating;
        case 'BATTING_DESC':
          return b.battingRating - a.battingRating || b.overallRating - a.overallRating;
        case 'BOWLING_DESC':
          return b.bowlingRating - a.bowlingRating || b.overallRating - a.overallRating;
        default:
          return 0;
      }
    });
  }, [currentSpin, searchQuery, roleFilter, originFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || roleFilter !== 'ALL' || originFilter !== 'ALL';

  if (!state.customFranchise) {
    return (
      <FranchiseCreator
        defaultName={state.settings.franchiseName}
        onCreateFranchise={onCreateFranchise}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-3 pb-24 md:pb-8">
      {/* Custom Franchise Identity Strip */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border border-[#141619] bg-[#0D1B2A] px-3.5 py-2 text-white">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-6 min-w-[40px] items-center justify-center rounded-[2px] border px-1.5 font-mono text-[11px] font-extrabold"
            style={{
              backgroundColor: state.customFranchise.primaryColor,
              borderColor: state.customFranchise.secondaryColor,
            }}
          >
            {state.customFranchise.code}
          </span>
          <span className="font-display text-lg font-extrabold tracking-wide uppercase">
            {state.customFranchise.name}
          </span>
          <span className="hidden font-mono text-[11px] text-slate-300 sm:inline">
            · {state.customFranchise.homeGround}
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold tracking-wider text-[#F59E0B] uppercase">
          11th IPL Expansion Franchise
        </span>
      </div>

      {/* Compact Live Scorebook Draft HUD */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[#141619]/15 border-2 border-[#141619] bg-[#FAF8F3] sm:grid-cols-4 sm:divide-y-0">
        <div className="flex items-baseline justify-between px-3.5 py-2">
          <span className="font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">Purse</span>
          <span
            data-testid="hud-purse"
            className={`font-mono text-base font-extrabold tabular-nums sm:text-lg ${
              state.remainingPurseCr < 6 ? 'text-[#D94E28]' : 'text-[#141619]'
            }`}
          >
            {formatCr(state.remainingPurseCr)}
          </span>
        </div>

        <div className="flex items-baseline justify-between px-3.5 py-2">
          <span className="font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">Squad</span>
          <span
            data-testid="hud-squad-count"
            className="font-mono text-base font-extrabold text-[#141619] tabular-nums sm:text-lg"
          >
            {displaySquadCount}/{state.settings.squadSize}
          </span>
        </div>

        <div className="flex items-baseline justify-between px-3.5 py-2">
          <span className="font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">Overseas</span>
          <span
            data-testid="hud-overseas-count"
            className={`font-mono text-base font-extrabold tabular-nums sm:text-lg ${
              overseasCount >= state.settings.overseasSquadLimit
                ? 'text-[#B45309]'
                : 'text-[#157F3D]'
            }`}
          >
            {overseasCount}/{state.settings.overseasSquadLimit}
          </span>
        </div>

        <div className="flex items-baseline justify-between px-3.5 py-2">
          <span className="font-mono text-[10.5px] font-bold text-[#4A4E54] uppercase">To Pick</span>
          <span
            data-testid="hud-players-remaining"
            className="font-mono text-base font-extrabold text-[#141619] tabular-nums sm:text-lg"
          >
            {playersRemaining}
          </span>
        </div>
      </div>

      {/* Retention Phase OR Spin Draft Phase */}
      {isRetentionPhase ? (
        <RetentionScreen
          state={state}
          repository={repository}
          onSetRetentionCount={onSetRetentionCount}
          onAssignRetention={onAssignRetention}
          onClearRetentionSlot={onClearRetentionSlot}
          onLockRetentions={onLockRetentions}
          onInspectPlayer={onInspectPlayer}
        />
      ) : state.status === 'COMPLETED' ? (
        <div className="mt-4 border-2 border-[#141619] bg-[#FAF8F3] p-6 text-center shadow-[4px_4px_0px_#141619] sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[3px] border border-[#157F3D] bg-[#DCFCE7] text-[#157F3D]">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-[#141619] uppercase sm:text-4xl">
            Squad Complete ({state.squad.length}/{state.settings.squadSize})
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-[#4A4E54] sm:text-sm">
            Finished auction with{' '}
            <span className="font-mono font-bold text-[#141619] tabular-nums">
              {formatCr(state.remainingPurseCr)}
            </span>{' '}
            remaining and{' '}
            <span className="font-mono font-bold text-[#157F3D] tabular-nums">
              {overseasCount}/{state.settings.overseasSquadLimit}
            </span>{' '}
            overseas players.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onContinueToPlayingXI}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
            >
              <span>CONTINUE TO SQUAD SELECTION</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onGoToSquad}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border border-[#141619] bg-white px-5 py-2.5 text-xs font-bold tracking-wider text-[#141619] uppercase hover:bg-[#EAE3D5] whitespace-nowrap"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Open My Squad</span>
            </button>
            <button
              type="button"
              onClick={onStartNewDraft}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border border-[#141619] bg-white px-5 py-2.5 text-xs font-bold tracking-wider text-[#141619] uppercase hover:bg-[#EAE3D5] whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Start New Draft</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {/* Dark Navy Spin Header / Reel Stage */}
          {currentSpin && !isSpinning && poolHasSelectable ? (
            <div
              data-testid="spin-result-display"
              className="flex flex-wrap items-center justify-between gap-2 border-2 border-[#141619] bg-[#0D1B2A] px-4 py-2.5 text-white"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] border border-white/20 bg-[#132338]"
                  aria-hidden="true"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-[2px]"
                    style={{ backgroundColor: activeFranchiseMeta.primaryColor }}
                  />
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold tracking-wide text-white tabular-nums sm:text-3xl">
                    {currentSpin.franchise} • {currentSpin.season}
                  </span>
                  <span className="text-xs font-semibold text-slate-300 sm:text-sm">
                    {activeFranchiseMeta.name}
                  </span>
                </div>
              </div>

              <div className="font-mono text-xs font-bold text-[#F59E0B] tabular-nums">
                PICK {state.squad.length + 1} / {state.settings.squadSize}
              </div>
            </div>
          ) : (
            <div className="border-2 border-[#141619] bg-[#0D1B2A] px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex flex-col items-center text-center">
                <div className="font-mono text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                  {isSpinning
                    ? 'Spinning Franchise & Season...'
                    : `Pick ${state.squad.length + 1} of ${state.settings.squadSize} · Spin Auction`}
                </div>

                <div
                  data-testid="spin-result-display"
                  className={`mt-2 flex w-full max-w-md items-center justify-center gap-3 rounded-[3px] border border-white/20 bg-[#132338] px-4 py-3 ${
                    isSpinning ? 'border-[#D94E28]' : ''
                  }`}
                >
                  {currentSpin || isSpinning ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-block h-3 w-3 rounded-[2px]"
                          style={{ backgroundColor: activeFranchiseMeta.primaryColor }}
                          aria-hidden="true"
                        />
                        <span className="font-display text-3xl font-extrabold tracking-wide text-white tabular-nums sm:text-4xl">
                          {currentSpin && !isSpinning
                            ? `${currentSpin.franchise} • ${currentSpin.season}`
                            : `${reelPreview.franchise} • ${reelPreview.season}`}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-slate-300">
                        {activeFranchiseMeta.name}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-display text-2xl font-extrabold tracking-wide text-slate-200 uppercase sm:text-3xl">
                        FRANCHISE • SEASON
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {eligibleCombos.length} team-seasons available ({state.settings.seasonStart}–
                        {state.settings.seasonEnd})
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 w-full max-w-sm">
                  {!poolHasSelectable && currentSpin && (
                    <p className="mb-2 text-xs font-semibold text-[#F59E0B]">
                      No affordable eligible players left in {currentSpin.franchise}{' '}
                      {currentSpin.season}. Re-spin to continue.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isSpinning || eligibleCombos.length === 0}
                    onClick={handleSpinClick}
                    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] px-8 py-2 font-display text-2xl font-extrabold tracking-wider text-white uppercase transition-colors ${
                      isSpinning
                        ? 'cursor-wait bg-[#B83C1B]'
                        : 'bg-[#D94E28] hover:bg-[#B83C1B]'
                    }`}
                  >
                    <Disc3
                      className={`h-5 w-5 ${isSpinning ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isSpinning ? 'SPINNING...' : currentSpin ? 'RE-SPIN' : 'SPIN'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Spun Squad Table */}
          {currentSpin && !isSpinning && (
            <div className="mt-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-extrabold tracking-wide text-[#141619] uppercase">
                  {FRANCHISES[currentSpin.franchise].name} ({currentSpin.season}) Squad
                </h2>
                <span className="font-mono text-xs font-semibold text-[#4A4E54] tabular-nums">
                  {hasActiveFilters
                    ? `Showing ${filteredAndSortedPool.length} of ${currentSpin.pool.length} Players Available`
                    : `${currentSpin.pool.length} Players Available`}
                </span>
              </div>

              {/* Filter & Sort Bar */}
              <div className="mt-1.5 border border-[#141619] bg-[#FAF8F3] p-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[175px] flex-1 sm:max-w-[220px]">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4E54]"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search player..."
                        aria-label="Search players"
                        className="h-8 w-full rounded-[2px] border border-[#141619]/30 bg-white pl-8 pr-7 text-xs font-medium text-[#141619] placeholder:text-[#6A6E75] focus:border-[#D94E28] focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#4A4E54] hover:text-[#141619]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-0.5 rounded-[2px] border border-[#141619]/25 bg-white p-0.5"
                      role="group"
                      aria-label="Filter by role"
                    >
                      {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as RoleFilter[]).map((role) => {
                        const active = roleFilter === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setRoleFilter(role)}
                            aria-pressed={active}
                            className={`min-h-[26px] rounded-[2px] px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${
                              active
                                ? 'bg-[#D94E28] text-white'
                                : 'text-[#141619] hover:bg-[#EAE3D5]'
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="flex items-center gap-0.5 rounded-[2px] border border-[#141619]/25 bg-white p-0.5"
                      role="group"
                      aria-label="Filter by nationality"
                    >
                      {(
                        [
                          { id: 'ALL', label: 'ALL' },
                          { id: 'INDIAN', label: 'INDIAN' },
                          { id: 'OVERSEAS', label: 'OVERSEAS' },
                        ] as const
                      ).map((opt) => {
                        const active = originFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setOriginFilter(opt.id)}
                            aria-pressed={active}
                            className={`min-h-[26px] rounded-[2px] px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${
                              active
                                ? 'bg-[#0D1B2A] text-white'
                                : 'text-[#141619] hover:bg-[#EAE3D5]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-0.5 rounded-[2px] border border-[#141619]/25 bg-white p-0.5"
                    role="group"
                    aria-label="Sort players"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSortBy(opt.id)}
                          aria-pressed={active}
                          className={`min-h-[26px] rounded-[2px] px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-[#0D1B2A] text-white'
                              : 'text-[#4A4E54] hover:bg-[#EAE3D5] hover:text-[#141619]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scorebook Player Table */}
              <div className="mt-2 overflow-hidden border-2 border-[#141619] bg-white">
                <div className="md:max-h-[520px] md:overflow-y-auto">
                  <div
                    className={`hidden sticky top-0 z-10 border-b-2 border-[#141619] bg-[#EAE3D5] px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#141619] uppercase ${DRAFT_TABLE_GRID_COLS}`}
                  >
                    <div>ROLE</div>
                    <div>PLAYER</div>
                    <div>TYPE</div>
                    <div className="text-center">BAT</div>
                    <div className="text-center">BWL</div>
                    <div className="text-center">IMP</div>
                    <div className="text-center">OVR</div>
                    <div className="text-right">SALARY</div>
                    <div className="text-center">INFO</div>
                    <div className="text-right">SELECT</div>
                  </div>

                  {filteredAndSortedPool.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs font-medium text-[#4A4E54]">
                        No players match your current search or filter criteria.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setRoleFilter('ALL');
                            setOriginFilter('ALL');
                          }}
                          className="mt-2.5 inline-flex min-h-[34px] items-center justify-center rounded-[2px] bg-[#D94E28] px-4 py-1 text-xs font-bold text-white uppercase hover:bg-[#B83C1B]"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div data-testid="draft-player-list">
                      {filteredAndSortedPool.map((player) => (
                        <PlayerCard
                          key={`${player.franchise}-${player.season}-${player.playerId}`}
                          player={player}
                          check={canSelectPlayer(state, player)}
                          onSelect={handleSelect}
                          onInspectPlayer={onInspectPlayer}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous Selections Strip */}
      {!isRetentionPhase && state.squad.length > 0 && (
        <div className="mt-3 border border-[#141619] bg-[#FAF8F3] p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-extrabold tracking-wider text-[#141619] uppercase">
              Draft Log ({state.squad.length}/{state.settings.squadSize})
            </h3>
            <button
              type="button"
              onClick={onGoToSquad}
              className="font-mono text-[11px] font-bold text-[#D94E28] uppercase hover:underline"
            >
              View Full Squad →
            </button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {state.squad.map((pick, idx) => (
              <div
                key={`${pick.playerId}-${idx}`}
                className={`shrink-0 rounded-[2px] border px-2.5 py-1.5 ${
                  pick.isRetained
                    ? 'border-[#6D28D9] bg-[#F5F3FF]'
                    : 'border-[#141619]/25 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#141619]">
                  <span>
                    {idx + 1}. {pick.playerName}
                  </span>
                  {pick.isRetained && (
                    <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                      RET
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-[#4A4E54] tabular-nums">
                  {pick.franchise} {pick.season} · {pick.role} · {formatCr(pick.priceCr)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
