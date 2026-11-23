import { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  MapPin,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  formatNrr,
  formatOversDisplay,
  getUserFixtures,
  getUserStandingsInfo,
} from '../game/seasonEngine';
import type {
  MatchResult,
  PlayoffFixture,
  PlayoffRoundId,
  SeasonFixture,
  SeasonState,
} from '../types/game';
import { ScorecardPanel } from './MatchCenter';
import { AnimatedNumber } from './MotionPrimitives';

interface FixturesScreenProps {
  season: SeasonState | null;
  xiConfirmed: boolean;
  xiValid: boolean;
  animateNumbers?: boolean;
  onStartSeason: () => void;
  onQuickSimFixture: (fixtureId: string) => void;
  onPlayFixture: (fixtureId: string) => void;
  onQuickSimPlayoff: (playoffId: PlayoffRoundId) => void;
  onPlayPlayoff: (playoffId: PlayoffRoundId) => void;
  onPrepareTeam: () => void;
  onOpenStandings?: () => void;
}

function formatFixtureOutcome(result: MatchResult): { text: string; isWin: boolean } {
  if (result.winnerId === 'YOU') {
    return { text: result.marginText.replace(/^Win by /i, 'Won by '), isWin: true };
  }
  if (result.superOver) {
    return { text: 'Lost (SO)', isWin: false };
  }
  return {
    text: result.marginText.replace(/^Win by /i, 'Lost by '),
    isWin: false,
  };
}

export function FixturesScreen({
  season,
  xiConfirmed,
  xiValid,
  animateNumbers = true,
  onStartSeason,
  onQuickSimFixture,
  onPlayFixture,
  onQuickSimPlayoff,
  onPlayPlayoff,
  onPrepareTeam,
  onOpenStandings,
}: FixturesScreenProps) {
  const [viewedScorecard, setViewedScorecard] = useState<{
    title: string;
    venue: string;
    result: MatchResult;
  } | null>(null);

  if (!season) {
    return (
      <section className="mx-auto w-full max-w-4xl px-3 py-6 pb-20 sm:px-4 md:pb-10">
        <div className="border border-[#263039] bg-[#0E1318] p-6 text-center sm:p-8">
          <Trophy className="mx-auto h-8 w-8 text-[#22D36B]" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-extrabold text-[#F5F2EA] uppercase">
            SEASON FIXTURES
          </h1>
          {xiConfirmed && xiValid ? (
            <>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-[#9DA8B3] sm:text-sm">
                Your Playing XI and Impact Bench are ready. Start the 11-team, 20-match IPL season.
              </p>
              <button
                type="button"
                onClick={onStartSeason}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-6 py-2 font-display text-lg font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>START SEASON</span>
              </button>
            </>
          ) : (
            <>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-[#9DA8B3] sm:text-sm">
                Lock your 11-player Playing XI on the Squad screen before launching the season
                schedule.
              </p>
              <button
                type="button"
                onClick={onPrepareTeam}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-6 py-2 font-display text-lg font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>OPEN SQUAD &amp; XI</span>
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  const standings = getUserStandingsInfo(season);
  const userFixtures = getUserFixtures(season);
  const nextFixture = standings.nextFixture;
  const userTeam = season.teams.YOU;
  const championTeam = season.championTeamId ? season.teams[season.championTeamId] : null;
  const playoffList: PlayoffFixture[] = [
    season.playoffs.Q1,
    season.playoffs.ELIM,
    season.playoffs.Q2,
    season.playoffs.FINAL,
  ];

  return (
    <section
      data-testid="fixtures-screen"
      className="mx-auto w-full max-w-6xl px-3 py-3 pb-20 sm:px-4 md:pb-10"
    >
      {onOpenStandings && (
        <div className="mb-2.5 grid grid-cols-2 border border-[#263039] bg-[#0E1318] md:hidden">
          <button
            type="button"
            className="min-h-[38px] bg-[#22D36B] font-mono text-[11px] font-extrabold tracking-wider text-[#06110A] uppercase"
          >
            FIXTURES
          </button>
          <button
            type="button"
            onClick={onOpenStandings}
            className="min-h-[38px] border-l border-[#263039] font-mono text-[11px] font-bold tracking-wider text-[#9DA8B3] uppercase hover:bg-[#111820] hover:text-[#F5F2EA]"
          >
            STANDINGS
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[#263039] bg-[#111820] px-4 py-3 text-[#F5F2EA]">
        <div>
          <div className="font-mono text-[10px] font-bold tracking-widest text-[#F5B942] uppercase">
            SEASON {season.seasonNumber} · 20 LEAGUE MATCHES (10H / 10A)
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase sm:text-3xl">
            {userTeam.name} FIXTURES
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-[#9DA8B3] tabular-nums sm:inline">
            {standings.won}W-{standings.lost}L ·{' '}
            <AnimatedNumber
              value={standings.points}
              enabled={animateNumbers}
              format={(v) => String(Math.round(v))}
            />{' '}
            PTS · POS #{standings.position}
          </span>
          <button
            type="button"
            onClick={onStartSeason}
            className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-[#263039] bg-[#0E1318] px-3 font-mono text-[10.5px] font-bold text-[#F5F2EA] uppercase transition-colors hover:border-[#22D36B]/60 hover:bg-[#17212C]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>New Season</span>
          </button>
        </div>
      </div>

      {/* Playoff Qualification / Elimination Status Banner (league ended) */}
      {season.phase !== 'LEAGUE' && season.phase !== 'COMPLETED' && (
        <div
          data-testid={standings.position <= 4 ? 'playoffs-clinched-banner' : 'season-complete-banner'}
          className={`ip-result-reveal mt-3 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 ${
            standings.position <= 4
              ? 'border-[#22D36B] bg-[#0A2014] text-[#F5F2EA]'
              : 'border-[#263039] bg-[#111820] text-[#F5F2EA]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {standings.position <= 4 && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22D36B]" aria-hidden="true" />
            )}
            <div>
              <div
                className={`font-display text-xl font-extrabold tracking-wide uppercase ${
                  standings.position <= 4 ? 'text-[#22D36B]' : 'text-[#F5F2EA]'
                }`}
              >
                {standings.position <= 4 ? 'PLAYOFFS CLINCHED' : 'SEASON COMPLETE'}
              </div>
              <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
                {standings.position <= 4
                  ? `Finished #${standings.position} in the league (${standings.won}W-${standings.lost}L, ${standings.points} PTS) · Playoff bracket live`
                  : `Finished #${standings.position} (${standings.won}W-${standings.lost}L) · Outside Top 4 playoff cutoff`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Championship Banner */}
      {season.phase === 'COMPLETED' && championTeam && (
        <div
          data-testid="championship-banner"
          className={`ip-result-reveal mt-3 flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-[#F5F2EA] ${
            championTeam.id === 'YOU'
              ? 'border-[#22D36B] bg-[#0A2014]'
              : 'border-[#263039] bg-[#111820]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trophy
              className={`h-6 w-6 shrink-0 ${
                championTeam.id === 'YOU' ? 'text-[#22D36B]' : 'text-[#F5B942]'
              }`}
              aria-hidden="true"
            />
            <div>
              <div className="font-display text-xl font-extrabold uppercase">
                {championTeam.id === 'YOU'
                  ? `CHAMPIONS · ${championTeam.name} LIFTED THE TROPHY`
                  : standings.position > 4
                    ? `SEASON COMPLETE · CHAMPIONS: ${championTeam.name}`
                    : `SEASON ${season.seasonNumber} CHAMPIONS: ${championTeam.name}`}
              </div>
              <div className="font-mono text-[11px] text-[#9DA8B3] tabular-nums">
                Finished #{standings.position} ({standings.won}W-{standings.lost}L, NRR{' '}
                {formatNrr(standings.nrr)})
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onStartSeason}
            className="inline-flex h-9 items-center gap-1.5 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-4 font-display text-base font-extrabold tracking-wider text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
          >
            <span>START NEXT SEASON</span>
          </button>
        </div>
      )}

      {/* Playoff Bracket (when league stage ends) */}
      {season.phase !== 'LEAGUE' && (
        <div data-testid="playoffs-bracket" className="mt-3 border border-[#263039] bg-[#0E1318]">
          <div className="flex items-center justify-between border-b border-[#263039] bg-[#111820] px-3.5 py-2">
            <h2 className="font-display text-lg font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              PLAYOFFS &amp; FINAL
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#F5B942] uppercase">
              TOP 4 QUALIFICATION
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 p-3 md:grid-cols-2">
            {playoffList.map((po) => {
              const home = po.homeTeamId ? season.teams[po.homeTeamId] : null;
              const away = po.awayTeamId ? season.teams[po.awayTeamId] : null;
              const involvesUser = po.homeTeamId === 'YOU' || po.awayTeamId === 'YOU';
              const isCompleted = po.status === 'COMPLETED' && po.result !== null;
              const isReady = po.status === 'READY';
              const winner = isCompleted && po.result ? season.teams[po.result.winnerId] : null;

              return (
                <article
                  key={po.id}
                  data-testid={`playoff-card-${po.id}`}
                  className={`border p-3 ${
                    po.id === 'FINAL'
                      ? 'border-[#F5B942]/60 bg-[#1B160B]'
                      : 'border-[#263039] bg-[#111820]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-extrabold text-[#F5F2EA] uppercase">
                      {po.label}
                    </span>
                    <span
                      className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${
                        isCompleted
                          ? 'border-[#22D36B]/45 bg-[#0A2014] text-[#22D36B]'
                          : isReady
                            ? 'border-[#F05A32]/50 bg-[#23120D] text-[#F05A32]'
                            : 'border-[#263039] bg-[#0E1318] text-[#9DA8B3]'
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-xs font-bold text-[#F5F2EA]">
                    <span>{home ? home.name : po.homeSeedLabel}</span>
                    <span className="text-[#9DA8B3]">vs</span>
                    <span>{away ? away.name : po.awaySeedLabel}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-[#9DA8B3]">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{po.venue}</span>
                  </div>

                  {isCompleted && po.result && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#263039] pt-2">
                      <span className="font-mono text-[11px] font-bold text-[#22D36B]">
                        {winner?.shortName} · {po.result.marginText}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setViewedScorecard({
                            title: po.label,
                            venue: po.venue,
                            result: po.result!,
                          })
                        }
                        className="inline-flex h-7 items-center gap-1 rounded-[2px] border border-[#263039] bg-[#0E1318] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase hover:border-[#22D36B]"
                      >
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        <span>SCORECARD</span>
                      </button>
                    </div>
                  )}

                  {isReady && (
                    <div className="mt-2.5 flex items-center gap-2">
                      {involvesUser && (
                        <button
                          type="button"
                          onClick={() => onPlayPlayoff(po.id)}
                          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[2px] border border-[#22D36B] bg-[#22D36B] px-3 font-mono text-[10.5px] font-extrabold text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
                        >
                          <Play className="h-3 w-3" aria-hidden="true" />
                          <span>PLAY</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onQuickSimPlayoff(po.id)}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-[2px] border border-[#263039] bg-[#0E1318] px-3 font-mono text-[10.5px] font-bold text-[#F5F2EA] uppercase transition-colors hover:border-[#F5B942]/60 hover:bg-[#17212C]"
                      >
                        <Zap className="h-3 w-3 text-[#F5B942]" aria-hidden="true" />
                        <span>SIM</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* COMPACT LEAGUE SCHEDULE TABLE: Match | Opponent | Home/Away | Venue | Result | Points */}
      <div
        data-testid="fixtures-list"
        className="mt-3 overflow-hidden border border-[#263039] bg-[#0E1318]"
      >
        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#263039] bg-[#111820] font-mono text-[10px] font-bold tracking-wider text-[#9DA8B3] uppercase">
                <th className="px-3 py-2">MATCH</th>
                <th className="px-2.5 py-2">OPPONENT</th>
                <th className="px-2 py-2 text-center">H / A</th>
                <th className="px-2.5 py-2">VENUE</th>
                <th className="px-2.5 py-2">RESULT</th>
                <th className="px-2 py-2 text-center">PTS</th>
                <th className="px-3 py-2 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263039]">
              {userFixtures.map((fix: SeasonFixture) => {
                const isHome = fix.homeTeamId === 'YOU';
                const opponent = season.teams[isHome ? fix.awayTeamId : fix.homeTeamId];
                const isNext = nextFixture?.id === fix.id;
                const isCompleted = fix.status === 'COMPLETED' && fix.result !== null;
                const outcome = isCompleted && fix.result ? formatFixtureOutcome(fix.result) : null;
                const ptsAwarded = isCompleted ? (outcome?.isWin ? 2 : 0) : null;

                return (
                  <tr
                    key={fix.id}
                    data-testid={`fixture-match-${fix.userMatchNumber}`}
                    className={
                      isNext
                        ? 'bg-[#22D36B]/[0.08]'
                        : isCompleted
                          ? 'bg-[#0E1318] hover:bg-[#111820]'
                          : 'bg-[#0E1318]/65 text-[#9DA8B3]'
                    }
                  >
                    <td className="px-3 py-2 font-mono font-extrabold text-[#F5F2EA] tabular-nums whitespace-nowrap">
                      M{fix.userMatchNumber}
                      {isNext && (
                        <span className="ml-1.5 rounded-[2px] bg-[#22D36B] px-1 py-0.5 text-[8.5px] font-extrabold text-[#06110A]">
                          NEXT
                        </span>
                      )}
                    </td>

                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] border border-white/15"
                          style={{ backgroundColor: opponent.primaryColor }}
                          aria-hidden="true"
                        />
                        <span className="font-bold text-[#F5F2EA]">{opponent.name}</span>
                        <span className="font-mono text-[10px] text-[#9DA8B3]">
                          ({opponent.code})
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2 text-center">
                      <span
                        className={`inline-block rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                          isHome
                            ? 'border-[#22D36B]/40 bg-[#0A2014] text-[#22D36B]'
                            : 'border-[#F5B942]/40 bg-[#201A0A] text-[#F5B942]'
                        }`}
                      >
                        {isHome ? 'HOME' : 'AWAY'}
                      </span>
                    </td>

                    <td className="max-w-[200px] truncate px-2.5 py-2 text-[11px] text-[#9DA8B3]">
                      {fix.venue}
                    </td>

                    <td className="px-2.5 py-2 font-mono text-[11px] tabular-nums">
                      {isCompleted && outcome && fix.result ? (
                        <div>
                          <span
                            className={`font-extrabold ${
                              outcome.isWin ? 'text-[#22D36B]' : 'text-[#E44949]'
                            }`}
                          >
                            {outcome.text}
                          </span>
                          <span className="ml-1.5 text-[10px] text-[#9DA8B3]">
                            ({fix.result.firstInnings.runs}/{fix.result.firstInnings.wickets} vs{' '}
                            {fix.result.secondInnings.runs}/{fix.result.secondInnings.wickets})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-[#9DA8B3]/70">Scheduled</span>
                      )}
                    </td>

                    <td className="px-2 py-2 text-center font-mono font-extrabold tabular-nums">
                      {ptsAwarded === null ? (
                        <span className="text-[#9DA8B3]/50">—</span>
                      ) : (
                        <span className={ptsAwarded === 2 ? 'text-[#22D36B]' : 'text-[#9DA8B3]'}>
                          {ptsAwarded}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isCompleted && fix.result ? (
                        <button
                          type="button"
                          onClick={() =>
                            setViewedScorecard({
                              title: `Match ${fix.userMatchNumber} · vs ${opponent.code}`,
                              venue: fix.venue,
                              result: fix.result!,
                            })
                          }
                          className="inline-flex h-7 items-center gap-1 rounded-[2px] border border-[#263039] bg-[#111820] px-2.5 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase hover:border-[#22D36B]"
                        >
                          <FileText className="h-3 w-3" aria-hidden="true" />
                          <span>SCORECARD</span>
                        </button>
                      ) : isNext ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={onPrepareTeam}
                            className="inline-flex h-7 items-center rounded-[2px] border border-[#263039] bg-[#111820] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase hover:border-[#22D36B]/60"
                          >
                            PREPARE
                          </button>
                          <button
                            type="button"
                            data-testid="fixtures-play-next-btn"
                            onClick={() => onPlayFixture(fix.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-[2px] bg-[#22D36B] px-2.5 font-mono text-[10px] font-extrabold text-[#06110A] uppercase transition-colors hover:bg-[#1EC161]"
                          >
                            <Play className="h-3 w-3" aria-hidden="true" />
                            <span>PLAY</span>
                          </button>
                          <button
                            type="button"
                            title="Quick Sim Match"
                            aria-label={`Quick Sim Match ${fix.userMatchNumber}`}
                            onClick={() => onQuickSimFixture(fix.id)}
                            className="inline-flex h-7 items-center gap-0.5 rounded-[2px] border border-[#263039] bg-[#111820] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase hover:border-[#F5B942]/60"
                          >
                            <Zap className="h-3 w-3 text-[#F5B942]" aria-hidden="true" />
                            <span>SIM</span>
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-[#9DA8B3]/60 uppercase">
                          UPCOMING
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Compact 2-Line Rows */}
        <div className="divide-y divide-[#263039] md:hidden">
          {userFixtures.map((fix: SeasonFixture) => {
            const isHome = fix.homeTeamId === 'YOU';
            const opponent = season.teams[isHome ? fix.awayTeamId : fix.homeTeamId];
            const isNext = nextFixture?.id === fix.id;
            const isCompleted = fix.status === 'COMPLETED' && fix.result !== null;
            const outcome = isCompleted && fix.result ? formatFixtureOutcome(fix.result) : null;

            return (
              <div
                key={fix.id}
                className={`px-3 py-2.5 ${isNext ? 'bg-[#22D36B]/[0.08]' : 'bg-[#0E1318]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="font-mono text-[11px] font-extrabold text-[#22D36B]">
                      M{fix.userMatchNumber}
                    </span>
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] border border-white/15"
                      style={{ backgroundColor: opponent.primaryColor }}
                    />
                    <span className="truncate text-xs font-extrabold text-[#F5F2EA]">
                      vs {opponent.name}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                      isHome
                        ? 'border-[#22D36B]/40 bg-[#0A2014] text-[#22D36B]'
                        : 'border-[#F5B942]/40 bg-[#201A0A] text-[#F5B942]'
                    }`}
                  >
                    {isHome ? 'HOME' : 'AWAY'}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate font-mono text-[10.5px] text-[#9DA8B3]">
                    {isCompleted && outcome ? (
                      <span
                        className={`font-extrabold ${
                          outcome.isWin ? 'text-[#22D36B]' : 'text-[#E44949]'
                        }`}
                      >
                        {outcome.text} ({outcome.isWin ? '+2 pts' : '0 pts'})
                      </span>
                    ) : (
                      <span>{fix.venue}</span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isCompleted && fix.result ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewedScorecard({
                            title: `Match ${fix.userMatchNumber} · vs ${opponent.code}`,
                            venue: fix.venue,
                            result: fix.result!,
                          })
                        }
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-[2px] border border-[#263039] bg-[#111820] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase"
                      >
                        SCORECARD
                      </button>
                    ) : isNext ? (
                      <>
                        <button
                          type="button"
                          onClick={onPrepareTeam}
                          className="inline-flex min-h-[30px] items-center rounded-[2px] border border-[#263039] bg-[#111820] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase"
                        >
                          PREPARE
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlayFixture(fix.id)}
                          className="inline-flex min-h-[30px] items-center rounded-[2px] bg-[#22D36B] px-2.5 font-mono text-[10px] font-extrabold text-[#06110A] uppercase"
                        >
                          PLAY
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickSimFixture(fix.id)}
                          className="inline-flex min-h-[30px] items-center rounded-[2px] border border-[#263039] bg-[#111820] px-2 font-mono text-[10px] font-bold text-[#F5F2EA] uppercase"
                        >
                          SIM
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPLETED MATCH SCORECARD MODAL */}
      {viewedScorecard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Scorecard"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
          onClick={() => setViewedScorecard(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-[#263039] bg-[#080B0D] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#263039] pb-2.5">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-[#F5F2EA] uppercase">
                  {viewedScorecard.title}
                </h2>
                <div className="font-mono text-[11px] text-[#9DA8B3]">
                  {viewedScorecard.venue} ·{' '}
                  <strong className="text-[#22D36B]">
                    {season.teams[viewedScorecard.result.winnerId].shortName}{' '}
                    {viewedScorecard.result.marginText}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewedScorecard(null)}
                aria-label="Close scorecard"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#263039] bg-[#111820] text-[#F5F2EA] hover:border-[#22D36B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {viewedScorecard.result.firstScorecard || viewedScorecard.result.secondScorecard ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {viewedScorecard.result.firstScorecard && (
                  <ScorecardPanel
                    season={season}
                    card={viewedScorecard.result.firstScorecard}
                    inningsLabel="1st Innings"
                  />
                )}
                {viewedScorecard.result.secondScorecard && (
                  <ScorecardPanel
                    season={season}
                    card={viewedScorecard.result.secondScorecard}
                    inningsLabel="2nd Innings"
                    targetRuns={viewedScorecard.result.firstInnings.runs + 1}
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 border border-[#263039] bg-[#0E1318] p-4 font-mono text-xs sm:grid-cols-2">
                <div>
                  <div className="text-[10px] text-[#9DA8B3] uppercase">1st Innings</div>
                  <div className="mt-0.5 text-sm font-extrabold text-[#F5F2EA]">
                    {season.teams[viewedScorecard.result.firstInnings.teamId].name}:{' '}
                    {viewedScorecard.result.firstInnings.runs}/
                    {viewedScorecard.result.firstInnings.wickets} (
                    {formatOversDisplay(viewedScorecard.result.firstInnings.overs)} ov)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#9DA8B3] uppercase">2nd Innings</div>
                  <div className="mt-0.5 text-sm font-extrabold text-[#F5F2EA]">
                    {season.teams[viewedScorecard.result.secondInnings.teamId].name}:{' '}
                    {viewedScorecard.result.secondInnings.runs}/
                    {viewedScorecard.result.secondInnings.wickets} (
                    {formatOversDisplay(viewedScorecard.result.secondInnings.overs)} ov)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
