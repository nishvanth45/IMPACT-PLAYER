import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Disc3,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
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
  getPlayerDisplayPriceInfo,
} from '../game/draftEngine';
import { validateLeagueDraft } from '../game/liveDraftEngine';
import { getRetentionSummary } from '../game/retentionEngine';
import type {
  CustomFranchise,
  DraftState,
  FranchiseCode,
  PlayerRole,
  PlayerSeasonRecord,
} from '../types/game';
import { buildSpinDecelerationSchedule } from '../game/animationEngine';
import { playDraftConfirm, playSpinLock, playSpinTick } from '../utils/sound';
import { FranchiseCreator } from './FranchiseCreator';
import { LiveDraftTeamsModal } from './LiveDraftTeamsModal';
import {
  AnimatedNumber,
  FranchiseBadge,
  useAnimationPreferences,
} from './MotionPrimitives';
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
  { id: 'BOWLING_DESC', label: 'BOWL ↓' },
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
  onStartNewDraft,
  onInspectPlayer,
}: DraftScreenProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelPreview, setReelPreview] = useState<{ franchise: FranchiseCode; season: number }>({
    franchise: 'CSK',
    season: 2018,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');
  const [isAllTeamsOpen, setIsAllTeamsOpen] = useState(false);
  const [justLockedSpin, setJustLockedSpin] = useState(false);
  const [signedFlight, setSignedFlight] = useState<{
    id: string;
    playerName: string;
    priceLabel: string;
  } | null>(null);
  const [hudFlashKey, setHudFlashKey] = useState(0);
  const [retentionsLockedNotice, setRetentionsLockedNotice] = useState(false);

  const animPrefs = useAnimationPreferences(state.settings);

  // Detect Retention -> Spin Draft transition for brief RETENTIONS LOCKED confirmation
  const prevRetentionLockedRef = useRef<boolean>(state.retention.locked);
  useEffect(() => {
    if (!prevRetentionLockedRef.current && state.retention.locked) {
      setRetentionsLockedNotice(true);
      const t = window.setTimeout(() => setRetentionsLockedNotice(false), 1600);
      prevRetentionLockedRef.current = state.retention.locked;
      return () => window.clearTimeout(t);
    }
    prevRetentionLockedRef.current = state.retention.locked;
  }, [state.retention.locked]);

  // Non-blocking slide-in-from-right ticker for latest AI draft cycle
  const lastRoundTxs = state.liveLeague?.lastRoundTransactions ?? [];
  const lastRoundTxsRef = useRef(lastRoundTxs);
  lastRoundTxsRef.current = lastRoundTxs;

  const lastRoundKey = useMemo(() => {
    if (lastRoundTxs.length === 0) return '';
    return `${state.liveLeague?.totalPicks ?? 0}-${lastRoundTxs[0]?.pickNumber ?? 0}-${lastRoundTxs.length}`;
  }, [lastRoundTxs.length, lastRoundTxs[0]?.pickNumber, state.liveLeague?.totalPicks]);

  const [revealedCount, setRevealedCount] = useState<number>(lastRoundTxs.length);
  const [activeTickerIdx, setActiveTickerIdx] = useState<number>(-1);
  const revealIntervalRef = useRef<number | null>(null);
  const tickerIntervalRef = useRef<number | null>(null);
  const prevRoundKeyRef = useRef<string>(lastRoundKey);

  useEffect(() => {
    if (revealIntervalRef.current !== null) {
      window.clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
    if (tickerIntervalRef.current !== null) {
      window.clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }

    const roundTxs = lastRoundTxsRef.current;
    if (!lastRoundKey || roundTxs.length === 0) {
      setRevealedCount(0);
      setActiveTickerIdx(-1);
      prevRoundKeyRef.current = lastRoundKey;
      return;
    }

    const isFreshRound = prevRoundKeyRef.current !== lastRoundKey;
    prevRoundKeyRef.current = lastRoundKey;

    if (!isFreshRound || animPrefs.isOff || animPrefs.isReduced) {
      setRevealedCount(roundTxs.length);
      setActiveTickerIdx(-1);
      return;
    }

    // Non-blocking rapid cascade into RECENT SIGNINGS + sliding compact ticker
    setRevealedCount(1);
    const aiOnlyIndices = roundTxs
      .map((tx, idx) => (tx.teamId !== 'YOU' ? idx : -1))
      .filter((idx) => idx >= 0);

    let current = 1;
    revealIntervalRef.current = window.setInterval(() => {
      current += 1;
      setRevealedCount(current);
      if (current >= roundTxs.length && revealIntervalRef.current !== null) {
        window.clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
    }, 55);

    if (aiOnlyIndices.length > 0) {
      let step = 0;
      setActiveTickerIdx(aiOnlyIndices[0]);
      tickerIntervalRef.current = window.setInterval(() => {
        step += 1;
        if (step >= Math.min(aiOnlyIndices.length, 4)) {
          setActiveTickerIdx(-1);
          if (tickerIntervalRef.current !== null) {
            window.clearInterval(tickerIntervalRef.current);
            tickerIntervalRef.current = null;
          }
        } else {
          setActiveTickerIdx(aiOnlyIndices[step]);
        }
      }, 650);
    }

    return () => {
      if (revealIntervalRef.current !== null) {
        window.clearInterval(revealIntervalRef.current);
        revealIntervalRef.current = null;
      }
      if (tickerIntervalRef.current !== null) {
        window.clearInterval(tickerIntervalRef.current);
        tickerIntervalRef.current = null;
      }
    };
  }, [lastRoundKey, animPrefs.isOff, animPrefs.isReduced]);

  const spinTimersRef = useRef<number[]>([]);
  const signedFlightTimerRef = useRef<number | null>(null);

  const clearSpinTimers = () => {
    for (const id of spinTimersRef.current) {
      window.clearTimeout(id);
    }
    spinTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearSpinTimers();
      if (signedFlightTimerRef.current !== null) {
        window.clearTimeout(signedFlightTimerRef.current);
        signedFlightTimerRef.current = null;
      }
    };
  }, []);

  const spinComboKey = state.currentSpin?.comboKey ?? null;
  const prevSpinComboRef = useRef<string | null>(spinComboKey);
  useEffect(() => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setOriginFilter('ALL');
    if (spinComboKey && spinComboKey !== prevSpinComboRef.current && !animPrefs.isOff) {
      setJustLockedSpin(true);
      const t = window.setTimeout(() => setJustLockedSpin(false), 520);
      prevSpinComboRef.current = spinComboKey;
      return () => window.clearTimeout(t);
    }
    prevSpinComboRef.current = spinComboKey;
  }, [spinComboKey, animPrefs.isOff]);

  const retentionSummary = getRetentionSummary(state);
  const isRetentionPhase = !state.retention.locked;
  const overseasCount = isRetentionPhase
    ? retentionSummary.overseasCount
    : getOverseasCount(state.squad);
  const displaySquadCount = isRetentionPhase
    ? retentionSummary.retainedCount
    : state.squad.length;
  const currentPickNumber = Math.min(state.settings.squadSize, displaySquadCount + 1);
  const eligibleCombos = getEligibleSpinCombos(state, repository);
  const currentSpin = state.currentSpin;
  const activeFranchiseMeta = currentSpin
    ? FRANCHISES[currentSpin.franchise]
    : FRANCHISES[reelPreview.franchise];

  const liveLeague = state.liveLeague ?? null;
  const leagueValidation = useMemo(() => {
    if (!liveLeague) return null;
    if (state.status === 'COMPLETED' || state.squad.length >= state.settings.squadSize) {
      return liveLeague.validation ?? validateLeagueDraft(state);
    }
    return null;
  }, [liveLeague, state]);

  const finalizeSpinNow = () => {
    clearSpinTimers();
    setIsSpinning(false);
    playSpinLock(state.settings.soundEnabled);
    onSpin();
  };

  const handleSpinClick = () => {
    if (isSpinning || state.status === 'COMPLETED' || eligibleCombos.length === 0) {
      return;
    }

    const schedule = buildSpinDecelerationSchedule(animPrefs.effectiveMode);
    if (schedule.length === 0) {
      finalizeSpinNow();
      return;
    }

    setIsSpinning(true);
    clearSpinTimers();

    let elapsed = 0;
    schedule.forEach((stepDelay, idx) => {
      elapsed += stepDelay;
      const timerId = window.setTimeout(() => {
        const randomCombo =
          eligibleCombos[Math.floor(Math.random() * eligibleCombos.length)];
        if (randomCombo) {
          setReelPreview({
            franchise: randomCombo.franchise,
            season: randomCombo.season,
          });
        }
        playSpinTick(state.settings.soundEnabled);

        if (idx === schedule.length - 1) {
          const lockId = window.setTimeout(() => {
            finalizeSpinNow();
          }, 95);
          spinTimersRef.current.push(lockId);
        }
      }, elapsed);
      spinTimersRef.current.push(timerId);
    });
  };

  const handleSelect = (player: PlayerSeasonRecord) => {
    playDraftConfirm(state.settings.soundEnabled);
    // Persist immediately — animations never delay state or database writes
    onSelectPlayer(player);
    if (!animPrefs.isOff) {
      const priceInfo = getPlayerDisplayPriceInfo(player);
      setHudFlashKey((k) => k + 1);
      setSignedFlight({
        id: `${player.playerId}-${Date.now()}`,
        playerName: player.name || player.playerName,
        priceLabel: priceInfo.amountCr !== null ? formatCr(priceInfo.amountCr) : 'SIGNED',
      });
      if (signedFlightTimerRef.current !== null) {
        window.clearTimeout(signedFlightTimerRef.current);
      }
      signedFlightTimerRef.current = window.setTimeout(() => {
        setSignedFlight(null);
        signedFlightTimerRef.current = null;
      }, 740);
    }
  };

  const poolHasSelectable = currentSpin ? canAffordAnyInPool(state, currentSpin.pool) : true;

  const poolAvailabilityStats = useMemo(() => {
    if (!currentSpin) return { available: 0, owned: 0, total: 0 };
    let available = 0;
    let owned = 0;
    for (const p of currentSpin.pool) {
      const check = canSelectPlayer(state, p);
      if (check.allowed) available += 1;
      else if (check.reason === 'ALREADY_DRAFTED') owned += 1;
    }
    return { available, owned, total: currentSpin.pool.length };
  }, [currentSpin, state]);

  const filteredAndSortedPool = useMemo(() => {
    if (!currentSpin) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = currentSpin.pool.filter((player) => {
      if (roleFilter !== 'ALL' && player.role !== roleFilter) return false;
      if (originFilter === 'INDIAN' && player.isOverseas !== false) return false;
      if (originFilter === 'OVERSEAS' && player.isOverseas !== true) return false;
      const nameLower = (player.name || player.playerName).toLowerCase();
      const aliasMatch = (player.aliases ?? []).some((a) =>
        a.toLowerCase().includes(normalizedQuery)
      );
      if (
        normalizedQuery &&
        !nameLower.includes(normalizedQuery) &&
        !aliasMatch &&
        !(player.nationality ?? '').toLowerCase().includes(normalizedQuery)
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
        case 'PRICE_DESC': {
          const sa = getPlayerDisplayPriceInfo(a).amountCr;
          const sb = getPlayerDisplayPriceInfo(b).amountCr;
          if (sa === null && sb === null) return b.overallRating - a.overallRating;
          if (sa === null) return 1;
          if (sb === null) return -1;
          return sb - sa || b.overallRating - a.overallRating;
        }
        case 'PRICE_ASC': {
          const sa = getPlayerDisplayPriceInfo(a).amountCr;
          const sb = getPlayerDisplayPriceInfo(b).amountCr;
          if (sa === null && sb === null) return b.overallRating - a.overallRating;
          if (sa === null) return 1;
          if (sb === null) return -1;
          return sa - sb || b.overallRating - a.overallRating;
        }
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

  const compactBoardTeams = useMemo(() => {
    if (!liveLeague) return [];
    // Show user franchise first + top 5 rival franchises for compact density
    return liveLeague.teamOrder.slice(0, 6).map((tid) => liveLeague.teams[tid]).filter(Boolean);
  }, [liveLeague]);

  const recentFeedItems = useMemo(() => {
    if (!liveLeague) return [];
    return [...liveLeague.feed].reverse().slice(0, 15);
  }, [liveLeague]);

  if (!state.customFranchise) {
    return (
      <FranchiseCreator
        defaultName={state.settings.franchiseName}
        onCreateFranchise={onCreateFranchise}
      />
    );
  }

  const canProceedFromCompleted = !leagueValidation || leagueValidation.isValid;

  const activeAiTickerTx =
    activeTickerIdx >= 0 && activeTickerIdx < lastRoundTxs.length
      ? lastRoundTxs[activeTickerIdx]
      : null;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-3 py-3 pb-20 sm:px-4 md:pb-8">
      {/* Non-blocking Floating SIGNED Flight Cue toward Squad Bar */}
      {signedFlight && (
        <div
          key={signedFlight.id}
          aria-live="polite"
          className="ip-flight-badge pointer-events-none fixed right-4 top-16 z-40 flex items-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-3 py-1.5 font-mono text-xs font-extrabold text-[#22D36B] shadow-lg"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#22D36B]" aria-hidden="true" />
          <span>SIGNED ✓ {signedFlight.playerName}</span>
          <span className="text-[#F5F2EA]/80">· {signedFlight.priceLabel}</span>
        </div>
      )}

      {/* Non-blocking RETENTIONS LOCKED confirmation banner */}
      {retentionsLockedNotice && !isRetentionPhase && (
        <div
          data-testid="retentions-locked-banner"
          className="ip-fade-slide mb-2.5 flex items-center justify-between gap-2 border border-[#22D36B]/60 bg-[#0A2014] px-3.5 py-2 text-[#F5F2EA]"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-extrabold tracking-wider text-[#22D36B] uppercase">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22D36B]" aria-hidden="true" />
            <span>RETENTIONS LOCKED · ENTERING SPIN DRAFT</span>
          </div>
          <button
            type="button"
            onClick={() => setRetentionsLockedNotice(false)}
            aria-label="Dismiss notice"
            className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase hover:text-[#F5F2EA]"
          >
            OK
          </button>
        </div>
      )}

      {/* Non-blocking Live AI Draft Slide-in Ticker */}
      {activeAiTickerTx && !isRetentionPhase && (
        <div
          key={`ticker-${activeAiTickerTx.pickNumber}-${activeAiTickerTx.teamId}`}
          data-testid="ai-draft-ticker"
          aria-live="polite"
          className="ip-slide-right pointer-events-none fixed bottom-16 right-4 z-30 flex items-center gap-2 rounded-[2px] border border-[#22D36B]/55 bg-[#0E1318] px-3 py-2 font-mono text-xs text-[#F5F2EA] shadow-2xl md:bottom-5"
        >
          <FranchiseBadge
            code={activeAiTickerTx.teamCode}
            primaryColor={
              FRANCHISES[activeAiTickerTx.teamCode as FranchiseCode]?.primaryColor ?? '#111820'
            }
            secondaryColor={
              FRANCHISES[activeAiTickerTx.teamCode as FranchiseCode]?.accentColor ?? '#F5B942'
            }
            size="xs"
          />
          <span className="font-extrabold text-[#22D36B]">{activeAiTickerTx.teamCode}</span>
          <span className="text-[#9DA8B3]">SIGNED</span>
          <span className="font-extrabold text-[#F5F2EA]">{activeAiTickerTx.playerName}</span>
        </div>
      )}

      {/* TOP STATUS BAR: PURSE · SQUAD X/15 · OVERSEAS X/6 · PICK X */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[#263039] border border-[#263039] bg-[#0E1318] sm:grid-cols-4 sm:divide-y-0">
        <div
          key={`hud-purse-${hudFlashKey}`}
          className={`flex items-baseline justify-between px-3 py-2.5 ${
            hudFlashKey > 0 ? 'ip-green-flash' : ''
          }`}
        >
          <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">PURSE</span>
          <span
            data-testid="hud-purse"
            className={`font-mono text-sm font-extrabold tabular-nums sm:text-base ${
              state.remainingPurseCr < 6 ? 'text-[#F05A32]' : 'text-[#F5B942]'
            }`}
          >
            <AnimatedNumber
              value={state.remainingPurseCr}
              enabled={animPrefs.isFull}
              format={(v) => formatCr(Math.max(0, v))}
            />
          </span>
        </div>

        <div
          key={`hud-squad-${hudFlashKey}`}
          className={`flex items-baseline justify-between px-3 py-2.5 ${
            hudFlashKey > 0 ? 'ip-green-flash' : ''
          }`}
        >
          <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">SQUAD</span>
          <span
            data-testid="hud-squad-count"
            className="font-mono text-sm font-extrabold text-[#F5F2EA] tabular-nums sm:text-base"
          >
            <AnimatedNumber
              value={displaySquadCount}
              enabled={animPrefs.isFull}
              format={(v) => String(Math.round(v))}
            />
            /{state.settings.squadSize}
          </span>
        </div>

        <div className="flex items-baseline justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">OVERSEAS</span>
          <span
            data-testid="hud-overseas-count"
            className={`font-mono text-sm font-extrabold tabular-nums sm:text-base ${
              overseasCount >= state.settings.overseasSquadLimit
                ? 'text-[#F5B942]'
                : 'text-[#22D36B]'
            }`}
          >
            {overseasCount}/{state.settings.overseasSquadLimit}
          </span>
        </div>

        <div className="flex items-baseline justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
            {liveLeague ? 'LEAGUE ROUND' : 'PICK'}
          </span>
          <span
            data-testid="hud-players-remaining"
            className="font-mono text-sm font-extrabold text-[#22D36B] tabular-nums sm:text-base"
          >
            {state.status === 'COMPLETED' ? 'DONE' : `PICK ${currentPickNumber}`}
          </span>
        </div>
      </div>

      {/* RETENTION ROOM OR LIVE 11-FRANCHISE DRAFT ROOM */}
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
      ) : state.status === 'COMPLETED' || state.squad.length >= state.settings.squadSize ? (
        <div
          data-testid="draft-completed-panel"
          className="mt-4 border border-[#263039] bg-[#0E1318] p-6 text-center sm:p-8"
        >
          <div
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-[2px] border ${
              canProceedFromCompleted
                ? 'border-[#22D36B]/50 bg-[#0A2014] text-[#22D36B]'
                : 'border-[#E44949]/50 bg-[#231012] text-[#E44949]'
            }`}
          >
            {canProceedFromCompleted ? (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-[#F5F2EA] uppercase">
            {canProceedFromCompleted
              ? `11-FRANCHISE DRAFT COMPLETE (${state.squad.length}/${state.settings.squadSize})`
              : 'LEAGUE DRAFT VALIDATION FAILED'}
          </h2>
          <p className="mx-auto mt-1 max-w-md font-mono text-xs text-[#9DA8B3] tabular-nums">
            Remaining Purse: {formatCr(state.remainingPurseCr)} · Overseas: {overseasCount}/
            {state.settings.overseasSquadLimit}
          </p>

          {leagueValidation && (
            <div
              data-testid="league-validation-summary"
              className={`mx-auto mt-3 max-w-xl border px-3.5 py-2 font-mono text-[11px] tabular-nums ${
                leagueValidation.isValid
                  ? 'border-[#22D36B]/40 bg-[#0A2014] text-[#22D36B]'
                  : 'border-[#E44949]/40 bg-[#231012] text-[#FCA5A5]'
              }`}
            >
              {leagueValidation.isValid ? (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {leagueValidation.totalTeams} TEAMS · {leagueValidation.totalRosterSlots}{' '}
                    SLOTS · {leagueValidation.uniqueCanonicalPlayers} UNIQUE PLAYERS · 0 DUPLICATES
                  </span>
                </div>
              ) : (
                <ul className="space-y-1 text-left">
                  {leagueValidation.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={!canProceedFromCompleted}
              onClick={onGoToSquad}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border px-6 py-2 font-display text-lg font-extrabold tracking-wider uppercase whitespace-nowrap ${
                canProceedFromCompleted
                  ? 'border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
                  : 'cursor-not-allowed border-[#263039] bg-[#111820] text-[#667380]'
              }`}
            >
              <span>OPEN MY FRANCHISE ROSTER</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {liveLeague && (
              <button
                type="button"
                onClick={() => setIsAllTeamsOpen(true)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#263039] bg-[#111820] px-5 py-2 font-mono text-xs font-bold tracking-wider text-[#F5F2EA] uppercase hover:border-[#22D36B]/50 hover:text-[#22D36B] whitespace-nowrap"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>VIEW ALL 11 TEAMS</span>
              </button>
            )}
            <button
              type="button"
              onClick={onStartNewDraft}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#263039] bg-[#0E1318] px-5 py-2 font-mono text-xs font-bold tracking-wider text-[#9DA8B3] uppercase hover:border-[#F05A32]/50 hover:text-[#F5F2EA] whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>NEW DRAFT</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {/* Compact Spin Stage / Post-Spin Result Header */}
          {currentSpin && !isSpinning && poolHasSelectable ? (
            <div
              data-testid="spin-result-display"
              className={`flex flex-wrap items-center justify-between gap-2 border bg-[#111820] px-4 py-2.5 text-[#F5F2EA] transition-colors ${
                justLockedSpin
                  ? 'border-[#22D36B] ip-green-lock-flash'
                  : 'border-[#263039]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FranchiseBadge
                  code={currentSpin.franchise}
                  primaryColor={activeFranchiseMeta.primaryColor}
                  secondaryColor={activeFranchiseMeta.accentColor}
                  size="sm"
                  className={justLockedSpin ? 'ring-2 ring-[#22D36B]' : ''}
                />
                <span className="font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] tabular-nums sm:text-3xl">
                  {currentSpin.franchise} • {currentSpin.season}
                </span>
                <span className="hidden text-xs font-semibold text-[#9DA8B3] sm:inline">
                  {activeFranchiseMeta.name}
                </span>
              </div>

              <div className="flex items-center gap-2.5 font-mono text-xs tabular-nums">
                <span className="font-bold text-[#22D36B] uppercase">
                  {poolAvailabilityStats.available} AVAILABLE
                </span>
                {poolAvailabilityStats.owned > 0 && (
                  <>
                    <span className="text-[#263039]">·</span>
                    <span className="font-semibold text-[#9DA8B3] uppercase">
                      {poolAvailabilityStats.owned} OWNED
                    </span>
                  </>
                )}
                <span className="hidden text-[#263039] sm:inline">·</span>
                <span className="hidden text-[#9DA8B3] sm:inline">
                  PICK {state.squad.length + 1} OF {state.settings.squadSize}
                </span>
              </div>
            </div>
          ) : (
            <div className="border border-[#263039] bg-[#0E1318] px-4 py-4 text-[#F5F2EA] sm:px-5">
              {/* LIVE DRAFT ROUND ACTIVITY PANEL (shown right after each user pick / retention lock) */}
              {!currentSpin && !isSpinning && lastRoundTxs.length > 0 && (
                <div
                  data-testid="live-draft-round-activity"
                  className="mb-4 border border-[#263039] bg-[#111820] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] pb-2">
                    <div className="flex items-center gap-2 font-mono text-[10.5px] font-extrabold tracking-widest text-[#22D36B] uppercase">
                      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        LIVE DRAFT · ROUND {liveLeague?.roundNumber ?? state.squad.length} ACTIVITY
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                      {liveLeague?.ownedPlayerIds.length ?? state.squad.length} /{' '}
                      {state.settings.squadSize * 11} LEAGUE PICKS CLAIMED
                    </span>
                  </div>

                  <div className="mt-2 grid max-h-[188px] grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto sm:max-h-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
                    {lastRoundTxs.slice(0, revealedCount).map((tx) => {
                      const isUserTx = tx.teamId === 'YOU';
                      return (
                        <div
                          key={`${tx.pickNumber}-${tx.teamId}-${tx.canonicalId}`}
                          className={`flex items-center justify-between gap-2 border-b border-[#263039]/60 py-1 font-mono text-[11px] ${
                            isUserTx ? 'text-[#F5F2EA]' : 'text-[#9DA8B3]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={`shrink-0 rounded-[2px] px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                                isUserTx
                                  ? 'bg-[#22D36B] text-[#06110A]'
                                  : 'border border-[#263039] bg-[#0E1318] text-[#F5B942]'
                              }`}
                            >
                              {isUserTx ? 'YOU' : tx.teamCode}
                            </span>
                            <span className="truncate">
                              <span className="text-[#9DA8B3]">signed </span>
                              <span className="font-bold text-[#F5F2EA]">{tx.playerName}</span>
                            </span>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-[#9DA8B3] tabular-nums">
                            {tx.salaryCr === null ? 'PENDING' : formatCr(tx.salaryCr)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center text-center">
                <div className="font-mono text-[10.5px] font-bold tracking-widest text-[#F5B942] uppercase">
                  {isSpinning
                    ? 'SPINNING FRANCHISE & SEASON...'
                    : `LIVE 11-FRANCHISE DRAFT · PICK ${currentPickNumber} OF ${state.settings.squadSize}`}
                </div>

                <div
                  data-testid="spin-result-display"
                  className={`mt-2 flex w-full max-w-md items-center justify-center gap-3 rounded-[2px] border bg-[#111820] px-4 py-3 transition-colors ${
                    isSpinning
                      ? 'border-[#F05A32]'
                      : justLockedSpin
                        ? 'border-[#22D36B] ip-green-lock-flash'
                        : 'border-[#263039]'
                  }`}
                >
                  {currentSpin || isSpinning ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-3">
                        <FranchiseBadge
                          code={
                            currentSpin && !isSpinning
                              ? currentSpin.franchise
                              : reelPreview.franchise
                          }
                          primaryColor={activeFranchiseMeta.primaryColor}
                          secondaryColor={activeFranchiseMeta.accentColor}
                          size="md"
                          className={
                            isSpinning
                              ? 'scale-105 transition-transform duration-75'
                              : justLockedSpin
                                ? 'ring-2 ring-[#22D36B]'
                                : ''
                          }
                        />
                        <span className="font-display text-3xl font-extrabold tracking-wide text-[#F5F2EA] tabular-nums sm:text-4xl">
                          {currentSpin && !isSpinning
                            ? `${currentSpin.franchise} • ${currentSpin.season}`
                            : `${reelPreview.franchise} • ${reelPreview.season}`}
                        </span>
                      </div>
                      <span className="mt-1 text-xs text-[#9DA8B3]">
                        {activeFranchiseMeta.name}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-3xl">
                        FRANCHISE • SEASON
                      </div>
                      <div className="mt-0.5 font-mono text-[10.5px] text-[#9DA8B3]">
                        {eligibleCombos.length} unused historical squads ({state.settings.seasonStart}
                        –{state.settings.seasonEnd})
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 w-full max-w-sm">
                  {!poolHasSelectable && currentSpin && (
                    <p className="mb-2 text-xs font-semibold text-[#F05A32]">
                      No eligible available players left in {currentSpin.franchise}{' '}
                      {currentSpin.season}. Re-spin to continue.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      data-testid="spin-action-btn"
                      disabled={isSpinning || eligibleCombos.length === 0}
                      onClick={handleSpinClick}
                      className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[2px] border px-6 py-2 font-display text-xl font-extrabold tracking-wider uppercase transition-colors ${
                        isSpinning
                          ? 'cursor-wait border-[#F05A32] bg-[#F05A32] text-[#080B0D]'
                          : 'border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
                      }`}
                    >
                      <Disc3
                        className={`h-5 w-5 ${isSpinning ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>
                        {isSpinning
                          ? 'SPINNING...'
                          : currentSpin
                            ? 'RE-SPIN FRANCHISE + SEASON'
                            : lastRoundTxs.length > 0
                              ? 'SPIN AGAIN'
                              : 'SPIN FRANCHISE + SEASON'}
                      </span>
                    </button>

                    {isSpinning && (
                      <button
                        type="button"
                        data-testid="skip-spin-btn"
                        onClick={finalizeSpinNow}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] border border-[#22D36B] bg-[#0A2014] px-3.5 py-2 font-mono text-[11px] font-extrabold tracking-wider text-[#22D36B] uppercase transition-colors hover:bg-[#103220] whitespace-nowrap"
                      >
                        SKIP ANIMATION
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Spun Squad Filter Bar + Compact Dark Player Table */}
          {currentSpin && !isSpinning && (
            <div className="mt-2.5">
              <div className="border border-[#263039] bg-[#111820] p-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative min-w-[165px] flex-1 sm:max-w-[210px]">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9DA8B3]"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search player..."
                        aria-label="Search players"
                        className="h-8 w-full rounded-[2px] border border-[#263039] bg-[#080B0D] pl-8 pr-7 text-xs font-medium text-[#F5F2EA] placeholder:text-[#667380] focus:border-[#22D36B] focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#9DA8B3] hover:text-[#F5F2EA]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                      role="group"
                      aria-label="Filter by role"
                    >
                      {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as RoleFilter[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRoleFilter(role)}
                          aria-pressed={roleFilter === role}
                          className={`h-6 rounded-[2px] px-2 font-mono text-[10px] font-bold transition-colors ${
                            roleFilter === role
                              ? 'bg-[#22D36B] text-[#06110A]'
                              : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>

                    <div
                      className="flex items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                      role="group"
                      aria-label="Filter by nationality"
                    >
                      {(
                        [
                          { id: 'ALL', label: 'ALL' },
                          { id: 'INDIAN', label: 'IND' },
                          { id: 'OVERSEAS', label: 'OS' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOriginFilter(opt.id)}
                          aria-pressed={originFilter === opt.id}
                          className={`h-6 rounded-[2px] px-2 font-mono text-[10px] font-bold transition-colors ${
                            originFilter === opt.id
                              ? 'bg-[#22D36B] text-[#06110A]'
                              : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#080B0D] p-0.5"
                    role="group"
                    aria-label="Sort players"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortBy(opt.id)}
                        aria-pressed={sortBy === opt.id}
                        className={`h-6 rounded-[2px] px-2 font-mono text-[10px] font-bold transition-colors whitespace-nowrap ${
                          sortBy === opt.id
                            ? 'bg-[#22D36B] text-[#06110A]'
                            : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player Table: ROLE | PLAYER | BAT | BOWL | IMP | OVR | PRICE | ACTION */}
              <div className="mt-2 overflow-hidden border border-[#263039] bg-[#0E1318]">
                <div className="md:max-h-[500px] md:overflow-y-auto">
                  <div
                    className={`hidden sticky top-0 z-10 border-b border-[#263039] bg-[#111820] px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase ${DRAFT_TABLE_GRID_COLS}`}
                  >
                    <div>ROLE</div>
                    <div>PLAYER</div>
                    <div className="text-center">BAT</div>
                    <div className="text-center">BOWL</div>
                    <div className="text-center">IMP</div>
                    <div className="text-center">OVR</div>
                    <div className="text-right">PRICE</div>
                    <div className="text-right">ACTION</div>
                  </div>

                  {filteredAndSortedPool.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs font-medium text-[#9DA8B3]">
                        No players match your current filters.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setRoleFilter('ALL');
                            setOriginFilter('ALL');
                          }}
                          className="mt-2 inline-flex min-h-[32px] items-center justify-center rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-3.5 py-1 font-mono text-[11px] font-extrabold text-[#06110A] uppercase hover:bg-[#3CE282]"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div data-testid="draft-player-list" key={currentSpin.comboKey}>
                      {filteredAndSortedPool.map((player, idx) => {
                        const signedFromPool = state.squad.some(
                          (s) =>
                            s.playerId === player.playerId &&
                            s.franchise === player.franchise &&
                            s.season === player.season
                        );
                        return (
                          <PlayerCard
                            key={`${player.franchise}-${player.season}-${player.playerId}`}
                            player={player}
                            check={canSelectPlayer(state, player)}
                            isSignedInThisPool={signedFromPool}
                            animIndex={idx}
                            animateRows={!animPrefs.isOff}
                            onSelect={handleSelect}
                            onInspectPlayer={onInspectPlayer}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIVE DRAFT BOARD (TEAM | PICKS | PURSE | OS) + LIVE DRAFT FEED */}
      {!isRetentionPhase && liveLeague && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Compact LIVE DRAFT Board */}
          <div
            data-testid="live-draft-board"
            className="border border-[#263039] bg-[#0E1318]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-3 py-2 text-[#F5F2EA]">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-extrabold tracking-wider uppercase">
                  LIVE DRAFT BOARD
                </h3>
                <span className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                  11 TEAMS
                </span>
              </div>
              <button
                type="button"
                data-testid="view-all-teams-btn"
                onClick={() => setIsAllTeamsOpen(true)}
                className="rounded-[2px] border border-[#263039] bg-[#0E1318] px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider text-[#F5F2EA] uppercase hover:border-[#22D36B] hover:text-[#22D36B]"
              >
                VIEW ALL TEAMS
              </button>
            </div>

            <div className="grid grid-cols-[1.2fr_0.65fr_0.95fr_0.55fr] items-center gap-2 border-b border-[#263039] bg-[#080B0D] px-3 py-1 font-mono text-[9.5px] font-bold tracking-wider text-[#9DA8B3] uppercase">
              <div>TEAM</div>
              <div className="text-center">PICKS</div>
              <div className="text-right">PURSE</div>
              <div className="text-right">OS</div>
            </div>

            <div className="divide-y divide-[#263039]">
              {compactBoardTeams.map((team) => (
                <div
                  key={team.teamId}
                  className={`grid grid-cols-[1.2fr_0.65fr_0.95fr_0.55fr] items-center gap-2 px-3 py-1.5 font-mono text-xs tabular-nums ${
                    team.isUser ? 'bg-[#22D36B]/[0.07]' : 'bg-[#0E1318]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: team.primaryColor }}
                      aria-hidden="true"
                    />
                    <span className="font-extrabold text-[#F5F2EA]">{team.code}</span>
                    {team.isUser && (
                      <span className="rounded-[2px] bg-[#22D36B] px-1 text-[8.5px] font-extrabold text-[#06110A]">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-center font-bold text-[#F5F2EA]">
                    {team.squad.length}/{state.settings.squadSize}
                  </div>
                  <div className="text-right font-extrabold text-[#F5B942]">
                    {formatCr(team.remainingPurseCr)}
                  </div>
                  <div
                    className={`text-right font-bold ${
                      team.overseasCount >= state.settings.overseasSquadLimit
                        ? 'text-[#F5B942]'
                        : 'text-[#22D36B]'
                    }`}
                  >
                    {team.overseasCount}/{state.settings.overseasSquadLimit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LIVE DRAFT FEED */}
          <div
            data-testid="live-draft-feed"
            className="flex flex-col border border-[#263039] bg-[#0E1318]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-3 py-2 text-[#F5F2EA]">
              <h3 className="font-display text-base font-extrabold tracking-wider uppercase">
                DRAFT FEED
              </h3>
              <span className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                LATEST {recentFeedItems.length} PICKS
              </span>
            </div>

            {recentFeedItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-6 font-mono text-xs text-[#9DA8B3]">
                Spin and sign your first player to kick off the 11-franchise live draft.
              </div>
            ) : (
              <div className="max-h-[218px] divide-y divide-[#263039] overflow-y-auto">
                {recentFeedItems.map((tx) => {
                  const isUserTx = tx.teamId === 'YOU';
                  return (
                    <div
                      key={`${tx.pickNumber}-${tx.teamId}-${tx.canonicalId}`}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 font-mono text-[11px] ${
                        isUserTx ? 'bg-[#22D36B]/[0.07]' : 'bg-[#0E1318]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[10px] font-bold text-[#9DA8B3] tabular-nums">
                          PICK {tx.pickNumber}
                        </span>
                        <span className="text-[#263039]">·</span>
                        <span
                          className={`shrink-0 font-extrabold ${
                            isUserTx ? 'text-[#22D36B]' : 'text-[#F5F2EA]'
                          }`}
                        >
                          {tx.teamCode}
                        </span>
                        <span className="truncate text-[#9DA8B3]">
                          {tx.isRetained ? 'retained ' : 'signed '}
                          <span className="font-bold text-[#F5F2EA]">{tx.playerName}</span>
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-[#F5B942] tabular-nums">
                        {tx.salaryCr === null ? 'PENDING' : formatCr(tx.salaryCr)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact User Signed Squad Strip */}
      {!isRetentionPhase && state.squad.length > 0 && (
        <div className="mt-3 border border-[#263039] bg-[#0E1318] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-extrabold tracking-wider text-[#F5F2EA] uppercase">
              YOUR SIGNED PLAYERS ({state.squad.length}/{state.settings.squadSize})
            </h3>
            <button
              type="button"
              onClick={onGoToSquad}
              className="font-mono text-[10.5px] font-bold text-[#22D36B] uppercase hover:underline"
            >
              Open Roster →
            </button>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {state.squad.map((pick, idx) => {
              const info = getPlayerDisplayPriceInfo(pick);
              return (
                <div
                  key={`${pick.playerId}-${idx}`}
                  className={`shrink-0 rounded-[2px] border px-2 py-1 ${
                    pick.isRetained
                      ? 'border-[#22D36B]/45 bg-[#0A2014]'
                      : 'border-[#263039] bg-[#111820]'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#F5F2EA]">
                    <span>
                      {idx + 1}. {pick.playerName}
                    </span>
                    {pick.isRetained && (
                      <span className="rounded-[2px] bg-[#22D36B] px-1 font-mono text-[8px] font-extrabold text-[#06110A]">
                        RET
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[9.5px] text-[#9DA8B3] tabular-nums">
                    {pick.franchise} {pick.season} · {pick.role} ·{' '}
                    {info.amountCr === null ? 'DATA PENDING' : formatCr(info.amountCr)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAllTeamsOpen && liveLeague && (
        <LiveDraftTeamsModal
          liveLeague={liveLeague}
          settings={state.settings}
          onClose={() => setIsAllTeamsOpen(false)}
          onInspectPlayer={onInspectPlayer}
        />
      )}
    </section>
  );
}
