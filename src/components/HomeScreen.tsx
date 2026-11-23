import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Disc3,
  Lock,
  MapPin,
  Play,
  RotateCcw,
  Shield,
  Trophy,
} from 'lucide-react';
import { formatCr, getOverseasCount } from '../game/draftEngine';
import { PITCH_CONDITIONS, getPitchConditionForVenue } from '../game/matchEngine';
import { formatNrr, getUserStandingsInfo } from '../game/seasonEngine';
import type {
  CareerStats,
  CustomFranchise,
  DraftSettings,
  DraftState,
  PlayoffRoundId,
  SeasonState,
} from '../types/game';
import { GameButton, GamePanel, GamePanelHeader, StatusBadge, TeamLogo } from './ui';

interface HomeScreenProps {
  settings: DraftSettings;
  draftState: DraftState;
  seasonState: SeasonState | null;
  customFranchise?: CustomFranchise | null;
  career: CareerStats;
  hasActiveDraft: boolean;
  hasActiveSeason: boolean;
  draftedCount: number;
  onStartNewDraft: () => void;
  onResumeDraft: () => void;
  onPrepareTeam: () => void;
  onPlayFixture: (fixtureId: string) => void;
  onPlayPlayoff: (playoffId: PlayoffRoundId) => void;
  onOpenFixtures: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  settings,
  draftState,
  seasonState,
  customFranchise,
  career,
  hasActiveDraft,
  hasActiveSeason,
  draftedCount,
  onStartNewDraft,
  onResumeDraft,
  onPrepareTeam,
  onPlayFixture,
  onPlayPlayoff,
  onOpenFixtures,
}: HomeScreenProps) {
  const [openSection, setOpenSection] = useState<'RULES' | 'HOW_TO_PLAY' | 'ACHIEVEMENTS' | null>(
    null
  );

  const unlockedCount = career.achievements.filter((a) => a.unlocked).length;
  const activeFranchiseName =
    customFranchise?.name || settings.franchiseName || 'Mumbai Warriors';
  const activeFranchiseCode = customFranchise?.code || 'NEW';
  const primaryColor = customFranchise?.primaryColor || '#22D36B';
  const secondaryColor = customFranchise?.secondaryColor || '#F5B942';
  const homeGround = customFranchise?.homeGround || 'Wankhede Stadium, Mumbai';

  const overseasCount = getOverseasCount(draftState.squad);
  const retentionCount = draftState.retention.locked
    ? draftState.squad.filter((p) => p.isRetained).length
    : draftState.retention.slots.filter((s) => s.player !== null).length;

  const standings = seasonState ? getUserStandingsInfo(seasonState) : null;
  const nextFixture = standings?.nextFixture ?? null;

  const readyPlayoff = seasonState
    ? [
        seasonState.playoffs.Q1,
        seasonState.playoffs.ELIM,
        seasonState.playoffs.Q2,
        seasonState.playoffs.FINAL,
      ].find(
        (p) => p.status === 'READY' && (p.homeTeamId === 'YOU' || p.awayTeamId === 'YOU')
      ) ?? null
    : null;

  const impactAwardsCount = seasonState
    ? (seasonState.impactHistory?.length ?? 0) +
      Object.values(seasonState.stats.playerStats)
        .filter((ps) => ps.teamId === 'YOU')
        .reduce((sum, ps) => sum + (ps.potmCount ?? 0), 0)
    : 0;

  const squadComplete = draftState.squad.length >= draftState.settings.squadSize;

  // Resolve Hero Next Match Details
  let heroEyebrow = 'NEXT MATCH';
  let opponentName = '10 IPL FRANCHISES';
  let opponentCode = 'IPL';
  let opponentColor = '#111820';
  let heroVenue = homeGround;
  let heroMatchLabel = hasActiveSeason ? 'SEASON COMPLETE' : 'PRE-SEASON';
  let heroLeaguePos = standings ? `#${standings.position}` : '—';
  let heroHomeAway: string | null = null;

  if (seasonState && nextFixture) {
    const isHome = nextFixture.homeTeamId === 'YOU';
    const opp = seasonState.teams[isHome ? nextFixture.awayTeamId : nextFixture.homeTeamId];
    heroEyebrow = 'NEXT MATCH';
    opponentName = opp.name;
    opponentCode = opp.code;
    opponentColor = opp.primaryColor;
    heroVenue = nextFixture.venue;
    heroMatchLabel = `MATCH ${nextFixture.userMatchNumber}/20`;
    heroHomeAway = isHome ? 'HOME' : 'AWAY';
  } else if (seasonState && readyPlayoff) {
    const isHome = readyPlayoff.homeTeamId === 'YOU';
    const oppId = isHome ? readyPlayoff.awayTeamId : readyPlayoff.homeTeamId;
    const opp = oppId ? seasonState.teams[oppId] : null;
    heroEyebrow = `NEXT MATCH · ${readyPlayoff.label.toUpperCase()}`;
    opponentName = opp?.name ?? 'PLAYOFF OPPONENT';
    opponentCode = opp?.code ?? 'PO';
    opponentColor = opp?.primaryColor ?? '#F5B942';
    heroVenue = readyPlayoff.venue;
    heroMatchLabel = readyPlayoff.label.toUpperCase();
    heroHomeAway = 'PLAYOFF';
  } else if (seasonState && seasonState.phase === 'COMPLETED') {
    const champ = seasonState.championTeamId
      ? seasonState.teams[seasonState.championTeamId]
      : null;
    heroEyebrow = `SEASON ${seasonState.seasonNumber} FINAL RESULT`;
    opponentName = champ ? `${champ.name} CHAMPIONS` : 'SEASON FINISHED';
    opponentCode = champ?.code ?? 'END';
    opponentColor = champ?.primaryColor ?? '#22D36B';
    heroVenue = homeGround;
    heroMatchLabel = '20/20 PLAYED';
  }

  const pitchMeta = PITCH_CONDITIONS[getPitchConditionForVenue(heroVenue)];

  return (
    <section
      data-testid="owner-dashboard"
      className="mx-auto w-full max-w-6xl px-3 py-5 pb-20 sm:px-4 md:py-6 md:pb-10"
    >
      {/* HERO FRANCHISE PANEL — Matches Dark Login Aesthetic with Green Primary CTA */}
      <GamePanel className="overflow-hidden">
        <div
          className="h-1 w-full"
          style={{ backgroundColor: primaryColor }}
          aria-hidden="true"
        />

        <div className="p-4 sm:p-6">
          {/* Top metadata row */}
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold tracking-[0.18em] text-[#22D36B] uppercase">
                {heroEyebrow}
              </span>
              {heroHomeAway && (
                <StatusBadge tone={heroHomeAway === 'PLAYOFF' ? 'orange' : 'green'}>
                  {heroHomeAway}
                </StatusBadge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[#9DA8B3] tabular-nums">
              <span className="font-bold text-[#F5F2EA]">{heroMatchLabel}</span>
              <span className="text-[#263039]">·</span>
              <span>POS {heroLeaguePos}</span>
            </div>
          </div>

          {/* Matchup & Primary Green CTA */}
          <div className="mt-3.5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <TeamLogo
                  code={activeFranchiseCode}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  size="md"
                />
                <h1 className="font-display text-3xl font-extrabold tracking-wide text-[#F5F2EA] uppercase sm:text-4xl">
                  {activeFranchiseName}
                </h1>
                <span className="font-mono text-xs font-extrabold text-[#9DA8B3] lowercase">
                  vs
                </span>
                <span className="font-display text-3xl font-extrabold tracking-wide text-[#9DA8B3] uppercase sm:text-4xl">
                  {opponentName}
                </span>
                <TeamLogo
                  code={opponentCode}
                  primaryColor={opponentColor}
                  secondaryColor="#263039"
                  size="sm"
                  className="hidden sm:inline-flex"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[#9DA8B3]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#F5B942]" aria-hidden="true" />
                  <span>
                    VENUE: <strong className="text-[#F5F2EA]">{heroVenue}</strong>
                  </span>
                </span>
                <span className="text-[#263039]">·</span>
                <span>
                  PITCH: <strong className="text-[#F5F2EA]">{pitchMeta.shortLabel}</strong>
                </span>
                <span className="text-[#263039]">·</span>
                <span>
                  POSITION: <strong className="text-[#22D36B]">{heroLeaguePos}</strong>
                </span>
              </div>
            </div>

            {/* Action Buttons: Green Primary CTA */}
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {seasonState && nextFixture ? (
                <>
                  <GameButton
                    variant="primary"
                    size="lg"
                    data-testid="home-play-next-btn"
                    onClick={() => onPlayFixture(nextFixture.id)}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>PLAY NEXT MATCH</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    size="md"
                    data-testid="home-prepare-team-btn"
                    onClick={onPrepareTeam}
                  >
                    <Shield className="h-3.5 w-3.5 text-[#F5B942]" aria-hidden="true" />
                    <span>PREPARE XI</span>
                  </GameButton>
                </>
              ) : seasonState && readyPlayoff ? (
                <>
                  <GameButton
                    variant="primary"
                    size="lg"
                    data-testid="home-play-next-btn"
                    onClick={() => onPlayPlayoff(readyPlayoff.id)}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>PLAY NEXT MATCH</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    size="md"
                    data-testid="home-prepare-team-btn"
                    onClick={onPrepareTeam}
                  >
                    <Shield className="h-3.5 w-3.5 text-[#F5B942]" aria-hidden="true" />
                    <span>PREPARE XI</span>
                  </GameButton>
                </>
              ) : squadComplete ? (
                <>
                  <GameButton
                    variant="primary"
                    size="lg"
                    data-testid="home-prepare-team-btn"
                    onClick={onPrepareTeam}
                  >
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    <span>PREPARE XI</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </GameButton>
                  {hasActiveSeason && (
                    <GameButton variant="secondary" size="md" onClick={onOpenFixtures}>
                      <Trophy className="h-3.5 w-3.5 text-[#F5B942]" aria-hidden="true" />
                      <span>FIXTURES</span>
                    </GameButton>
                  )}
                </>
              ) : (
                <GameButton
                  variant="primary"
                  size="lg"
                  data-start="true"
                  data-testid="home-prepare-team-btn"
                  onClick={hasActiveDraft ? onResumeDraft : onStartNewDraft}
                >
                  <Disc3 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    DRAFT SQUAD ({draftedCount}/{settings.squadSize})
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </GameButton>
              )}
            </div>
          </div>
        </div>
      </GamePanel>

      {/* THREE COMPACT DARK FRANCHISE PANELS: FRONT OFFICE · SEASON · CAREER */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* FRONT OFFICE */}
        <GamePanel data-testid="dashboard-front-office">
          <GamePanelHeader
            title="FRONT OFFICE"
            action={
              <button
                type="button"
                onClick={onResumeDraft}
                className="font-mono text-[10px] font-bold text-[#22D36B] uppercase hover:underline"
              >
                Draft Room →
              </button>
            }
          />
          <dl className="grid grid-cols-2 divide-x divide-y divide-[#263039] bg-[#0E1318]">
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">PURSE</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#F5B942] tabular-nums">
                {formatCr(draftState.remainingPurseCr)}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">SQUAD</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#F5F2EA] tabular-nums">
                {draftState.squad.length}/{draftState.settings.squadSize}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">
                OVERSEAS
              </dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#22D36B] tabular-nums">
                {overseasCount}/{draftState.settings.overseasSquadLimit}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">
                RETENTIONS
              </dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#F5F2EA] tabular-nums">
                {retentionCount}/4
              </dd>
            </div>
          </dl>
        </GamePanel>

        {/* SEASON */}
        <GamePanel data-testid="dashboard-season">
          <GamePanelHeader
            title={`SEASON ${seasonState ? seasonState.seasonNumber : '—'}`}
            action={
              <button
                type="button"
                onClick={onOpenFixtures}
                className="font-mono text-[10px] font-bold text-[#22D36B] uppercase hover:underline"
              >
                Schedule →
              </button>
            }
          />
          <dl className="grid grid-cols-3 divide-x divide-y divide-[#263039] bg-[#0E1318]">
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">P</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#F5F2EA] tabular-nums">
                {standings ? standings.played : 0}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">W</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#22D36B] tabular-nums">
                {standings ? standings.won : 0}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">L</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#E44949] tabular-nums">
                {standings ? standings.lost : 0}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">PTS</dt>
              <dd className="mt-0.5 font-mono text-base font-extrabold text-[#F5B942] tabular-nums">
                {standings ? standings.points : 0}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">NRR</dt>
              <dd className="mt-0.5 font-mono text-sm font-extrabold text-[#F5F2EA] tabular-nums">
                {standings ? formatNrr(standings.nrr) : '+0.00'}
              </dd>
            </div>
            <div className="px-3 py-2.5 text-center">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">
                POSITION
              </dt>
              <dd
                className={`mt-0.5 font-mono text-base font-extrabold tabular-nums ${
                  standings && standings.position <= 4 ? 'text-[#22D36B]' : 'text-[#F5F2EA]'
                }`}
              >
                {standings ? `#${standings.position}` : '—'}
              </dd>
            </div>
          </dl>
        </GamePanel>

        {/* CAREER */}
        <GamePanel data-testid="dashboard-career">
          <GamePanelHeader
            title="CAREER"
            action={
              <button
                type="button"
                onClick={onStartNewDraft}
                className="font-mono text-[10px] font-bold text-[#9DA8B3] uppercase hover:text-[#F05A32]"
              >
                New Franchise
              </button>
            }
          />
          <dl className="grid grid-cols-2 divide-x divide-y divide-[#263039] bg-[#0E1318]">
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">SEASONS</dt>
              <dd
                data-testid="career-seasons-played"
                className="mt-0.5 font-mono text-base font-extrabold text-[#F5F2EA] tabular-nums"
              >
                {career.seasonsPlayed}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">TITLES</dt>
              <dd
                data-testid="career-titles-won"
                className="mt-0.5 font-mono text-base font-extrabold text-[#22D36B] tabular-nums"
              >
                {career.titlesWon}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">
                BEST FINISH
              </dt>
              <dd
                data-testid="career-best-finish"
                className="mt-0.5 truncate font-mono text-sm font-extrabold text-[#F5B942] tabular-nums"
              >
                {career.bestFinish}
              </dd>
            </div>
            <div className="px-3.5 py-2.5">
              <dt className="font-mono text-[9.5px] font-bold text-[#9DA8B3] uppercase">
                IMPACT AWARDS
              </dt>
              <dd
                data-testid="career-impact-awards"
                className="mt-0.5 font-mono text-base font-extrabold text-[#F05A32] tabular-nums"
              >
                {impactAwardsCount}
              </dd>
            </div>
          </dl>
        </GamePanel>
      </div>

      {/* Bottom Drawers: LEAGUE RULES · SEASON FLOW · ACHIEVEMENTS */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <GamePanel>
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'RULES' ? null : 'RULES'))}
            aria-expanded={openSection === 'RULES'}
            className="flex min-h-[42px] w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-[#111820]"
          >
            <span className="flex items-center gap-2 font-display text-base font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              <BookOpen className="h-4 w-4 text-[#22D36B]" aria-hidden="true" />
              <span>LEAGUE RULES</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#9DA8B3] transition-transform ${
                openSection === 'RULES' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'RULES' && (
            <ul className="space-y-1.5 border-t border-[#263039] bg-[#111820] px-3.5 py-3 text-xs leading-relaxed text-[#9DA8B3]">
              <li>
                <strong className="text-[#F5F2EA]">Purse &amp; Squad:</strong> ₹
                {settings.startingPurseCr} Cr purse for {settings.squadSize} players (max{' '}
                {settings.overseasSquadLimit} overseas).
              </li>
              <li>
                <strong className="text-[#F5F2EA]">Retentions:</strong> 0–4 retained stars (₹18 /
                ₹15 / ₹12 / ₹10 Cr slots).
              </li>
              <li>
                <strong className="text-[#F5F2EA]">Playing XI:</strong> 11 starters (max{' '}
                {settings.playingXIOverseasLimit} overseas, ≥1 WK, Captain) + 4-man Impact Bench.
              </li>
            </ul>
          )}
        </GamePanel>

        <GamePanel>
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'HOW_TO_PLAY' ? null : 'HOW_TO_PLAY'))}
            aria-expanded={openSection === 'HOW_TO_PLAY'}
            className="flex min-h-[42px] w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-[#111820]"
          >
            <span className="flex items-center gap-2 font-display text-base font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              <RotateCcw className="h-4 w-4 text-[#F5B942]" aria-hidden="true" />
              <span>SEASON FLOW</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#9DA8B3] transition-transform ${
                openSection === 'HOW_TO_PLAY' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'HOW_TO_PLAY' && (
            <ol className="list-decimal space-y-1.5 border-t border-[#263039] bg-[#111820] py-3 pl-7 pr-3.5 text-xs leading-relaxed text-[#9DA8B3]">
              <li>
                Retain 0–4 icons &amp; spin 2008–2026 IPL teams to complete your 15-man squad.
              </li>
              <li>Set your Playing XI on the pitch, batting order, Captain &amp; Keeper.</li>
              <li>
                Play or Quick Sim 20 league matches, deploy Impact Players, and win the Playoffs.
              </li>
            </ol>
          )}
        </GamePanel>

        <GamePanel>
          <button
            type="button"
            onClick={() => setOpenSection((s) => (s === 'ACHIEVEMENTS' ? null : 'ACHIEVEMENTS'))}
            aria-expanded={openSection === 'ACHIEVEMENTS'}
            className="flex min-h-[42px] w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-[#111820]"
          >
            <span className="flex items-center gap-2 font-display text-base font-extrabold tracking-wide text-[#F5F2EA] uppercase">
              <Award className="h-4 w-4 text-[#F05A32]" aria-hidden="true" />
              <span>
                ACHIEVEMENTS ({unlockedCount}/{career.achievements.length})
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#9DA8B3] transition-transform ${
                openSection === 'ACHIEVEMENTS' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
          {openSection === 'ACHIEVEMENTS' && (
            <ul className="divide-y divide-[#263039] border-t border-[#263039] bg-[#111820]">
              {career.achievements.map((ach) => (
                <li key={ach.id} className="flex items-start gap-2 px-3 py-2 text-xs">
                  {ach.unlocked ? (
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22D36B]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Lock
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#667380]"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-bold ${ach.unlocked ? 'text-[#F5F2EA]' : 'text-[#9DA8B3]'}`}
                    >
                      {ach.title}
                    </div>
                    <div className="text-[11px] text-[#9DA8B3]">{ach.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GamePanel>
      </div>
    </section>
  );
}
