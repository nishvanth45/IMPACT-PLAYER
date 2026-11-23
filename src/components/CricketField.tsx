import { partitionFieldZones } from '../game/playingXiEngine';
import type { PlayerSeasonRecord } from '../types/game';
import { getDisplayRoleBadge } from './RoleBadge';

interface CricketFieldProps {
  xiPlayers: PlayerSeasonRecord[];
  captainId: string | null;
  wicketkeeperId: string | null;
  swapTargetXiId: string | null;
  recentlyMovedIds?: ReadonlySet<string>;
  autoPopulateWave?: number;
  animateField?: boolean;
  onFieldPlayerClick: (player: PlayerSeasonRecord) => void;
}

function FieldPlayerChip({
  player,
  isCaptain,
  isActiveWk,
  isSelectedForSwap,
  isRecentlyMoved,
  staggerDelayMs,
  onClick,
}: {
  player: PlayerSeasonRecord;
  isCaptain: boolean;
  isActiveWk: boolean;
  isSelectedForSwap: boolean;
  isRecentlyMoved: boolean;
  staggerDelayMs?: number;
  onClick: () => void;
}) {
  const displayRole = getDisplayRoleBadge(player.role, player.bowlingStyle);

  return (
    <button
      type="button"
      onClick={onClick}
      style={staggerDelayMs !== undefined ? { animationDelay: `${staggerDelayMs}ms` } : undefined}
      aria-label={`${player.playerName}, ${player.role}, Overall ${player.overallRating}${isCaptain ? ', Captain' : ''}${isActiveWk ? ', Wicketkeeper' : ''}`}
      className={`group relative flex min-h-[48px] min-w-[96px] max-w-[144px] flex-col items-center justify-center rounded-[3px] border px-2 py-1 text-center transition-[transform,background-color,border-color,box-shadow] duration-200 sm:min-w-[114px] sm:px-2.5 ${
        staggerDelayMs !== undefined || isRecentlyMoved ? 'ip-chip-pop' : ''
      } ${
        isSelectedForSwap
          ? 'border-[#F05A32] bg-[#23120D] ring-2 ring-[#F05A32]'
          : isRecentlyMoved
            ? 'border-[#22D36B] bg-[#0A2014] ring-1 ring-[#22D36B]'
            : 'border-[#263039] bg-[#0E1318]/95 hover:-translate-y-[1px] hover:border-[#22D36B] hover:bg-[#111820]'
      }`}
    >
      {(isCaptain || isActiveWk || player.isRetained) && (
        <div className="mb-0.5 flex items-center gap-1 font-mono text-[9.5px] font-extrabold">
          {player.isRetained && (
            <span className="rounded-[2px] border border-[#F5B942]/40 bg-[#201A0A] px-1 text-[8.5px] text-[#F5B942]">
              RET
            </span>
          )}
          {isCaptain && (
            <span className="rounded-[2px] bg-[#22D36B] px-1 text-[8.5px] text-[#06110A]">C</span>
          )}
          {isActiveWk && (
            <span className="rounded-[2px] bg-[#F5B942] px-1 text-[8.5px] text-[#080B0D]">WK</span>
          )}
        </div>
      )}

      <div className="w-full truncate text-xs font-extrabold text-[#F5F2EA]">
        {player.playerName}
      </div>

      <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[9.5px] font-bold text-[#9DA8B3] tabular-nums">
        <span>{displayRole}</span>
        <span>·</span>
        <span className="text-[#22D36B]">{player.overallRating}</span>
        {player.isOverseas && (
          <>
            <span>·</span>
            <span className="text-[#F5B942]">OS</span>
          </>
        )}
      </div>
    </button>
  );
}

export function CricketField({
  xiPlayers,
  captainId,
  wicketkeeperId,
  swapTargetXiId,
  recentlyMovedIds,
  autoPopulateWave = 0,
  animateField = true,
  onFieldPlayerClick,
}: CricketFieldProps) {
  const zones = partitionFieldZones(xiPlayers);
  const staggerFor = (slotIdx: number): number | undefined =>
    animateField && autoPopulateWave > 0 ? slotIdx * 52 : undefined;

  return (
    <div
      data-testid="cricket-field"
      className="relative overflow-hidden rounded-[3px] border border-[#263039] bg-[#0B2A1A] p-4 sm:p-5"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 50%, #124329 0%, #0C2E1C 62%, #071A10 100%)',
      }}
    >
      {/* Mowed grass stripes */}
      <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />

      {/* Boundary & 30-yard oval SVG */}
      <svg
        viewBox="0 0 600 420"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
        aria-hidden="true"
      >
        <ellipse
          cx="300"
          cy="210"
          rx="285"
          ry="195"
          fill="none"
          stroke="#22D36B"
          strokeWidth="1.8"
        />
        <ellipse
          cx="300"
          cy="210"
          rx="185"
          ry="120"
          fill="none"
          stroke="#F5F2EA"
          strokeWidth="1.3"
          strokeDasharray="7 7"
        />
        <rect
          x="278"
          y="150"
          width="44"
          height="120"
          rx="2"
          fill="#C2A373"
          fillOpacity="0.32"
          stroke="#F5F2EA"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        <line x1="274" y1="168" x2="326" y2="168" stroke="#F5F2EA" strokeWidth="1.2" strokeOpacity="0.65" />
        <line x1="274" y1="252" x2="326" y2="252" stroke="#F5F2EA" strokeWidth="1.2" strokeOpacity="0.65" />
      </svg>

      <div className="relative z-10 flex min-h-[330px] flex-col justify-between gap-4 sm:min-h-[360px]">
        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-[#F5F2EA]/80 uppercase">
            Top Order · Batters
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.top.length > 0 ? (
              zones.top.map((p, idx) => (
                <FieldPlayerChip
                  key={`${p.playerId}-${autoPopulateWave}`}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  isRecentlyMoved={Boolean(animateField && recentlyMovedIds?.has(p.playerId))}
                  staggerDelayMs={staggerFor(idx)}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-[#9DA8B3]">No top-order batters selected</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-[#F5F2EA]/80 uppercase">
            Middle Order · Keeper &amp; All-Rounders
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.middle.length > 0 ? (
              zones.middle.map((p, idx) => (
                <FieldPlayerChip
                  key={`${p.playerId}-${autoPopulateWave}`}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  isRecentlyMoved={Boolean(animateField && recentlyMovedIds?.has(p.playerId))}
                  staggerDelayMs={staggerFor(zones.top.length + idx)}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-[#9DA8B3]">
                No middle-order / keeper / all-rounders selected
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-[#F5F2EA]/80 uppercase">
            Bowling Attack · Pacers &amp; Spinners
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.bottom.length > 0 ? (
              zones.bottom.map((p, idx) => (
                <FieldPlayerChip
                  key={`${p.playerId}-${autoPopulateWave}`}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  isRecentlyMoved={Boolean(animateField && recentlyMovedIds?.has(p.playerId))}
                  staggerDelayMs={staggerFor(zones.top.length + zones.middle.length + idx)}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-[#9DA8B3]">No specialist bowlers selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
