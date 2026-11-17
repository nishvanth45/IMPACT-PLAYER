import { useState } from 'react';
import { ArrowLeft, ArrowRight, Info, Users } from 'lucide-react';
import { formatCr, getOverseasCount, getRoleCounts } from '../game/draftEngine';
import type { DraftState, PlayerRole, PlayerSeasonRecord } from '../types/game';
import { RoleBadge } from './RoleBadge';

interface SquadScreenProps {
  state: DraftState;
  onGoToDraft: () => void;
  onGoToPlayingXI: () => void;
  onStartNewDraft: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

type RoleFilter = 'ALL' | Exclude<PlayerRole, 'UNKNOWN'>;

export function SquadScreen({
  state,
  onGoToDraft,
  onGoToPlayingXI,
  onStartNewDraft,
  onInspectPlayer,
}: SquadScreenProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const overseasCount = getOverseasCount(state.squad);
  const roleCounts = getRoleCounts(state.squad);
  const spentCr = state.settings.startingPurseCr - state.remainingPurseCr;
  const isSquadComplete = state.squad.length >= state.settings.squadSize;

  const filteredSquad =
    roleFilter === 'ALL'
      ? state.squad
      : state.squad.filter((player) => player.role === roleFilter);

  const franchiseTitle = state.customFranchise?.name || state.settings.franchiseName || 'Franchise';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4 pb-24 md:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-wide text-[#141619] uppercase">
            {franchiseTitle} Squad
          </h1>
          <p className="mt-0.5 font-mono text-xs text-[#4A4E54] tabular-nums">
            {state.squad.length}/{state.settings.squadSize} drafted ·{' '}
            {overseasCount}/{state.settings.overseasSquadLimit} overseas · Spent {formatCr(spentCr)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isSquadComplete ? (
            <button
              type="button"
              onClick={onGoToDraft}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-2 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Draft</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onGoToPlayingXI}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-2 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
              >
                <span>Playing XI</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onStartNewDraft}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[3px] border border-[#141619] bg-white px-4 py-2 text-xs font-bold tracking-wider text-[#141619] uppercase hover:bg-[#EAE3D5] whitespace-nowrap"
              >
                <span>New Draft</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Compact Scorebook Summary Bar */}
      <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-[#141619]/15 border-2 border-[#141619] bg-[#FAF8F3] sm:grid-cols-4 sm:divide-y-0">
        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Players</div>
          <div className="mt-0.5 font-mono text-xl font-extrabold text-[#141619] tabular-nums">
            {state.squad.length}/{state.settings.squadSize}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Purse Left</div>
          <div className="mt-0.5 font-mono text-xl font-extrabold text-[#B45309] tabular-nums">
            {formatCr(state.remainingPurseCr)}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Overseas</div>
          <div className="mt-0.5 font-mono text-xl font-extrabold text-[#157F3D] tabular-nums">
            {overseasCount}/{state.settings.overseasSquadLimit}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Balance</div>
          <div className="mt-1 font-mono text-xs font-bold text-[#141619] tabular-nums whitespace-nowrap sm:text-sm">
            {roleCounts.BAT} BAT · {roleCounts.WK} WK · {roleCounts.AR} AR · {roleCounts.BOWL} BWL
          </div>
        </div>
      </div>

      {state.squad.length === 0 ? (
        <div className="mt-4 border-2 border-[#141619] bg-[#FAF8F3] p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[3px] border border-[#141619] bg-white text-[#D94E28]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-[#141619] uppercase">
            No Players Drafted Yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#4A4E54]">
            Head to the Draft room, lock optional retentions, spin an IPL franchise-season, and draft your first player.
          </p>
          <button
            type="button"
            onClick={onGoToDraft}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2 font-display text-base font-bold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
          >
            Go to Draft
          </button>
        </div>
      ) : (
        <>
          {/* Role Filter Tabs */}
          <div className="mt-3 grid w-full grid-cols-5 gap-1 border border-[#141619] bg-[#FAF8F3] p-1 sm:inline-flex sm:w-auto">
            {(['ALL', 'BAT', 'WK', 'AR', 'BOWL'] as RoleFilter[]).map((role) => {
              const count = role === 'ALL' ? state.squad.length : roleCounts[role];
              const active = roleFilter === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={`min-h-[34px] rounded-[2px] px-2 py-1 font-mono text-[11px] font-bold transition-colors whitespace-nowrap tabular-nums sm:px-3 ${
                    active
                      ? 'bg-[#D94E28] text-white'
                      : 'text-[#141619] hover:bg-[#EAE3D5]'
                  }`}
                >
                  {role === 'ALL' ? `ALL (${count})` : `${role} (${count})`}
                </button>
              );
            })}
          </div>

          {/* Squad Roster Table */}
          <div className="mt-2.5 overflow-x-auto border-2 border-[#141619] bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b-2 border-[#141619] bg-[#EAE3D5] font-mono text-[10px] font-bold tracking-wider text-[#141619] uppercase">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-2.5 py-2">ROLE</th>
                  <th className="px-2.5 py-2">PLAYER</th>
                  <th className="px-2.5 py-2">ORIGIN</th>
                  <th className="px-2.5 py-2">TEAM • YR</th>
                  <th className="px-2 py-2 text-center">BAT</th>
                  <th className="px-2 py-2 text-center">BWL</th>
                  <th className="px-2 py-2 text-center">IMP</th>
                  <th className="px-2 py-2 text-center">OVR</th>
                  <th className="px-3 py-2 text-right">SALARY</th>
                  <th className="px-2 py-2 text-center">INFO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6D0C4]">
                {filteredSquad.map((player, index) => (
                  <tr
                    key={`${player.playerId}-${player.season}-${index}`}
                    className="hover:bg-[#FAF8F3]"
                  >
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-[#4A4E54] tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-2.5 py-2">
                      <RoleBadge role={player.role} bowlingStyle={player.bowlingStyle} />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        {onInspectPlayer ? (
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(player)}
                            className="font-bold text-[#141619] hover:text-[#D94E28] hover:underline text-left"
                          >
                            {player.playerName}
                          </button>
                        ) : (
                          <span className="font-bold text-[#141619]">{player.playerName}</span>
                        )}
                        {player.isRetained && (
                          <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[9px] font-extrabold text-white">
                            RET
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[10.5px] font-bold">
                      {player.isOverseas === true ? (
                        <span className="rounded-[2px] bg-[#FEF3C7] px-1.5 py-0.5 text-[#B45309]">
                          OS
                        </span>
                      ) : player.isOverseas === false ? (
                        <span className="rounded-[2px] bg-[#DCFCE7] px-1.5 py-0.5 text-[#157F3D]">
                          IND
                        </span>
                      ) : (
                        <span className="rounded-[2px] bg-stone-200 px-1.5 py-0.5 text-stone-700">
                          UNK
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[11px] font-semibold text-[#4A4E54] tabular-nums whitespace-nowrap">
                      {player.franchise} • {player.season}
                    </td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums">
                      {player.battingRating}
                    </td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums">
                      {player.bowlingRating}
                    </td>
                    <td className="px-2 py-2 text-center font-mono font-bold text-[#6D28D9] tabular-nums">
                      {player.impactRating}
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-sm font-extrabold text-[#141619] tabular-nums">
                      {player.overallRating}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-[#B45309] tabular-nums whitespace-nowrap">
                      {formatCr(player.priceCr)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {onInspectPlayer && (
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(player)}
                          aria-label={`Inspect ${player.playerName}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] border border-[#141619]/25 bg-[#FAF8F3] text-[#4A4E54] hover:border-[#141619] hover:text-[#141619]"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
