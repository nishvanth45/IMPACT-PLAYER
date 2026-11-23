import { Fragment } from 'react';
import { CheckCircle2, Flame, Play, Shield, Table2 } from 'lucide-react';
import { formatNrr, getUserStandingsInfo } from '../game/seasonEngine';
import type { SeasonState } from '../types/game';
import { AnimatedNumber } from './MotionPrimitives';

interface StandingsScreenProps {
  season: SeasonState | null;
  xiConfirmed: boolean;
  xiValid: boolean;
  animateNumbers?: boolean;
  onStartSeason: () => void;
  onPrepareTeam: () => void;
  onOpenFixtures?: () => void;
}

export function StandingsScreen({
  season,
  xiConfirmed,
  xiValid,
  animateNumbers = true,
  onStartSeason,
  onPrepareTeam,
  onOpenFixtures,
}: StandingsScreenProps) {
  if (!season) {
    return (
      <section className="mx-auto w-full max-w-4xl px-3 py-6 pb-20 sm:px-4 md:pb-10">
        <div className="border border-[#263039] bg-[#0E1318] p-6 text-center sm:p-8">
          <Table2 className="mx-auto h-8 w-8 text-[#22D36B]" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-extrabold text-[#F5F2EA] uppercase">
            LEAGUE STANDINGS
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-[#9DA8B3] sm:text-sm">
            {xiConfirmed && xiValid
              ? 'Start your 11-team IPL season to track the live points table and Top 4 playoff race.'
              : 'Finalize your Playing XI before starting the season.'}
          </p>
          <button
            type="button"
            onClick={xiConfirmed && xiValid ? onStartSeason : onPrepareTeam}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-6 py-2 font-display text-lg font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
          >
            {xiConfirmed && xiValid ? (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>START SEASON</span>
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>OPEN SQUAD &amp; XI</span>
              </>
            )}
          </button>
        </div>
      </section>
    );
  }

  const standings = getUserStandingsInfo(season);
  const challengeLabel =
    standings.challenge14Status === 'COMPLETED'
      ? '20-0 ACHIEVED'
      : standings.challenge14Status === 'ALIVE'
        ? `ALIVE (${standings.won}/20)`
        : `BROKEN (M${standings.challengeBrokenAtMatch ?? '?'})`;

  return (
    <section
      data-testid="standings-screen"
      className="mx-auto w-full max-w-6xl px-3 py-3 pb-20 sm:px-4 md:pb-10"
    >
      {onOpenFixtures && (
        <div className="mb-2.5 grid grid-cols-2 border border-[#263039] bg-[#0E1318] md:hidden">
          <button
            type="button"
            onClick={onOpenFixtures}
            className="min-h-[38px] font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase hover:bg-[#111820] hover:text-[#F5F2EA]"
          >
            FIXTURES
          </button>
          <button
            type="button"
            className="min-h-[38px] border-l border-[#263039] bg-[#22D36B] font-mono text-[11px] font-extrabold tracking-wider text-[#06110A] uppercase"
          >
            STANDINGS
          </button>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
        <div>
          <div className="font-mono text-[10px] font-bold tracking-widest text-[#F5B942] uppercase">
            SEASON {season.seasonNumber} · 11-TEAM POINTS TABLE
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase sm:text-3xl">
            STANDINGS
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[#9DA8B3] tabular-nums">
          <span>
            YOUR POS:{' '}
            <strong className={standings.position <= 4 ? 'text-[#22D36B]' : 'text-[#F5F2EA]'}>
              #{standings.position}
            </strong>
          </span>
          <span className="text-[#263039]">·</span>
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-[#F05A32]" aria-hidden="true" />
            <span className="text-[#F5F2EA]">20-0: {challengeLabel}</span>
          </span>
        </div>
      </div>

      {/* Playoff Qualification / Season Complete Banner */}
      {season.phase !== 'LEAGUE' && (
        <div
          data-testid={standings.position <= 4 ? 'playoffs-clinched-banner' : 'season-complete-banner'}
          className={`ip-fade-slide mt-3 flex flex-wrap items-center justify-between gap-2 border px-4 py-2.5 ${
            standings.position <= 4
              ? 'border-[#22D36B] bg-[#0A2014] text-[#F5F2EA]'
              : 'border-[#263039] bg-[#111820] text-[#F5F2EA]'
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-xs font-extrabold tracking-wider uppercase">
            {standings.position <= 4 && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22D36B]" aria-hidden="true" />
            )}
            <span className={standings.position <= 4 ? 'text-[#22D36B]' : 'text-[#F5F2EA]'}>
              {standings.position <= 4 ? 'PLAYOFFS CLINCHED' : 'SEASON COMPLETE'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
            {standings.position <= 4
              ? `Qualified #${standings.position} · ${standings.points} PTS (NRR ${formatNrr(standings.nrr)})`
              : `Finished #${standings.position} · Missed Top 4 (${standings.won}W-${standings.lost}L)`}
          </span>
        </div>
      )}

      {/* Points Table: POS | TEAM | P | W | L | NRR | PTS */}
      <div
        data-testid="points-table"
        className="mt-3 overflow-hidden border border-[#263039] bg-[#0E1318]"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#263039] bg-[#111820] font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                <th className="w-12 px-3 py-2 text-center">POS</th>
                <th className="px-2.5 py-2">TEAM</th>
                <th className="w-12 px-2 py-2 text-center">P</th>
                <th className="w-12 px-2 py-2 text-center">W</th>
                <th className="w-12 px-2 py-2 text-center">L</th>
                <th className="w-24 px-2.5 py-2 text-right">NRR</th>
                <th className="w-16 px-3 py-2 text-right">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263039]">
              {season.pointsTable.map((row, idx) => {
                const pos = idx + 1;
                const team = season.teams[row.teamId];
                const isTop4 = pos <= 4;
                const isUser = team.isUser;

                return (
                  <Fragment key={row.teamId}>
                    <tr
                      data-testid={`standings-row-${team.code}`}
                      className={
                        isUser
                          ? 'bg-[#22D36B]/[0.09] font-bold'
                          : isTop4
                            ? 'bg-[#0E1318] hover:bg-[#111820]'
                            : 'bg-[#0E1318]/75 hover:bg-[#111820]'
                      }
                    >
                      <td
                        className={`px-3 py-2.5 text-center font-mono text-xs font-extrabold tabular-nums ${
                          isTop4 ? 'text-[#22D36B]' : 'text-[#9DA8B3]'
                        }`}
                      >
                        {pos}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-white/15"
                            style={{ backgroundColor: team.primaryColor }}
                            aria-hidden="true"
                          />
                          <span className="truncate font-bold text-[#F5F2EA]">{team.name}</span>
                          <span className="hidden font-mono text-[10px] font-bold text-[#9DA8B3] sm:inline">
                            ({team.code})
                          </span>
                          {isUser && (
                            <span className="rounded-[2px] bg-[#22D36B] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[#06110A] uppercase">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-[#F5F2EA] tabular-nums">
                        {row.played}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono font-bold text-[#22D36B] tabular-nums">
                        {row.won}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-[#E44949] tabular-nums">
                        {row.lost}
                      </td>
                      <td
                        className={`px-2.5 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          row.nrr >= 0 ? 'text-[#22D36B]' : 'text-[#F87171]'
                        }`}
                      >
                        <AnimatedNumber
                          value={row.nrr}
                          enabled={animateNumbers}
                          format={(v) => formatNrr(v)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-extrabold text-[#F5F2EA] tabular-nums">
                        <AnimatedNumber
                          value={row.points}
                          enabled={animateNumbers}
                          format={(v) => String(Math.round(v))}
                        />
                      </td>
                    </tr>

                    {/* Visual Separation Line After 4th Position */}
                    {pos === 4 && (
                      <tr className="bg-[#111820]">
                        <td
                          colSpan={7}
                          className="border-y border-[#22D36B]/30 px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.16em] text-[#22D36B] uppercase"
                        >
                          ▲ TOP 4 QUALIFY FOR PLAYOFFS
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
