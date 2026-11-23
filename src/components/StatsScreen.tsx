import { useState } from 'react';
import { BarChart3, Crown, Flame, Play, Shield, Sparkles } from 'lucide-react';
import { getPlayerFormMeta } from '../game/ratingEngine';
import { getCapRaceLeaderboards } from '../game/seasonEngine';
import type { PlayerSeasonRecord, SeasonState } from '../types/game';
import { getDarkFormBadgeClass } from './ui/StatusBadge';

interface StatsScreenProps {
  season: SeasonState | null;
  xiConfirmed: boolean;
  xiValid: boolean;
  onStartSeason: () => void;
  onPrepareTeam: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

type StatsTab = 'BATTING' | 'BOWLING' | 'IMPACT';

export function StatsScreen({
  season,
  xiConfirmed,
  xiValid,
  onStartSeason,
  onPrepareTeam,
  onInspectPlayer,
}: StatsScreenProps) {
  const [tab, setTab] = useState<StatsTab>('BATTING');

  if (!season) {
    return (
      <section className="mx-auto w-full max-w-4xl px-3 py-6 pb-20 sm:px-4 md:pb-10">
        <div className="border border-[#263039] bg-[#0E1318] p-6 text-center sm:p-8">
          <BarChart3 className="mx-auto h-8 w-8 text-[#22D36B]" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-extrabold text-[#F5F2EA] uppercase">
            SEASON STATS &amp; AWARDS
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-[#9DA8B3] sm:text-sm">
            {xiConfirmed && xiValid
              ? 'Start the season to track the Orange Cap, Purple Cap, and Impact Player leaderboard.'
              : 'Confirm your Playing XI and start the season to populate league leaderboards.'}
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

  const leaderboards = getCapRaceLeaderboards(season);
  const orangeLeader = leaderboards.orangeCap[0] ?? null;
  const purpleLeader = leaderboards.purpleCap[0] ?? null;
  const impactLeader = leaderboards.impactLeaders[0] ?? null;

  return (
    <section
      data-testid="stats-screen"
      className="mx-auto w-full max-w-6xl px-3 py-3 pb-20 sm:px-4 md:pb-10"
    >
      {/* Header + Tabs: BATTING | BOWLING | IMPACT */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
        <div>
          <div className="font-mono text-[10px] font-bold tracking-widest text-[#F5B942] uppercase">
            SEASON {season.seasonNumber} · CAP RACE &amp; LEADERBOARDS
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase sm:text-3xl">
            LEAGUE STATS
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Stats leaderboards"
          className="flex items-center gap-1 rounded-[2px] border border-[#263039] bg-[#080B0D] p-1"
        >
          {(
            [
              { id: 'BATTING', label: 'BATTING' },
              { id: 'BOWLING', label: 'BOWLING' },
              { id: 'IMPACT', label: 'IMPACT' },
            ] as Array<{ id: StatsTab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              data-testid={`stats-tab-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`h-8 rounded-[2px] px-3.5 font-mono text-[11px] font-extrabold tracking-wider uppercase transition-colors ${
                tab === item.id
                  ? 'bg-[#22D36B] text-[#06110A]'
                  : 'text-[#9DA8B3] hover:bg-[#111820] hover:text-[#F5F2EA]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Cap Holders Summary Strip */}
      <div className="mt-3 grid grid-cols-1 divide-y divide-[#263039] border border-[#263039] bg-[#0E1318] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <button
          type="button"
          onClick={() => setTab('BATTING')}
          className={`px-3.5 py-2.5 text-left transition-colors ${
            tab === 'BATTING' ? 'bg-[#23120D]' : 'hover:bg-[#111820]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-[#F05A32] uppercase">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ORANGE CAP</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-extrabold text-[#F5F2EA]">
            {orangeLeader ? orangeLeader.playerName : 'No matches played'}
          </div>
          <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
            {orangeLeader
              ? `${orangeLeader.runs} runs · ${season.teams[orangeLeader.teamId].code}`
              : '—'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('BOWLING')}
          className={`px-3.5 py-2.5 text-left transition-colors ${
            tab === 'BOWLING' ? 'bg-[#1A1328]' : 'hover:bg-[#111820]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-[#C084FC] uppercase">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PURPLE CAP</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-extrabold text-[#F5F2EA]">
            {purpleLeader ? purpleLeader.playerName : 'No matches played'}
          </div>
          <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
            {purpleLeader
              ? `${purpleLeader.wickets} wkts · ${season.teams[purpleLeader.teamId].code}`
              : '—'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('IMPACT')}
          className={`px-3.5 py-2.5 text-left transition-colors ${
            tab === 'IMPACT' ? 'bg-[#201A0A]' : 'hover:bg-[#111820]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-[#F5B942] uppercase">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            <span>IMPACT LEADER</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-extrabold text-[#F5F2EA]">
            {impactLeader ? impactLeader.playerName : 'No matches played'}
          </div>
          <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
            {impactLeader
              ? `${impactLeader.impactPoints} pts · ${season.teams[impactLeader.teamId].code}`
              : '—'}
          </div>
        </button>
      </div>

      {/* BATTING: ORANGE CAP TABLE */}
      {tab === 'BATTING' && (
        <div className="mt-3 overflow-hidden border border-[#263039] bg-[#0E1318]">
          <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2">
            <h2 className="font-display text-lg font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              ORANGE CAP · MOST RUNS
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#F05A32] uppercase">
              TOP BATTERS
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#263039] bg-[#111820]/70 font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                  <th className="px-3 py-2">#</th>
                  <th className="px-2 py-2">PLAYER</th>
                  <th className="px-2 py-2">TEAM</th>
                  <th className="px-2 py-2 text-center">M</th>
                  <th className="px-2 py-2 text-right">RUNS</th>
                  <th className="px-2 py-2 text-right">HS</th>
                  <th className="px-2 py-2 text-right">AVG</th>
                  <th className="px-2 py-2 text-right">SR</th>
                  <th className="px-3 py-2 text-right">6S</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263039]">
                {leaderboards.orangeCap.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#9DA8B3]">
                      Simulate or play a match to track Orange Cap standings.
                    </td>
                  </tr>
                ) : (
                  leaderboards.orangeCap.slice(0, 15).map((row, idx) => {
                    const team = season.teams[row.teamId];
                    const outs = Math.max(0, row.innings - row.notOuts);
                    const avg = outs > 0 ? (row.runs / outs).toFixed(1) : row.runs.toFixed(1);
                    const sr = row.balls > 0 ? ((row.runs / row.balls) * 100).toFixed(1) : '0.0';
                    return (
                      <tr
                        key={`${row.teamId}-${row.playerId}`}
                        className={
                          team.isUser
                            ? 'bg-[#22D36B]/[0.08]'
                            : 'hover:bg-[#111820]'
                        }
                      >
                        <td className="px-3 py-2 font-mono font-bold text-[#9DA8B3] tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2 font-bold text-[#F5F2EA]">{row.playerName}</td>
                        <td className="px-2 py-2 font-mono text-[11px] font-bold text-[#9DA8B3]">
                          {team.code}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-[#F5F2EA] tabular-nums">
                          {row.matches}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-extrabold text-[#F05A32] tabular-nums">
                          {row.runs}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[#F5F2EA] tabular-nums">
                          {row.highestScore}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[#9DA8B3] tabular-nums">
                          {avg}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[#9DA8B3] tabular-nums">
                          {sr}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#F5F2EA] tabular-nums">
                          {row.sixes}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOWLING: PURPLE CAP TABLE */}
      {tab === 'BOWLING' && (
        <div className="mt-3 overflow-hidden border border-[#263039] bg-[#0E1318]">
          <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2">
            <h2 className="font-display text-lg font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              PURPLE CAP · MOST WICKETS
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#C084FC] uppercase">
              TOP BOWLERS
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#263039] bg-[#111820]/70 font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                  <th className="px-3 py-2">#</th>
                  <th className="px-2 py-2">PLAYER</th>
                  <th className="px-2 py-2">TEAM</th>
                  <th className="px-2 py-2 text-center">M</th>
                  <th className="px-2 py-2 text-right">WKTS</th>
                  <th className="px-2 py-2 text-right">OV</th>
                  <th className="px-2 py-2 text-right">ECON</th>
                  <th className="px-3 py-2 text-right">BEST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263039]">
                {leaderboards.purpleCap.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#9DA8B3]">
                      Simulate or play a match to track Purple Cap standings.
                    </td>
                  </tr>
                ) : (
                  leaderboards.purpleCap.slice(0, 15).map((row, idx) => {
                    const team = season.teams[row.teamId];
                    const econ =
                      row.oversBowled > 0
                        ? (row.runsConceded / row.oversBowled).toFixed(2)
                        : '0.00';
                    const best =
                      row.bestBowlingWickets > 0
                        ? `${row.bestBowlingWickets}/${row.bestBowlingRuns}`
                        : '—';
                    return (
                      <tr
                        key={`${row.teamId}-${row.playerId}`}
                        className={
                          team.isUser
                            ? 'bg-[#22D36B]/[0.08]'
                            : 'hover:bg-[#111820]'
                        }
                      >
                        <td className="px-3 py-2 font-mono font-bold text-[#9DA8B3] tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2 font-bold text-[#F5F2EA]">{row.playerName}</td>
                        <td className="px-2 py-2 font-mono text-[11px] font-bold text-[#9DA8B3]">
                          {team.code}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-[#F5F2EA] tabular-nums">
                          {row.matches}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-extrabold text-[#C084FC] tabular-nums">
                          {row.wickets}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[#9DA8B3] tabular-nums">
                          {row.oversBowled.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[#9DA8B3] tabular-nums">
                          {econ}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[#F5F2EA] tabular-nums">
                          {best}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IMPACT: IMPACT LEADERBOARD + SUBSTITUTION LOG + FORM STRIP */}
      {tab === 'IMPACT' && (
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden border border-[#263039] bg-[#0E1318]">
            <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2">
              <h2 className="font-display text-lg font-extrabold tracking-wide text-[#F5F2EA] uppercase">
                IMPACT LEADERBOARD
              </h2>
              <span className="font-mono text-[10px] font-bold text-[#F05A32] uppercase">
                MVP POINTS
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#263039] bg-[#111820]/70 font-mono text-[10px] font-bold text-[#9DA8B3] uppercase">
                    <th className="px-3 py-2">#</th>
                    <th className="px-2 py-2">PLAYER</th>
                    <th className="px-2 py-2">TEAM</th>
                    <th className="px-2 py-2 text-right">RUNS</th>
                    <th className="px-2 py-2 text-right">WKTS</th>
                    <th className="px-2 py-2 text-center">POTM</th>
                    <th className="px-3 py-2 text-right">IMPACT PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263039]">
                  {leaderboards.impactLeaders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#9DA8B3]">
                        Play or simulate matches to populate the Impact Leaderboard.
                      </td>
                    </tr>
                  ) : (
                    leaderboards.impactLeaders.slice(0, 15).map((row, idx) => {
                      const team = season.teams[row.teamId];
                      return (
                        <tr
                          key={`${row.teamId}-${row.playerId}`}
                          className={
                            team.isUser
                              ? 'bg-[#22D36B]/[0.08]'
                              : 'hover:bg-[#111820]'
                          }
                        >
                          <td className="px-3 py-2 font-mono font-bold text-[#9DA8B3] tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2 font-bold text-[#F5F2EA]">{row.playerName}</td>
                          <td className="px-2 py-2 font-mono text-[11px] font-bold text-[#9DA8B3]">
                            {team.code}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[#F5F2EA] tabular-nums">
                            {row.runs}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[#F5F2EA] tabular-nums">
                            {row.wickets}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-bold text-[#F5B942] tabular-nums">
                            {row.potmCount}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-extrabold text-[#F05A32] tabular-nums">
                            {row.impactPoints}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Squad Live Form & Impact Substitutions Log */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="border border-[#263039] bg-[#0E1318] p-3">
              <div className="font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                {season.teams.YOU.name} XI · LIVE FORM
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {season.teams.YOU.players.map((p) => {
                  const liveForm = season.playerForms?.[p.playerId] ?? p.form ?? 'NORMAL';
                  const formMeta = getPlayerFormMeta(liveForm);
                  return (
                    <button
                      key={p.playerId}
                      type="button"
                      onClick={() => onInspectPlayer?.(p)}
                      className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 text-[11px] font-bold transition-colors hover:border-[#22D36B] ${getDarkFormBadgeClass(liveForm)}`}
                    >
                      <span className="max-w-[110px] truncate">{p.playerName}</span>
                      <span className="font-mono text-[10px]">{formMeta.icon}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-[#263039] bg-[#0E1318] p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[#F05A32] uppercase">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>IMPACT SUBSTITUTIONS USED ({season.impactHistory?.length ?? 0})</span>
              </div>
              {season.impactHistory && season.impactHistory.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {season.impactHistory.map((item, idx) => (
                    <li
                      key={`${item.matchId}-${idx}`}
                      className="flex items-center justify-between border border-[#263039] bg-[#111820] px-2.5 py-1.5 font-mono text-[11px] text-[#F5F2EA]"
                    >
                      <span>
                        <strong className="text-[#22D36B]">IN: {item.inPlayerName}</strong> · OUT:{' '}
                        <span className="text-[#9DA8B3]">{item.outPlayerName}</span>
                      </span>
                      <span className="text-[#9DA8B3]">{item.matchLabel}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[#9DA8B3]">
                  No Impact substitutions logged yet this season.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
