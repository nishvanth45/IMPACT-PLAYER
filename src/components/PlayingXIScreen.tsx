import { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Crown,
  GripVertical,
  Info,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { formatCr, getOverseasCount, getPlayerSalaryCr } from '../game/draftEngine';
import {
  PLAYING_XI_SIZE,
  calculateTeamSummary,
  getBowlingOptions,
  validatePlayingXI,
} from '../game/playingXiEngine';
import type { DraftState, PlayerSeasonRecord, PlayingXIState } from '../types/game';
import { CricketField } from './CricketField';
import { useAnimationPreferences } from './MotionPrimitives';
import { RoleBadge } from './RoleBadge';

interface PlayingXIScreenProps {
  draftState: DraftState;
  xiState: PlayingXIState;
  onAutoSelectXI: () => void;
  onAddPlayer: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onSwapPlayers: (xiPlayerId: string, benchPlayerId: string) => void;
  onReorderBatting: (fromIndex: number, toIndex: number) => void;
  onSelectCaptain: (playerId: string) => void;
  onSelectWicketkeeper: (playerId: string) => void;
  onConfirmXI: () => void;
  onStartSeason: () => void;
  hasActiveSeason: boolean;
  onGoToDraft: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

type SquadSubPanel = 'BATTING_ORDER' | 'ROSTER' | 'BOWLING';

export function PlayingXIScreen({
  draftState,
  xiState,
  onAutoSelectXI,
  onAddPlayer,
  onRemovePlayer,
  onSwapPlayers,
  onReorderBatting,
  onSelectCaptain,
  onSelectWicketkeeper,
  onConfirmXI,
  onStartSeason,
  hasActiveSeason,
  onGoToDraft,
  onInspectPlayer,
}: PlayingXIScreenProps) {
  const [swapXiId, setSwapXiId] = useState<string | null>(null);
  const [swapBenchId, setSwapBenchId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<SquadSubPanel>('BATTING_ORDER');
  const [editModeHint, setEditModeHint] = useState<'NONE' | 'EDIT' | 'CAPTAIN' | 'KEEPER'>('NONE');
  const [recentlyMovedIds, setRecentlyMovedIds] = useState<Set<string>>(new Set());
  const [autoPopulateWave, setAutoPopulateWave] = useState(0);

  const animPrefs = useAnimationPreferences(draftState.settings);
  const triggerMovedHighlight = (ids: string[]) => {
    if (animPrefs.isOff) return;
    setRecentlyMovedIds(new Set(ids));
    window.setTimeout(() => {
      setRecentlyMovedIds(new Set());
    }, 440);
  };

  const squad = draftState.squad;
  const maxOverseas = draftState.settings.playingXIOverseasLimit;
  const franchiseName =
    draftState.customFranchise?.name || draftState.settings.franchiseName || 'My Franchise';

  // Draft not complete yet: show drafted players + direct CTA back to Draft
  if (squad.length < draftState.settings.squadSize) {
    const overseasDrafted = getOverseasCount(squad);
    return (
      <section className="mx-auto w-full max-w-6xl px-3 py-4 pb-20 sm:px-4 md:pb-10">
        <div className="border border-[#263039] bg-[#0E1318]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-wider text-[#F5B942] uppercase">
                {franchiseName} · ROSTER IN PROGRESS
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-3xl">
                MY FRANCHISE ROSTER
              </h1>
            </div>
            <button
              type="button"
              onClick={onGoToDraft}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-4 py-1.5 font-display text-base font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
            >
              <span>CONTINUE DRAFT ({squad.length}/{draftState.settings.squadSize})</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[#263039] border-b border-[#263039] bg-[#0E1318] font-mono text-xs tabular-nums">
            <div className="px-3.5 py-2.5">
              <span className="text-[10px] text-[#9DA8B3] uppercase">Drafted</span>
              <div className="font-extrabold text-[#F5F2EA]">
                {squad.length}/{draftState.settings.squadSize}
              </div>
            </div>
            <div className="px-3.5 py-2.5">
              <span className="text-[10px] text-[#9DA8B3] uppercase">Overseas</span>
              <div className="font-extrabold text-[#22D36B]">
                {overseasDrafted}/{draftState.settings.overseasSquadLimit}
              </div>
            </div>
            <div className="px-3.5 py-2.5">
              <span className="text-[10px] text-[#9DA8B3] uppercase">Purse Left</span>
              <div className="font-extrabold text-[#F5B942]">
                {formatCr(draftState.remainingPurseCr)}
              </div>
            </div>
          </div>

          {squad.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#9DA8B3]">
                Complete your {draftState.settings.squadSize}-player draft to unlock Playing XI and
                the 4-man Impact Bench.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#263039] bg-[#0E1318]">
              {squad.map((p, i) => {
                const sal = getPlayerSalaryCr(p);
                return (
                  <div
                    key={`${p.playerId}-${i}`}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs hover:bg-[#111820]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 font-mono text-[11px] font-bold text-[#9DA8B3]">
                        {i + 1}.
                      </span>
                      <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                      <span className="truncate font-bold text-[#F5F2EA]">{p.playerName}</span>
                      <span className="font-mono text-[10px] text-[#9DA8B3]">
                        {p.franchise} {p.season}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums">
                      <span className="font-bold text-[#F5F2EA]">OVR {p.overallRating}</span>
                      <span className="font-bold text-[#F5B942]">
                        {p.isRetained ? formatCr(p.priceCr) : sal === null ? 'PENDING' : formatCr(sal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  const validation = validatePlayingXI(xiState, squad, maxOverseas);
  const { xiPlayers, benchPlayers, overseasCount } = validation;
  const bowlingOptions = getBowlingOptions(xiPlayers);
  const summary = calculateTeamSummary(xiPlayers, xiState.captainId, xiState.wicketkeeperId);
  const totalSquadOverseas = getOverseasCount(squad);
  const maxMatchOverseas = Math.min(5, totalSquadOverseas);

  const handleFieldPlayerClick = (player: PlayerSeasonRecord) => {
    if (editModeHint === 'CAPTAIN') {
      onSelectCaptain(player.playerId);
      setEditModeHint('NONE');
      return;
    }
    if (editModeHint === 'KEEPER' && player.role === 'WK') {
      onSelectWicketkeeper(player.playerId);
      setEditModeHint('NONE');
      return;
    }
    if (swapBenchId) {
      onSwapPlayers(player.playerId, swapBenchId);
      triggerMovedHighlight([player.playerId, swapBenchId]);
      setSwapBenchId(null);
      setSwapXiId(null);
      return;
    }
    setSwapXiId((prev) => (prev === player.playerId ? null : player.playerId));
  };

  const handleBenchAction = (benchPlayer: PlayerSeasonRecord) => {
    if (swapXiId) {
      onSwapPlayers(swapXiId, benchPlayer.playerId);
      triggerMovedHighlight([swapXiId, benchPlayer.playerId]);
      setSwapXiId(null);
      setSwapBenchId(null);
      return;
    }
    if (xiPlayers.length < PLAYING_XI_SIZE) {
      onAddPlayer(benchPlayer.playerId);
      triggerMovedHighlight([benchPlayer.playerId]);
      return;
    }
    setSwapBenchId((prev) => (prev === benchPlayer.playerId ? null : benchPlayer.playerId));
  };

  const swapXiPlayer = swapXiId ? xiPlayers.find((p) => p.playerId === swapXiId) : null;
  const swapBenchPlayer = swapBenchId
    ? benchPlayers.find((p) => p.playerId === swapBenchId)
    : null;

  return (
    <section
      data-testid="squad-management-screen"
      className="mx-auto w-full max-w-6xl px-3 py-3 pb-20 sm:px-4 md:pb-10"
    >
      {/* Header + Top Strip: XI 11/11 | Impact Bench 4/4 | Overseas XI X/4 | Match Usage X/5 */}
      <div className="border border-[#263039] bg-[#0E1318]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-4 py-2.5 text-[#F5F2EA]">
          <div>
            <div className="font-mono text-[10px] font-bold tracking-widest text-[#F5B942] uppercase">
              {franchiseName} · MATCHDAY LINEUP
            </div>
            <h1 className="font-display text-2xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-3xl">
              MY FRANCHISE ROSTER
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="auto-xi-btn"
              onClick={() => {
                setSwapXiId(null);
                setSwapBenchId(null);
                setEditModeHint('NONE');
                onAutoSelectXI();
                if (animPrefs.isFull) {
                  setAutoPopulateWave((w) => w + 1);
                }
              }}
              className="inline-flex h-8 items-center gap-1 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-3 font-mono text-[10.5px] font-extrabold text-[#06110A] uppercase transition-colors hover:bg-[#1EC161] whitespace-nowrap"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>AUTO XI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditModeHint((prev) => (prev === 'EDIT' ? 'NONE' : 'EDIT'));
                setActivePanel('BATTING_ORDER');
              }}
              className={`inline-flex h-8 items-center rounded-[2px] border px-2.5 font-mono text-[10.5px] font-bold uppercase whitespace-nowrap transition-colors ${
                editModeHint === 'EDIT'
                  ? 'border-[#F5B942] bg-[#F5B942] text-[#080B0D]'
                  : 'border-[#263039] bg-[#0E1318] text-[#F5F2EA] hover:border-[#22D36B]/50 hover:bg-[#17212C]'
              }`}
            >
              EDIT XI
            </button>
            <button
              type="button"
              onClick={() => {
                setEditModeHint('NONE');
                setActivePanel('BATTING_ORDER');
              }}
              className={`inline-flex h-8 items-center rounded-[2px] border px-2.5 font-mono text-[10.5px] font-bold uppercase whitespace-nowrap transition-colors ${
                activePanel === 'BATTING_ORDER' && editModeHint === 'NONE'
                  ? 'border-[#22D36B]/60 bg-[#0A2014] text-[#22D36B]'
                  : 'border-[#263039] bg-[#0E1318] text-[#9DA8B3] hover:text-[#F5F2EA]'
              }`}
            >
              BATTING ORDER
            </button>
            <button
              type="button"
              onClick={() => {
                setEditModeHint((prev) => (prev === 'CAPTAIN' ? 'NONE' : 'CAPTAIN'));
                setActivePanel('BATTING_ORDER');
              }}
              className={`inline-flex h-8 items-center gap-1 rounded-[2px] border px-2.5 font-mono text-[10.5px] font-bold uppercase whitespace-nowrap transition-colors ${
                editModeHint === 'CAPTAIN'
                  ? 'border-[#F5B942] bg-[#F5B942] text-[#080B0D]'
                  : 'border-[#263039] bg-[#0E1318] text-[#F5F2EA] hover:border-[#22D36B]/50 hover:bg-[#17212C]'
              }`}
            >
              <Crown className="h-3 w-3" aria-hidden="true" />
              <span>CAPTAIN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditModeHint((prev) => (prev === 'KEEPER' ? 'NONE' : 'KEEPER'));
                setActivePanel('BATTING_ORDER');
              }}
              className={`inline-flex h-8 items-center gap-1 rounded-[2px] border px-2.5 font-mono text-[10.5px] font-bold uppercase whitespace-nowrap transition-colors ${
                editModeHint === 'KEEPER'
                  ? 'border-[#F5B942] bg-[#F5B942] text-[#080B0D]'
                  : 'border-[#263039] bg-[#0E1318] text-[#F5F2EA] hover:border-[#22D36B]/50 hover:bg-[#17212C]'
              }`}
            >
              <Shield className="h-3 w-3" aria-hidden="true" />
              <span>KEEPER</span>
            </button>
          </div>
        </div>

        {/* 4-Column Status Strip */}
        <div className="grid grid-cols-2 divide-x divide-y divide-[#263039] bg-[#0E1318] sm:grid-cols-4 sm:divide-y-0">
          <div className="flex items-baseline justify-between px-3 py-2">
            <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">XI</span>
            <span
              data-testid="xi-count"
              className={`font-mono text-sm font-extrabold tabular-nums sm:text-base ${
                xiPlayers.length === PLAYING_XI_SIZE ? 'text-[#22D36B]' : 'text-[#F5F2EA]'
              }`}
            >
              {xiPlayers.length}/{PLAYING_XI_SIZE}
            </span>
          </div>

          <div className="flex items-baseline justify-between px-3 py-2">
            <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
              Impact Bench
            </span>
            <span
              data-testid="xi-bench-count"
              className="font-mono text-sm font-extrabold text-[#F05A32] tabular-nums sm:text-base"
            >
              {benchPlayers.length}/{Math.max(0, squad.length - PLAYING_XI_SIZE)}
            </span>
          </div>

          <div className="flex items-baseline justify-between px-3 py-2">
            <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
              Overseas XI
            </span>
            <span
              data-testid="xi-overseas-count"
              className={`font-mono text-sm font-extrabold tabular-nums sm:text-base ${
                overseasCount > maxOverseas ? 'text-[#E44949]' : 'text-[#F5B942]'
              }`}
            >
              {overseasCount}/{maxOverseas}
            </span>
          </div>

          <div className="flex items-baseline justify-between px-3 py-2">
            <span className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
              Match Usage
            </span>
            <span className="font-mono text-sm font-extrabold text-[#F5F2EA] tabular-nums sm:text-base">
              {overseasCount}/{maxMatchOverseas || 5} OS
            </span>
          </div>
        </div>
      </div>

      {/* Mode / Swap Instruction Banner */}
      {(swapXiPlayer || swapBenchPlayer || editModeHint !== 'NONE') && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border border-[#F05A32]/70 bg-[#23120D] px-3.5 py-2">
          <p className="font-mono text-xs font-bold text-[#F5F2EA]">
            {swapXiPlayer
              ? `Swapping ${swapXiPlayer.playerName} (XI) — tap an Impact Bench player to complete swap.`
              : swapBenchPlayer
                ? `Swapping ${swapBenchPlayer.playerName} (Bench) — tap any XI player on the field or batting order.`
                : editModeHint === 'CAPTAIN'
                  ? 'Tap any player on the field or press C below to assign Franchise Captain.'
                  : editModeHint === 'KEEPER'
                    ? 'Tap a Wicketkeeper (WK) on the field or press WK below to assign active Keeper.'
                    : 'Tap any XI player on the field and any Impact Bench player to swap them.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSwapXiId(null);
              setSwapBenchId(null);
              setEditModeHint('NONE');
            }}
            className="h-7 rounded-[2px] border border-[#263039] bg-[#111820] px-2.5 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase hover:border-[#22D36B]"
          >
            Done
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN AREA: Left/Center = Playing XI on Field · Right/Below = Impact Bench - 4 */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.45fr_0.85fr] lg:items-start">
        {/* Left/Center: Playing XI Cricket Field */}
        <div>
          <CricketField
            xiPlayers={xiPlayers}
            captainId={xiState.captainId}
            wicketkeeperId={xiState.wicketkeeperId}
            swapTargetXiId={swapXiId}
            recentlyMovedIds={recentlyMovedIds}
            autoPopulateWave={autoPopulateWave}
            animateField={animPrefs.isFull}
            onFieldPlayerClick={handleFieldPlayerClick}
          />

          {/* Compact Team Strength Bar under field */}
          <div className="mt-2 grid grid-cols-5 divide-x divide-[#263039] border border-[#263039] bg-[#0E1318] text-center font-mono text-xs tabular-nums">
            <div className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-[#9DA8B3] uppercase">BAT</div>
              <div className="font-extrabold text-[#7DD3FC]">{summary.battingRating}</div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-[#9DA8B3] uppercase">BOWL</div>
              <div className="font-extrabold text-[#22D36B]">{summary.bowlingRating}</div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-[#9DA8B3] uppercase">OVR</div>
              <div className="font-extrabold text-[#F5F2EA]">{summary.overallRating}</div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-[#9DA8B3] uppercase">C</div>
              <div className="truncate font-bold text-[#22D36B]">
                {summary.captainName ? summary.captainName.split(' ').pop() : '—'}
              </div>
            </div>
            <div className="px-2 py-1.5">
              <div className="text-[9px] font-bold text-[#9DA8B3] uppercase">WK</div>
              <div className="truncate font-bold text-[#F5B942]">
                {summary.keeperName ? summary.keeperName.split(' ').pop() : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Right/Below: IMPACT BENCH - 4 */}
        <aside className="border border-[#263039] bg-[#0E1318]">
          <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2 text-[#F5F2EA]">
            <h2 className="font-display text-lg font-extrabold tracking-wider uppercase">
              IMPACT BENCH - {benchPlayers.length}
            </h2>
            <span className="rounded-[2px] border border-[#F05A32]/60 bg-[#23120D] px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold text-[#F05A32] uppercase">
              IMP OPTIONS
            </span>
          </div>

          <div className="divide-y divide-[#263039] bg-[#0E1318]">
            {benchPlayers.map((player) => {
              const isSelected = swapBenchId === player.playerId;
              const justMoved = !animPrefs.isOff && recentlyMovedIds.has(player.playerId);
              return (
                <article
                  key={player.playerId}
                  className={`p-3 transition-[background-color,transform,opacity] duration-200 ${
                    justMoved
                      ? 'ip-chip-pop bg-[#0A2014]'
                      : isSelected
                        ? 'bg-[#23120D]'
                        : 'hover:bg-[#111820]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                        <span
                          className={`rounded-[2px] border px-1 font-mono text-[9px] font-bold ${
                            player.isOverseas === true
                              ? 'border-[#F5B942]/40 bg-[#201A0A] text-[#F5B942]'
                              : 'border-[#22D36B]/40 bg-[#0A2014] text-[#22D36B]'
                          }`}
                        >
                          {player.isOverseas === true ? 'OS' : 'IND'}
                        </span>
                        <span className="rounded-[2px] border border-[#F05A32]/45 bg-[#23120D] px-1 font-mono text-[9px] font-extrabold text-[#F05A32]">
                          IMP {player.impactRating}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-extrabold text-[#F5F2EA]">
                          {player.playerName}
                        </h3>
                        {onInspectPlayer && (
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(player)}
                            aria-label={`Inspect ${player.playerName}`}
                            className="text-[#9DA8B3] hover:text-[#F5F2EA]"
                          >
                            <Info className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="mt-0.5 font-mono text-[10.5px] text-[#9DA8B3] tabular-nums">
                        BAT {player.battingRating} · BOWL {player.bowlingRating} · OVR{' '}
                        <strong className="text-[#F5F2EA]">{player.overallRating}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBenchAction(player)}
                      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-[2px] border px-2.5 font-mono text-[10px] font-extrabold uppercase transition-colors ${
                        isSelected
                          ? 'border-[#F05A32] bg-[#F05A32] text-[#080B0D]'
                          : 'border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B] hover:bg-[#22D36B] hover:text-[#06110A]'
                      }`}
                    >
                      {swapXiId ? (
                        <>
                          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                          <span>SWAP</span>
                        </>
                      ) : xiPlayers.length < PLAYING_XI_SIZE ? (
                        <>
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>ADD</span>
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                          <span>{isSelected ? 'PICKED' : 'SWAP'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-[#263039] bg-[#111820] px-3 py-2 font-mono text-[10px] text-[#9DA8B3]">
            1 tactical substitution allowed mid-match (5th Overseas Impact permitted).
          </div>
        </aside>
      </div>

      {/* LOWER SECTION: BATTING ORDER / BOWLING OPTIONS / FULL 15-MAN ROSTER */}
      <div className="mt-3 border border-[#263039] bg-[#0E1318]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-3 py-1.5">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'BATTING_ORDER', label: `BATTING ORDER (${xiPlayers.length})` },
                { id: 'BOWLING', label: 'BOWLING ATTACK' },
                { id: 'ROSTER', label: `FULL 15-MAN ROSTER` },
              ] as Array<{ id: SquadSubPanel; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePanel(tab.id)}
                className={`h-7 rounded-[2px] px-2.5 font-mono text-[10.5px] font-extrabold uppercase transition-colors ${
                  activePanel === tab.id
                    ? 'bg-[#22D36B] text-[#06110A]'
                    : 'text-[#9DA8B3] hover:bg-[#17212C] hover:text-[#F5F2EA]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="hidden font-mono text-[10px] text-[#9DA8B3] sm:inline">
            Drag or use arrows to adjust batting order · Click C / WK to assign roles
          </span>
        </div>

        {/* BATTING ORDER PANEL */}
        {activePanel === 'BATTING_ORDER' && (
          <div className="bg-[#0E1318]">
            {xiPlayers.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9DA8B3]">
                Tap AUTO XI or add players from the Impact Bench to build your Playing XI.
              </div>
            ) : (
              <ol className="divide-y divide-[#263039]">
                {xiPlayers.map((player, index) => {
                  const isCaptain = xiState.captainId === player.playerId;
                  const isActiveWk = xiState.wicketkeeperId === player.playerId;
                  const isWkRole = player.role === 'WK';
                  const isSwapHighlighted = swapXiId === player.playerId;

                  return (
                    <li
                      key={player.playerId}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null && dragIndex !== index) {
                          onReorderBatting(dragIndex, index);
                        }
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={`flex flex-col gap-1.5 px-3 py-2 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isSwapHighlighted ? 'bg-[#23120D]' : 'hover:bg-[#111820]'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <GripVertical
                          className="hidden h-3.5 w-3.5 shrink-0 cursor-grab text-[#9DA8B3] sm:block"
                          aria-hidden="true"
                        />
                        <span className="w-5 shrink-0 font-mono text-xs font-extrabold text-[#9DA8B3] tabular-nums">
                          {index + 1}.
                        </span>
                        <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                        <button
                          type="button"
                          onClick={() => handleFieldPlayerClick(player)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-bold text-[#F5F2EA]">
                              {player.playerName}
                            </span>
                            {player.isOverseas && (
                              <span className="shrink-0 rounded-[2px] border border-[#F5B942]/40 bg-[#201A0A] px-1 font-mono text-[9px] font-bold text-[#F5B942]">
                                OS
                              </span>
                            )}
                            {player.isRetained && (
                              <span className="shrink-0 rounded-[2px] border border-[#F5B942]/40 bg-[#201A0A] px-1 font-mono text-[8.5px] font-extrabold text-[#F5B942]">
                                RET
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                            {player.franchise} {player.season} · BAT {player.battingRating} · BOWL{' '}
                            {player.bowlingRating} · OVR{' '}
                            <strong className="text-[#F5F2EA]">{player.overallRating}</strong>
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectCaptain(player.playerId)}
                          aria-label={`Make ${player.playerName} Captain`}
                          aria-pressed={isCaptain}
                          className={`h-8 min-w-[32px] rounded-[2px] border px-2 font-mono text-[11px] font-extrabold transition-colors ${
                            isCaptain
                              ? 'border-[#22D36B] bg-[#22D36B] text-[#06110A]'
                              : 'border-[#263039] bg-[#111820] text-[#9DA8B3] hover:border-[#22D36B] hover:text-[#F5F2EA]'
                          }`}
                        >
                          C
                        </button>

                        {isWkRole && (
                          <button
                            type="button"
                            onClick={() => onSelectWicketkeeper(player.playerId)}
                            aria-label={`Make ${player.playerName} Active Wicketkeeper`}
                            aria-pressed={isActiveWk}
                            className={`h-8 min-w-[34px] rounded-[2px] border px-2 font-mono text-[11px] font-extrabold transition-colors ${
                              isActiveWk
                                ? 'border-[#F5B942] bg-[#F5B942] text-[#080B0D]'
                                : 'border-[#263039] bg-[#111820] text-[#9DA8B3] hover:border-[#F5B942] hover:text-[#F5F2EA]'
                            }`}
                          >
                            WK
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onReorderBatting(index, index - 1)}
                          aria-label={`Move ${player.playerName} up`}
                          className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B]/50 hover:bg-[#17212C] disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          disabled={index === xiPlayers.length - 1}
                          onClick={() => onReorderBatting(index, index + 1)}
                          aria-label={`Move ${player.playerName} down`}
                          className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B]/50 hover:bg-[#17212C] disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSwapXiId(null);
                            onRemovePlayer(player.playerId);
                          }}
                          aria-label={`Move ${player.playerName} to bench`}
                          className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#9DA8B3] hover:border-[#E44949] hover:text-[#E44949]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {/* BOWLING OPTIONS PANEL */}
        {activePanel === 'BOWLING' && (
          <div className="grid grid-cols-1 divide-y divide-[#263039] bg-[#0E1318] md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="p-3.5">
              <div className="font-mono text-[10px] font-bold text-[#F05A32] uppercase">
                Primary Bowlers ({bowlingOptions.primaryBowlers.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {bowlingOptions.primaryBowlers.length > 0 ? (
                  bowlingOptions.primaryBowlers.map((p) => (
                    <li key={p.playerId} className="flex justify-between tabular-nums">
                      <span className="font-semibold text-[#F5F2EA]">
                        {p.playerName} ({p.bowlerType})
                      </span>
                      <span className="font-mono font-bold text-[#9DA8B3]">BWL {p.bowlingRating}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[#9DA8B3]">None selected</li>
                )}
              </ul>
            </div>

            <div className="p-3.5">
              <div className="font-mono text-[10px] font-bold text-[#F5B942] uppercase">
                All-Rounders ({bowlingOptions.allRounders.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {bowlingOptions.allRounders.length > 0 ? (
                  bowlingOptions.allRounders.map((p) => (
                    <li key={p.playerId} className="flex justify-between tabular-nums">
                      <span className="font-semibold text-[#F5F2EA]">
                        {p.playerName} ({p.bowlerType})
                      </span>
                      <span className="font-mono font-bold text-[#9DA8B3]">BWL {p.bowlingRating}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[#9DA8B3]">None selected</li>
                )}
              </ul>
            </div>

            <div className="p-3.5">
              <div className="font-mono text-[10px] font-bold text-[#7DD3FC] uppercase">
                Part-Time Bowlers ({bowlingOptions.partTimers.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {bowlingOptions.partTimers.length > 0 ? (
                  bowlingOptions.partTimers.map((p) => (
                    <li key={p.playerId} className="flex justify-between tabular-nums">
                      <span className="font-semibold text-[#F5F2EA]">
                        {p.playerName} ({p.bowlerType})
                      </span>
                      <span className="font-mono font-bold text-[#9DA8B3]">BWL {p.bowlingRating}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[#9DA8B3]">None available</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* FULL 15-MAN ROSTER TABLE */}
        {activePanel === 'ROSTER' && (
          <div className="overflow-x-auto bg-[#0E1318]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#263039] bg-[#111820] font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                  <th className="px-3 py-2">ROLE</th>
                  <th className="px-2 py-2">PLAYER</th>
                  <th className="px-2 py-2">STATUS</th>
                  <th className="px-2 py-2">TEAM</th>
                  <th className="px-2 py-2 text-center">BAT</th>
                  <th className="px-2 py-2 text-center">BOWL</th>
                  <th className="px-2 py-2 text-center">IMP</th>
                  <th className="px-2 py-2 text-center">OVR</th>
                  <th className="px-3 py-2 text-right">PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263039]">
                {squad.map((p) => {
                  const inXi = xiState.playingXiIds.includes(p.playerId);
                  const sal = getPlayerSalaryCr(p);
                  return (
                    <tr key={p.playerId} className="hover:bg-[#111820]">
                      <td className="px-3 py-2">
                        <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                      </td>
                      <td className="px-2 py-2 font-bold text-[#F5F2EA]">
                        <button
                          type="button"
                          onClick={() => onInspectPlayer?.(p)}
                          className="text-left hover:text-[#22D36B] hover:underline"
                        >
                          {p.playerName}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] font-bold">
                        {inXi ? (
                          <span className="rounded-[2px] border border-[#22D36B]/40 bg-[#0A2014] px-1.5 py-0.5 text-[#22D36B]">
                            XI
                          </span>
                        ) : (
                          <span className="rounded-[2px] border border-[#F05A32]/40 bg-[#23120D] px-1.5 py-0.5 text-[#F05A32]">
                            BENCH
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-[11px] text-[#9DA8B3]">
                        {p.franchise} {p.season}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[#F5F2EA] tabular-nums">
                        {p.battingRating}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[#F5F2EA] tabular-nums">
                        {p.bowlingRating}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-bold text-[#F05A32] tabular-nums">
                        {p.impactRating}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-extrabold text-[#22D36B] tabular-nums">
                        {p.overallRating}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#F5B942] tabular-nums">
                        {p.isRetained
                          ? formatCr(p.priceCr)
                          : sal === null
                            ? 'PENDING'
                            : formatCr(sal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRM PLAYING XI / START SEASON FOOTER */}
      <div className="mt-3 border border-[#263039] bg-[#0E1318] p-3.5">
        {!validation.isValid && (
          <div role="alert" className="mb-3 border border-[#E44949]/60 bg-[#231012] p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#F87171]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Lineup Requirements:</span>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[#FCA5A5]">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {xiState.isConfirmed && validation.isValid ? (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22D36B]" aria-hidden="true" />
              <div>
                <div className="font-display text-lg font-extrabold text-[#F5F2EA] uppercase">
                  PLAYING XI LOCKED · {franchiseName}
                </div>
                <div className="font-mono text-[11px] text-[#9DA8B3]">
                  Captain: {summary.captainName} · Keeper: {summary.keeperName} · Impact Bench:{' '}
                  {benchPlayers.length}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="start-or-open-season-btn"
              onClick={onStartSeason}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-5 py-2 font-display text-lg font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161] whitespace-nowrap"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>{hasActiveSeason ? 'SAVE & OPEN FIXTURES' : 'START SEASON'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!validation.isValid}
            onClick={onConfirmXI}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-[2px] font-display text-lg font-extrabold tracking-wider uppercase transition-colors ${
              validation.isValid
                ? 'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#1EC161]'
                : 'cursor-not-allowed border border-[#263039] bg-[#111820] text-[#9DA8B3]/60'
            }`}
          >
            CONFIRM PLAYING XI
          </button>
        )}
      </div>
    </section>
  );
}
