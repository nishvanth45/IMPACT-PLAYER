import { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Crown,
  Flame,
  Home,
  LayoutDashboard,
  MapPin,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Table2,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  formatNrr,
  formatOversDisplay,
  getCapRaceLeaderboards,
  getUserFixtures,
  getUserStandingsInfo,
} from '../game/seasonEngine';
import { getPlayerFormMeta } from '../game/ratingEngine';
import type {
  MatchResult,
  PlayerSeasonRecord,
  PlayoffFixture,
  PlayoffRoundId,
  SeasonFixture,
  SeasonState,
  SeasonTeamId,
} from '../types/game';
import { RoleBadge } from './RoleBadge';

type SeasonSubTab =
  | 'DASHBOARD'
  | 'FIXTURES'
  | 'STANDINGS'
  | 'MY_SQUAD'
  | 'CAP_RACE'
  | 'IMPACT';

interface SeasonScreenProps {
  season: SeasonState | null;
  xiConfirmed: boolean;
  xiValid: boolean;
  benchPlayers: PlayerSeasonRecord[];
  onStartSeason: () => void;
  onQuickSimFixture: (fixtureId: string) => void;
  onPlayFixture: (fixtureId: string) => void;
  onQuickSimPlayoff: (playoffId: PlayoffRoundId) => void;
  onPlayPlayoff: (playoffId: PlayoffRoundId) => void;
  onGoToPlayingXI: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

function getTeamInningsScore(result: MatchResult, teamId: SeasonTeamId) {
  return result.firstInnings.teamId === teamId ? result.firstInnings : result.secondInnings;
}

function formatUserOutcomeText(result: MatchResult): { text: string; isWin: boolean } {
  if (result.winnerId === 'YOU') {
    return { text: result.marginText, isWin: true };
  }
  if (result.superOver) {
    return { text: 'Lost in Super Over', isWin: false };
  }
  return {
    text: result.marginText.replace(/^Win by /i, 'Lost by '),
    isWin: false,
  };
}

function ScoreboardPair({
  season,
  homeTeamId,
  awayTeamId,
  result,
}: {
  season: SeasonState;
  homeTeamId: SeasonTeamId;
  awayTeamId: SeasonTeamId;
  result: MatchResult;
}) {
  const involvesUser = homeTeamId === 'YOU' || awayTeamId === 'YOU';
  const topTeamId = involvesUser ? 'YOU' : result.battingFirstTeamId;
  const bottomTeamId = topTeamId === homeTeamId ? awayTeamId : homeTeamId;

  const topTeam = season.teams[topTeamId];
  const bottomTeam = season.teams[bottomTeamId];
  const topInn = getTeamInningsScore(result, topTeamId);
  const bottomInn = getTeamInningsScore(result, bottomTeamId);

  return (
    <div className="mt-2.5 grid grid-cols-1 gap-1.5 border border-[#141619]/20 bg-white px-3 py-2 font-mono text-xs tabular-nums sm:grid-cols-2 sm:gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 truncate font-sans font-bold text-[#141619]">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: topTeam.primaryColor }}
            aria-hidden="true"
          />
          <span className="truncate">{topTeam.isUser ? topTeam.shortName : topTeam.code}</span>
          {result.winnerId === topTeamId && (
            <span className="rounded-[2px] bg-[#DCFCE7] px-1 text-[9.5px] font-extrabold text-[#157F3D]">
              WIN
            </span>
          )}
        </span>
        <span className="shrink-0 font-extrabold text-[#141619]">
          {topInn.runs}/{topInn.wickets} ({formatOversDisplay(topInn.overs)})
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#141619]/10 pt-1.5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
        <span className="flex items-center gap-2 truncate font-sans font-bold text-[#2D3138]">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: bottomTeam.primaryColor }}
            aria-hidden="true"
          />
          <span className="truncate">
            {bottomTeam.isUser ? bottomTeam.shortName : bottomTeam.code}
          </span>
          {result.winnerId === bottomTeamId && (
            <span className="rounded-[2px] bg-[#DCFCE7] px-1 text-[9.5px] font-extrabold text-[#157F3D]">
              WIN
            </span>
          )}
        </span>
        <span className="shrink-0 font-extrabold text-[#2D3138]">
          {bottomInn.runs}/{bottomInn.wickets} ({formatOversDisplay(bottomInn.overs)})
        </span>
      </div>
    </div>
  );
}

function PlayoffBracketGrid({
  season,
  playoffList,
  onQuickSimPlayoff,
  onPlayPlayoff,
}: {
  season: SeasonState;
  playoffList: PlayoffFixture[];
  onQuickSimPlayoff: (playoffId: PlayoffRoundId) => void;
  onPlayPlayoff: (playoffId: PlayoffRoundId) => void;
}) {
  return (
    <div className="space-y-3" data-testid="playoffs-bracket">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase">
          IPL Playoffs &amp; Final
        </h2>
        <span className="font-mono text-[11px] font-bold text-[#4A4E54] uppercase">
          Top 4 Qualification Bracket
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {playoffList.map((po) => {
          const homeTeam = po.homeTeamId ? season.teams[po.homeTeamId] : null;
          const awayTeam = po.awayTeamId ? season.teams[po.awayTeamId] : null;
          const involvesUser = po.homeTeamId === 'YOU' || po.awayTeamId === 'YOU';
          const isCompleted = po.status === 'COMPLETED' && po.result !== null;
          const isReady = po.status === 'READY';
          const winnerTeam =
            isCompleted && po.result ? season.teams[po.result.winnerId] : null;

          return (
            <article
              key={po.id}
              data-testid={`playoff-card-${po.id}`}
              className={`border-2 p-4 ${
                po.id === 'FINAL'
                  ? 'border-[#B45309] bg-[#FFFBEB]'
                  : isReady
                    ? 'border-[#D94E28] bg-[#FAF8F3]'
                    : 'border-[#141619] bg-[#FAF8F3]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {po.id === 'FINAL' && (
                      <Trophy className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
                    )}
                    <h3 className="font-display text-xl font-extrabold text-[#141619] uppercase">
                      {po.label}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-[#4A4E54]">{po.subtitle}</p>
                </div>

                <span
                  className={`shrink-0 rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                    isCompleted
                      ? 'bg-[#DCFCE7] text-[#157F3D]'
                      : isReady
                        ? 'bg-[#D94E28] text-white'
                        : 'bg-[#EAE3D5] text-[#4A4E54]'
                  }`}
                >
                  {po.status}
                </span>
              </div>

              <div className="mt-3 border border-[#141619]/20 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#141619]">
                    {homeTeam ? homeTeam.name : po.homeSeedLabel}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#4A4E54]">VS</span>
                  <span className="font-bold text-[#141619]">
                    {awayTeam ? awayTeam.name : po.awaySeedLabel}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#4A4E54]">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{po.venue}</span>
                </div>
              </div>

              {isCompleted && po.result && po.homeTeamId && po.awayTeamId && (
                <>
                  <ScoreboardPair
                    season={season}
                    homeTeamId={po.homeTeamId}
                    awayTeamId={po.awayTeamId}
                    result={po.result}
                  />
                  <div className="mt-2 font-mono text-xs font-bold text-[#157F3D]">
                    {winnerTeam?.name} — {po.result.marginText}
                  </div>
                </>
              )}

              {isReady && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {involvesUser && (
                    <button
                      type="button"
                      onClick={() => onPlayPlayoff(po.id)}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-1.5 font-display text-base font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>PLAY {po.id === 'FINAL' ? 'FINAL' : 'MATCH'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onQuickSimPlayoff(po.id)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[3px] border border-[#141619] bg-[#0D1B2A] px-4 py-1.5 font-mono text-xs font-bold tracking-wider text-white uppercase hover:bg-[#162B42]"
                  >
                    <Zap className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                    <span>QUICK SIM {po.id === 'FINAL' ? 'FINAL' : ''}</span>
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function SeasonScreen({
  season,
  xiConfirmed,
  xiValid,
  benchPlayers,
  onStartSeason,
  onQuickSimFixture,
  onPlayFixture,
  onQuickSimPlayoff,
  onPlayPlayoff,
  onGoToPlayingXI,
  onInspectPlayer,
}: SeasonScreenProps) {
  const [subTab, setSubTab] = useState<SeasonSubTab>('DASHBOARD');

  useEffect(() => {
    if (season?.phase === 'PLAYOFFS' || season?.phase === 'COMPLETED') {
      const nextUserFix = getUserFixtures(season).find((f) => f.status === 'SCHEDULED');
      if (!nextUserFix && subTab === 'FIXTURES') {
        setSubTab('DASHBOARD');
      }
    }
  }, [season?.phase, season?.seasonNumber, subTab]);

  if (!season) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 pb-24 md:pb-12">
        <div className="border-2 border-[#141619] bg-[#FAF8F3] p-8 text-center shadow-[4px_4px_0px_#141619] sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-[#141619] bg-[#0D1B2A] text-[#F59E0B]">
            <Trophy className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-[#141619] uppercase sm:text-4xl">
            IMPACT PLAYER SEASON
          </h1>

          {xiConfirmed && xiValid ? (
            <>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#4A4E54]">
                Your Playing XI and 4-man Impact Bench are locked in. Launch the 11-team, 20-match IPL league season (10 Home / 10 Away) + Top-4 Playoffs.
              </p>
              <button
                type="button"
                onClick={onStartSeason}
                className="mt-6 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-7 py-3 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[3px_3px_0px_#141619] hover:bg-[#B83C1B]"
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                <span>START SEASON</span>
              </button>
            </>
          ) : (
            <>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#4A4E54]">
                Confirm your 11-player Playing XI (Captain, Wicketkeeper, max 4 Overseas) before starting the season.
              </p>
              <button
                type="button"
                onClick={onGoToPlayingXI}
                className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>Go to Playing XI</span>
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
  const championTeam = season.championTeamId ? season.teams[season.championTeamId] : null;
  const leaderboards = getCapRaceLeaderboards(season);
  const activeBench =
    benchPlayers.length > 0 ? benchPlayers : season.userBench ?? [];

  const playoffList: PlayoffFixture[] = [
    season.playoffs.Q1,
    season.playoffs.ELIM,
    season.playoffs.Q2,
    season.playoffs.FINAL,
  ];
  const readyPlayoff =
    playoffList.find(
      (p) => p.status === 'READY' && (p.homeTeamId === 'YOU' || p.awayTeamId === 'YOU')
    ) ?? playoffList.find((p) => p.status === 'READY') ?? null;

  const userTeam = season.teams.YOU;
  const userSecondaryColor = userTeam.secondaryColor ?? '#F59E0B';

  const challengeLabel =
    standings.challenge14Status === 'COMPLETED'
      ? '20-0 WON!'
      : standings.challenge14Status === 'ALIVE'
        ? `ALIVE (${standings.won}/20)`
        : `BROKEN (M${standings.challengeBrokenAtMatch ?? '?'})`;

  const challengeColorClass =
    standings.challenge14Status === 'COMPLETED'
      ? 'text-[#B45309]'
      : standings.challenge14Status === 'ALIVE'
        ? 'text-[#157F3D]'
        : 'text-[#B83C1B]';

  const tabs: Array<{ id: SeasonSubTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'DASHBOARD', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'FIXTURES', label: 'FIXTURES', icon: Calendar },
    { id: 'STANDINGS', label: 'STANDINGS', icon: Table2 },
    { id: 'MY_SQUAD', label: 'MY SQUAD', icon: Users },
    { id: 'CAP_RACE', label: 'CAP RACE', icon: BarChart3 },
    { id: 'IMPACT', label: 'IMPACT', icon: Sparkles },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-4 pb-24 md:pb-12">
      {/* Custom Franchise Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-2 border-[#141619] bg-[#0D1B2A] px-4 py-3 text-white"
        style={{ borderTopWidth: '5px', borderTopColor: userTeam.primaryColor }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border-2 font-mono text-xs font-extrabold tracking-wider text-white"
            style={{
              backgroundColor: userTeam.primaryColor,
              borderColor: userSecondaryColor,
            }}
          >
            {userTeam.code}
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-wide text-white uppercase sm:text-3xl">
              {userTeam.name}
            </h1>
            <p className="font-mono text-[11px] text-slate-300">
              Season {season.seasonNumber} · 11-Team League · 20 Matches (10H / 10A) · Top 4 Playoffs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartSeason}
          className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-3.5 py-1.5 font-mono text-xs font-bold text-white uppercase hover:bg-white/20 whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New Season</span>
        </button>
      </div>

      {/* Season Summary HUD */}
      <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-[#141619]/15 border-2 border-[#141619] bg-[#FAF8F3] sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Played</div>
          <div
            data-testid="season-played"
            className="mt-0.5 font-mono text-lg font-extrabold text-[#141619] tabular-nums"
          >
            {standings.played}/20
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Wins</div>
          <div
            data-testid="season-wins"
            className="mt-0.5 font-mono text-lg font-extrabold text-[#157F3D] tabular-nums"
          >
            {standings.won}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Losses</div>
          <div
            data-testid="season-losses"
            className="mt-0.5 font-mono text-lg font-extrabold text-[#D94E28] tabular-nums"
          >
            {standings.lost}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Points</div>
          <div
            data-testid="season-points"
            className="mt-0.5 font-mono text-lg font-extrabold text-[#1D4ED8] tabular-nums"
          >
            {standings.points}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">NRR</div>
          <div
            data-testid="season-nrr"
            className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums ${
              standings.nrr >= 0 ? 'text-[#157F3D]' : 'text-[#D94E28]'
            }`}
          >
            {formatNrr(standings.nrr)}
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">Position</div>
          <div
            data-testid="season-position"
            className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums ${
              standings.position <= 4 ? 'text-[#157F3D]' : 'text-[#141619]'
            }`}
          >
            #{standings.position}
          </div>
        </div>

        <div className="col-span-2 px-3 py-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
            <Flame className="h-3 w-3 text-[#D94E28]" aria-hidden="true" />
            <span>20-0 CHALLENGE</span>
          </div>
          <div
            data-testid="season-challenge"
            className={`mt-0.5 font-mono text-sm font-extrabold tabular-nums ${challengeColorClass}`}
          >
            {challengeLabel}
          </div>
        </div>
      </div>

      {/* Championship Banner */}
      {season.phase === 'COMPLETED' && championTeam && (
        <div
          data-testid="championship-banner"
          className={`mt-4 flex flex-col items-center justify-between gap-4 border-2 p-5 text-center sm:flex-row sm:text-left ${
            championTeam.id === 'YOU'
              ? 'border-[#141619] bg-[#0D1B2A] text-white shadow-[4px_4px_0px_#B45309]'
              : 'border-[#141619] bg-[#FAF8F3] text-[#141619]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
                championTeam.id === 'YOU'
                  ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B]'
                  : 'border-[#141619]/20 bg-white text-[#1D4ED8]'
              }`}
            >
              <Trophy className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase sm:text-3xl">
                {championTeam.id === 'YOU'
                  ? `CHAMPIONS! ${championTeam.name} Won the Title!`
                  : `${championTeam.name} Won the Championship`}
              </h2>
              <p
                className={`mt-0.5 text-xs ${
                  championTeam.id === 'YOU' ? 'text-slate-300' : 'text-[#4A4E54]'
                }`}
              >
                {championTeam.id === 'YOU'
                  ? `Finished league stage #${standings.position} (${standings.won}W-${standings.lost}L, NRR ${formatNrr(standings.nrr)}) and lifted the trophy.`
                  : `${season.teams.YOU.name} finished #${standings.position} (${standings.won}W-${standings.lost}L, ${standings.points} pts, NRR ${formatNrr(standings.nrr)}).`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartSeason}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Play Another Season</span>
          </button>
        </div>
      )}

      {/* 6 Season Sub-Tabs */}
      <div
        className="mt-4 flex flex-wrap gap-1 border-2 border-[#141619] bg-[#FAF8F3] p-1"
        role="tablist"
        aria-label="Season views"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`season-tab-${tab.id}`}
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[2px] px-2.5 py-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap sm:flex-none sm:px-3.5 ${
                isActive
                  ? 'bg-[#D94E28] text-white'
                  : 'text-[#2D3138] hover:bg-[#EAE3D5] hover:text-[#141619]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {subTab === 'DASHBOARD' && (
        <div className="mt-4 space-y-4">
          {/* Next Match / Active Playoff Dark Navy Hero Card */}
          {nextFixture ? (
            <div
              className="border-2 border-[#141619] bg-[#0D1B2A] p-5 text-white shadow-[4px_4px_0px_#141619]"
              style={{ borderLeftWidth: '6px', borderLeftColor: userTeam.primaryColor }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white uppercase"
                  style={{ backgroundColor: userTeam.primaryColor }}
                >
                  NEXT MATCH · {nextFixture.userMatchNumber}/20
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                  {nextFixture.venue}
                </span>
              </div>

              {(() => {
                const isHome = nextFixture.homeTeamId === 'YOU';
                const opp = season.teams[isHome ? nextFixture.awayTeamId : nextFixture.homeTeamId];
                return (
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-[#F59E0B] uppercase">
                        {isHome ? 'HOME FIXTURE' : 'AWAY FIXTURE'}
                      </div>
                      <h2 className="mt-0.5 font-display text-3xl font-extrabold tracking-wide uppercase">
                        {season.teams.YOU.shortName} vs {opp.name} ({opp.code})
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        data-testid="dashboard-play-match-btn"
                        onClick={() => onPlayFixture(nextFixture.id)}
                        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border border-white/25 bg-[#D94E28] px-5 py-2 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B] whitespace-nowrap"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>PLAY MATCH</span>
                      </button>

                      <button
                        type="button"
                        data-testid="dashboard-quick-sim-btn"
                        onClick={() => onQuickSimFixture(nextFixture.id)}
                        className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-4 py-2 font-mono text-xs font-bold tracking-wider text-white uppercase hover:bg-white/20 whitespace-nowrap"
                      >
                        <Zap className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                        <span>QUICK SIM</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : readyPlayoff ? (
            <div className="border-2 border-[#141619] bg-[#0D1B2A] p-5 text-white shadow-[4px_4px_0px_#141619]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-[2px] bg-[#F59E0B] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#141619] uppercase">
                  PLAYOFFS · {readyPlayoff.label.toUpperCase()}
                </span>
                <span className="font-mono text-xs text-slate-300">{readyPlayoff.venue}</span>
              </div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-3xl font-extrabold uppercase">
                    {season.teams[readyPlayoff.homeTeamId!]?.name} vs{' '}
                    {season.teams[readyPlayoff.awayTeamId!]?.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-300">{readyPlayoff.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {(readyPlayoff.homeTeamId === 'YOU' || readyPlayoff.awayTeamId === 'YOU') && (
                    <button
                      type="button"
                      onClick={() => onPlayPlayoff(readyPlayoff.id)}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[3px] border border-white/25 bg-[#D94E28] px-5 py-2 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>PLAY MATCH</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onQuickSimPlayoff(readyPlayoff.id)}
                    className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-4 py-2 font-mono text-xs font-bold text-white uppercase hover:bg-white/20"
                  >
                    <Zap className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
                    <span>QUICK SIM</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Live Form Strip */}
          <div
            data-testid="season-xi-form-strip"
            className="border-2 border-[#141619] bg-[#FAF8F3] px-3.5 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#4A4E54] uppercase">
                {userTeam.name} XI · Live Form Tracker
              </span>
              <span className="font-mono text-[10.5px] text-[#4A4E54]">
                Tap player to inspect full profile
              </span>
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
                    title={`${p.playerName} · OVR ${p.overallRating} · Form: ${formMeta.label}`}
                    className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 text-left text-[11px] font-bold transition-colors hover:border-[#141619] ${formMeta.badgeClass}`}
                  >
                    <span className="max-w-[115px] truncate">{p.playerName}</span>
                    <span className="font-mono text-[10px] opacity-80 tabular-nums">
                      {p.overallRating}
                    </span>
                    <span aria-label={`Form ${formMeta.label}`} className="font-mono text-[11px]">
                      {formMeta.icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dashboard 2-Col Overview: Top 4 Standings + Cap Leaders */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="border-2 border-[#141619] bg-[#FAF8F3]">
              <div className="flex items-center justify-between border-b border-[#141619] bg-[#EFE9DC] px-3.5 py-2">
                <span className="font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
                  Top 4 Standings Preview
                </span>
                <button
                  type="button"
                  onClick={() => setSubTab('STANDINGS')}
                  className="font-mono text-[10.5px] font-bold text-[#D94E28] uppercase hover:underline"
                >
                  Full Table →
                </button>
              </div>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141619]/15 bg-white font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                    <th className="px-3 py-1.5">#</th>
                    <th className="px-2 py-1.5">TEAM</th>
                    <th className="px-2 py-1.5 text-center">P</th>
                    <th className="px-2 py-1.5 text-center">W</th>
                    <th className="px-2 py-1.5 text-right">PTS</th>
                    <th className="px-3 py-1.5 text-right">NRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141619]/10 bg-white">
                  {season.pointsTable.slice(0, 4).map((row, idx) => {
                    const team = season.teams[row.teamId];
                    return (
                      <tr key={row.teamId} className={team.isUser ? 'bg-[#FFF3EE]' : ''}>
                        <td className="px-3 py-2 font-mono font-bold text-[#157F3D]">{idx + 1}</td>
                        <td className="px-2 py-2 font-bold text-[#141619]">
                          {team.name}
                        </td>
                        <td className="px-2 py-2 text-center font-mono tabular-nums">{row.played}</td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-[#157F3D] tabular-nums">
                          {row.won}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-extrabold text-[#141619] tabular-nums">
                          {row.points}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#4A4E54] tabular-nums">
                          {formatNrr(row.nrr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-2 border-[#141619] bg-[#FAF8F3]">
              <div className="flex items-center justify-between border-b border-[#141619] bg-[#EFE9DC] px-3.5 py-2">
                <span className="font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase">
                  Cap Race Leaders
                </span>
                <button
                  type="button"
                  onClick={() => setSubTab('CAP_RACE')}
                  className="font-mono text-[10.5px] font-bold text-[#D94E28] uppercase hover:underline"
                >
                  All Leaders →
                </button>
              </div>
              <div className="grid grid-cols-1 divide-y divide-[#141619]/15 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="p-3">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-[#C2410C] uppercase">
                    <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Orange Cap</span>
                  </div>
                  {leaderboards.orangeCap[0] ? (
                    <div className="mt-1.5">
                      <div className="truncate text-sm font-extrabold text-[#141619]">
                        {leaderboards.orangeCap[0].playerName}
                      </div>
                      <div className="font-mono text-xs text-[#4A4E54] tabular-nums">
                        {leaderboards.orangeCap[0].runs} runs ({leaderboards.orangeCap[0].matches}m)
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-[#6A6E75]">Play a match to track runs.</div>
                  )}
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-extrabold text-[#6D28D9] uppercase">
                    <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Purple Cap</span>
                  </div>
                  {leaderboards.purpleCap[0] ? (
                    <div className="mt-1.5">
                      <div className="truncate text-sm font-extrabold text-[#141619]">
                        {leaderboards.purpleCap[0].playerName}
                      </div>
                      <div className="font-mono text-xs text-[#4A4E54] tabular-nums">
                        {leaderboards.purpleCap[0].wickets} wkts ({leaderboards.purpleCap[0].matches}m)
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-[#6A6E75]">Play a match to track wickets.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Playoff Bracket when unlocked */}
          {season.phase !== 'LEAGUE' && (
            <PlayoffBracketGrid
              season={season}
              playoffList={playoffList}
              onQuickSimPlayoff={onQuickSimPlayoff}
              onPlayPlayoff={onPlayPlayoff}
            />
          )}
        </div>
      )}

      {/* TAB 2: FIXTURES */}
      {subTab === 'FIXTURES' && (
        <div className="mt-4 space-y-4">
          {season.phase !== 'LEAGUE' && (
            <PlayoffBracketGrid
              season={season}
              playoffList={playoffList}
              onQuickSimPlayoff={onQuickSimPlayoff}
              onPlayPlayoff={onPlayPlayoff}
            />
          )}

          <div className="space-y-2.5" data-testid="fixtures-list">
            {userFixtures.map((fix: SeasonFixture) => {
              const isHome = fix.homeTeamId === 'YOU';
              const opponentId = isHome ? fix.awayTeamId : fix.homeTeamId;
              const opponent = season.teams[opponentId];
              const isNext = nextFixture?.id === fix.id;
              const isCompleted = fix.status === 'COMPLETED' && fix.result !== null;
              const outcome = isCompleted && fix.result ? formatUserOutcomeText(fix.result) : null;

              return (
                <article
                  key={fix.id}
                  data-testid={`fixture-match-${fix.userMatchNumber}`}
                  className={`border-2 p-3.5 transition-colors ${
                    isNext
                      ? 'border-[#D94E28] bg-[#FAF8F3] shadow-[3px_3px_0px_#141619]'
                      : isCompleted
                        ? 'border-[#141619] bg-[#FAF8F3]'
                        : 'border-[#141619]/40 bg-[#FAF8F3]/80'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-extrabold text-[#D94E28] tabular-nums">
                          Match {fix.userMatchNumber}/20
                        </span>
                        <span className="text-[#8A8F98]" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            isHome
                              ? 'bg-[#DCFCE7] text-[#157F3D]'
                              : 'bg-[#FEF3C7] text-[#B45309]'
                          }`}
                        >
                          <Home className="h-2.5 w-2.5" aria-hidden="true" />
                          <span>{isHome ? 'HOME' : 'AWAY'}</span>
                        </span>
                        {isNext && (
                          <span className="rounded-[2px] bg-[#D94E28] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white">
                            NEXT MATCH
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: opponent.primaryColor }}
                          aria-hidden="true"
                        />
                        <h3 className="truncate font-display text-xl font-extrabold text-[#141619] uppercase">
                          vs {opponent.name} ({opponent.code})
                        </h3>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1 text-xs text-[#4A4E54]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{fix.venue}</span>
                      </div>
                    </div>

                    {isCompleted && outcome ? (
                      <div className="shrink-0 sm:text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 font-mono text-xs font-extrabold ${
                            outcome.isWin
                              ? 'border-[#157F3D] bg-[#DCFCE7] text-[#157F3D]'
                              : 'border-[#D94E28] bg-[#FFF1EE] text-[#B83C1B]'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{outcome.text}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!isNext}
                          onClick={() => onPlayFixture(fix.id)}
                          className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[3px] px-4 py-1.5 font-display text-base font-extrabold tracking-wider uppercase whitespace-nowrap ${
                            isNext
                              ? 'border-2 border-[#141619] bg-[#D94E28] text-white hover:bg-[#B83C1B]'
                              : 'cursor-not-allowed border border-[#141619]/20 bg-[#EAE3D5] text-[#6A6E75]'
                          }`}
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>PLAY MATCH</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isNext}
                          onClick={() => onQuickSimFixture(fix.id)}
                          className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[3px] px-3.5 py-1.5 font-mono text-xs font-bold tracking-wider uppercase whitespace-nowrap ${
                            isNext
                              ? 'border border-[#141619] bg-[#0D1B2A] text-white hover:bg-[#162B42]'
                              : 'cursor-not-allowed border border-[#141619]/20 bg-[#EAE3D5] text-[#6A6E75]'
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                          <span>QUICK SIM</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isCompleted && fix.result && (
                    <ScoreboardPair
                      season={season}
                      homeTeamId={fix.homeTeamId}
                      awayTeamId={fix.awayTeamId}
                      result={fix.result}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: STANDINGS (11 TEAMS: POS | TEAM | P | W | L | NRR | PTS) */}
      {subTab === 'STANDINGS' && (
        <div
          data-testid="points-table"
          className="mt-4 overflow-hidden border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11px] sm:text-sm">
              <thead>
                <tr className="border-b-2 border-[#141619] bg-[#0D1B2A] font-mono text-[10px] font-bold tracking-wider text-white uppercase sm:text-[11px]">
                  <th className="px-2 py-2 sm:px-4 sm:py-2.5">POS</th>
                  <th className="px-1.5 py-2 sm:px-4 sm:py-2.5">TEAM</th>
                  <th className="px-1.5 py-2 text-center sm:px-2.5 sm:py-2.5">P</th>
                  <th className="px-1.5 py-2 text-center sm:px-2.5 sm:py-2.5">W</th>
                  <th className="px-1.5 py-2 text-center sm:px-2.5 sm:py-2.5">L</th>
                  <th className="px-1.5 py-2 text-right sm:px-3 sm:py-2.5">NRR</th>
                  <th className="px-2 py-2 text-right sm:px-4 sm:py-2.5">PTS</th>
                </tr>
              </thead>
              <tbody>
                {season.pointsTable.map((row, idx) => {
                  const pos = idx + 1;
                  const team = season.teams[row.teamId];
                  const isPlayoffZone = pos <= 4;
                  const isCutoffRow = pos === 4;

                  return (
                    <tr
                      key={row.teamId}
                      data-testid={`points-row-${row.teamId}`}
                      className={`border-b transition-colors last:border-b-0 ${
                        isCutoffRow ? 'border-b-2 border-[#157F3D]' : 'border-[#141619]/15'
                      } ${team.isUser ? 'bg-[#FFF3EE]' : 'bg-white hover:bg-[#FAF8F3]'}`}
                    >
                      <td className="px-2 py-2 font-mono font-extrabold tabular-nums sm:px-4 sm:py-2.5">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-[2px] text-[11px] sm:h-6 sm:w-6 sm:text-xs ${
                            isPlayoffZone
                              ? 'bg-[#DCFCE7] text-[#157F3D]'
                              : 'text-[#4A4E54]'
                          }`}
                        >
                          {pos}
                        </span>
                      </td>

                      <td className="px-1.5 py-2 sm:px-4 sm:py-2.5">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-[2px] border sm:h-3.5 sm:w-3.5"
                            style={{
                              backgroundColor: team.primaryColor,
                              borderColor: team.secondaryColor ?? '#141619',
                            }}
                            aria-hidden="true"
                          />
                          <span className="font-bold whitespace-nowrap text-[#141619]">
                            <span className="sm:hidden">{team.code}</span>
                            <span className="hidden sm:inline">{team.name}</span>
                          </span>
                          {team.isUser && (
                            <span
                              className="hidden rounded-[2px] px-1.5 py-0.2 font-mono text-[9px] font-extrabold text-white sm:inline-block"
                              style={{ backgroundColor: team.primaryColor }}
                            >
                              {team.code}
                            </span>
                          )}
                          {isPlayoffZone && (
                            <span className="rounded-[2px] bg-[#DCFCE7] px-1 py-0.2 font-mono text-[9px] font-extrabold text-[#157F3D] sm:text-[9.5px]">
                              Q
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-1.5 py-2 text-center font-mono text-[#141619] tabular-nums sm:px-2.5 sm:py-2.5">
                        {row.played}
                      </td>
                      <td className="px-1.5 py-2 text-center font-mono font-bold text-[#157F3D] tabular-nums sm:px-2.5 sm:py-2.5">
                        {row.won}
                      </td>
                      <td className="px-1.5 py-2 text-center font-mono text-[#D94E28] tabular-nums sm:px-2.5 sm:py-2.5">
                        {row.lost}
                      </td>
                      <td
                        className={`px-1.5 py-2 text-right font-mono font-bold tabular-nums sm:px-3 sm:py-2.5 ${
                          row.nrr >= 0 ? 'text-[#157F3D]' : 'text-[#D94E28]'
                        }`}
                      >
                        {formatNrr(row.nrr)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-extrabold text-[#141619] tabular-nums sm:px-4 sm:py-2.5 sm:text-sm">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#141619] bg-[#EFE9DC] px-4 py-2 font-mono text-[11px] font-bold text-[#157F3D] uppercase">
            11 Teams · Top 4 Qualify for Playoffs · 20 League Matches (10H / 10A) · Sorted by Points, then NRR
          </div>
        </div>
      )}

      {/* TAB 4: MY SQUAD */}
      {subTab === 'MY_SQUAD' && (
        <div className="mt-4 space-y-4">
          <div className="overflow-hidden border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="border-b-2 border-[#141619] bg-[#0D1B2A] px-4 py-2.5 text-white">
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase">
                Active Playing XI · Season Stats &amp; Form
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141619]/20 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                    <th className="px-3 py-2">ROLE</th>
                    <th className="px-2 py-2">PLAYER</th>
                    <th className="px-2 py-2">FORM</th>
                    <th className="px-2 py-2 text-center">M</th>
                    <th className="px-2 py-2 text-right">RUNS</th>
                    <th className="hidden px-2 py-2 text-right sm:table-cell">SR</th>
                    <th className="px-2 py-2 text-right">WKTS</th>
                    <th className="hidden px-2 py-2 text-right sm:table-cell">ECON</th>
                    <th className="px-3 py-2 text-right">IMP PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141619]/10 bg-white">
                  {season.teams.YOU.players.map((p) => {
                    const st = season.stats.playerStats?.[p.playerId];
                    const liveForm = season.playerForms?.[p.playerId] ?? p.form ?? 'NORMAL';
                    const formMeta = getPlayerFormMeta(liveForm);
                    const sr = st && st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(1) : '—';
                    const econ =
                      st && st.oversBowled > 0
                        ? (st.runsConceded / st.oversBowled).toFixed(2)
                        : '—';

                    return (
                      <tr key={p.playerId} className="hover:bg-[#FAF8F3]">
                        <td className="px-3 py-2">
                          <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => onInspectPlayer?.(p)}
                            className="text-left font-bold text-[#141619] hover:text-[#D94E28] hover:underline"
                          >
                            {p.playerName}
                          </button>
                          <div className="font-mono text-[10px] text-[#4A4E54]">
                            {p.franchise} {p.season} · OVR {p.overallRating}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-bold ${formMeta.badgeClass}`}
                          >
                            <span>{formMeta.icon}</span>
                            <span className="hidden sm:inline">{formMeta.label}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-mono tabular-nums">
                          {st?.matches ?? 0}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-[#141619] tabular-nums">
                          {st?.runs ?? 0}
                        </td>
                        <td className="hidden px-2 py-2 text-right font-mono text-[#4A4E54] tabular-nums sm:table-cell">
                          {sr}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-[#6D28D9] tabular-nums">
                          {st?.wickets ?? 0}
                        </td>
                        <td className="hidden px-2 py-2 text-right font-mono text-[#4A4E54] tabular-nums sm:table-cell">
                          {econ}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-extrabold text-[#D94E28] tabular-nums">
                          {st ? st.impactPoints.toFixed(0) : 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CAP RACE */}
      {subTab === 'CAP_RACE' && (
        <div data-testid="cap-race-panel" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Orange Cap */}
          <div className="border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="flex items-center gap-2 border-b-2 border-[#141619] bg-[#C2410C] px-3.5 py-2.5 text-white">
              <Crown className="h-4 w-4" aria-hidden="true" />
              <h2 className="font-display text-lg font-extrabold tracking-wide uppercase">
                ORANGE CAP · RUNS
              </h2>
            </div>
            {leaderboards.orangeCap.length === 0 ? (
              <p className="p-4 text-xs text-[#4A4E54]">Simulate or play matches to populate runs.</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141619]/15 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54]">
                    <th className="px-2.5 py-1.5">#</th>
                    <th className="px-2 py-1.5">PLAYER</th>
                    <th className="px-2 py-1.5 text-right">R</th>
                    <th className="px-2.5 py-1.5 text-right">HS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141619]/10 bg-white">
                  {leaderboards.orangeCap.map((p, idx) => (
                    <tr key={p.playerId} className={p.teamId === 'YOU' ? 'bg-[#FFF3EE]' : ''}>
                      <td className="px-2.5 py-1.5 font-mono font-bold text-[#4A4E54]">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="truncate font-bold text-[#141619]">{p.playerName}</div>
                        <div className="font-mono text-[10px] text-[#4A4E54]">
                          {season.teams[p.teamId]?.code ?? p.teamId} · {p.matches}M
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-extrabold text-[#C2410C] tabular-nums">
                        {p.runs}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                        {p.highestScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Purple Cap */}
          <div className="border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="flex items-center gap-2 border-b-2 border-[#141619] bg-[#6D28D9] px-3.5 py-2.5 text-white">
              <Crown className="h-4 w-4" aria-hidden="true" />
              <h2 className="font-display text-lg font-extrabold tracking-wide uppercase">
                PURPLE CAP · WICKETS
              </h2>
            </div>
            {leaderboards.purpleCap.length === 0 ? (
              <p className="p-4 text-xs text-[#4A4E54]">Simulate or play matches to populate wickets.</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141619]/15 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54]">
                    <th className="px-2.5 py-1.5">#</th>
                    <th className="px-2 py-1.5">PLAYER</th>
                    <th className="px-2 py-1.5 text-right">W</th>
                    <th className="px-2.5 py-1.5 text-right">ECON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141619]/10 bg-white">
                  {leaderboards.purpleCap.map((p, idx) => {
                    const econ =
                      p.oversBowled > 0 ? (p.runsConceded / p.oversBowled).toFixed(2) : '—';
                    return (
                      <tr key={p.playerId} className={p.teamId === 'YOU' ? 'bg-[#FFF3EE]' : ''}>
                        <td className="px-2.5 py-1.5 font-mono font-bold text-[#4A4E54]">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <div className="truncate font-bold text-[#141619]">{p.playerName}</div>
                          <div className="font-mono text-[10px] text-[#4A4E54]">
                            {season.teams[p.teamId]?.code ?? p.teamId} · {p.matches}M
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-extrabold text-[#6D28D9] tabular-nums">
                          {p.wickets}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                          {econ}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Impact Leaderboard */}
          <div className="border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="flex items-center gap-2 border-b-2 border-[#141619] bg-[#0D1B2A] px-3.5 py-2.5 text-white">
              <Award className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />
              <h2 className="font-display text-lg font-extrabold tracking-wide uppercase">
                IMPACT LEADERBOARD
              </h2>
            </div>
            {leaderboards.impactLeaders.length === 0 ? (
              <p className="p-4 text-xs text-[#4A4E54]">
                Simulate or play matches to track Impact Points.
              </p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141619]/15 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54]">
                    <th className="px-2.5 py-1.5">#</th>
                    <th className="px-2 py-1.5">PLAYER</th>
                    <th className="px-2 py-1.5 text-right">POTM</th>
                    <th className="px-2.5 py-1.5 text-right">IMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141619]/10 bg-white">
                  {leaderboards.impactLeaders.map((p, idx) => (
                    <tr key={p.playerId} className={p.teamId === 'YOU' ? 'bg-[#FFF3EE]' : ''}>
                      <td className="px-2.5 py-1.5 font-mono font-bold text-[#4A4E54]">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="truncate font-bold text-[#141619]">{p.playerName}</div>
                        <div className="font-mono text-[10px] text-[#4A4E54]">
                          {season.teams[p.teamId]?.code ?? p.teamId} · {p.matches}M
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[#B45309] tabular-nums">
                        {p.potmCount}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono font-extrabold text-[#D94E28] tabular-nums">
                        {p.impactPoints.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: IMPACT BENCH & LOG */}
      {subTab === 'IMPACT' && (
        <div data-testid="season-impact-panel" className="mt-4 space-y-4">
          <div className="border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#141619] bg-[#0D1B2A] px-4 py-2.5 text-white">
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase">
                Impact Bench ({activeBench.length} Players)
              </h2>
              <span className="font-mono text-[10.5px] font-bold text-[#F59E0B] uppercase">
                Available during PLAY MATCH Impact Moment
              </span>
            </div>

            <div className="border-b border-[#141619]/15 bg-[#EFE9DC] px-4 py-2 text-xs text-[#2D3138]">
              <strong>5th Overseas Impact Rule:</strong> Even with 4 overseas starters in your Playing XI, you may activate 1 overseas Impact Player mid-match by clicking <strong>PLAY MATCH</strong>.
            </div>

            {activeBench.length === 0 ? (
              <p className="p-4 text-xs text-[#4A4E54]">No bench players recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#141619]/20 bg-[#FAF8F3] font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                      <th className="px-3 py-2">ROLE</th>
                      <th className="px-2 py-2">PLAYER</th>
                      <th className="px-2 py-2">TYPE</th>
                      <th className="px-2 py-2 text-right">BAT</th>
                      <th className="px-2 py-2 text-right">BWL</th>
                      <th className="px-2 py-2 text-right">IMP</th>
                      <th className="px-3 py-2 text-right">OVR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141619]/10 bg-white">
                    {activeBench.map((p) => (
                      <tr key={p.playerId} className="hover:bg-[#FAF8F3]">
                        <td className="px-3 py-2">
                          <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        </td>
                        <td className="px-2 py-2 font-bold text-[#141619]">
                          <button
                            type="button"
                            onClick={() => onInspectPlayer?.(p)}
                            className="text-left hover:text-[#D94E28] hover:underline"
                          >
                            {p.playerName}
                          </button>
                        </td>
                        <td className="px-2 py-2 font-mono text-[10.5px]">
                          {p.isOverseas ? (
                            <span className="rounded-[2px] bg-[#FEF3C7] px-1.5 py-0.5 font-bold text-[#B45309]">
                              OS
                            </span>
                          ) : (
                            <span className="rounded-[2px] bg-[#DCFCE7] px-1.5 py-0.5 font-bold text-[#157F3D]">
                              IND
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {p.battingRating}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {p.bowlingRating}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-[#6D28D9] tabular-nums">
                          {p.impactRating}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-extrabold text-[#141619] tabular-nums">
                          {p.overallRating}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-2 border-[#141619] bg-[#FAF8F3]">
            <div className="border-b border-[#141619] bg-[#EFE9DC] px-4 py-2 font-display text-lg font-extrabold text-[#141619] uppercase">
              Impact Substitutions Log
            </div>
            {(season.impactHistory?.length ?? 0) === 0 ? (
              <p className="bg-white p-4 text-xs text-[#4A4E54]">
                No Impact Player substitutions activated yet this season. Launch any fixture via PLAY MATCH to use an Impact sub.
              </p>
            ) : (
              <ul className="divide-y divide-[#141619]/10 bg-white">
                {season.impactHistory?.map((item) => (
                  <li
                    key={`${item.matchId}-${item.inPlayerId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                  >
                    <div>
                      <span className="rounded-[2px] bg-[#6D28D9] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white uppercase">
                        {item.matchLabel}
                      </span>{' '}
                      <strong className="text-[#141619]">{item.inPlayerName}</strong> replaced{' '}
                      <span className="text-[#4A4E54]">{item.outPlayerName}</span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-[#4A4E54]">
                      Over {item.overLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(season.transferImpactNotices?.length ?? 0) > 0 && (
            <div data-testid="transfer-impact-panel" className="border-2 border-[#141619] bg-[#FAF8F3]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#141619] bg-[#EFE9DC] px-4 py-2">
                <span className="font-display text-lg font-extrabold text-[#141619] uppercase">
                  Transfer Impact Notices
                </span>
                <span className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                  11-Team Unique Ownership Verified
                </span>
              </div>
              <ul className="divide-y divide-[#141619]/10 bg-white">
                {season.transferImpactNotices?.map((notice) => (
                  <li
                    key={notice.playerCanonicalId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs"
                  >
                    <div>
                      <span className="rounded-[2px] bg-[#141619] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white uppercase">
                        {notice.originalFranchise}
                      </span>{' '}
                      <strong className="text-[#141619]">{notice.playerName}</strong>{' '}
                      <span className="text-[#4A4E54]">
                        drafted by {notice.draftedByName}; {notice.originalFranchise} signed a replacement for its 15-man squad.
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
