import { partitionFieldZones } from '../game/playingXiEngine';
import type { PlayerSeasonRecord } from '../types/game';
import { getDisplayRoleBadge } from './RoleBadge';

interface CricketFieldProps {
  xiPlayers: PlayerSeasonRecord[];
  captainId: string | null;
  wicketkeeperId: string | null;
  swapTargetXiId: string | null;
  onFieldPlayerClick: (player: PlayerSeasonRecord) => void;
}

function FieldPlayerChip({
  player,
  isCaptain,
  isActiveWk,
  isSelectedForSwap,
  onClick,
}: {
  player: PlayerSeasonRecord;
  isCaptain: boolean;
  isActiveWk: boolean;
  isSelectedForSwap: boolean;
  onClick: () => void;
}) {
  const displayRole = getDisplayRoleBadge(player.role, player.bowlingStyle);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.playerName}, ${player.role}, Overall ${player.overallRating}${isCaptain ? ', Captain' : ''}${isActiveWk ? ', Wicketkeeper' : ''}`}
      className={`group relative flex min-h-[48px] min-w-[96px] max-w-[144px] flex-col items-center justify-center rounded-[3px] border px-2 py-1 text-center transition-all sm:min-w-[114px] sm:px-2.5 ${
        isSelectedForSwap
          ? 'border-[#F59E0B] bg-[#0D1B2A] ring-2 ring-[#D94E28]'
          : 'border-[#141619] bg-[#FAF8F3] hover:bg-white'
      }`}
    >
      {(isCaptain || isActiveWk || player.isRetained) && (
        <div className="mb-0.5 flex items-center gap-1 font-mono text-[9.5px] font-extrabold">
          {player.isRetained && (
            <span className="rounded-[2px] bg-[#6D28D9] px-1 text-[8.5px] text-white">RET</span>
          )}
          {isCaptain && (
            <span className="rounded-[2px] bg-[#D94E28] px-1 text-[8.5px] text-white">C</span>
          )}
          {isActiveWk && (
            <span className="rounded-[2px] bg-[#B45309] px-1 text-[8.5px] text-white">WK</span>
          )}
        </div>
      )}

      <div
        className={`w-full truncate text-xs font-extrabold ${
          isSelectedForSwap ? 'text-white' : 'text-[#141619]'
        }`}
      >
        {player.playerName}
      </div>

      <div
        className={`mt-0.5 flex items-center justify-center gap-1 font-mono text-[9.5px] font-bold tabular-nums ${
          isSelectedForSwap ? 'text-slate-300' : 'text-[#4A4E54]'
        }`}
      >
        <span>{displayRole}</span>
        <span>·</span>
        <span className={isSelectedForSwap ? 'text-[#F59E0B]' : 'text-[#157F3D]'}>
          {player.overallRating}
        </span>
        {player.isOverseas && (
          <>
            <span>·</span>
            <span className={isSelectedForSwap ? 'text-amber-300' : 'text-[#B45309]'}>OS</span>
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
  onFieldPlayerClick,
}: CricketFieldProps) {
  const zones = partitionFieldZones(xiPlayers);

  return (
    <div
      data-testid="cricket-field"
      className="relative overflow-hidden rounded-[4px] border-2 border-[#141619] bg-[#157F3D] p-4 sm:p-5"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% 50%, #1B9347 0%, #157F3D 68%, #0E5A2B 100%)',
      }}
    >
      {/* Mowed grass stripes */}
      <div className="pitch-stripes pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      {/* Boundary & 30-yard oval SVG */}
      <svg
        viewBox="0 0 600 420"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
        aria-hidden="true"
      >
        <ellipse
          cx="300"
          cy="210"
          rx="285"
          ry="195"
          fill="none"
          stroke="#FAF8F3"
          strokeWidth="2"
        />
        <ellipse
          cx="300"
          cy="210"
          rx="185"
          ry="120"
          fill="none"
          stroke="#FAF8F3"
          strokeWidth="1.5"
          strokeDasharray="7 7"
        />
        <rect
          x="278"
          y="150"
          width="44"
          height="120"
          rx="2"
          fill="#DFC496"
          fillOpacity="0.6"
          stroke="#FAF8F3"
          strokeOpacity="0.65"
          strokeWidth="1"
        />
        <line x1="274" y1="168" x2="326" y2="168" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.85" />
        <line x1="274" y1="252" x2="326" y2="252" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.85" />
      </svg>

      <div className="relative z-10 flex min-h-[330px] flex-col justify-between gap-4 sm:min-h-[360px]">
        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-white/90 uppercase">
            Top Order · Batters
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.top.length > 0 ? (
              zones.top.map((p) => (
                <FieldPlayerChip
                  key={p.playerId}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-white/75">No top-order batters selected</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-white/90 uppercase">
            Middle Order · Keeper &amp; All-Rounders
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.middle.length > 0 ? (
              zones.middle.map((p) => (
                <FieldPlayerChip
                  key={p.playerId}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-white/75">
                No middle-order / keeper / all-rounders selected
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-center font-mono text-[10px] font-bold tracking-widest text-white/90 uppercase">
            Bowling Attack · Pacers &amp; Spinners
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {zones.bottom.length > 0 ? (
              zones.bottom.map((p) => (
                <FieldPlayerChip
                  key={p.playerId}
                  player={p}
                  isCaptain={p.playerId === captainId}
                  isActiveWk={p.playerId === wicketkeeperId}
                  isSelectedForSwap={p.playerId === swapTargetXiId}
                  onClick={() => onFieldPlayerClick(p)}
                />
              ))
            ) : (
              <span className="text-xs font-medium text-white/75">No specialist bowlers selected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
