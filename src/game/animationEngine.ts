import type {
  AnimationMode,
  DraftSettings,
  OverSummaryLine,
  SeasonTeamId,
} from '../types/game';
import type { InningsEngineState } from './cricketMatchEngine';

export interface ResolvedAnimationPrefs {
  requestedMode: AnimationMode;
  effectiveMode: AnimationMode;
  isFull: boolean;
  isReduced: boolean;
  isOff: boolean;
  skipMatchAnimations: boolean;
  matchAnimationsEnabled: boolean;
}

/**
 * Resolves the effective animation mode from persisted user settings and OS
 * `prefers-reduced-motion` preference. Backwards-compatible with older saves
 * that only stored `animationEnabled`.
 */
export function resolveAnimationMode(
  settings: Pick<
    DraftSettings,
    'animationEnabled' | 'animationMode' | 'skipMatchAnimations'
  >,
  prefersReducedMotion = false
): ResolvedAnimationPrefs {
  const requestedMode: AnimationMode =
    settings.animationMode ?? (settings.animationEnabled ? 'FULL' : 'OFF');

  let effectiveMode: AnimationMode = requestedMode;
  if (prefersReducedMotion && requestedMode === 'FULL') {
    effectiveMode = 'REDUCED';
  }

  const skipMatchAnimations = Boolean(settings.skipMatchAnimations);
  const isOff = effectiveMode === 'OFF';
  const isReduced = effectiveMode === 'REDUCED';
  const isFull = effectiveMode === 'FULL';

  return {
    requestedMode,
    effectiveMode,
    isFull,
    isReduced,
    isOff,
    skipMatchAnimations,
    matchAnimationsEnabled: !isOff && !skipMatchAnimations,
  };
}

/**
 * Builds a progressive deceleration delay schedule (in milliseconds) for the
 * Spin Draft franchise + season reel.
 * Fast initial spin (~45ms/tick) slowing smoothly into a crisp lock-in (~200ms)
 * totaling ~1200–1350ms in FULL mode, or ~380ms in REDUCED mode, or [] in OFF.
 */
export function buildSpinDecelerationSchedule(
  mode: AnimationMode
): number[] {
  if (mode === 'OFF') return [];
  if (mode === 'REDUCED') return [85, 115, 160];
  // 13 progressive ticks totaling 1245ms (target: 1.0–1.5s)
  return [45, 48, 52, 58, 66, 76, 88, 102, 118, 136, 156, 178, 200].slice(0, 12);
}

export type MatchEventFlashKind = 'FOUR' | 'SIX' | 'WICKET';

export interface MatchEventFlash {
  id: string;
  kind: MatchEventFlashKind;
  headline: string;
  detail: string;
  durationMs: number;
}

export type MatchMilestoneKind =
  | 'PARTNERSHIP_50'
  | 'BATTER_50'
  | 'BATTER_100'
  | 'TEAM_100'
  | 'TEAM_150'
  | 'WICKET_HAUL_3'
  | 'WICKET_HAUL_5';

export interface MatchMilestoneBanner {
  id: string;
  kind: MatchMilestoneKind;
  label: string;
  detail: string;
}

export interface DetectedMatchFeedback {
  flash: MatchEventFlash | null;
  milestones: MatchMilestoneBanner[];
}

/**
 * Pure visual feedback detector comparing pre-step and post-step innings state.
 * Never mutates state or affects probabilities/outcomes — reads only committed
 * scoreboard facts to trigger brief broadcast-style callouts.
 */
export function detectMatchFeedback(
  prev: InningsEngineState | null,
  next: InningsEngineState,
  completedOver?: OverSummaryLine | null
): DetectedMatchFeedback {
  if (!prev) {
    return { flash: null, milestones: [] };
  }

  const stamp = `${next.legalBalls}-${next.runs}-${next.wickets}-${next.deliveryLog.length}`;
  let flash: MatchEventFlash | null = null;
  const milestones: MatchMilestoneBanner[] = [];

  const newDeliveries = next.deliveryLog.slice(prev.deliveryLog.length);
  const latestWicketDelivery = [...newDeliveries]
    .reverse()
    .find((d) => d.isWicket);
  const latestSixDelivery = [...newDeliveries]
    .reverse()
    .find((d) => d.outcome === '6' || d.batterRuns === 6);
  const latestFourDelivery = [...newDeliveries]
    .reverse()
    .find((d) => d.outcome === '4' || d.batterRuns === 4);

  const lookupBatterName = (id?: string): string =>
    (id && next.batterStates[id]?.player.playerName) || 'Batter';
  const lookupBowlerName = (id?: string): string =>
    (id && next.bowlers.find((b) => b.player.playerId === id)?.player.playerName) ||
    'Bowler';

  // Priority: WICKET > SIX > FOUR
  if (next.wickets > prev.wickets) {
    const latestFow = next.fallOfWickets[next.fallOfWickets.length - 1];
    const dismissedId =
      latestFow?.batterId ??
      latestWicketDelivery?.dismissedBatterId ??
      latestWicketDelivery?.batterId;
    const dismissedBatter = dismissedId ? next.batterStates[dismissedId] : undefined;
    const batterName =
      latestFow?.batterName ??
      (dismissedId ? lookupBatterName(dismissedId) : undefined) ??
      completedOver?.wicketBatterNames?.[
        completedOver.wicketBatterNames.length - 1
      ] ??
      'Batter';
    const bowlerName = lookupBowlerName(latestWicketDelivery?.bowlerId);
    const dismissalDesc =
      dismissedBatter?.dismissalText ||
      (latestWicketDelivery?.dismissalType
        ? `${latestWicketDelivery.dismissalType.toLowerCase()} b ${bowlerName}`
        : `Out · ${next.runs}/${next.wickets}`);
    const runsBalls = dismissedBatter
      ? ` (${dismissedBatter.runs} off ${dismissedBatter.balls})`
      : '';
    flash = {
      id: `w-${stamp}`,
      kind: 'WICKET',
      headline: 'WICKET!',
      detail: `${batterName}${runsBalls} — ${dismissalDesc}`,
      durationMs: 780,
    };
  } else if (latestSixDelivery) {
    flash = {
      id: `6-${stamp}`,
      kind: 'SIX',
      headline: 'SIX!',
      detail: `${lookupBatterName(latestSixDelivery.batterId)} launches ${lookupBowlerName(latestSixDelivery.bowlerId)}`,
      durationMs: 620,
    };
  } else if (latestFourDelivery) {
    flash = {
      id: `4-${stamp}`,
      kind: 'FOUR',
      headline: 'FOUR!',
      detail: `${lookupBatterName(latestFourDelivery.batterId)} finds the rope`,
      durationMs: 480,
    };
  } else if (completedOver) {
    if (completedOver.wickets > 0) {
      flash = {
        id: `ow-${stamp}`,
        kind: 'WICKET',
        headline: 'WICKET!',
        detail: `${completedOver.wicketBatterNames.join(', ') || 'Breakthrough'} · ${completedOver.bowlerName}`,
        durationMs: 780,
      };
    } else if (completedOver.sixes > 0) {
      flash = {
        id: `o6-${stamp}`,
        kind: 'SIX',
        headline: 'SIX!',
        detail: `${completedOver.runs} off over ${completedOver.overNumber}`,
        durationMs: 620,
      };
    } else if (completedOver.fours > 0) {
      flash = {
        id: `o4-${stamp}`,
        kind: 'FOUR',
        headline: 'FOUR!',
        detail: `${completedOver.runs} off over ${completedOver.overNumber}`,
        durationMs: 480,
      };
    }
  }

  // Milestones
  // 1. Batter 100 / Batter 50
  for (const [batterId, currB] of Object.entries(next.batterStates)) {
    const prevB = prev.batterStates[batterId];
    const prevRuns = prevB?.runs ?? 0;
    if (prevRuns < 100 && currB.runs >= 100) {
      milestones.push({
        id: `b100-${batterId}-${stamp}`,
        kind: 'BATTER_100',
        label: 'BATTER 100',
        detail: `${currB.player.playerName} · ${currB.runs} (${currB.balls})`,
      });
    } else if (prevRuns < 50 && currB.runs >= 50) {
      milestones.push({
        id: `b50-${batterId}-${stamp}`,
        kind: 'BATTER_50',
        label: 'BATTER 50',
        detail: `${currB.player.playerName} · ${currB.runs} (${currB.balls})`,
      });
    }
  }

  // 2. Bowler 5-wicket haul / 3-wicket haul
  for (const currBowler of next.bowlers) {
    const prevBowler = prev.bowlers.find(
      (b) => b.player.playerId === currBowler.player.playerId
    );
    const prevW = prevBowler?.wickets ?? 0;
    if (prevW < 5 && currBowler.wickets >= 5) {
      milestones.push({
        id: `w5-${currBowler.player.playerId}-${stamp}`,
        kind: 'WICKET_HAUL_5',
        label: '5-WICKET HAUL',
        detail: `${currBowler.player.playerName} · ${currBowler.wickets}/${currBowler.runsConceded}`,
      });
    } else if (prevW < 3 && currBowler.wickets >= 3) {
      milestones.push({
        id: `w3-${currBowler.player.playerId}-${stamp}`,
        kind: 'WICKET_HAUL_3',
        label: '3-WICKET HAUL',
        detail: `${currBowler.player.playerName} · ${currBowler.wickets}/${currBowler.runsConceded}`,
      });
    }
  }

  // 3. 50 Partnership (current unbroken stand crossing 50)
  if (
    prev.partnershipWicketNum === next.partnershipWicketNum &&
    prev.currentPartnershipRuns < 50 &&
    next.currentPartnershipRuns >= 50
  ) {
    milestones.push({
      id: `p50-${next.partnershipWicketNum}-${stamp}`,
      kind: 'PARTNERSHIP_50',
      label: '50 PARTNERSHIP',
      detail: `${next.currentPartnershipRuns} runs (${next.currentPartnershipBalls}b)`,
    });
  }

  // 4. Team 150 / Team 100
  if (prev.runs < 150 && next.runs >= 150) {
    milestones.push({
      id: `t150-${stamp}`,
      kind: 'TEAM_150',
      label: 'TEAM 150',
      detail: `${next.battingTeam.code} ${next.runs}/${next.wickets}`,
    });
  } else if (prev.runs < 100 && next.runs >= 100) {
    milestones.push({
      id: `t100-${stamp}`,
      kind: 'TEAM_100',
      label: 'TEAM 100',
      detail: `${next.battingTeam.code} ${next.runs}/${next.wickets}`,
    });
  }

  return {
    flash,
    milestones: milestones.slice(0, 2),
  };
}

export interface ChaseTensionState {
  isChase: boolean;
  isCritical: boolean;
  runsNeeded: number;
  ballsRemaining: number;
  requiredRunRate: number;
  calloutText: string | null;
}

/**
 * Evaluates chase pressure during the 2nd innings so ONLY the chase-equation
 * box gets a subtle localized orange pulse during tense moments.
 */
export function getChaseTensionState(
  innings: Pick<
    InningsEngineState,
    'target' | 'runs' | 'wickets' | 'legalBalls' | 'isCompleted'
  > | null
): ChaseTensionState {
  if (!innings || innings.target === undefined || innings.isCompleted) {
    return {
      isChase: Boolean(innings?.target !== undefined),
      isCritical: false,
      runsNeeded: 0,
      ballsRemaining: 0,
      requiredRunRate: 0,
      calloutText: null,
    };
  }

  const runsNeeded = Math.max(0, innings.target - innings.runs);
  const ballsRemaining = Math.max(0, 120 - innings.legalBalls);
  const requiredRunRate =
    ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : runsNeeded > 0 ? 99 : 0;

  if (runsNeeded <= 0 || ballsRemaining <= 0 || innings.wickets >= 10) {
    return {
      isChase: true,
      isCritical: false,
      runsNeeded,
      ballsRemaining,
      requiredRunRate,
      calloutText: null,
    };
  }

  // Critical chase window: final 4 overs with realistic finish, or high RRR in final 6 overs, or <= 24 needed
  const isCritical =
    (ballsRemaining <= 24 && runsNeeded <= 56) ||
    (ballsRemaining <= 36 && requiredRunRate >= 10.0) ||
    (ballsRemaining <= 12 && runsNeeded <= 36) ||
    (runsNeeded <= 18 && ballsRemaining <= 30);

  return {
    isChase: true,
    isCritical,
    runsNeeded,
    ballsRemaining,
    requiredRunRate: Number(requiredRunRate.toFixed(2)),
    calloutText: `${runsNeeded} NEEDED FROM ${ballsRemaining}`,
  };
}

export type MatchResultBannerVariant =
  | 'CHAMPIONS'
  | 'VICTORY'
  | 'DEFEAT'
  | 'SUPER_OVER';

export interface MatchResultPresentation {
  variant: MatchResultBannerVariant;
  headline: string;
  subline: string;
  isUserWin: boolean;
  isSuperOver: boolean;
  isChampionshipWin: boolean;
}

/**
 * Classifies a completed match result into its sharp broadcast presentation
 * state (`VICTORY`, `DEFEAT`, `SUPER OVER`, or `CHAMPIONS` for Final win).
 */
export function classifyMatchResultPresentation(
  result: {
    winnerId: SeasonTeamId;
    resultText: string;
    isSuperOver?: boolean;
    isTie?: boolean;
  },
  userTeamId: SeasonTeamId,
  isFinal: boolean
): MatchResultPresentation {
  const isUserWin = result.winnerId === userTeamId;
  const isSuperOver = Boolean(result.isSuperOver);

  if (isFinal && isUserWin) {
    return {
      variant: 'CHAMPIONS',
      headline: 'CHAMPIONS',
      subline: result.resultText,
      isUserWin: true,
      isSuperOver,
      isChampionshipWin: true,
    };
  }

  if (isSuperOver) {
    return {
      variant: 'SUPER_OVER',
      headline: isUserWin ? 'SUPER OVER VICTORY' : 'SUPER OVER',
      subline: result.resultText,
      isUserWin,
      isSuperOver: true,
      isChampionshipWin: false,
    };
  }

  if (isUserWin) {
    return {
      variant: 'VICTORY',
      headline: 'VICTORY',
      subline: result.resultText,
      isUserWin: true,
      isSuperOver: false,
      isChampionshipWin: false,
    };
  }

  return {
    variant: 'DEFEAT',
    headline: 'DEFEAT',
    subline: result.resultText,
    isUserWin: false,
    isSuperOver: false,
    isChampionshipWin: false,
  };
}
