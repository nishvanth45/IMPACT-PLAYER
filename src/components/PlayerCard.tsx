import { Info } from 'lucide-react';
import { formatCr } from '../game/draftEngine';
import type { PlayerSeasonRecord, SelectionCheck } from '../types/game';
import { RoleBadge } from './RoleBadge';

interface PlayerCardProps {
  player: PlayerSeasonRecord;
  check: SelectionCheck;
  onSelect: (player: PlayerSeasonRecord) => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

export const DRAFT_TABLE_GRID_COLS =
  'md:grid md:grid-cols-[58px_minmax(185px,2.2fr)_56px_44px_44px_44px_46px_82px_34px_108px] md:items-center md:gap-2';

export function PlayerCard({
  player,
  check,
  onSelect,
  onInspectPlayer,
}: PlayerCardProps) {
  const isDisabled = !check.allowed;
  const displayName = player.name || player.playerName;
  const originTag =
    player.isOverseas === true ? 'OS' : player.isOverseas === false ? 'IND' : 'UNK';
  const originClass =
    player.isOverseas === true
      ? 'bg-[#FEF3C7] text-[#B45309] border-[#F59E0B]/40'
      : player.isOverseas === false
        ? 'bg-[#DCFCE7] text-[#157F3D] border-[#157F3D]/30'
        : 'bg-stone-200 text-stone-700 border-stone-300';

  const selectAriaLabel = isDisabled
    ? `${displayName} unavailable: ${check.label}`
    : `Select ${displayName} for ${formatCr(player.priceCr)}`;

  return (
    <article
      data-testid={`player-row-${player.playerId}`}
      className={`border-b border-[#D6D0C4] transition-colors last:border-b-0 ${
        isDisabled
          ? 'bg-[#F5F1E8]/80 opacity-60'
          : 'bg-white hover:bg-[#FAF8F3]'
      }`}
    >
      {/* Desktop Compact Single-Row Table */}
      <div className={`hidden min-h-[44px] px-3 py-1 ${DRAFT_TABLE_GRID_COLS}`}>
        <div>
          <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 pr-1">
          {onInspectPlayer ? (
            <button
              type="button"
              onClick={() => onInspectPlayer(player)}
              className="truncate text-left text-[13px] font-bold text-[#141619] underline-offset-2 hover:text-[#D94E28] hover:underline"
              title={`View ${displayName} profile`}
            >
              {displayName}
            </button>
          ) : (
            <span className="truncate text-[13px] font-bold text-[#141619]" title={displayName}>
              {displayName}
            </span>
          )}
          <span
            className={`shrink-0 rounded-[2px] border px-1 py-0.2 font-mono text-[9px] font-bold ${originClass}`}
          >
            {originTag}
          </span>
        </div>

        <div className="font-mono text-[10.5px] font-semibold text-[#4A4E54]">
          {player.isOverseas === true
            ? 'Overseas'
            : player.isOverseas === false
              ? 'Indian'
              : 'Unknown'}
        </div>

        <div className="text-center font-mono text-xs font-semibold text-[#2D3138] tabular-nums">
          {player.battingRating}
        </div>
        <div className="text-center font-mono text-xs font-semibold text-[#2D3138] tabular-nums">
          {player.bowlingRating}
        </div>
        <div className="text-center font-mono text-xs font-bold text-[#6D28D9] tabular-nums">
          {player.impactRating}
        </div>
        <div className="text-center font-mono text-sm font-extrabold text-[#141619] tabular-nums">
          {player.overallRating}
        </div>

        <div className="text-right font-mono text-xs font-extrabold text-[#B45309] tabular-nums whitespace-nowrap">
          {formatCr(player.priceCr)}
        </div>

        <div className="flex justify-center">
          {onInspectPlayer && (
            <button
              type="button"
              onClick={() => onInspectPlayer(player)}
              aria-label={`Inspect ${displayName}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] transition-colors hover:border-[#141619] hover:text-[#141619]"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(player)}
            aria-label={selectAriaLabel}
            className={`inline-flex min-h-[32px] min-w-[96px] items-center justify-center rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              isDisabled
                ? 'cursor-not-allowed border border-[#141619]/20 bg-[#EAE3D5] text-[#6A6E75]'
                : 'bg-[#D94E28] text-white hover:bg-[#B83C1B]'
            }`}
          >
            {isDisabled ? check.label : 'SELECT'}
          </button>
        </div>
      </div>

      {/* Mobile Compact 2-Line Row */}
      <div className="px-3 py-2 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
            {onInspectPlayer ? (
              <button
                type="button"
                onClick={() => onInspectPlayer(player)}
                className="truncate text-left text-[13px] font-bold text-[#141619] hover:text-[#D94E28]"
              >
                {displayName}
              </button>
            ) : (
              <span className="truncate text-[13px] font-bold text-[#141619]">{displayName}</span>
            )}
            <span
              className={`shrink-0 rounded-[2px] border px-1 py-0.2 font-mono text-[9px] font-bold ${originClass}`}
            >
              {originTag}
            </span>
          </div>

          <span className="shrink-0 font-mono text-xs font-extrabold text-[#B45309] tabular-nums whitespace-nowrap">
            {formatCr(player.priceCr)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 font-mono text-[10.5px] text-[#4A4E54] tabular-nums">
            <span>BAT {player.battingRating}</span>
            <span>·</span>
            <span>BWL {player.bowlingRating}</span>
            <span>·</span>
            <span className="font-bold text-[#6D28D9]">IMP {player.impactRating}</span>
            <span>·</span>
            <span className="font-extrabold text-[#141619]">OVR {player.overallRating}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onInspectPlayer && (
              <button
                type="button"
                onClick={() => onInspectPlayer(player)}
                aria-label={`Inspect ${displayName}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54]"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(player)}
              aria-label={selectAriaLabel}
              className={`inline-flex min-h-[34px] items-center justify-center rounded-[2px] px-3 py-1 font-mono text-[11px] font-bold tracking-wider uppercase whitespace-nowrap ${
                isDisabled
                  ? 'cursor-not-allowed border border-[#141619]/20 bg-[#EAE3D5] text-[#6A6E75]'
                  : 'bg-[#D94E28] text-white hover:bg-[#B83C1B]'
              }`}
            >
              {isDisabled ? check.label : 'SELECT'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
