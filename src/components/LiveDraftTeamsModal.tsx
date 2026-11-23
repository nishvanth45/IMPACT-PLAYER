import { useState } from 'react';
import { ShieldCheck, Users, X } from 'lucide-react';
import { formatCr, getPlayerDisplayPriceInfo } from '../game/draftEngine';
import type {
  DraftSettings,
  LiveLeagueDraftState,
  PlayerSeasonRecord,
  SeasonTeamId,
} from '../types/game';
import { RoleBadge } from './RoleBadge';

interface LiveDraftTeamsModalProps {
  liveLeague: LiveLeagueDraftState;
  settings: DraftSettings;
  onClose: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

export function LiveDraftTeamsModal({
  liveLeague,
  settings,
  onClose,
  onInspectPlayer,
}: LiveDraftTeamsModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<SeasonTeamId>('YOU');
  const activeTeam = liveLeague.teams[selectedTeamId] ?? liveLeague.teams.YOU;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All 11 League Franchises Draft Board"
      data-testid="all-teams-draft-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B0D]/85 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden border border-[#263039] bg-[#0E1318] text-[#F5F2EA] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#22D36B]" aria-hidden="true" />
            <h2 className="font-display text-xl font-extrabold tracking-wide uppercase">
              LIVE LEAGUE DRAFT BOARD · ALL 11 FRANCHISES
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close all teams modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#263039] bg-[#0E1318] text-[#9DA8B3] hover:border-[#22D36B] hover:text-[#F5F2EA]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Summary Split: Left = 11 Teams Table, Right = Selected Team Roster */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[0.95fr_1.15fr] md:divide-x md:divide-[#263039] md:overflow-hidden">
          {/* Left: 11 Teams Board */}
          <div className="flex min-h-0 flex-col bg-[#0E1318] md:overflow-y-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[1.3fr_0.65fr_0.95fr_0.55fr] items-center gap-2 border-b border-[#263039] bg-[#111820] px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
              <div>TEAM</div>
              <div className="text-center">PICKS</div>
              <div className="text-right">PURSE</div>
              <div className="text-right">OS</div>
            </div>

            <div className="divide-y divide-[#263039]">
              {liveLeague.teamOrder.map((tid) => {
                const team = liveLeague.teams[tid];
                if (!team) return null;
                const isSelected = tid === selectedTeamId;
                return (
                  <button
                    key={tid}
                    type="button"
                    data-testid={`modal-team-row-${team.code}`}
                    onClick={() => setSelectedTeamId(tid)}
                    className={`grid w-full grid-cols-[1.3fr_0.65fr_0.95fr_0.55fr] items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#22D36B]/[0.10]'
                        : 'bg-[#0E1318] hover:bg-[#111820]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-[#263039]"
                        style={{ backgroundColor: team.primaryColor }}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xs font-extrabold text-[#F5F2EA]">
                        {team.code}
                      </span>
                      {team.isUser && (
                        <span className="rounded-[2px] bg-[#22D36B] px-1 font-mono text-[8.5px] font-extrabold text-[#06110A]">
                          YOU
                        </span>
                      )}
                      <span className="hidden truncate text-[11px] text-[#9DA8B3] sm:inline">
                        {team.name}
                      </span>
                    </div>

                    <div className="text-center font-mono text-xs font-bold text-[#F5F2EA] tabular-nums">
                      {team.squad.length}/{settings.squadSize}
                    </div>
                    <div className="text-right font-mono text-xs font-extrabold text-[#F5B942] tabular-nums">
                      {formatCr(team.remainingPurseCr)}
                    </div>
                    <div
                      className={`text-right font-mono text-xs font-bold tabular-nums ${
                        team.overseasCount >= settings.overseasSquadLimit
                          ? 'text-[#F5B942]'
                          : 'text-[#22D36B]'
                      }`}
                    >
                      {team.overseasCount}/{settings.overseasSquadLimit}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Team Roster */}
          <div className="flex min-h-0 flex-col bg-[#080B0D] md:overflow-y-auto">
            {activeTeam && (
              <>
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#263039] bg-[#111820] px-3.5 py-2.5 text-[#F5F2EA]">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-[2px]"
                      style={{ backgroundColor: activeTeam.primaryColor }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="font-display text-lg font-extrabold tracking-wide uppercase">
                        {activeTeam.name} ({activeTeam.code})
                      </div>
                      <div className="font-mono text-[10px] text-[#9DA8B3] tabular-nums">
                        {activeTeam.squad.length}/{settings.squadSize} Signed · Purse{' '}
                        {formatCr(activeTeam.remainingPurseCr)} · OS {activeTeam.overseasCount}/
                        {settings.overseasSquadLimit}
                      </div>
                    </div>
                  </div>
                </div>

                {activeTeam.squad.length === 0 ? (
                  <div className="p-6 text-center font-mono text-xs text-[#9DA8B3]">
                    No players signed yet for {activeTeam.code}.
                  </div>
                ) : (
                  <div className="divide-y divide-[#263039] bg-[#0E1318]">
                    {activeTeam.squad.map((p, idx) => {
                      const priceInfo = getPlayerDisplayPriceInfo(p);
                      const hasRatings = p.hasRatings !== false && p.overallRating > 0;
                      return (
                        <div
                          key={`${activeTeam.teamId}-${p.playerId}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-[#22D36B]/[0.06]"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="w-4 shrink-0 font-mono text-[10px] font-bold text-[#9DA8B3] tabular-nums">
                              {idx + 1}.
                            </span>
                            <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                            {onInspectPlayer ? (
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(p)}
                                className="truncate text-left font-semibold text-[#F5F2EA] hover:text-[#22D36B] hover:underline"
                              >
                                {p.playerName || p.name}
                              </button>
                            ) : (
                              <span className="truncate font-semibold text-[#F5F2EA]">
                                {p.playerName || p.name}
                              </span>
                            )}
                            <span
                              className={`shrink-0 rounded-[2px] border px-1 font-mono text-[8.5px] font-bold ${
                                p.isOverseas === true
                                  ? 'border-[#F5B942]/35 bg-[#201A0A] text-[#F5B942]'
                                  : 'border-[#22D36B]/30 bg-[#0A2014] text-[#22D36B]'
                              }`}
                            >
                              {p.isOverseas === true ? 'OS' : 'IND'}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 font-mono text-[10.5px] tabular-nums">
                            <span className="hidden text-[#9DA8B3] sm:inline">
                              {p.franchise} {p.season}
                            </span>
                            <span className="font-extrabold text-[#F5F2EA]">
                              OVR {hasRatings ? p.overallRating : '—'}
                            </span>
                            <span
                              className={`font-bold ${
                                priceInfo.source === 'GAME_VALUE'
                                  ? 'text-[#9DA8B3]'
                                  : priceInfo.amountCr === null
                                    ? 'text-[#667380]'
                                    : 'text-[#F5B942]'
                              }`}
                            >
                              {priceInfo.amountCr === null
                                ? 'DATA PENDING'
                                : formatCr(priceInfo.amountCr)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263039] bg-[#111820] px-4 py-2 font-mono text-[10.5px] text-[#9DA8B3] tabular-nums">
          <div className="flex items-center gap-1.5 font-bold text-[#F5F2EA]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#22D36B]" aria-hidden="true" />
            <span>
              GLOBAL OWNERSHIP ACTIVE · {liveLeague.ownedPlayerIds.length} UNIQUE PLAYERS CLAIMED
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[2px] border border-[#263039] bg-[#0E1318] px-3 py-1 text-[10px] font-extrabold text-[#F5F2EA] uppercase hover:border-[#22D36B] hover:text-[#22D36B]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
