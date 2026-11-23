import {
  formatCrUpper,
  getPlayerDataCompleteness,
  getPlayerDisplayPriceInfo,
} from '../../game/draftEngine';
import type { PlayerSeasonRecord, SelectionCheck } from '../../types/game';
import { PlayerDataPendingBadge } from '../PlayerDataPendingBadge';
import { RoleBadge } from '../RoleBadge';

export interface PlayerRowProps {
  player: PlayerSeasonRecord;
  check: SelectionCheck;
  isSignedInThisPool?: boolean;
  justSigned?: boolean;
  animIndex?: number;
  animateRows?: boolean;
  onSelect: (player: PlayerSeasonRecord) => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

// Compact 8-column dark table row: ROLE | PLAYER | BAT | BOWL | IMP | OVR | PRICE | ACTION
export const DRAFT_TABLE_GRID_COLS =
  'md:grid md:grid-cols-[54px_minmax(210px,2.3fr)_40px_40px_40px_42px_162px_110px] md:items-center md:gap-2';

function getActionLabel(check: SelectionCheck, isSignedInThisPool?: boolean): string {
  if (isSignedInThisPool) return 'SIGNED ✓';
  if (check.allowed) return 'SIGN';
  switch (check.reason) {
    case 'ALREADY_DRAFTED':
      if (check.ownerTeamCode) {
        return `OWNED BY ${check.ownerTeamCode}`;
      }
      return check.label ?? 'OWNED';
    case 'OVERSEAS_LIMIT':
      return 'LIMIT REACHED';
    case 'INSUFFICIENT_PURSE':
      return 'LOW PURSE';
    case 'SQUAD_FULL':
      return 'SQUAD FULL';
    default:
      return check.label ?? 'UNAVAILABLE';
  }
}

export function PlayerRow({
  player,
  check,
  isSignedInThisPool = false,
  justSigned = false,
  animIndex = 0,
  animateRows = false,
  onSelect,
  onInspectPlayer,
}: PlayerRowProps) {
  const isDisabled = !check.allowed;
  const isOwnedElsewhere = check.reason === 'ALREADY_DRAFTED' && Boolean(check.ownerTeamCode);
  const displayName = player.name || player.playerName;
  const originTag =
    player.isOverseas === true ? 'OS' : player.isOverseas === false ? 'IND' : 'UNK';
  const originClass =
    player.isOverseas === true
      ? 'border-[#F5B942]/35 bg-[#201A0A] text-[#F5B942]'
      : player.isOverseas === false
        ? 'border-[#22D36B]/30 bg-[#0A2014] text-[#22D36B]'
        : 'border-[#263039] bg-[#111820] text-[#9DA8B3]';

  const priceInfo = getPlayerDisplayPriceInfo(player);
  const completeness = getPlayerDataCompleteness(player);
  const hasRatings = completeness.hasRatings;
  const actionLabel = getActionLabel(check, isSignedInThisPool);

  const selectAriaLabel = isDisabled
    ? `${displayName} unavailable: ${actionLabel}`
    : `Sign ${displayName} (${priceInfo.label})`;

  const formattedPrice =
    priceInfo.amountCr === null
      ? 'DATA PENDING'
      : priceInfo.source === 'REAL_CONTRACT'
        ? `${formatCrUpper(priceInfo.amountCr)} · REAL CONTRACT`
        : priceInfo.source === 'GAME_VALUE'
          ? `${formatCrUpper(priceInfo.amountCr)} · GAME VALUE`
          : priceInfo.label;

  const staggerDelay = animateRows ? `${Math.min(animIndex, 12) * 18}ms` : undefined;

  return (
    <article
      data-testid={`player-row-${player.playerId}`}
      style={staggerDelay ? { animationDelay: staggerDelay } : undefined}
      className={`border-b border-[#263039] transition-[opacity,background-color,border-color] duration-150 last:border-b-0 ${
        animateRows ? 'ip-row-enter' : ''
      } ${justSigned ? 'ip-green-flash' : ''} ${
        isSignedInThisPool
          ? 'bg-[#22D36B]/[0.11]'
          : isDisabled
            ? 'bg-[#0A0E12] opacity-55'
            : 'bg-[#0E1318] hover:bg-[#22D36B]/[0.06]'
      }`}
    >
      {/* Desktop Compact Single-Row: ROLE | PLAYER | BAT | BOWL | IMP | OVR | PRICE | ACTION */}
      <div className={`hidden min-h-[42px] px-3 py-1 ${DRAFT_TABLE_GRID_COLS}`}>
        <div>
          <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 pr-1">
          {onInspectPlayer ? (
            <button
              type="button"
              onClick={() => onInspectPlayer(player)}
              className="truncate text-left text-[13px] font-semibold text-[#F5F2EA] underline-offset-2 hover:text-[#22D36B] hover:underline"
              title={`View ${displayName} profile`}
            >
              {displayName}
            </button>
          ) : (
            <span className="truncate text-[13px] font-semibold text-[#F5F2EA]" title={displayName}>
              {displayName}
            </span>
          )}
          <span
            className={`shrink-0 rounded-[2px] border px-1 py-[1px] font-mono text-[8.5px] font-bold ${originClass}`}
          >
            {originTag}
          </span>
          {completeness.hasPendingData && <PlayerDataPendingBadge player={player} />}
        </div>

        {hasRatings ? (
          <>
            <div className="text-center font-mono text-xs font-semibold text-[#9DA8B3] tabular-nums">
              {player.battingRating}
            </div>
            <div className="text-center font-mono text-xs font-semibold text-[#9DA8B3] tabular-nums">
              {player.bowlingRating}
            </div>
            <div className="text-center font-mono text-xs font-bold text-[#F05A32] tabular-nums">
              {player.impactRating}
            </div>
            <div className="text-center font-mono text-xs font-extrabold text-[#F5F2EA] tabular-nums">
              {player.overallRating}
            </div>
          </>
        ) : (
          <div className="col-span-4 text-center font-mono text-[9.5px] font-bold tracking-wider text-[#F5B942]/85 uppercase">
            RATING PENDING
          </div>
        )}

        <div className="flex flex-col items-end justify-center font-mono tabular-nums">
          <span
            className={`text-[10px] font-bold whitespace-nowrap ${
              priceInfo.amountCr === null
                ? 'text-[#9DA8B3]'
                : priceInfo.source === 'GAME_VALUE'
                  ? 'text-[#9DA8B3]'
                  : 'text-[#F5B942]'
            }`}
          >
            {formattedPrice}
          </span>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(player)}
            aria-label={selectAriaLabel}
            className={`inline-flex h-7 min-w-[100px] items-center justify-center rounded-[2px] px-2 font-mono text-[9.5px] font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap ${
              isSignedInThisPool
                ? 'cursor-default border border-[#22D36B] bg-[#0A2014] text-[#22D36B]'
                : isDisabled
                  ? isOwnedElsewhere
                    ? 'cursor-not-allowed border border-[#263039] bg-[#111820] text-[#9DA8B3]'
                    : 'cursor-not-allowed border border-[#263039]/80 bg-[#0E1318] text-[#667380]'
                  : 'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
            }`}
          >
            {actionLabel}
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
                className="truncate text-left text-[13px] font-semibold text-[#F5F2EA] hover:text-[#22D36B]"
              >
                {displayName}
              </button>
            ) : (
              <span className="truncate text-[13px] font-semibold text-[#F5F2EA]">
                {displayName}
              </span>
            )}
            <span
              className={`shrink-0 rounded-[2px] border px-1 py-[1px] font-mono text-[8.5px] font-bold ${originClass}`}
            >
              {originTag}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums whitespace-nowrap">
            <span
              className={`text-[9.5px] font-bold ${
                priceInfo.amountCr === null
                  ? 'text-[#9DA8B3]'
                  : priceInfo.source === 'GAME_VALUE'
                    ? 'text-[#9DA8B3]'
                    : 'text-[#F5B942]'
              }`}
            >
              {formattedPrice}
            </span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10.5px] text-[#9DA8B3] tabular-nums">
            {hasRatings ? (
              <>
                <span>BAT {player.battingRating}</span>
                <span>·</span>
                <span>BWL {player.bowlingRating}</span>
                <span>·</span>
                <span className="font-bold text-[#F05A32]">IMP {player.impactRating}</span>
                <span>·</span>
                <span className="font-extrabold text-[#F5F2EA]">OVR {player.overallRating}</span>
              </>
            ) : (
              <span className="text-[9.5px] font-bold tracking-wider text-[#F5B942] uppercase">
                RATING PENDING
              </span>
            )}
            {completeness.hasPendingData && <PlayerDataPendingBadge player={player} compact />}
          </div>

          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(player)}
            aria-label={selectAriaLabel}
            className={`inline-flex min-h-[32px] min-w-[88px] shrink-0 items-center justify-center rounded-[2px] px-2.5 font-mono text-[9.5px] font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap ${
              isSignedInThisPool
                ? 'cursor-default border border-[#22D36B] bg-[#0A2014] text-[#22D36B]'
                : isDisabled
                  ? isOwnedElsewhere
                    ? 'cursor-not-allowed border border-[#263039] bg-[#111820] text-[#9DA8B3]'
                    : 'cursor-not-allowed border border-[#263039]/80 bg-[#0E1318] text-[#667380]'
                  : 'border border-[#22D36B] bg-[#22D36B] text-[#06110A] hover:bg-[#3CE282]'
            }`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
