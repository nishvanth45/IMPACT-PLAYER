import { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  PLAYING_XI_SIZE,
  calculateTeamSummary,
  getBowlingOptions,
  validatePlayingXI,
} from '../game/playingXiEngine';
import type { DraftState, PlayerSeasonRecord, PlayingXIState } from '../types/game';
import { CricketField } from './CricketField';
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
}

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
}: PlayingXIScreenProps) {
  const [swapXiId, setSwapXiId] = useState<string | null>(null);
  const [swapBenchId, setSwapBenchId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const squad = draftState.squad;
  const maxOverseas = draftState.settings.playingXIOverseasLimit;

  if (squad.length < draftState.settings.squadSize) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 pb-24 md:pb-12">
        <div className="border-2 border-[#141619] bg-[#FAF8F3] p-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-[#141619] uppercase">
            Playing XI Selection
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#4A4E54] sm:text-sm">
            Complete your {draftState.settings.squadSize}-player draft first ({squad.length}/
            {draftState.settings.squadSize} drafted) before selecting your Playing XI &amp; Impact Bench.
          </p>
          <button
            type="button"
            onClick={onGoToDraft}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
          >
            Go to Draft
          </button>
        </div>
      </section>
    );
  }

  const validation = validatePlayingXI(xiState, squad, maxOverseas);
  const { xiPlayers, benchPlayers, overseasCount } = validation;
  const bowlingOptions = getBowlingOptions(xiPlayers);
  const summary = calculateTeamSummary(xiPlayers, xiState.captainId, xiState.wicketkeeperId);

  const handleFieldPlayerClick = (player: PlayerSeasonRecord) => {
    if (swapBenchId) {
      onSwapPlayers(player.playerId, swapBenchId);
      setSwapBenchId(null);
      setSwapXiId(null);
      return;
    }
    setSwapXiId((prev) => (prev === player.playerId ? null : player.playerId));
  };

  const handleBenchAction = (benchPlayer: PlayerSeasonRecord) => {
    if (swapXiId) {
      onSwapPlayers(swapXiId, benchPlayer.playerId);
      setSwapXiId(null);
      setSwapBenchId(null);
      return;
    }
    if (xiPlayers.length < PLAYING_XI_SIZE) {
      onAddPlayer(benchPlayer.playerId);
      return;
    }
    setSwapBenchId((prev) => (prev === benchPlayer.playerId ? null : benchPlayer.playerId));
  };

  const swapXiPlayer = swapXiId ? xiPlayers.find((p) => p.playerId === swapXiId) : null;
  const swapBenchPlayer = swapBenchId
    ? benchPlayers.find((p) => p.playerId === swapBenchId)
    : null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4 pb-24 md:pb-12">
      {/* Header & Auto Select */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-wide text-[#141619] uppercase">
            {draftState.customFranchise?.name || draftState.settings.franchiseName} · Playing XI &amp; Impact Bench
          </h1>
          <p className="mt-0.5 font-mono text-xs text-[#4A4E54]">
            Select 11 starters, assign Captain (C) &amp; Wicketkeeper (WK), and set your 4-man Impact Bench.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSwapXiId(null);
            setSwapBenchId(null);
            onAutoSelectXI();
          }}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-2 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>AUTO SELECT XI</span>
        </button>
      </div>

      {/* Live Scorebook HUD */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-[#141619]/15 border-2 border-[#141619] bg-[#FAF8F3]">
        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Playing XI</div>
          <div
            data-testid="xi-count"
            className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums sm:text-2xl ${
              xiPlayers.length === PLAYING_XI_SIZE ? 'text-[#157F3D]' : 'text-[#141619]'
            }`}
          >
            {xiPlayers.length}/{PLAYING_XI_SIZE}
          </div>
        </div>

        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Overseas</div>
          <div
            data-testid="xi-overseas-count"
            className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums sm:text-2xl ${
              overseasCount > maxOverseas ? 'text-[#D94E28]' : 'text-[#B45309]'
            }`}
          >
            {overseasCount}/{maxOverseas}
          </div>
        </div>

        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Impact Bench</div>
          <div
            data-testid="xi-bench-count"
            className="mt-0.5 font-mono text-lg font-extrabold text-[#6D28D9] tabular-nums sm:text-2xl"
          >
            {benchPlayers.length}/{squad.length - PLAYING_XI_SIZE}
          </div>
        </div>
      </div>

      {/* Swap Banner */}
      {(swapXiPlayer || swapBenchPlayer) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-2 border-[#D94E28] bg-[#FAF8F3] px-4 py-2.5">
          <p className="text-xs font-bold text-[#141619] sm:text-sm">
            {swapXiPlayer
              ? `Selected ${swapXiPlayer.playerName} from XI — tap an Impact Bench player below to swap.`
              : `Selected ${swapBenchPlayer?.playerName} from Impact Bench — tap a player on the Field or Batting Order to swap.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setSwapXiId(null);
              setSwapBenchId(null);
            }}
            className="min-h-[34px] rounded-[2px] border border-[#141619] bg-white px-3 py-1 font-mono text-[11px] font-bold text-[#141619] uppercase hover:bg-[#EAE3D5]"
          >
            Cancel Swap
          </button>
        </div>
      )}

      {/* Green Cricket Field */}
      <div className="mt-4">
        <CricketField
          xiPlayers={xiPlayers}
          captainId={xiState.captainId}
          wicketkeeperId={xiState.wicketkeeperId}
          swapTargetXiId={swapXiId}
          onFieldPlayerClick={handleFieldPlayerClick}
        />
      </div>

      {/* IMPACT BENCH Section */}
      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-wide text-[#141619] uppercase sm:text-2xl">
              IMPACT BENCH - {benchPlayers.length} PLAYERS
            </h2>
            <p className="font-mono text-[11px] text-[#4A4E54]">
              Eligible for mid-match Impact substitution (includes 5th overseas Impact Player option).
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-[#4A4E54]">
            {xiPlayers.length < PLAYING_XI_SIZE
              ? 'Tap Add to XI to build your 11'
              : 'Tap Swap to exchange with a starter'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {benchPlayers.map((player) => {
            const isSelected = swapBenchId === player.playerId;
            return (
              <article
                key={player.playerId}
                className={`flex flex-col justify-between rounded-[3px] border-2 p-3 transition-colors ${
                  isSelected
                    ? 'border-[#D94E28] bg-white shadow-[2px_2px_0px_#D94E28]'
                    : 'border-[#141619] bg-[#FAF8F3]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                      <span
                        className={`rounded-[2px] px-1 py-0.2 font-mono text-[9.5px] font-bold ${
                          player.isOverseas === true
                            ? 'bg-[#FEF3C7] text-[#B45309]'
                            : 'bg-[#DCFCE7] text-[#157F3D]'
                        }`}
                      >
                        {player.isOverseas === true ? 'OS' : 'IND'}
                      </span>
                      {player.isRetained && (
                        <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[9px] font-extrabold text-white">
                          RET
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-extrabold text-[#141619]">
                      {player.playerName}
                    </h3>
                    <div className="mt-0.5 font-mono text-[10.5px] text-[#4A4E54] tabular-nums">
                      BAT {player.battingRating} · BWL {player.bowlingRating} · IMP{' '}
                      <span className="font-bold text-[#6D28D9]">{player.impactRating}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono">
                    <div className="text-base font-extrabold text-[#141619] tabular-nums">
                      {player.overallRating}
                    </div>
                    <div className="text-[9.5px] font-bold text-[#4A4E54]">OVR</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBenchAction(player)}
                  className="mt-2.5 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-[2px] border border-[#141619] bg-[#0D1B2A] px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-[#D94E28]"
                >
                  {swapXiId ? (
                    <>
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Swap with {swapXiPlayer?.playerName.split(' ').pop()}</span>
                    </>
                  ) : xiPlayers.length < PLAYING_XI_SIZE ? (
                    <>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add to XI</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSelected ? 'Selected' : 'Swap'}</span>
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      </div>

      {/* Batting Order + Team Summary & Bowling Options */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        {/* Batting Order 1-11 */}
        <div className="border-2 border-[#141619] bg-[#FAF8F3] p-4">
          <h2 className="font-display text-xl font-extrabold tracking-wide text-[#141619] uppercase">
            Batting Order (1–11)
          </h2>
          <p className="text-xs text-[#4A4E54]">
            Drag rows or use Up/Down arrows. Pick Captain (C) &amp; active Wicketkeeper (WK).
          </p>

          {xiPlayers.length === 0 ? (
            <div className="mt-3 border border-dashed border-[#141619]/30 bg-white p-6 text-center text-xs text-[#4A4E54]">
              Add players from Bench or press AUTO SELECT XI to populate your batting order.
            </div>
          ) : (
            <ol className="mt-3 divide-y divide-[#D6D0C4] border border-[#141619] bg-white">
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
                    className={`flex flex-col gap-2 px-3 py-2 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isSwapHighlighted ? 'bg-[#FEF3C7]/70' : 'hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <GripVertical
                        className="hidden h-4 w-4 shrink-0 cursor-grab text-[#6A6E75] sm:block"
                        aria-hidden="true"
                      />
                      <span className="w-5 shrink-0 font-mono text-xs font-extrabold text-[#4A4E54] tabular-nums">
                        {index + 1}.
                      </span>
                      <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                      <button
                        type="button"
                        onClick={() => handleFieldPlayerClick(player)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-[#141619]">
                            {player.playerName}
                          </span>
                          {player.isRetained && (
                            <span className="shrink-0 rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                              RET
                            </span>
                          )}
                          {player.isOverseas && (
                            <span className="shrink-0 rounded-[2px] bg-[#FEF3C7] px-1 font-mono text-[9px] font-bold text-[#B45309]">
                              OS
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10.5px] text-[#4A4E54] tabular-nums">
                          BAT {player.battingRating} · BWL {player.bowlingRating} · OVR{' '}
                          <span className="font-bold text-[#141619]">{player.overallRating}</span>
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-1 sm:justify-start">
                      <button
                        type="button"
                        onClick={() => onSelectCaptain(player.playerId)}
                        aria-label={`Make ${player.playerName} Captain`}
                        aria-pressed={isCaptain}
                        className={`min-h-[34px] min-w-[34px] rounded-[2px] border px-2 font-mono text-xs font-extrabold transition-colors ${
                          isCaptain
                            ? 'border-[#141619] bg-[#D94E28] text-white'
                            : 'border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] hover:border-[#141619] hover:text-[#141619]'
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
                          className={`min-h-[34px] min-w-[34px] rounded-[2px] border px-2 font-mono text-xs font-extrabold transition-colors ${
                            isActiveWk
                              ? 'border-[#141619] bg-[#B45309] text-white'
                              : 'border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] hover:border-[#141619] hover:text-[#141619]'
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
                        className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#141619] hover:bg-[#EAE3D5] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        disabled={index === xiPlayers.length - 1}
                        onClick={() => onReorderBatting(index, index + 1)}
                        aria-label={`Move ${player.playerName} down`}
                        className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#141619] hover:bg-[#EAE3D5] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSwapXiId(null);
                          onRemovePlayer(player.playerId);
                        }}
                        aria-label={`Remove ${player.playerName} from Playing XI`}
                        className="flex min-h-[34px] min-w-[34px] items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] hover:border-[#D94E28] hover:text-[#D94E28]"
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

        {/* Right Column: Team Summary & Bowling Options */}
        <div className="space-y-4">
          <div className="border-2 border-[#141619] bg-[#FAF8F3] p-4">
            <h2 className="font-display text-xl font-extrabold tracking-wide text-[#141619] uppercase">
              Team Summary
            </h2>

            <div className="mt-3 grid grid-cols-3 divide-x divide-[#141619]/15 border border-[#141619] bg-white text-center">
              <div className="p-2.5">
                <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Batting</div>
                <div className="mt-0.5 font-mono text-xl font-extrabold text-[#1D4ED8] tabular-nums">
                  {summary.battingRating}
                </div>
              </div>
              <div className="p-2.5">
                <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Bowling</div>
                <div className="mt-0.5 font-mono text-xl font-extrabold text-[#157F3D] tabular-nums">
                  {summary.bowlingRating}
                </div>
              </div>
              <div className="p-2.5">
                <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Overall</div>
                <div className="mt-0.5 font-mono text-xl font-extrabold text-[#141619] tabular-nums">
                  {summary.overallRating}
                </div>
              </div>
            </div>

            <dl className="mt-3.5 space-y-2 border-t border-[#141619]/15 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-[#4A4E54]">Indian Players</dt>
                <dd className="font-mono font-bold text-[#157F3D] tabular-nums">
                  {summary.indianCount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#4A4E54]">Overseas Players</dt>
                <dd className="font-mono font-bold text-[#B45309] tabular-nums">
                  {summary.overseasCount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#4A4E54]">Keeper (WK)</dt>
                <dd className="font-bold text-[#B45309]">
                  {summary.keeperName ?? 'Not Selected'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#4A4E54]">Captain (C)</dt>
                <dd className="font-bold text-[#D94E28]">
                  {summary.captainName ?? 'Not Selected'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-2 border-[#141619] bg-[#FAF8F3] p-4">
            <h2 className="font-display text-xl font-extrabold tracking-wide text-[#141619] uppercase">
              Bowling Options
            </h2>

            <div className="mt-2.5 space-y-2.5 text-xs">
              <div>
                <div className="font-mono text-[10.5px] font-bold text-[#C2410C] uppercase">
                  Primary Bowlers ({bowlingOptions.primaryBowlers.length})
                </div>
                {bowlingOptions.primaryBowlers.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[#141619]">
                    {bowlingOptions.primaryBowlers.map((p) => (
                      <li key={p.playerId} className="flex items-center justify-between tabular-nums">
                        <span className="font-medium">
                          {p.playerName}
                          {p.bowlerType !== 'NONE' ? ` · ${p.bowlerType}` : ''}
                        </span>
                        <span className="font-mono font-bold text-[#4A4E54]">BWL {p.bowlingRating}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[#6A6E75]">None selected</p>
                )}
              </div>

              <div className="border-t border-[#141619]/15 pt-2">
                <div className="font-mono text-[10.5px] font-bold text-[#6D28D9] uppercase">
                  All-Rounders ({bowlingOptions.allRounders.length})
                </div>
                {bowlingOptions.allRounders.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[#141619]">
                    {bowlingOptions.allRounders.map((p) => (
                      <li key={p.playerId} className="flex items-center justify-between tabular-nums">
                        <span className="font-medium">
                          {p.playerName}
                          {p.bowlerType !== 'NONE' ? ` · ${p.bowlerType}` : ''}
                        </span>
                        <span className="font-mono font-bold text-[#4A4E54]">BWL {p.bowlingRating}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[#6A6E75]">None selected</p>
                )}
              </div>

              <div className="border-t border-[#141619]/15 pt-2">
                <div className="font-mono text-[10.5px] font-bold text-[#1D4ED8] uppercase">
                  Part-Time Bowlers ({bowlingOptions.partTimers.length})
                </div>
                {bowlingOptions.partTimers.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[#141619]">
                    {bowlingOptions.partTimers.map((p) => (
                      <li key={p.playerId} className="flex items-center justify-between tabular-nums">
                        <span className="font-medium">
                          {p.playerName}
                          {p.bowlerType !== 'NONE' ? ` · ${p.bowlerType}` : ''}
                        </span>
                        <span className="font-mono font-bold text-[#4A4E54]">BWL {p.bowlingRating}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[#6A6E75]">None available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation & Confirm Playing XI */}
      <div className="mt-5 border-2 border-[#141619] bg-[#FAF8F3] p-4">
        {!validation.isValid && (
          <div
            role="alert"
            className="mb-3 border border-[#D94E28] bg-[#FFF1EE] p-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#B83C1B]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Complete these requirements to confirm your Playing XI:</span>
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-xs text-[#7F1D1D]">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {xiState.isConfirmed && validation.isValid ? (
          <div className="flex flex-col items-center justify-between gap-4 border border-[#157F3D] bg-[#DCFCE7]/60 p-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-[#157F3D]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#141619] uppercase">
                  {draftState.customFranchise?.name || draftState.settings.franchiseName} XI IS READY
                </h2>
                <p className="text-xs text-[#2D3138]">
                  Playing XI, 4-man Impact Bench, Captain ({summary.captainName}), Keeper (
                  {summary.keeperName}), and batting order saved.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartSeason}
              className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
            >
              <span>{hasActiveSeason ? 'OPEN SEASON' : 'START SEASON'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!validation.isValid}
            onClick={onConfirmXI}
            className={`flex min-h-[48px] w-full items-center justify-center rounded-[3px] font-display text-xl font-extrabold tracking-wider uppercase transition-colors ${
              validation.isValid
                ? 'border-2 border-[#141619] bg-[#D94E28] text-white hover:bg-[#B83C1B]'
                : 'cursor-not-allowed border border-[#141619]/25 bg-[#EAE3D5] text-[#6A6E75]'
            }`}
          >
            CONFIRM PLAYING XI
          </button>
        )}
      </div>
    </section>
  );
}
