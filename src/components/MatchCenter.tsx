import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  CheckCircle2,
  Coins,
  FastForward,
  FileText,
  Flame,
  MapPin,
  Play,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  SIMULATION_VERSION,
  stepInningsDelivery,
} from '../game/cricketMatchEngine';
import {
  type InteractiveInningsState,
  applyImpactPlayerToInnings,
  ballsToCricketOvers,
  createInitialInningsState,
  finalizeInningsOutput,
  getBowlerSelectionOptions,
  pickAutoBowler,
  simulateSingleOver,
} from '../game/inningsSim';
import {
  PITCH_CONDITIONS,
  applyUserTossDecision,
  assembleMatchResultFromInnings,
  checkImpactSubstitution,
  detectImpactSituation,
  getPitchConditionForVenue,
  recommendImpactPlayer,
  resolveToss,
} from '../game/matchEngine';
import { swapXIWithBench, validatePlayingXI } from '../game/playingXiEngine';
import { formatOversDisplay } from '../game/seasonEngine';
import { createSeededRng } from '../game/seededRng';
import {
  SIM_CONFIG,
  getDefaultPlanForPhase,
  getInningsPhaseForOver,
  getPlansForPhase,
} from '../game/simConfig';
import type {
  BattingAggressionMode,
  BowlingPlanId,
  CaptaincyDifficulty,
  ImpactSituationType,
  ImpactSubstitution,
  InningsScorecard,
  InningsSummary,
  MatchResult,
  MatchupRating,
  OverSummaryLine,
  PitchCondition,
  PlayoffFixture,
  PlayerSeasonRecord,
  PlayingXIState,
  SeasonFixture,
  SeasonState,
  SeasonTeam,
  SeasonTeamId,
  TossInfo,
} from '../types/game';
import { MatchFlowChart } from './MatchFlowChart';
import { RoleBadge } from './RoleBadge';

const ACTIVE_MATCH_STORAGE_KEY = 'impact_player_active_match_v1';

export type MatchContext =
  | { type: 'LEAGUE'; fixture: SeasonFixture }
  | { type: 'PLAYOFF'; playoff: PlayoffFixture };

type MatchStage = 'PRE_MATCH' | 'LIVE' | 'IMPACT_MOMENT' | 'POST_MATCH';
type BowlingMode = 'MANUAL' | 'AUTO';

interface SavedActiveMatchSnapshot {
  simulationVersion: string;
  matchSeed: string;
  rngState: number;
  matchId: string;
  stage: MatchStage;
  pitchCondition: PitchCondition;
  toss: TossInfo | null;
  bowlingMode: BowlingMode;
  battingAggression: BattingAggressionMode;
  inningsNumber: 1 | 2;
  inn1State: InteractiveInningsState | null;
  inn1Summary: InningsSummary | null;
  inn1Scorecard: InningsScorecard | null;
  inn2State: InteractiveInningsState | null;
  matchResult: MatchResult | null;
  impactSub: ImpactSubstitution | null;
  impactInPlayer: PlayerSeasonRecord | null;
  impactPromptShown: boolean;
  lastOverSummary: OverSummaryLine | null;
}

interface MatchCenterProps {
  season: SeasonState;
  matchContext: MatchContext;
  squad?: PlayerSeasonRecord[];
  playingXiState?: PlayingXIState;
  benchPlayers: PlayerSeasonRecord[];
  maxStandardOverseas?: number;
  simSpeed?: 'Normal' | 'Fast';
  difficulty?: CaptaincyDifficulty;
  onAdjustPreMatchXI?: (nextXiState: PlayingXIState) => void;
  onCompleteMatch: (result: MatchResult) => void;
  onCancel: () => void;
  onInspectPlayer?: (player: PlayerSeasonRecord) => void;
}

function getTeamScorecard(
  result: MatchResult,
  innings: 1 | 2
): InningsScorecard | undefined {
  return innings === 1 ? result.firstScorecard : result.secondScorecard;
}

function applyImpactToTeamRoster<T extends { id: SeasonTeamId; players: PlayerSeasonRecord[] }>(
  team: T,
  impactSub: ImpactSubstitution | null,
  inPlayer: PlayerSeasonRecord | null
): T {
  if (!impactSub || !inPlayer || impactSub.teamId !== team.id) return team;
  const outIdx = team.players.findIndex((p) => p.playerId === impactSub.outPlayerId);
  const filtered = team.players.filter((p) => p.playerId !== impactSub.outPlayerId);
  if (filtered.some((p) => p.playerId === inPlayer.playerId)) {
    return { ...team, players: filtered };
  }
  const isBatSub =
    inPlayer.role === 'BAT' ||
    inPlayer.role === 'WK' ||
    (inPlayer.role === 'AR' && inPlayer.battingRating >= inPlayer.bowlingRating);
  const insertIdx = isBatSub
    ? Math.min(outIdx >= 0 ? outIdx : 4, Math.min(4, filtered.length))
    : outIdx >= 0
      ? Math.min(outIdx, filtered.length)
      : filtered.length;
  return {
    ...team,
    players: [
      ...filtered.slice(0, insertIdx),
      inPlayer,
      ...filtered.slice(insertIdx),
    ],
  };
}

function MatchupBadge({ matchup }: { matchup: MatchupRating }) {
  if (matchup === 'STRONG_MATCHUP') {
    return (
      <span className="rounded-[2px] bg-[#DCFCE7] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[#157F3D] uppercase">
        STRONG MATCHUP
      </span>
    );
  }
  if (matchup === 'RISKY_MATCHUP') {
    return (
      <span className="rounded-[2px] bg-[#FEE2E2] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[#B91C1C] uppercase">
        RISKY MATCHUP
      </span>
    );
  }
  return (
    <span className="rounded-[2px] bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#4A4E54] uppercase">
      EVEN MATCHUP
    </span>
  );
}

function ScorecardPanel({
  season,
  card,
  inningsLabel,
  targetRuns,
}: {
  season: SeasonState;
  card: InningsScorecard;
  inningsLabel: string;
  targetRuns?: number;
}) {
  const team = season.teams[card.teamId];
  return (
    <div className="border-2 border-[#141619] bg-[#FAF8F3]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#141619] bg-[#0D1B2A] px-3.5 py-2 text-white">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-[2px]"
            style={{ backgroundColor: team.primaryColor }}
            aria-hidden="true"
          />
          <span className="font-display text-base font-extrabold tracking-wide uppercase">
            {inningsLabel}: {team.name}
          </span>
          {targetRuns && (
            <span className="font-mono text-[10px] text-slate-300">
              (Target {targetRuns})
            </span>
          )}
        </div>
        <div className="font-mono text-sm font-extrabold tabular-nums">
          {card.runs}/{card.wickets} ({formatOversDisplay(card.overs)} ov · RR {card.runRate})
        </div>
      </div>

      {/* Phase Breakdown Strip (Powerplay / Middle / Death) */}
      {card.phaseSplits && card.phaseSplits.length > 0 && (
        <div
          data-testid="scorecard-phase-splits"
          className="grid grid-cols-3 divide-x divide-[#141619]/15 border-b border-[#141619]/20 bg-[#F4EFE4] font-mono text-[10.5px]"
        >
          {card.phaseSplits.map((ph) => (
            <div key={ph.phase} className="px-2.5 py-1.5">
              <div className="font-bold text-[#4A4E54] uppercase">{ph.label}</div>
              <div className="mt-0.5 font-extrabold text-[#141619] tabular-nums">
                {ph.runs}/{ph.wickets}{' '}
                <span className="font-normal text-[#4A4E54]">
                  (RR {ph.runRate.toFixed(1)})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batting Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#141619]/20 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
              <th className="px-3 py-1.5">Batter</th>
              <th className="px-2 py-1.5">Dismissal</th>
              <th className="px-2 py-1.5 text-right">R</th>
              <th className="px-2 py-1.5 text-right">B</th>
              <th className="hidden px-2 py-1.5 text-right sm:table-cell">4s</th>
              <th className="hidden px-2 py-1.5 text-right sm:table-cell">6s</th>
              <th className="px-3 py-1.5 text-right">SR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141619]/10 bg-white">
            {card.batting.map((b) => (
              <tr key={b.playerId}>
                <td className="px-3 py-1.5 font-bold text-[#141619]">
                  <span className="inline-flex items-center gap-1.5">
                    <span>{b.playerName}</span>
                    {b.isImpactIn && (
                      <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                        IMP
                      </span>
                    )}
                    {b.isSubbedOut && (
                      <span className="rounded-[2px] bg-[#4A4E54] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                        SUB
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-[#4A4E54]">
                  {b.out ? b.dismissalText : <span className="font-semibold text-[#157F3D]">not out</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono font-extrabold text-[#141619] tabular-nums">
                  {b.runs}
                  {!b.out ? '*' : ''}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {b.balls}
                </td>
                <td className="hidden px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums sm:table-cell">
                  {b.fours}
                </td>
                <td className="hidden px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums sm:table-cell">
                  {b.sixes}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {b.strikeRate.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Extras & Fall of Wickets */}
      <div className="border-t border-[#141619]/15 bg-[#FAF8F3] px-3 py-1.5 font-mono text-[10.5px] text-[#4A4E54]">
        <div>
          Extras: {card.extras}
          {card.extrasBreakdown
            ? ` (Wd ${card.extrasBreakdown.wides}, NB ${card.extrasBreakdown.noBalls}, B ${card.extrasBreakdown.byes}, LB ${card.extrasBreakdown.legByes})`
            : ''}{' '}
          · Total: {card.runs}/{card.wickets} ({formatOversDisplay(card.overs)} ov)
        </div>
        {card.fallOfWickets && card.fallOfWickets.length > 0 && (
          <div className="mt-0.5 text-[10px] leading-snug text-[#4A4E54]">
            <span className="font-bold text-[#141619]">FoW:</span>{' '}
            {card.fallOfWickets
              .map((f) => `${f.wicketNumber}-${f.runs} (${f.batterName.split(' ').slice(-1)[0]}, ${f.overLabel})`)
              .join(' · ')}
          </div>
        )}
      </div>

      {/* Bowling Table (BOWLER | O | M | R | W | ECON + Dots/Extras detail) */}
      <div className="overflow-x-auto border-t border-[#141619]/25">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#141619]/20 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
              <th className="px-3 py-1.5">Bowler</th>
              <th className="px-2 py-1.5 text-right">O</th>
              <th className="px-2 py-1.5 text-right">M</th>
              <th className="px-2 py-1.5 text-right">R</th>
              <th className="px-2 py-1.5 text-right">W</th>
              <th className="px-3 py-1.5 text-right">ECON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141619]/10 bg-white">
            {card.bowling.map((bw) => (
              <tr key={bw.playerId}>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#141619]">
                    <span>{bw.playerName}</span>
                    {bw.isImpactIn && (
                      <span className="rounded-[2px] bg-[#6D28D9] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                        IMP
                      </span>
                    )}
                    {bw.isSubbedOut && (
                      <span className="rounded-[2px] bg-[#4A4E54] px-1 py-0.2 font-mono text-[8.5px] font-extrabold text-white">
                        SUB
                      </span>
                    )}
                  </div>
                  {(bw.dots !== undefined || bw.wides !== undefined) && (
                    <div className="font-mono text-[9.5px] text-[#4A4E54]">
                      Dots {bw.dots ?? 0} · 4s {bw.foursConceded ?? 0} · 6s {bw.sixesConceded ?? 0} · Wd {bw.wides ?? 0} · NB {bw.noBalls ?? 0}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {formatOversDisplay(bw.overs)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {bw.maidens ?? 0}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {bw.runsConceded}
                </td>
                <td className="px-2 py-1.5 text-right font-mono font-extrabold text-[#141619] tabular-nums">
                  {bw.wickets}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[#4A4E54] tabular-nums">
                  {bw.economy.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MatchCenter({
  season,
  matchContext,
  squad,
  playingXiState,
  benchPlayers,
  maxStandardOverseas = 4,
  simSpeed = 'Normal',
  difficulty = 'STANDARD',
  onAdjustPreMatchXI,
  onCompleteMatch,
  onCancel,
  onInspectPlayer,
}: MatchCenterProps) {
  const matchId =
    matchContext.type === 'LEAGUE' ? matchContext.fixture.id : matchContext.playoff.id;

  const homeTeamId: SeasonTeamId =
    matchContext.type === 'LEAGUE'
      ? matchContext.fixture.homeTeamId
      : matchContext.playoff.homeTeamId ?? 'YOU';
  const awayTeamId: SeasonTeamId =
    matchContext.type === 'LEAGUE'
      ? matchContext.fixture.awayTeamId
      : matchContext.playoff.awayTeamId ?? 'CSK';

  const homeTeam = season.teams[homeTeamId];
  const awayTeam = season.teams[awayTeamId];
  const userTeam = season.teams.YOU;
  const opponentTeam = homeTeamId === 'YOU' ? awayTeam : homeTeam;
  const venue =
    matchContext.type === 'LEAGUE'
      ? matchContext.fixture.venue
      : matchContext.playoff.venue;
  const matchLabel =
    matchContext.type === 'LEAGUE'
      ? `MATCH ${matchContext.fixture.userMatchNumber ?? matchContext.fixture.round}/20`
      : matchContext.playoff.label.toUpperCase();

  const savedSnapshot = useMemo<SavedActiveMatchSnapshot | null>(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_MATCH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedActiveMatchSnapshot;
      if (
        parsed &&
        parsed.matchId === matchId &&
        parsed.simulationVersion === SIMULATION_VERSION &&
        typeof parsed.matchSeed === 'string'
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [matchId]);

  const [matchSeed] = useState<string>(
    () =>
      savedSnapshot?.matchSeed ??
      `s${season.seasonNumber}:${matchId}:${homeTeamId}:${awayTeamId}:${season.stats.matchesSimulated}`
  );
  const initialRng = useMemo(
    () => createSeededRng(matchSeed, savedSnapshot?.rngState),
    [matchSeed, savedSnapshot?.rngState]
  );
  const rngStateRef = useRef<number>(initialRng.getState());
  const [rngState, setRngState] = useState<number>(initialRng.getState());

  const withMatchRng = <T,>(fn: (rng: () => number) => T): T => {
    const seeded = createSeededRng(matchSeed, rngStateRef.current);
    const out = fn(seeded.next);
    const nextState = seeded.getState();
    rngStateRef.current = nextState;
    setRngState(nextState);
    return out;
  };

  const [pitchCondition] = useState<PitchCondition>(() => {
    if (savedSnapshot?.pitchCondition) return savedSnapshot.pitchCondition;
    const pitchRng = createSeededRng(`${matchSeed}:pitch`);
    return getPitchConditionForVenue(venue, pitchRng.next);
  });
  const pitchMeta = PITCH_CONDITIONS[pitchCondition];
  const venueMemory = season.venueStats?.[venue];

  const [stage, setStage] = useState<MatchStage>(savedSnapshot?.stage ?? 'PRE_MATCH');
  const [toss, setToss] = useState<TossInfo | null>(savedSnapshot?.toss ?? null);
  const [bowlingMode, setBowlingMode] = useState<BowlingMode>(
    savedSnapshot?.bowlingMode ?? 'MANUAL'
  );
  const [battingAggression, setBattingAggression] = useState<BattingAggressionMode>(
    savedSnapshot?.battingAggression ?? 'BALANCED'
  );
  const [inningsNumber, setInningsNumber] = useState<1 | 2>(
    savedSnapshot?.inningsNumber ?? 1
  );
  const [inn1State, setInn1State] = useState<InteractiveInningsState | null>(
    savedSnapshot?.inn1State ?? null
  );
  const [inn1Summary, setInn1Summary] = useState<InningsSummary | null>(
    savedSnapshot?.inn1Summary ?? null
  );
  const [inn1Scorecard, setInn1Scorecard] = useState<InningsScorecard | null>(
    savedSnapshot?.inn1Scorecard ?? null
  );
  const [inn2State, setInn2State] = useState<InteractiveInningsState | null>(
    savedSnapshot?.inn2State ?? null
  );
  const [matchResult, setMatchResult] = useState<MatchResult | null>(
    savedSnapshot?.matchResult ?? null
  );

  const [impactSub, setImpactSub] = useState<ImpactSubstitution | null>(
    savedSnapshot?.impactSub ?? null
  );
  const [impactInPlayer, setImpactInPlayer] = useState<PlayerSeasonRecord | null>(
    savedSnapshot?.impactInPlayer ?? null
  );
  const [impactPromptShown, setImpactPromptShown] = useState(
    savedSnapshot?.impactPromptShown ?? false
  );
  const [lastOverSummary, setLastOverSummary] = useState<OverSummaryLine | null>(
    savedSnapshot?.lastOverSummary ?? null
  );

  const [selectedInId, setSelectedInId] = useState<string | null>(
    benchPlayers[0]?.playerId ?? null
  );
  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [impactSituationOverride, setImpactSituationOverride] =
    useState<ImpactSituationType | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<BowlingPlanId>(
    getDefaultPlanForPhase('POWERPLAY')
  );
  const [isAutoStepping, setIsAutoStepping] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [postChartInnings, setPostChartInnings] = useState<1 | 2>(1);

  // Pre-Match XI Adjust drawer state
  const [isAdjustXiOpen, setIsAdjustXiOpen] = useState(false);
  const [draftXiState, setDraftXiState] = useState<PlayingXIState | null>(null);
  const [swapPickXiId, setSwapPickXiId] = useState<string | null>(null);

  const activeInningsState = inningsNumber === 1 ? inn1State : inn2State;
  const isUserBowlingNow = Boolean(
    activeInningsState && activeInningsState.bowlingTeam.id === 'YOU'
  );
  const isUserBattingNow = Boolean(
    activeInningsState && activeInningsState.battingTeam.id === 'YOU'
  );
  const diffUi = SIM_CONFIG.difficultyAI[difficulty];

  // Persist active match state cleanly
  useEffect(() => {
    try {
      const payload: SavedActiveMatchSnapshot = {
        simulationVersion: SIMULATION_VERSION,
        matchSeed,
        rngState,
        matchId,
        stage,
        pitchCondition,
        toss,
        bowlingMode,
        battingAggression,
        inningsNumber,
        inn1State,
        inn1Summary,
        inn1Scorecard,
        inn2State,
        matchResult,
        impactSub,
        impactInPlayer,
        impactPromptShown,
        lastOverSummary,
      };
      window.localStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage limits
    }
  }, [
    matchSeed,
    rngState,
    matchId,
    stage,
    pitchCondition,
    toss,
    bowlingMode,
    battingAggression,
    inningsNumber,
    inn1State,
    inn1Summary,
    inn1Scorecard,
    inn2State,
    matchResult,
    impactSub,
    impactInPlayer,
    impactPromptShown,
    lastOverSummary,
  ]);

  // Keep tactical plan synced with current innings phase when crossing Powerplay -> Middle -> Death
  useEffect(() => {
    if (!activeInningsState) return;
    const nextOver = Math.min(20, activeInningsState.completedOvers + 1);
    const phase = getInningsPhaseForOver(nextOver);
    const phasePlans = getPlansForPhase(phase);
    if (!phasePlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(getDefaultPlanForPhase(phase));
    }
  }, [activeInningsState, selectedPlanId]);

  const beginSecondInningsFromFirst = (
    finishedInn1: InteractiveInningsState,
    subOverride?: ImpactSubstitution | null,
    inPlayerOverride?: PlayerSeasonRecord | null
  ) => {
    const out1 = finalizeInningsOutput(finishedInn1);
    setInn1Summary(out1.summary);
    setInn1Scorecard(out1.scorecard);

    const effFirstTeam = applyImpactToTeamRoster(
      finishedInn1.battingTeam,
      subOverride ?? impactSub,
      inPlayerOverride ?? impactInPlayer
    );
    const effSecondTeam = applyImpactToTeamRoster(
      finishedInn1.bowlingTeam,
      subOverride ?? impactSub,
      inPlayerOverride ?? impactInPlayer
    );

    const nextInn2 = withMatchRng((rng) =>
      createInitialInningsState({
        battingTeam: effSecondTeam,
        bowlingTeam: effFirstTeam,
        target: out1.summary.runs + 1,
        pitchCondition,
        playerForms: season.playerForms ?? {},
        impactSub: subOverride ?? impactSub ?? undefined,
        difficulty,
        rng,
      })
    );

    setInn2State(nextInn2);
    setInningsNumber(2);
    setLastOverSummary(null);
    setSelectedPlanId(getDefaultPlanForPhase('POWERPLAY'));

    // If user is batting 2nd, auto-advance smoothly; if user is bowling 2nd, pause if MANUAL
    setIsAutoStepping(nextInn2.battingTeam.id === 'YOU' || bowlingMode === 'AUTO');
  };

  const finishMatchFromSecondInnings = (
    finishedInn2: InteractiveInningsState,
    firstSum: InningsSummary,
    firstCard: InningsScorecard,
    subOverride?: ImpactSubstitution | null
  ) => {
    const out2 = finalizeInningsOutput(finishedInn2);
    const firstTeamObj =
      firstSum.teamId === homeTeam.id ? homeTeam : awayTeam;
    const secondTeamObj =
      firstSum.teamId === homeTeam.id ? awayTeam : homeTeam;

    const finalRes = withMatchRng((rng) =>
      assembleMatchResultFromInnings({
        simulationVersion: SIMULATION_VERSION,
        matchSeed,
        firstTeam: firstTeamObj,
        secondTeam: secondTeamObj,
        firstSummary: firstSum,
        firstScorecard: firstCard,
        secondSummary: out2.summary,
        secondScorecard: out2.scorecard,
        pitchCondition,
        toss: toss ?? undefined,
        impactSub: subOverride ?? impactSub ?? undefined,
        playerForms: season.playerForms ?? {},
        injuredPlayerIds: finishedInn2.injuredPlayerIds ?? [],
        rng,
      })
    );
    setMatchResult(finalRes);
    setIsAutoStepping(false);
    setStage('POST_MATCH');
  };

  const startLiveMatchFromToss = (finalToss: TossInfo) => {
    const winnerIsHome = finalToss.winnerTeamId === homeTeam.id;
    const homeBatsFirst = finalToss.decision === 'BAT' ? winnerIsHome : !winnerIsHome;
    const firstTeam = homeBatsFirst ? homeTeam : awayTeam;
    const secondTeam = homeBatsFirst ? awayTeam : homeTeam;

    const initialInn1 = withMatchRng((rng) =>
      createInitialInningsState({
        battingTeam: firstTeam,
        bowlingTeam: secondTeam,
        pitchCondition,
        playerForms: season.playerForms ?? {},
        difficulty,
        rng,
      })
    );

    setInn1State(initialInn1);
    setInn1Summary(null);
    setInn1Scorecard(null);
    setInn2State(null);
    setMatchResult(null);
    setInningsNumber(1);
    setLastOverSummary(null);
    setSelectedPlanId(getDefaultPlanForPhase('POWERPLAY'));
    setStage('LIVE');
    // If user is batting first, step smoothly; if user is bowling first in MANUAL, let user pick Over 1 bowler!
    setIsAutoStepping(firstTeam.id === 'YOU' || bowlingMode === 'AUTO');
  };

  const handleInningsTransition = (
    nextState: InteractiveInningsState,
    overSummary: OverSummaryLine | null
  ) => {
    if (overSummary) {
      setLastOverSummary(overSummary);
    }

    if (inningsNumber === 1) {
      setInn1State(nextState);
      if (nextState.isCompleted) {
        setIsAutoStepping(false);
        // Offer Impact Moment cleanly at innings break if unused & bench exists
        if (!impactPromptShown && !impactSub && benchPlayers.length > 0) {
          const out1 = finalizeInningsOutput(nextState);
          setInn1Summary(out1.summary);
          setInn1Scorecard(out1.scorecard);
          setImpactPromptShown(true);
          setStage('IMPACT_MOMENT');
        } else {
          beginSecondInningsFromFirst(nextState);
        }
      }
    } else {
      setInn2State(nextState);
      if (nextState.isCompleted && inn1Summary && inn1Scorecard) {
        finishMatchFromSecondInnings(nextState, inn1Summary, inn1Scorecard);
      }
    }
  };

  const stepOneOver = (bowlerIdOverride?: string, planOverride?: BowlingPlanId) => {
    if (!activeInningsState || activeInningsState.isCompleted) return;
    const { nextState, overSummary } = withMatchRng((rng) => {
      const chosen =
        bowlerIdOverride ??
        pickAutoBowler(activeInningsState, rng, difficulty).bowlerId;
      const chosenPlan =
        planOverride ??
        (isUserBowlingNow
          ? selectedPlanId
          : pickAutoBowler(activeInningsState, rng, difficulty).planId);

      return simulateSingleOver(activeInningsState, {
        bowlerId: chosen,
        planId: chosenPlan,
        aggressionMode: isUserBattingNow ? battingAggression : undefined,
        rng,
      });
    });

    handleInningsTransition(nextState, overSummary);
  };

  const stepOneBall = (bowlerIdOverride?: string, planOverride?: BowlingPlanId) => {
    if (!activeInningsState || activeInningsState.isCompleted) return;
    const { nextState, completedOverSummary } = withMatchRng((rng) => {
      const chosen =
        bowlerIdOverride ??
        activeInningsState.activeOver?.bowlerId ??
        pickAutoBowler(activeInningsState, rng, difficulty).bowlerId;
      const chosenPlan =
        planOverride ??
        activeInningsState.activeOver?.planId ??
        (isUserBowlingNow
          ? selectedPlanId
          : pickAutoBowler(activeInningsState, rng, difficulty).planId);

      return stepInningsDelivery(activeInningsState, {
        bowlerId: chosen,
        planId: chosenPlan,
        aggressionMode: isUserBattingNow ? battingAggression : undefined,
        rng,
      });
    });

    handleInningsTransition(nextState, completedOverSummary);
  };

  const simulateRemainingInningsOrMatch = (openScorecard: boolean) => {
    setIsAutoStepping(false);
    const { s1, s1Sum, s1Card, s2 } = withMatchRng((rng) => {
      let cur1 = inn1State;
      let cur1Sum = inn1Summary;
      let cur1Card = inn1Scorecard;

      if (inningsNumber === 1 && cur1) {
        while (!cur1.isCompleted && cur1.completedOvers < 20) {
          const auto = pickAutoBowler(cur1, rng, difficulty);
          cur1 = simulateSingleOver(cur1, {
            bowlerId: auto.bowlerId,
            planId: auto.planId,
            rng,
          }).nextState;
        }
        const out1 = finalizeInningsOutput(cur1);
        cur1Sum = out1.summary;
        cur1Card = out1.scorecard;
      }

      let cur2 = inn2State;
      if (!cur2 && cur1 && cur1Sum) {
        const effFirstTeam = applyImpactToTeamRoster(cur1.battingTeam, impactSub, impactInPlayer);
        const effSecondTeam = applyImpactToTeamRoster(cur1.bowlingTeam, impactSub, impactInPlayer);
        cur2 = createInitialInningsState({
          battingTeam: effSecondTeam,
          bowlingTeam: effFirstTeam,
          target: cur1Sum.runs + 1,
          pitchCondition,
          playerForms: season.playerForms ?? {},
          impactSub: impactSub ?? undefined,
          difficulty,
          rng,
        });
      }

      if (cur2) {
        while (!cur2.isCompleted && cur2.completedOvers < 20) {
          const auto = pickAutoBowler(cur2, rng, difficulty);
          cur2 = simulateSingleOver(cur2, {
            bowlerId: auto.bowlerId,
            planId: auto.planId,
            rng,
          }).nextState;
        }
      }
      return { s1: cur1, s1Sum: cur1Sum, s1Card: cur1Card, s2: cur2 };
    });

    if (s1 && s1Sum && s1Card) {
      setInn1State(s1);
      setInn1Summary(s1Sum);
      setInn1Scorecard(s1Card);
    }

    if (s2 && s1Sum && s1Card) {
      setInn2State(s2);
      setInningsNumber(2);
      setShowScorecard(openScorecard);
      finishMatchFromSecondInnings(s2, s1Sum, s1Card);
    }
  };

  // Auto-stepping loop when user is batting or when user enables AUTO BOWLING
  useEffect(() => {
    if (stage !== 'LIVE' || !isAutoStepping || !activeInningsState) return;
    if (isUserBowlingNow && bowlingMode === 'MANUAL') {
      setIsAutoStepping(false);
      return;
    }
    const delayMs = simSpeed === 'Fast' ? 280 : 620;
    const timer = window.setTimeout(() => {
      stepOneOver();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    stage,
    isAutoStepping,
    isUserBowlingNow,
    bowlingMode,
    simSpeed,
    inningsNumber,
    activeInningsState?.completedOvers,
    activeInningsState?.isCompleted,
  ]);

  const handleCallToss = (call: 'HEADS' | 'TAILS') => {
    const resolved = withMatchRng((rng) =>
      resolveToss('YOU', opponentTeam.id, call, pitchCondition, rng)
    );
    setToss(resolved);
  };

  const handleUserDecision = (decision: 'BAT' | 'BOWL') => {
    if (!toss) return;
    const updated = applyUserTossDecision(toss, decision);
    setToss(updated);
    startLiveMatchFromToss(updated);
  };

  // Impact situation detection directly from live InteractiveInningsState
  const detectedLiveSituation: ImpactSituationType = useMemo(() => {
    if (impactSituationOverride) return impactSituationOverride;
    if (inningsNumber === 1 && inn1State?.isCompleted) {
      const target = (inn1Summary?.runs ?? inn1State.runs) + 1;
      const userBatsSecond = inn1State.bowlingTeam.id === 'YOU';
      if (userBatsSecond) {
        if (target >= 182) return 'DEATH_FINISH';
        if (pitchCondition === 'SPIN_FRIENDLY' || pitchCondition === 'SLOW_AND_LOW') {
          return 'MIDDLE_VS_SPIN';
        }
        return 'DEATH_FINISH';
      }
      return target >= 175 ? 'DEFENDING_DEATH' : 'NEED_WICKETS';
    }
    if (activeInningsState) {
      const userBats = activeInningsState.battingTeam.id === 'YOU';
      const phase = getInningsPhaseForOver(Math.min(20, activeInningsState.completedOvers + 1));
      if (userBats) {
        if (phase === 'POWERPLAY' && activeInningsState.wickets >= 2) {
          return 'POWERPLAY_COLLAPSE';
        }
        if (phase === 'MIDDLE' && (pitchCondition === 'SPIN_FRIENDLY' || pitchCondition === 'SLOW_AND_LOW')) {
          return 'MIDDLE_VS_SPIN';
        }
        return 'DEATH_FINISH';
      }
      if (phase === 'DEATH') return 'DEFENDING_DEATH';
      return 'NEED_WICKETS';
    }
    if (matchResult) return detectImpactSituation({ matchResult, userTeamId: 'YOU' });
    return 'DEATH_FINISH';
  }, [impactSituationOverride, inningsNumber, inn1State, inn1Summary, activeInningsState, pitchCondition, matchResult]);

  const impactRecommendations = useMemo(
    () =>
      recommendImpactPlayer({
        situation: detectedLiveSituation,
        benchPlayers,
        activeXi: userTeam.players,
        playerForms: season.playerForms ?? {},
        maxStandardOverseas,
        pitchCondition,
      }),
    [
      detectedLiveSituation,
      benchPlayers,
      userTeam.players,
      season.playerForms,
      maxStandardOverseas,
      pitchCondition,
    ]
  );
  const topImpactRec = impactRecommendations[0] ?? null;

  const selectedInPlayer = benchPlayers.find((p) => p.playerId === selectedInId) ?? null;
  const selectedOutPlayer = userTeam.players.find((p) => p.playerId === selectedOutId) ?? null;
  const impactEligibility =
    selectedInPlayer && selectedOutPlayer
      ? checkImpactSubstitution(
          userTeam.players,
          selectedInPlayer,
          selectedOutPlayer,
          maxStandardOverseas
        )
      : null;

  const oversRemainingForImpact = useMemo(() => {
    if (inningsNumber === 1 && inn1State?.isCompleted) return 20;
    if (!activeInningsState) return 20;
    return Math.max(0, 20 - activeInningsState.completedOvers);
  }, [inningsNumber, inn1State, activeInningsState]);

  const potentialImpactOvers = Math.min(4, oversRemainingForImpact);

  const handleConfirmImpactSub = () => {
    if (!selectedInPlayer || !selectedOutPlayer || !impactEligibility?.allowed) return;
    const ovLabel = activeInningsState
      ? activeInningsState.isCompleted
        ? '0.0 (Inn 2)'
        : String(ballsToCricketOvers(activeInningsState.legalBalls))
      : '10.0';

    const sub: ImpactSubstitution = {
      teamId: 'YOU',
      inPlayerId: selectedInPlayer.playerId,
      inPlayerName: selectedInPlayer.playerName,
      outPlayerId: selectedOutPlayer.playerId,
      outPlayerName: selectedOutPlayer.playerName,
      overLabel: ovLabel,
      wasFifthOverseas: impactEligibility.wasFifthOverseas,
    };

    setImpactSub(sub);
    setImpactInPlayer(selectedInPlayer);

    // If paused at Inn 1 break, transition into Inn 2 with Impact sub applied immediately
    if (inningsNumber === 1 && inn1State?.isCompleted) {
      beginSecondInningsFromFirst(inn1State, sub, selectedInPlayer);
      setStage('LIVE');
      return;
    }

    // Apply mid-innings immediately to active state without losing bowled overs
    if (activeInningsState) {
      const updated = applyImpactPlayerToInnings(
        activeInningsState,
        sub,
        selectedInPlayer
      );
      if (inningsNumber === 1) setInn1State(updated);
      else setInn2State(updated);
      setStage('LIVE');
      setIsAutoStepping(updated.battingTeam.id === 'YOU' || bowlingMode === 'AUTO');
    }
  };

  // Pre-match XI Validation for inline adjustment drawer
  const adjustXiValidation = useMemo(() => {
    if (!draftXiState || !squad) return null;
    return validatePlayingXI(draftXiState, squad, maxStandardOverseas);
  }, [draftXiState, squad, maxStandardOverseas]);

  const bowlerOptions = useMemo(() => {
    if (!activeInningsState || !isUserBowlingNow) return [];
    return getBowlerSelectionOptions(activeInningsState);
  }, [activeInningsState, isUserBowlingNow]);

  const currentOverNum = activeInningsState
    ? Math.min(20, activeInningsState.completedOvers + 1)
    : 1;
  const currentPhase = getInningsPhaseForOver(currentOverNum);
  const currentPhasePlans = getPlansForPhase(currentPhase);
  const activePlanMeta =
    currentPhasePlans.find((p) => p.id === selectedPlanId) ?? currentPhasePlans[0];

  const liveCrr =
    activeInningsState && activeInningsState.legalBalls > 0
      ? ((activeInningsState.runs * 6) / activeInningsState.legalBalls).toFixed(2)
      : '0.00';
  const liveRrr =
    activeInningsState && activeInningsState.target !== undefined
      ? (() => {
          const need = Math.max(0, activeInningsState.target - activeInningsState.runs);
          const remBalls = Math.max(1, 120 - activeInningsState.legalBalls);
          return ((need * 6) / remBalls).toFixed(2);
        })()
      : null;

  const liveStriker = activeInningsState
    ? activeInningsState.batterStates[activeInningsState.strikerId]
    : null;
  const liveNonStriker = activeInningsState
    ? activeInningsState.batterStates[activeInningsState.nonStrikerId]
    : null;
  const currentBowlerTracker = activeInningsState?.lastBowlerId
    ? activeInningsState.bowlers.find(
        (b) => b.player.playerId === activeInningsState.lastBowlerId
      ) ?? null
    : null;

  return (
    <section
      data-testid="match-center"
      className="mx-auto w-full max-w-5xl px-4 py-4 pb-24 md:pb-12"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-[#141619] bg-[#FAF8F3] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-[2px] bg-[#D94E28] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white uppercase">
            {matchLabel}
          </span>
          <span className="font-display text-lg font-extrabold tracking-wide text-[#141619] uppercase sm:text-xl">
            {userTeam.name} vs {opponentTeam.name}
          </span>
          <span className="rounded-[2px] border border-[#141619]/20 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
            {SIM_CONFIG.difficultyAI[difficulty].label} AI
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[2px] border border-[#141619] bg-white px-3 py-1 font-mono text-[11px] font-bold text-[#141619] uppercase hover:bg-[#EAE3D5]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Season</span>
        </button>
      </div>

      {/* STAGE 1: PRE-MATCH PITCH REPORT, VENUE MEMORY, XI ADJUST & TOSS */}
      {stage === 'PRE_MATCH' && (
        <div
          data-testid="match-pre-toss"
          className="mt-4 border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]"
        >
          <div className="border-b-2 border-[#141619] bg-[#0D1B2A] px-5 py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold tracking-widest text-[#F59E0B] uppercase">
                PRE-MATCH CENTER · PITCH &amp; VENUE CONDITIONS
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-[#D94E28]" aria-hidden="true" />
                {venue}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="border border-white/15 bg-white/5 px-3.5 py-2.5">
                <div className="font-mono text-[10px] text-slate-400 uppercase">VENUE</div>
                <div className="mt-0.5 font-display text-lg font-extrabold uppercase">
                  {venue}
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-slate-300">
                  {homeTeam.shortName} (H) vs {awayTeam.shortName} (A)
                </div>
              </div>

              <div className="border border-[#F59E0B]/40 bg-[#132338] px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold text-[#F59E0B] uppercase">
                    PITCH REPORT
                  </span>
                  <span className="rounded-[2px] bg-[#D94E28] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-white">
                    {pitchMeta.shortLabel}
                  </span>
                </div>
                <div className="mt-0.5 font-display text-xl font-extrabold uppercase">
                  {pitchMeta.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">{pitchMeta.summary}</div>
              </div>

              <div className="border border-white/15 bg-white/5 px-3.5 py-2.5">
                <div className="font-mono text-[10px] text-slate-400 uppercase">
                  EXPECTED PAR SCORE
                </div>
                <div className="mt-0.5 font-mono text-2xl font-extrabold text-[#F59E0B] tabular-nums">
                  {pitchMeta.expectedParRange[0]}–{pitchMeta.expectedParRange[1]}
                </div>
                <div className="mt-1 font-mono text-[10px] text-emerald-300">
                  + {pitchMeta.keyAdvantage}
                </div>
                <div className="font-mono text-[10px] text-rose-300">
                  ! {pitchMeta.threat}
                </div>
              </div>
            </div>

            {/* Venue Memory Banner (appears once matches have been played here) */}
            {venueMemory && venueMemory.matches > 0 && (
              <div
                data-testid="venue-memory-card"
                className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-[#132338] px-3.5 py-2 font-mono text-[11px]"
              >
                <span className="font-bold text-[#F59E0B] uppercase">
                  VENUE MEMORY ({venueMemory.matches} MATCH{venueMemory.matches > 1 ? 'ES' : ''})
                </span>
                <div className="flex flex-wrap items-center gap-4 text-slate-200 tabular-nums">
                  <span>
                    Avg 1st Inn:{' '}
                    <strong>
                      {Math.round(venueMemory.totalFirstInnRuns / venueMemory.matches)}/
                      {(venueMemory.totalFirstInnWkts / venueMemory.matches).toFixed(1)}
                    </strong>
                  </span>
                  <span>
                    Avg 2nd Inn:{' '}
                    <strong>{Math.round(venueMemory.totalSecondInnRuns / venueMemory.matches)}</strong>
                  </span>
                  <span>
                    Bat 1st Wins: <strong>{venueMemory.batFirstWins}</strong> · Chases:{' '}
                    <strong>{venueMemory.chaseWins}</strong>
                  </span>
                  <span>
                    Highest: <strong>{venueMemory.highestScore}</strong>
                  </span>
                  <span>
                    Lowest Defended:{' '}
                    <strong>{venueMemory.lowestDefended ?? '—'}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Pre-Toss Starting XI & Bench Review Bar */}
            {!toss && squad && playingXiState && onAdjustPreMatchXI && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-200">
                  <Users className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
                  <span>
                    Starting XI Ready ({userTeam.players.length}/11 · Bench{' '}
                    {benchPlayers.length}) — Tailor lineup for {pitchMeta.label} before Toss
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="adjust-xi-btn"
                  onClick={() => {
                    setDraftXiState({ ...playingXiState });
                    setSwapPickXiId(null);
                    setIsAdjustXiOpen(true);
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[2px] border border-white/30 bg-white/10 px-3 py-1 font-mono text-[11px] font-bold text-white uppercase hover:bg-white/20"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ADJUST XI &amp; BENCH</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {!toss ? (
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#141619] bg-[#FEF3C7] text-[#B45309] shadow-[2px_2px_0px_#141619]">
                  <Coins className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 className="mt-3 font-display text-2xl font-extrabold tracking-wide text-[#141619] uppercase">
                  CALL THE COIN TOSS
                </h2>
                <p className="mt-1 text-xs text-[#4A4E54]">
                  Win the toss to decide whether {userTeam.shortName} will bat or bowl first on this{' '}
                  {pitchMeta.label.toLowerCase()}.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="toss-heads"
                    onClick={() => handleCallToss('HEADS')}
                    className="min-h-[48px] rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[2px_2px_0px_#141619] hover:bg-[#B83C1B]"
                  >
                    HEADS
                  </button>
                  <button
                    type="button"
                    data-testid="toss-tails"
                    onClick={() => handleCallToss('TAILS')}
                    className="min-h-[48px] rounded-[3px] border-2 border-[#141619] bg-[#0D1B2A] px-4 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[2px_2px_0px_#141619] hover:bg-[#162B42]"
                  >
                    TAILS
                  </button>
                </div>
              </div>
            ) : (
              <div data-testid="toss-outcome" className="mx-auto max-w-lg text-center">
                <div className="inline-flex items-center gap-2 rounded-[2px] border border-[#141619] bg-white px-3 py-1 font-mono text-xs font-bold uppercase">
                  <span>CALL: {toss.call}</span>
                  <span>·</span>
                  <span className="text-[#D94E28]">RESULT: {toss.outcome}</span>
                </div>

                {/* Contextual Pitch Toss Hint (advisory only, never forces choice) */}
                <div
                  data-testid="toss-contextual-hint"
                  className="mt-3 rounded-[2px] border border-[#141619]/20 bg-[#F4EFE4] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#141619]"
                >
                  PITCH NOTE: {pitchMeta.tossHint}
                </div>

                {toss.winnerTeamId === 'YOU' ? (
                  <>
                    <h2 className="mt-3 font-display text-2xl font-extrabold text-[#157F3D] uppercase">
                      {userTeam.name} WON THE TOSS!
                    </h2>
                    <p className="mt-1 text-xs text-[#4A4E54]">
                      Choose whether to bat first and set a target, or bowl first with manual over-by-over captaincy.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        data-testid="toss-choose-bat"
                        onClick={() => handleUserDecision('BAT')}
                        className="min-h-[48px] rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-4 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
                      >
                        BAT FIRST
                      </button>
                      <button
                        type="button"
                        data-testid="toss-choose-bowl"
                        onClick={() => handleUserDecision('BOWL')}
                        className="min-h-[48px] rounded-[3px] border-2 border-[#141619] bg-[#157F3D] px-4 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase hover:bg-[#116832]"
                      >
                        BOWL FIRST
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 font-display text-2xl font-extrabold text-[#141619] uppercase">
                      {opponentTeam.name} WON THE TOSS
                    </h2>
                    <p className="mt-1 font-mono text-xs font-bold text-[#D94E28] uppercase">
                      {opponentTeam.shortName} elected to{' '}
                      {toss.decision === 'BAT' ? 'BAT FIRST' : 'BOWL FIRST'}
                    </p>
                    <button
                      type="button"
                      data-testid="start-live-match"
                      onClick={() => startLiveMatchFromToss(toss)}
                      className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-7 py-2.5 font-display text-xl font-extrabold tracking-wider text-white uppercase shadow-[2px_2px_0px_#141619] hover:bg-[#B83C1B]"
                    >
                      <Play className="h-5 w-5" aria-hidden="true" />
                      <span>PROCEED TO MATCH</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRE-MATCH XI & BENCH ADJUSTMENT MODAL */}
      {isAdjustXiOpen && draftXiState && squad && adjustXiValidation && (
        <div
          data-testid="pre-match-xi-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust Starting XI and Impact Bench"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-2 border-[#141619] bg-[#FAF8F3] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#141619] pb-2.5">
              <div>
                <div className="font-mono text-[10px] font-bold text-[#D94E28] uppercase">
                  PITCH ADJUSTMENT · {pitchMeta.label}
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#141619] uppercase">
                  Adjust Starting XI &amp; Impact Bench
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustXiOpen(false)}
                aria-label="Close XI adjustment"
                className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#141619]/30 bg-white hover:bg-[#141619] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-[#141619]/20 bg-white px-3 py-2 font-mono text-[11px]">
              <span>
                XI: <strong>{adjustXiValidation.xiPlayers.length}/11</strong> · Overseas:{' '}
                <strong>
                  {adjustXiValidation.overseasCount}/{maxStandardOverseas}
                </strong>{' '}
                · WK: <strong>{adjustXiValidation.wicketkeepersInXI.length}</strong>
              </span>
              {adjustXiValidation.isValid ? (
                <span className="font-bold text-[#157F3D]">VALID XI ✓</span>
              ) : (
                <span className="font-bold text-[#D94E28]">{adjustXiValidation.errors[0]}</span>
              )}
            </div>

            <p className="mt-2 font-mono text-[10.5px] text-[#4A4E54]">
              {swapPickXiId
                ? 'Now click any Bench player below to swap them into your Starting XI.'
                : 'Click a player in your Starting XI, then click a Bench player to swap.'}
            </p>

            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="border border-[#141619] bg-white">
                <div className="border-b border-[#141619]/20 bg-[#EFE9DC] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase">
                  Starting XI ({adjustXiValidation.xiPlayers.length})
                </div>
                <div className="max-h-[280px] divide-y divide-[#141619]/10 overflow-y-auto">
                  {adjustXiValidation.xiPlayers.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      onClick={() =>
                        setSwapPickXiId((prev) =>
                          prev === p.playerId ? null : p.playerId
                        )
                      }
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs ${
                        swapPickXiId === p.playerId
                          ? 'bg-[#D94E28]/15 font-bold'
                          : 'hover:bg-[#FAF8F3]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        <span className="truncate font-semibold">{p.playerName}</span>
                        {p.isOverseas && (
                          <span className="rounded-[2px] bg-[#FEF3C7] px-1 font-mono text-[8.5px] font-bold text-[#B45309]">
                            OS
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-[#4A4E54] tabular-nums">
                        {p.battingRating}/{p.bowlingRating}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-[#141619] bg-white">
                <div className="border-b border-[#141619]/20 bg-[#EFE9DC] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase">
                  Impact Bench ({adjustXiValidation.benchPlayers.length})
                </div>
                <div className="max-h-[280px] divide-y divide-[#141619]/10 overflow-y-auto">
                  {adjustXiValidation.benchPlayers.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      disabled={!swapPickXiId}
                      onClick={() => {
                        if (!swapPickXiId) return;
                        const next = swapXIWithBench(
                          draftXiState,
                          squad,
                          swapPickXiId,
                          p.playerId
                        );
                        setDraftXiState(next);
                        setSwapPickXiId(null);
                      }}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-[#FAF8F3] disabled:opacity-65"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        <span className="truncate font-semibold">{p.playerName}</span>
                        {p.isOverseas && (
                          <span className="rounded-[2px] bg-[#FEF3C7] px-1 font-mono text-[8.5px] font-bold text-[#B45309]">
                            OS
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-[#6D28D9] tabular-nums">
                        {p.battingRating}/{p.bowlingRating}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-[#141619]/20 pt-3">
              <button
                type="button"
                onClick={() => setIsAdjustXiOpen(false)}
                className="min-h-[38px] rounded-[2px] border border-[#141619] bg-white px-4 font-mono text-xs font-bold uppercase hover:bg-[#EAE3D5]"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="save-pre-match-xi-btn"
                disabled={!adjustXiValidation.isValid}
                onClick={() => {
                  if (onAdjustPreMatchXI && adjustXiValidation.isValid) {
                    onAdjustPreMatchXI(draftXiState);
                    setIsAdjustXiOpen(false);
                  }
                }}
                className="min-h-[38px] rounded-[2px] border border-[#141619] bg-[#D94E28] px-5 font-mono text-xs font-extrabold text-white uppercase hover:bg-[#B83C1B] disabled:opacity-45"
              >
                SAVE LINEUP FOR MATCH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: LIVE MATCH CENTER (D3 CHART + OVER-BY-OVER + BOWLING MANAGEMENT) */}
      {stage === 'LIVE' && activeInningsState && (
        <div data-testid="match-live-board" className="mt-4 space-y-4">
          {/* Dark Navy Live Scoreboard */}
          <div className="border-2 border-[#141619] bg-[#0D1B2A] p-4 text-white shadow-[4px_4px_0px_#141619] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold tracking-wider text-[#F59E0B] uppercase">
                  LIVE MATCH CENTER · INNINGS {inningsNumber}
                </span>
                <span
                  data-testid="live-phase-badge"
                  className="rounded-[2px] border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-300 uppercase"
                >
                  {SIM_CONFIG.phases[currentPhase].shortLabel}
                </span>
                <span className="rounded-[2px] bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 uppercase">
                  {pitchMeta.shortLabel}
                </span>
                {activeInningsState.freeHitActive && (
                  <span
                    data-testid="free-hit-badge"
                    className="rounded-[2px] border border-amber-300 bg-[#F59E0B] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#141619] uppercase"
                  >
                    FREE HIT
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-300">
                {toss
                  ? `${season.teams[toss.winnerTeamId].shortName} won toss & chose ${toss.decision}`
                  : pitchMeta.label}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1fr] sm:items-end">
              <div>
                <div className="font-mono text-xs font-bold text-slate-300 uppercase">
                  {activeInningsState.battingTeam.name} (Batting) · vs{' '}
                  {activeInningsState.bowlingTeam.shortName}
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span
                    data-testid="live-score-readout"
                    className="font-mono text-4xl font-extrabold tracking-tight text-white tabular-nums sm:text-5xl"
                  >
                    {activeInningsState.runs}/{activeInningsState.wickets}
                  </span>
                  <span className="font-mono text-base font-bold text-[#F59E0B] tabular-nums">
                    ({formatOversDisplay(ballsToCricketOvers(activeInningsState.legalBalls))} / 20 OV)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border border-white/15 bg-[#132338] p-3 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">CRR</div>
                  <div className="mt-0.5 font-bold text-white tabular-nums">{liveCrr}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">TARGET</div>
                  <div className="mt-0.5 font-bold text-[#F59E0B] tabular-nums">
                    {activeInningsState.target ?? '1st Inn'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">RRR</div>
                  <div className="mt-0.5 font-bold text-emerald-300 tabular-nums">
                    {liveRrr ?? '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Batters & Current Bowler Strip */}
            <div className="mt-3 grid grid-cols-1 gap-2 border border-white/15 bg-[#132338] p-3 font-mono text-xs md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Current Batters
                </div>
                {liveStriker && (
                  <div className="flex items-center justify-between text-white">
                    <span className="font-bold">
                      {liveStriker.player.playerName}*
                    </span>
                    <span className="tabular-nums">
                      {liveStriker.runs} ({liveStriker.balls}) · {liveStriker.fours}×4 ·{' '}
                      {liveStriker.sixes}×6
                    </span>
                  </div>
                )}
                {liveNonStriker && liveNonStriker.player.playerId !== liveStriker?.player.playerId && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{liveNonStriker.player.playerName}</span>
                    <span className="tabular-nums">
                      {liveNonStriker.runs} ({liveNonStriker.balls})
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1 border-t border-white/10 pt-2 md:border-t-0 md:border-l md:pt-0 md:pl-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Last Bowler / Attack
                </div>
                {currentBowlerTracker ? (
                  <div className="flex items-center justify-between text-white">
                    <span className="font-bold">{currentBowlerTracker.player.playerName}</span>
                    <span className="tabular-nums text-[#F59E0B]">
                      {ballsToCricketOvers(currentBowlerTracker.ballsBowled)}-
                      {currentBowlerTracker.maidens}-{currentBowlerTracker.runsConceded}-
                      {currentBowlerTracker.wickets}
                    </span>
                  </div>
                ) : (
                  <div className="text-slate-300">Opening over ready to bowl</div>
                )}
                <div className="text-[10.5px] text-slate-300">
                  Partnership: {activeInningsState.currentPartnershipRuns} (
                  {activeInningsState.currentPartnershipBalls}b)
                </div>
              </div>
            </div>

            {/* Current Over Ball-by-Ball Strip (when mid-over) */}
            {activeInningsState.activeOver && activeInningsState.activeOver.ballsSequence.length > 0 && (
              <div
                data-testid="active-over-balls"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-white/15 bg-[#132338] px-3.5 py-2 font-mono text-xs"
              >
                <span className="font-bold text-[#F59E0B] uppercase">
                  OVER {activeInningsState.activeOver.overNumber} IN PROGRESS ·{' '}
                  {activeInningsState.activeOver.bowlerName}
                </span>
                <div className="flex items-center gap-1">
                  {activeInningsState.activeOver.ballsSequence.map((b, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-[2px] px-1 text-[9.5px] font-extrabold ${
                        b === 'W'
                          ? 'bg-[#EF4444] text-white'
                          : b === '6'
                            ? 'bg-[#6D28D9] text-white'
                            : b === '4'
                              ? 'bg-[#157F3D] text-white'
                              : b === 'NB' || b === 'Wd'
                                ? 'bg-[#F59E0B] text-[#141619]'
                                : 'bg-white/15 text-white'
                      }`}
                    >
                      {b === '0' ? '•' : b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Batting Aggression Mode Selector (when user is batting) */}
            {isUserBattingNow && (
              <div
                data-testid="batting-aggression-panel"
                className="mt-3 border border-white/15 bg-[#132338] px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-wider text-[#F59E0B] uppercase">
                    BATTING INTENT · {SIM_CONFIG.aggressionModes[battingAggression].label}
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">
                    {SIM_CONFIG.aggressionModes[battingAggression].description}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(
                    [
                      'STABILIZE',
                      'ROTATE_STRIKE',
                      'BALANCED',
                      'ATTACK',
                      'ALL_OUT_ATTACK',
                    ] as BattingAggressionMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`batting-aggression-${mode}`}
                      onClick={() => setBattingAggression(mode)}
                      className={`rounded-[2px] border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase transition-colors ${
                        battingAggression === mode
                          ? 'border-[#F59E0B] bg-[#D94E28] text-white'
                          : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      {SIM_CONFIG.aggressionModes[mode].shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Over Completion Summary Banner */}
            {lastOverSummary && (
              <div
                data-testid="over-complete-banner"
                className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-emerald-400/35 bg-emerald-950/35 px-3.5 py-2 font-mono text-xs"
              >
                <div>
                  <span className="font-extrabold text-emerald-300 uppercase">
                    OVER {lastOverSummary.overNumber} COMPLETE
                  </span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="font-bold text-white">
                    {lastOverSummary.bowlerName} ({lastOverSummary.bowlerSpellFigures}):{' '}
                    {lastOverSummary.runs} runs, {lastOverSummary.wickets} wkt
                    {lastOverSummary.wickets === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {lastOverSummary.ballsSequence.map((b, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-[2px] px-1 text-[9.5px] font-extrabold ${
                        b === 'W'
                          ? 'bg-[#EF4444] text-white'
                          : b === '6'
                            ? 'bg-[#6D28D9] text-white'
                            : b === '4'
                              ? 'bg-[#157F3D] text-white'
                              : b === 'NB' || b === 'Wd'
                                ? 'bg-[#F59E0B] text-[#141619]'
                                : 'bg-white/15 text-white'
                      }`}
                    >
                      {b === '0' ? '•' : b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match Controls Strip */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {benchPlayers.length > 0 && !impactSub && (
                  <button
                    type="button"
                    data-testid="open-impact-moment-btn"
                    onClick={() => {
                      setIsAutoStepping(false);
                      setImpactPromptShown(true);
                      setStage('IMPACT_MOMENT');
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border border-amber-300 bg-[#6D28D9] px-3.5 py-1.5 font-mono text-xs font-extrabold text-white uppercase hover:bg-[#5B21B6]"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>IMPACT MOMENT</span>
                  </button>
                )}

                {isUserBowlingNow && (
                  <button
                    type="button"
                    data-testid="bowler-mode-toggle"
                    onClick={() => {
                      const nextMode: BowlingMode =
                        bowlingMode === 'MANUAL' ? 'AUTO' : 'MANUAL';
                      setBowlingMode(nextMode);
                      setIsAutoStepping(nextMode === 'AUTO');
                    }}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border px-3.5 py-1.5 font-mono text-xs font-bold uppercase ${
                      bowlingMode === 'MANUAL'
                        ? 'border-emerald-300 bg-emerald-700 text-white'
                        : 'border-white/25 bg-white/10 text-white'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      MODE: {bowlingMode === 'MANUAL' ? 'MANUAL CAPTAINCY' : 'AUTO BOWLING'}
                    </span>
                  </button>
                )}

                {isUserBattingNow && (
                  <>
                    <button
                      type="button"
                      data-testid="next-ball-bat-btn"
                      onClick={() => {
                        setIsAutoStepping(false);
                        stepOneBall();
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-xs font-bold text-white uppercase hover:bg-white/20"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      <span>1 BALL</span>
                    </button>
                    <button
                      type="button"
                      data-testid="next-over-bat-btn"
                      onClick={() => {
                        setIsAutoStepping(false);
                        stepOneOver();
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-3.5 py-1.5 font-mono text-xs font-bold text-white uppercase hover:bg-white/20"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>BOWL OVER {currentOverNum}</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="skip-animation-btn"
                  onClick={() => simulateRemainingInningsOrMatch(false)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] bg-[#D94E28] px-3.5 py-1.5 font-mono text-xs font-extrabold text-white uppercase hover:bg-[#B83C1B]"
                >
                  <FastForward className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>SIMULATE REST OF MATCH</span>
                </button>

                <button
                  type="button"
                  data-testid="skip-to-scorecard-btn"
                  onClick={() => simulateRemainingInningsOrMatch(true)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-3.5 py-1.5 font-mono text-xs font-bold text-white uppercase hover:bg-white/20"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>SKIP TO SCORECARD</span>
                </button>
              </div>
            </div>

            {/* D3 Runs Per Over & Wickets Chart */}
            <div className="mt-3">
              <MatchFlowChart
                overHistory={activeInningsState.overHistory}
                teamName={activeInningsState.battingTeam.name}
                teamColor={activeInningsState.battingTeam.primaryColor}
                inningsLabel={`Innings ${inningsNumber}`}
              />
            </div>
          </div>

          {/* MANUAL BOWLING CAPTAINCY CONSOLE (When User Team Is Fielding) */}
          {isUserBowlingNow && (
            <div
              data-testid="bowling-management-panel"
              className="border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#141619] bg-[#EFE9DC] px-4 py-2.5">
                <div>
                  <div className="font-mono text-[10px] font-bold text-[#D94E28] uppercase">
                    CAPTAINCY DECISION · OVER {currentOverNum} OF 20 ({SIM_CONFIG.phases[currentPhase].label})
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-[#141619] uppercase">
                    CHOOSE NEXT BOWLER &amp; TACTICAL PLAN
                  </h3>
                </div>

                <button
                  type="button"
                  data-testid="auto-select-bowler-btn"
                  onClick={() => {
                    const auto = withMatchRng((rng) =>
                      pickAutoBowler(activeInningsState, rng, difficulty)
                    );
                    stepOneOver(auto.bowlerId, auto.planId);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[3px] border-2 border-[#141619] bg-[#0D1B2A] px-4 py-1.5 font-mono text-xs font-extrabold text-[#F59E0B] uppercase hover:bg-[#162B42]"
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>AUTO SELECT BOWLER</span>
                </button>
              </div>

              {/* Phase Tactical Plans */}
              <div className="border-b border-[#141619]/20 bg-[#F4EFE4] px-4 py-3">
                <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                  Phase Bowling Plan ({SIM_CONFIG.phases[currentPhase].shortLabel})
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {currentPhasePlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      data-testid={`bowling-plan-${plan.id}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`rounded-[2px] border px-2.5 py-1 font-mono text-[10.5px] font-extrabold uppercase transition-colors ${
                        activePlanMeta.id === plan.id
                          ? 'border-[#141619] bg-[#D94E28] text-white'
                          : 'border-[#141619]/30 bg-white text-[#141619] hover:border-[#141619]'
                      }`}
                    >
                      {plan.label}
                    </button>
                  ))}
                </div>
                {activePlanMeta && (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10.5px]">
                    <span className="text-[#157F3D]">
                      <strong>+</strong> {activePlanMeta.strength}
                    </span>
                    <span className="text-[#B83C1B]">
                      <strong>Risk:</strong> {activePlanMeta.risk}
                    </span>
                  </div>
                )}
              </div>

              {/* Available Bowlers Table */}
              <div data-testid="bowler-select-table" className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#141619]/20 bg-[#EFE9DC] font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                      <th className="px-3 py-2">Bowler</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2 text-right">BWL/IMP</th>
                      <th className="px-2 py-2 text-right">O</th>
                      <th className="px-2 py-2 text-right">R</th>
                      <th className="px-2 py-2 text-right">W</th>
                      <th className="px-2 py-2 text-right">Econ</th>
                      <th className="px-2 py-2 text-right">Left</th>
                      {diffUi.showFullMatchupHints && (
                        <th className="hidden px-2 py-2 md:table-cell">Matchup</th>
                      )}
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141619]/10 bg-white">
                    {bowlerOptions.map((opt) => {
                      const typeLabel =
                        opt.bowlerType === 'NONE'
                          ? '—'
                          : opt.isPartTimer
                            ? `${opt.bowlerType} (PT)`
                            : opt.bowlerType;
                      return (
                        <tr
                          key={opt.player.playerId}
                          data-testid={`bowler-row-${opt.player.playerId}`}
                          className={!opt.canBowlNow ? 'bg-[#FAF8F3]/75 opacity-70' : ''}
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#141619]">
                              <span>{opt.player.playerName}</span>
                              {opt.isRecommended &&
                                opt.canBowlNow &&
                                diffUi.showRecommendedBadge && (
                                  <span className="rounded-[2px] bg-[#157F3D] px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold text-white">
                                    BEST FIT
                                  </span>
                                )}
                              {opt.currentSpellOvers >= 2 && opt.canBowlNow && (
                                <span className="rounded-[2px] bg-[#FEF3C7] px-1 font-mono text-[8.5px] font-bold text-[#B45309]">
                                  SPELL {opt.currentSpellOvers}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono text-[10.5px] font-semibold text-[#4A4E54]">
                            {typeLabel}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums">
                            {opt.player.bowlingRating}/
                            <span className="text-[#6D28D9]">{opt.player.impactRating}</span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {formatOversDisplay(opt.oversBowled)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {opt.runsConceded}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-extrabold tabular-nums">
                            {opt.wickets}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {opt.ballsBowled > 0 ? opt.economy.toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-extrabold text-[#141619] tabular-nums">
                            {opt.oversRemaining}
                          </td>
                          {diffUi.showFullMatchupHints && (
                            <td className="hidden px-2 py-2 md:table-cell">
                              {opt.eligible ? (
                                <MatchupBadge matchup={opt.matchup} />
                              ) : (
                                <span className="font-mono text-[9.5px] text-[#4A4E54]">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            {opt.canBowlNow ? (
                              <button
                                type="button"
                                data-testid={`bowl-over-btn-${opt.player.playerId}`}
                                onClick={() =>
                                  stepOneOver(opt.player.playerId, activePlanMeta.id)
                                }
                                className="min-h-[32px] rounded-[2px] border border-[#141619] bg-[#D94E28] px-3 py-1 font-mono text-[10.5px] font-extrabold text-white uppercase hover:bg-[#B83C1B]"
                              >
                                BOWL OV {currentOverNum}
                              </button>
                            ) : (
                              <span
                                data-testid={`bowler-disabled-${opt.player.playerId}`}
                                className="inline-block rounded-[2px] border border-[#141619]/20 bg-[#EFE9DC] px-2 py-1 font-mono text-[9px] font-bold text-[#4A4E54] uppercase"
                              >
                                {opt.disabledReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 3: MID-MATCH IMPACT MOMENT */}
      {stage === 'IMPACT_MOMENT' && (
        <div
          data-testid="impact-moment-panel"
          className="mt-4 border-2 border-[#141619] bg-[#FAF8F3] shadow-[4px_4px_0px_#141619]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#141619] bg-[#0D1B2A] px-5 py-3.5 text-white">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-[#F59E0B] uppercase">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>IMPACT MOMENT · TACTICAL SUBSTITUTION</span>
              </div>
              <h2 className="mt-0.5 font-display text-2xl font-extrabold uppercase">
                {inn1Summary
                  ? `1st Innings: ${season.teams[inn1Summary.teamId].shortName} ${inn1Summary.runs}/${inn1Summary.wickets} · Target ${inn1Summary.runs + 1}`
                  : activeInningsState
                    ? `${activeInningsState.battingTeam.shortName} ${activeInningsState.runs}/${activeInningsState.wickets} (${formatOversDisplay(ballsToCricketOvers(activeInningsState.legalBalls))} ov)`
                    : 'Tactical Substitution'}
              </h2>
              <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10.5px] text-emerald-300">
                <span>OVERS REMAINING: {oversRemainingForImpact}</span>
                <span>·</span>
                <span>POTENTIAL IMPACT OVERS: {potentialImpactOvers}</span>
                <span>·</span>
                <span>PITCH: {pitchMeta.label}</span>
              </div>
            </div>

            <button
              type="button"
              data-testid="skip-impact-btn"
              onClick={() => {
                if (inningsNumber === 1 && inn1State?.isCompleted) {
                  beginSecondInningsFromFirst(inn1State);
                }
                setStage('LIVE');
              }}
              className="min-h-[36px] rounded-[2px] border border-white/25 bg-white/10 px-3 py-1 font-mono text-[11px] font-bold text-white uppercase hover:bg-white/20"
            >
              Skip Impact Sub
            </button>
          </div>

          {/* Tactical Situation Detector & Pitch-Aware Specialist Recommendation */}
          <div
            data-testid="impact-tactical-advisor"
            className="border-b border-[#141619]/20 bg-[#F4EFE4] px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[10.5px] font-bold tracking-wider text-[#4A4E54] uppercase">
                Tactical Situation Analysis (Pitch + Phase Specialists)
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['POWERPLAY_COLLAPSE', 'PP Collapse'],
                    ['MIDDLE_VS_SPIN', 'Mid vs Spin'],
                    ['DEATH_FINISH', 'Need 65 off 5'],
                    ['NEED_WICKETS', 'Need Wickets'],
                    ['DEFENDING_DEATH', 'Defend Final 5'],
                  ] as Array<[ImpactSituationType, string]>
                ).map(([sitKey, sitShort]) => (
                  <button
                    key={sitKey}
                    type="button"
                    data-testid={`impact-situation-${sitKey}`}
                    onClick={() => setImpactSituationOverride(sitKey)}
                    className={`rounded-[2px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors ${
                      detectedLiveSituation === sitKey
                        ? 'border-[#141619] bg-[#0D1B2A] text-[#F59E0B]'
                        : 'border-[#141619]/25 bg-white text-[#4A4E54] hover:border-[#141619]'
                    }`}
                  >
                    {sitShort}
                  </button>
                ))}
              </div>
            </div>

            {topImpactRec && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border border-[#6D28D9]/40 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-[2px] bg-[#6D28D9] px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold text-white uppercase">
                      TACTICAL PICK
                    </span>
                    <span className="text-xs font-extrabold text-[#141619]">
                      {topImpactRec.playerName}
                    </span>
                    <span className="font-mono text-[10.5px] font-bold text-[#6D28D9]">
                      Score {topImpactRec.tacticalScore}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[#4A4E54]">
                    {topImpactRec.headlineReason}
                    {topImpactRec.suggestedOutName
                      ? ` · Suggested OUT: ${topImpactRec.suggestedOutName}`
                      : ''}
                  </p>
                </div>

                {topImpactRec.suggestedOutId && (
                  <button
                    type="button"
                    data-testid="apply-recommended-impact-btn"
                    onClick={() => {
                      setSelectedInId(topImpactRec.playerId);
                      setSelectedOutId(topImpactRec.suggestedOutId);
                    }}
                    className="rounded-[2px] border border-[#141619] bg-[#6D28D9] px-2.5 py-1 font-mono text-[10.5px] font-extrabold text-white uppercase hover:bg-[#5B21B6]"
                  >
                    Apply Tactical Pick
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            {/* Step 1: Pick Bench Player IN */}
            <div className="border border-[#141619] bg-white">
              <div className="border-b border-[#141619]/20 bg-[#EFE9DC] px-3 py-2 font-mono text-xs font-extrabold text-[#141619] uppercase">
                1. Choose IMPACT PLAYER IN (Bench)
              </div>
              <div className="divide-y divide-[#141619]/10">
                {benchPlayers.map((p) => {
                  const isPicked = selectedInId === p.playerId;
                  const rec = impactRecommendations.find((r) => r.playerId === p.playerId);
                  const isTopPick = topImpactRec?.playerId === p.playerId;
                  return (
                    <button
                      key={p.playerId}
                      type="button"
                      data-testid={`impact-in-${p.playerId}`}
                      onClick={() => setSelectedInId(p.playerId)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                        isPicked ? 'bg-[#6D28D9]/12' : 'hover:bg-[#FAF8F3]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs font-extrabold text-[#141619]">
                              {p.playerName}
                            </span>
                            <span
                              className={`rounded-[2px] px-1 font-mono text-[9px] font-bold ${
                                p.isOverseas === true
                                  ? 'bg-[#FEF3C7] text-[#B45309]'
                                  : 'bg-[#DCFCE7] text-[#157F3D]'
                              }`}
                            >
                              {p.isOverseas === true ? 'OS' : 'IND'}
                            </span>
                            {isTopPick && (
                              <span className="rounded-[2px] bg-[#6D28D9] px-1 font-mono text-[8.5px] font-extrabold text-white">
                                BEST FIT
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-[#4A4E54] tabular-nums">
                            BAT {p.battingRating} · BWL {p.bowlingRating} · IMP{' '}
                            <span className="font-bold text-[#6D28D9]">{p.impactRating}</span> · OVR{' '}
                            {p.overallRating}
                          </div>
                          {rec && (
                            <div className="font-mono text-[9.5px] text-[#6D28D9]">
                              {rec.keyAttributes.map((a) => `${a.label} ${a.value}`).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                          isPicked
                            ? 'bg-[#6D28D9] text-white'
                            : 'border border-[#141619]/25 text-[#4A4E54]'
                        }`}
                      >
                        {isPicked ? 'IN ✓' : 'SELECT'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Pick Active XI Player OUT */}
            <div className="border border-[#141619] bg-white">
              <div className="border-b border-[#141619]/20 bg-[#EFE9DC] px-3 py-2 font-mono text-xs font-extrabold text-[#141619] uppercase">
                2. Choose PLAYER OUT (Active XI)
              </div>
              <div className="max-h-[300px] divide-y divide-[#141619]/10 overflow-y-auto">
                {userTeam.players.map((p) => {
                  const isPicked = selectedOutId === p.playerId;
                  return (
                    <button
                      key={p.playerId}
                      type="button"
                      data-testid={`impact-out-${p.playerId}`}
                      onClick={() => setSelectedOutId(p.playerId)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors ${
                        isPicked ? 'bg-[#D94E28]/12' : 'hover:bg-[#FAF8F3]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <RoleBadge role={p.role} bowlingStyle={p.bowlingStyle} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#141619]">
                              {p.playerName}
                            </span>
                            {p.isOverseas && (
                              <span className="rounded-[2px] bg-[#FEF3C7] px-1 font-mono text-[9px] font-bold text-[#B45309]">
                                OS
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-[#4A4E54] tabular-nums">
                            BAT {p.battingRating} · BWL {p.bowlingRating} · OVR {p.overallRating}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                          isPicked
                            ? 'bg-[#D94E28] text-white'
                            : 'border border-[#141619]/25 text-[#4A4E54]'
                        }`}
                      >
                        {isPicked ? 'OUT ✓' : 'SUB OUT'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#141619]/20 bg-[#EFE9DC] px-4 py-3">
            <div className="text-xs font-semibold text-[#141619]">
              {selectedInPlayer && selectedOutPlayer ? (
                impactEligibility?.allowed ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4 text-[#6D28D9]" aria-hidden="true" />
                    <span>
                      IN: <strong>{selectedInPlayer.playerName}</strong> · OUT:{' '}
                      <strong>{selectedOutPlayer.playerName}</strong>
                    </span>
                    {impactEligibility.wasFifthOverseas && (
                      <span className="rounded-[2px] bg-[#B45309] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white">
                        5TH OVERSEAS IMPACT
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[#D94E28]">{impactEligibility?.reason}</span>
                )
              ) : (
                <span className="text-[#4A4E54]">
                  Select 1 Bench player IN and 1 XI player OUT to activate your Impact sub.
                </span>
              )}
            </div>

            <button
              type="button"
              data-testid="confirm-impact-sub-btn"
              disabled={!impactEligibility?.allowed}
              onClick={handleConfirmImpactSub}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[3px] border-2 border-[#141619] bg-[#D94E28] px-5 py-2 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              <span>ACTIVATE IMPACT PLAYER</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 4: POST-MATCH SUMMARY, D3 FLOW CHART & SCORECARDS */}
      {stage === 'POST_MATCH' && matchResult && (
        <div data-testid="match-post-summary" className="mt-4 space-y-4">
          {/* Top Score Comparison Strip */}
          <div className="grid grid-cols-1 divide-y divide-[#141619]/20 border-2 border-[#141619] bg-[#FAF8F3] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3">
              <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                1st Innings · {season.teams[matchResult.firstInnings.teamId].name}
              </div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-[#141619] tabular-nums">
                {matchResult.firstInnings.runs}/{matchResult.firstInnings.wickets}{' '}
                <span className="text-sm font-semibold text-[#4A4E54]">
                  ({formatOversDisplay(matchResult.firstInnings.overs)} ov)
                </span>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                2nd Innings · {season.teams[matchResult.secondInnings.teamId].name}
              </div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-[#141619] tabular-nums">
                {matchResult.secondInnings.runs}/{matchResult.secondInnings.wickets}{' '}
                <span className="text-sm font-semibold text-[#4A4E54]">
                  ({formatOversDisplay(matchResult.secondInnings.overs)} ov)
                </span>
              </div>
            </div>

            <div
              className={`flex flex-col justify-center px-4 py-3 ${
                matchResult.winnerId === 'YOU' ? 'bg-[#DCFCE7]' : 'bg-[#FFF1EE]'
              }`}
            >
              <div className="font-mono text-[10px] font-bold text-[#4A4E54] uppercase">
                Official Result
              </div>
              <div
                className={`mt-0.5 font-display text-2xl font-extrabold uppercase ${
                  matchResult.winnerId === 'YOU' ? 'text-[#157F3D]' : 'text-[#B83C1B]'
                }`}
              >
                {season.teams[matchResult.winnerId].shortName} {matchResult.marginText}
              </div>
            </div>
          </div>

          {/* Dark Navy Match Result Card + Post-Match D3 Flow Chart */}
          <div className="border-2 border-[#141619] bg-[#0D1B2A] p-5 text-white shadow-[4px_4px_0px_#141619]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy
                  className={`h-5 w-5 ${
                    matchResult.winnerId === 'YOU' ? 'text-[#F59E0B]' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono text-xs font-bold tracking-wider text-[#F59E0B] uppercase">
                  {matchLabel} COMPLETE · {venue}
                </span>
              </div>
              {matchResult.impactSub && (
                <span className="rounded-[2px] bg-[#6D28D9] px-2 py-0.5 font-mono text-[10px] font-extrabold text-white uppercase">
                  IMP: {matchResult.impactSub.inPlayerName} IN / {matchResult.impactSub.outPlayerName} OUT
                </span>
              )}
            </div>

            {matchResult.superOver &&
              matchResult.superOverHistory &&
              matchResult.superOverHistory.length > 0 && (
                <div
                  data-testid="super-over-summary"
                  className="mt-3 border border-[#F59E0B]/40 bg-[#132338] p-3 font-mono text-xs"
                >
                  <div className="font-bold text-[#F59E0B] uppercase">
                    SUPER OVER TIEBREAKER ({matchResult.superOverHistory.length} ROUND
                    {matchResult.superOverHistory.length > 1 ? 'S' : ''})
                  </div>
                  <div className="mt-1.5 space-y-1 text-slate-200">
                    {matchResult.superOverHistory.map((so) => (
                      <div key={so.round} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          SO #{so.round}: {season.teams[so.firstTeam.teamId].shortName}{' '}
                          <strong>
                            {so.firstTeam.runs}/{so.firstTeam.wickets}
                          </strong>{' '}
                          ({so.firstTeam.ballsSequence.join(' ')}) vs{' '}
                          {season.teams[so.secondTeam.teamId].shortName}{' '}
                          <strong>
                            {so.secondTeam.runs}/{so.secondTeam.wickets}
                          </strong>{' '}
                          ({so.secondTeam.ballsSequence.join(' ')})
                        </span>
                        <span className="font-bold text-emerald-300">
                          {so.winnerId === 'TIE'
                            ? 'TIED'
                            : `${season.teams[so.winnerId].shortName} WON`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {matchResult.playerOfTheMatch && (
                <div className="border border-white/15 bg-[#132338] p-3.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#F59E0B] uppercase">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>PLAYER OF THE MATCH</span>
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold text-white uppercase">
                    {matchResult.playerOfTheMatch.playerName}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-300">
                    {matchResult.playerOfTheMatch.summary} ·{' '}
                    <span className="font-bold text-[#F59E0B]">
                      {matchResult.playerOfTheMatch.impactPoints} IMP
                    </span>
                  </div>
                </div>
              )}

              {matchResult.bestImpact && (
                <div className="border border-white/15 bg-[#132338] p-3.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-purple-300 uppercase">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>BEST IMPACT</span>
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold text-white uppercase">
                    {matchResult.bestImpact.playerName}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-300">
                    {matchResult.bestImpact.summary} ·{' '}
                    <span className="font-bold text-purple-300">
                      {matchResult.bestImpact.impactPoints} IMP
                    </span>
                  </div>
                </div>
              )}

              <div className="border border-white/15 bg-[#132338] p-3.5">
                <div className="font-mono text-[10px] font-bold text-emerald-300 uppercase">
                  KEY MOMENT
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">
                  {matchResult.keyMoment}
                </p>
              </div>
            </div>

            {/* Post-Match D3 Runs Per Over & Wickets Narrative Chart */}
            {(matchResult.firstScorecard?.overHistory?.length ||
              matchResult.secondScorecard?.overHistory?.length) && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="post-chart-inn1-btn"
                    onClick={() => setPostChartInnings(1)}
                    className={`rounded-[2px] border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase ${
                      postChartInnings === 1
                        ? 'border-[#F59E0B] bg-[#F59E0B] text-[#141619]'
                        : 'border-white/25 bg-white/10 text-slate-200'
                    }`}
                  >
                    1st Inn ({season.teams[matchResult.firstInnings.teamId].shortName})
                  </button>
                  <button
                    type="button"
                    data-testid="post-chart-inn2-btn"
                    onClick={() => setPostChartInnings(2)}
                    className={`rounded-[2px] border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase ${
                      postChartInnings === 2
                        ? 'border-[#F59E0B] bg-[#F59E0B] text-[#141619]'
                        : 'border-white/25 bg-white/10 text-slate-200'
                    }`}
                  >
                    2nd Inn ({season.teams[matchResult.secondInnings.teamId].shortName})
                  </button>
                </div>

                {(() => {
                  const chosenCard =
                    postChartInnings === 1
                      ? matchResult.firstScorecard
                      : matchResult.secondScorecard;
                  const chosenTeam =
                    postChartInnings === 1
                      ? season.teams[matchResult.firstInnings.teamId]
                      : season.teams[matchResult.secondInnings.teamId];
                  return (
                    <MatchFlowChart
                      overHistory={chosenCard?.overHistory ?? []}
                      teamName={chosenTeam.name}
                      teamColor={chosenTeam.primaryColor}
                      inningsLabel={postChartInnings === 1 ? '1st Innings' : '2nd Innings'}
                    />
                  );
                })()}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4">
              <button
                type="button"
                data-testid="toggle-scorecard-btn"
                onClick={() => setShowScorecard((s) => !s)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[3px] border border-white/25 bg-white/10 px-4 py-1.5 font-mono text-xs font-bold text-white uppercase hover:bg-white/20"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{showScorecard ? 'HIDE SCORECARD' : 'VIEW SCORECARD'}</span>
              </button>

              <button
                type="button"
                data-testid="commit-next-match-btn"
                onClick={() => onCompleteMatch(matchResult)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[3px] border-2 border-white/25 bg-[#D94E28] px-6 py-2 font-display text-lg font-extrabold tracking-wider text-white uppercase hover:bg-[#B83C1B]"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>NEXT MATCH</span>
              </button>
            </div>
          </div>

          {/* Expandable Full Scorecards */}
          {showScorecard && (
            <div data-testid="full-scorecards" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {getTeamScorecard(matchResult, 1) && (
                <ScorecardPanel
                  season={season}
                  card={getTeamScorecard(matchResult, 1)!}
                  inningsLabel="1st Innings"
                />
              )}
              {getTeamScorecard(matchResult, 2) && (
                <ScorecardPanel
                  season={season}
                  card={getTeamScorecard(matchResult, 2)!}
                  inningsLabel="2nd Innings"
                  targetRuns={matchResult.firstInnings.runs + 1}
                />
              )}
            </div>
          )}

          {onInspectPlayer && matchResult.playerOfTheMatch && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  const all = [
                    ...homeTeam.players,
                    ...awayTeam.players,
                    ...benchPlayers,
                  ];
                  const found = all.find(
                    (p) => p.playerId === matchResult.playerOfTheMatch?.playerId
                  );
                  if (found) onInspectPlayer(found);
                }}
                className="font-mono text-[11px] font-bold text-[#4A4E54] underline hover:text-[#141619]"
              >
                Inspect POTM Profile ({matchResult.playerOfTheMatch.playerName})
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
