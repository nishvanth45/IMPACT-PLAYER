import type {
  BattingAggressionMode,
  BowlingPlanId,
  CaptaincyDifficulty,
  DraftSettings,
  ImpactSituationType,
  InningsPhase,
  PitchCondition,
} from '../types/game';
import { SIMULATION_VERSION } from '../types/game';

export { SIMULATION_VERSION };

export interface PhaseSimConfig {
  id: InningsPhase;
  label: string;
  shortLabel: string;
  startOver: number; // 1-indexed inclusive
  endOver: number; // 1-indexed inclusive
  scoringModifier: number; // Multiplier on base run expectancy
  wicketModifier: number; // Multiplier on base wicket hazard
  boundaryMultiplier: number; // Multiplier on boundary share
  sixShareOfBoundaries: number; // Fraction of boundaries that are 6s vs 4s
  dotBallBias: number; // >1 increases dots, <1 encourages singles/rotation
  paceBowlerWeight: number; // Preference for pace vs spin in bowling plan
  spinBowlerWeight: number;
  tailenderAggressionFloor: number; // Minimum batting intent factor for lower-order
}

export interface WicketConsequenceConfig {
  disruptionBalls: number;
  scoringMultiplier: number;
  wicketRiskMultiplier: number;
  incomingQualityMitigation: number; // 0..1 how strongly incoming batter quality softens shock
}

export interface PitchProfileConfig {
  id: PitchCondition;
  label: string;
  shortLabel: string;
  expectedParRange: [number, number];
  summary: string;
  keyAdvantage: string;
  threat: string;
  tossHint: string;
  idealAttack: 'PACE' | 'SPIN' | 'BALANCED';
  battingBias: number;
  bowlingBias: number;
  runMultiplier: Record<InningsPhase, number>;
  wicketMultiplier: Record<InningsPhase, number>;
  boundaryMultiplier: number;
  paceRatingBonus: Record<InningsPhase, number>;
  spinRatingBonus: Record<InningsPhase, number>;
  spinHittingWeightBoost: number;
  paceHittingWeightBoost: number;
  powerWeightBoost: number;
  techniqueWeightBoost: number;
  variationWeightBoost: number;
}

export interface TacticalPlanConfig {
  id: BowlingPlanId;
  phase: InningsPhase;
  label: string;
  shortLabel: string;
  strength: string;
  risk: string;
  runMultiplier: number;
  wicketMultiplier: number;
  boundaryMultiplier: number;
  extraMultiplier: number;
  dotBoost: number;
  preferControl?: boolean;
  preferVariation?: boolean;
  preferWicketTaking?: boolean;
}

export interface SimulationConfig {
  baseRunsPerBall: number;
  baseWicketProbPerBall: number;
  baselineRating: number;
  skillRunSensitivity: number; // Fractional run change per rating point edge
  skillWicketSensitivity: number; // Fractional wicket change per rating point edge
  phases: Record<InningsPhase, PhaseSimConfig>;
  pitchProfiles: Record<PitchCondition, PitchProfileConfig>;
  tacticalPlans: Record<BowlingPlanId, TacticalPlanConfig>;
  fatigue: {
    consecutivePenaltyOver3: number; // Rating drop on 3rd straight over
    consecutivePenaltyOver4: number; // Rating drop on 4th straight over
    tiredEconomyRunMult: number; // Slight run leakage when fatigued in consecutive spell
  };
  quietOverPressure: {
    dotThresholdInOver: number; // 4+ dots in an over builds pressure
    pressureWicketBoost: number; // Extra wicket probability in next over
    pressureRunDampen: number;
  };
  difficultyAI: Record<
    CaptaincyDifficulty,
    {
      label: string;
      selectionNoise: number; // Lower = smarter AI bowler/plan choices (no inflated stats!)
      planSmartChance: number;
      showRecommendedBadge: boolean;
      showFullMatchupHints: boolean;
    }
  >;
  settling: {
    rampBalls: number; // Approx 4-8 balls to get set (7 balls)
    finisherRampBalls: number; // Elite death/IMP finishers settle faster in overs 16-20
    finisherThreshold: number; // Min Death/IMP rating to unlock fast settling
    freshScoringMultiplier: number; // Scoring effectiveness on ball 0
    freshWicketMultiplier: number; // Extra early dismissal risk on ball 0
    settledThresholdBalls: number; // Balls faced to unlock full set batter boost
    maxSettledScoringBonus: number; // e.g. 1.08 (+8% when well set, so set BAT 85 > fresh BAT 92)
    maxSettledWicketReduction: number; // e.g. 0.82 (-18% dismissal risk when set)
  };
  aggressionModes: Record<
    BattingAggressionMode,
    {
      id: BattingAggressionMode;
      label: string;
      shortLabel: string;
      description: string;
      runMultiplier: number;
      boundaryMultiplier: number;
      dotBias: number; // >1 increases dots, <1 boosts singles/2s
      wicketMultiplier: number;
      runOutRiskMultiplier: number;
    }
  >;
  extrasAndFreeHit: {
    wideBaseProb: number; // Base wide chance before control/plan adjustments
    noBallBaseProb: number; // Base no-ball chance before control/plan adjustments
    byeBaseProb: number; // Legal-ball bye chance (e.g. keeper beat / bounce)
    legByeBaseProb: number; // Legal-ball leg-bye chance (deflected off pad/body)
    runOutBaseProb: number; // Base run-out chance on running deliveries
    freeHitRunMultiplier: number; // Batters swing freely on Free Hit
    freeHitBoundaryMultiplier: number;
  };
  batterFatigue: {
    startBalls: number; // Balls faced before endurance fatigue sets in gently
    maxPenalty: number; // Max fractional scoring drag on very long innings
    slopePerBall: number;
  };
  partnershipStability: {
    minBalls: number; // Partnership length before stability benefit begins
    maxVolatilityDampen: number; // Modest wicket hazard reduction for steady set partnerships
    maxRotationBoost: number; // Modest strike rotation uplift
  };
  formRegression: {
    towardNormalChance: number; // Gradual regression toward NORMAL between matches
  };
  wicketValue: Record<InningsPhase, WicketConsequenceConfig>;
  collapsePressure: {
    triggerWickets: number; // 2+ wickets in short window
    windowBalls: number; // Lookback window in legal deliveries
    baseScoringMultiplier: number; // Run scoring dampening under collapse pressure
    baseWicketMultiplier: number; // Extra wicket hazard under collapse pressure
    extraEscalationPerWicket: number; // Additional hazard when 3rd/4th rapid wicket falls
    stabilizationBallsNeeded: number; // Balls without losing a wicket to calm collapse pressure
    stabilizationWeights: {
      technique: number;
      pressure: number;
      consistency: number;
      overallRating: number;
    };
  };
  ratingWeights: {
    batting: Record<
      InningsPhase,
      {
        powerplay?: number;
        paceHitting?: number;
        middleOvers?: number;
        spinHitting?: number;
        deathOvers?: number;
        power?: number;
        finishing?: number;
        technique?: number;
        strikeRotation?: number;
        timing?: number;
        pressure?: number;
        consistency?: number;
        impactAbility?: number;
        battingRating?: number;
      }
    >;
    bowling: Record<
      InningsPhase,
      {
        powerplayBowling?: number;
        middleOversBowling?: number;
        deathBowling?: number;
        wicketTaking?: number;
        economy?: number;
        control?: number;
        variation?: number;
        pressure?: number;
        bowlingRating?: number;
      }
    >;
  };
  variance: {
    teamDaySpread: number; // Match-day form swing per team (+/-)
    bowlerSpellSpread: number; // Bowler spell variance (+/-)
    batterKnockSpread: number; // Individual innings variance
    seamerSwingNightChance: number; // Occasional bowler-friendly swing/collapse conditions
    flatRoadNightChance: number; // Occasional 215+ road night
    chaseTargetAwareness: {
      cruiseRrrThreshold: number;
      urgentRrrThreshold: number;
      desperateRrrThreshold: number;
      urgentRunBoost: number;
      urgentWicketBoost: number;
      desperateRunBoost: number;
      desperateWicketBoost: number;
    };
  };
  impactRecommendation: Record<
    ImpactSituationType,
    {
      label: string;
      description: string;
      preferRole: 'BAT_SPECIALIST' | 'BOWL_SPECIALIST';
      weights: Record<string, number>;
    }
  >;
}

export const SIM_CONFIG: SimulationConfig = {
  baseRunsPerBall: 1.47,
  baseWicketProbPerBall: 0.0365,
  baselineRating: 72,
  skillRunSensitivity: 0.0082,
  skillWicketSensitivity: 0.0098,

  phases: {
    POWERPLAY: {
      id: 'POWERPLAY',
      label: 'Powerplay (Overs 1–6)',
      shortLabel: 'PP 1–6',
      startOver: 1,
      endOver: 6,
      scoringModifier: 1.06,
      wicketModifier: 1.03, // New ball + attacking intent creates early wickets
      boundaryMultiplier: 1.25, // Two fielders outside the circle
      sixShareOfBoundaries: 0.28,
      dotBallBias: 1.05, // Moving new ball produces dots + boundaries
      paceBowlerWeight: 1.25,
      spinBowlerWeight: 0.72,
      tailenderAggressionFloor: 0.58,
    },
    MIDDLE: {
      id: 'MIDDLE',
      label: 'Middle Overs (Overs 7–15)',
      shortLabel: 'MID 7–15',
      startOver: 7,
      endOver: 15,
      scoringModifier: 0.87, // Lower volatility, consolidation & rotation
      wicketModifier: 0.82, // Fewer wickets unless spin/collapse strikes
      boundaryMultiplier: 0.75, // Fielders spread out
      sixShareOfBoundaries: 0.34,
      dotBallBias: 0.88, // Singles and twos dominate
      paceBowlerWeight: 0.82,
      spinBowlerWeight: 1.32,
      tailenderAggressionFloor: 0.65,
    },
    DEATH: {
      id: 'DEATH',
      label: 'Death Overs (Overs 16–20)',
      shortLabel: 'DEATH 16–20',
      startOver: 16,
      endOver: 20,
      scoringModifier: 1.38, // Strong increase in batting aggression (10.5–12.0 RPO)
      wicketModifier: 1.48, // Batters preserve wickets less
      boundaryMultiplier: 1.54, // High boundary attempt rate
      sixShareOfBoundaries: 0.54,
      dotBallBias: 0.85,
      paceBowlerWeight: 1.22,
      spinBowlerWeight: 0.78,
      tailenderAggressionFloor: 0.86, // Tailenders swing aggressively
    },
  },

  pitchProfiles: {
    BATTING_PARADISE: {
      id: 'BATTING_PARADISE',
      label: 'Batting Paradise',
      shortLabel: 'FLAT DECK',
      expectedParRange: [185, 208],
      summary: 'True bounce and fast outfield; power hitters & finishers thrive.',
      keyAdvantage: 'Power, Timing & Finishing batters',
      threat: 'Death overs carnage (11+ RPO); bowlers need yorkers & variations',
      tossHint: 'High-scoring chase deck — batting second often preferred under lights.',
      idealAttack: 'BALANCED',
      battingBias: 14,
      bowlingBias: 0,
      runMultiplier: { POWERPLAY: 1.10, MIDDLE: 1.09, DEATH: 1.11 },
      wicketMultiplier: { POWERPLAY: 0.90, MIDDLE: 0.89, DEATH: 0.93 },
      boundaryMultiplier: 1.12,
      paceRatingBonus: { POWERPLAY: -1, MIDDLE: -1, DEATH: 0 },
      spinRatingBonus: { POWERPLAY: -2, MIDDLE: -1, DEATH: -2 },
      spinHittingWeightBoost: 0,
      paceHittingWeightBoost: 0.08,
      powerWeightBoost: 0.14,
      techniqueWeightBoost: -0.05,
      variationWeightBoost: 0.08,
    },
    BALANCED: {
      id: 'BALANCED',
      label: 'Balanced Sporting Pitch',
      shortLabel: 'BALANCED',
      expectedParRange: [168, 188],
      summary: 'Even contest between bat and ball across all three phases.',
      keyAdvantage: 'All-round depth & phase specialists',
      threat: 'Momentum shifts quickly in Powerplay & Death overs',
      tossHint: 'Neutral conditions — back your strongest phase plan.',
      idealAttack: 'BALANCED',
      battingBias: 0,
      bowlingBias: 0,
      runMultiplier: { POWERPLAY: 1.0, MIDDLE: 1.0, DEATH: 1.0 },
      wicketMultiplier: { POWERPLAY: 1.0, MIDDLE: 1.0, DEATH: 1.0 },
      boundaryMultiplier: 1.0,
      paceRatingBonus: { POWERPLAY: 0, MIDDLE: 0, DEATH: 0 },
      spinRatingBonus: { POWERPLAY: 0, MIDDLE: 0, DEATH: 0 },
      spinHittingWeightBoost: 0,
      paceHittingWeightBoost: 0,
      powerWeightBoost: 0,
      techniqueWeightBoost: 0,
      variationWeightBoost: 0,
    },
    SPIN_FRIENDLY: {
      id: 'SPIN_FRIENDLY',
      label: 'Spin Friendly Track',
      shortLabel: 'SPIN TRACK',
      expectedParRange: [152, 174],
      summary: 'Dry surface grips sharply; spinners squeeze overs 7–15.',
      keyAdvantage: 'Specialist Spinners & Spin-Hitting batters',
      threat: 'Middle-overs spin choke & high risk for weak players of spin',
      tossHint: 'Surface may grip even harder later — batting first has strong value.',
      idealAttack: 'SPIN',
      battingBias: -7,
      bowlingBias: 6,
      runMultiplier: { POWERPLAY: 0.98, MIDDLE: 0.91, DEATH: 0.96 },
      wicketMultiplier: { POWERPLAY: 1.0, MIDDLE: 1.15, DEATH: 1.05 },
      boundaryMultiplier: 0.91,
      paceRatingBonus: { POWERPLAY: 1, MIDDLE: -1, DEATH: 0 },
      spinRatingBonus: { POWERPLAY: 3, MIDDLE: 7, DEATH: 4 },
      spinHittingWeightBoost: 0.22,
      paceHittingWeightBoost: 0,
      powerWeightBoost: -0.04,
      techniqueWeightBoost: 0.08,
      variationWeightBoost: 0.12,
    },
    PACE_SEAMER: {
      id: 'PACE_SEAMER',
      label: 'Pace & Bounce',
      shortLabel: 'PACE & BOUNCE',
      expectedParRange: [158, 178],
      summary: 'Hard surface with carry and seam; fast bowlers extract early wickets.',
      keyAdvantage: 'High-pace bowlers & strong Pace Hitters',
      threat: 'New-ball bounce in Powerplay; top-order collapses possible',
      tossHint: 'Lively carry early — pacers can strike inside the first 6 overs.',
      idealAttack: 'PACE',
      battingBias: -6,
      bowlingBias: 6,
      runMultiplier: { POWERPLAY: 0.96, MIDDLE: 0.97, DEATH: 0.98 },
      wicketMultiplier: { POWERPLAY: 1.15, MIDDLE: 1.05, DEATH: 1.06 },
      boundaryMultiplier: 0.97,
      paceRatingBonus: { POWERPLAY: 6, MIDDLE: 4, DEATH: 4 },
      spinRatingBonus: { POWERPLAY: -2, MIDDLE: 0, DEATH: -1 },
      spinHittingWeightBoost: 0,
      paceHittingWeightBoost: 0.22,
      powerWeightBoost: 0.04,
      techniqueWeightBoost: 0.10,
      variationWeightBoost: 0.04,
    },
    SLOW_AND_LOW: {
      id: 'SLOW_AND_LOW',
      label: 'Slow & Low Surface',
      shortLabel: 'SLOW & LOW',
      expectedParRange: [146, 168],
      summary: 'Two-paced deck; timing boundaries is tough, slower balls & spin excel.',
      keyAdvantage: 'Spinners, Slower-ball Pacers & Strike Rotators',
      threat: 'Power-only sloggers mistime; middle overs scoring drops steeply',
      tossHint: 'Tough stroke-play — bowlers with variation and cutters dominate.',
      idealAttack: 'SPIN',
      battingBias: -10,
      bowlingBias: 8,
      runMultiplier: { POWERPLAY: 0.94, MIDDLE: 0.90, DEATH: 0.91 },
      wicketMultiplier: { POWERPLAY: 1.05, MIDDLE: 1.12, DEATH: 1.10 },
      boundaryMultiplier: 0.85,
      paceRatingBonus: { POWERPLAY: 1, MIDDLE: 2, DEATH: 2 },
      spinRatingBonus: { POWERPLAY: 3, MIDDLE: 6, DEATH: 5 },
      spinHittingWeightBoost: 0.14,
      paceHittingWeightBoost: 0,
      powerWeightBoost: -0.14,
      techniqueWeightBoost: 0.16,
      variationWeightBoost: 0.22,
    },
    SWINGING: {
      id: 'SWINGING',
      label: 'Swinging Conditions',
      shortLabel: 'SWINGING',
      expectedParRange: [154, 176],
      summary: 'Strong lateral swing in the Powerplay; eases for set batters later.',
      keyAdvantage: 'New-ball Swing Pacers & high-Technique openers',
      threat: 'Severe early Powerplay wicket danger before ball softens',
      tossHint: 'New ball expected to swing strongly in Overs 1–6.',
      idealAttack: 'PACE',
      battingBias: -5,
      bowlingBias: 6,
      runMultiplier: { POWERPLAY: 0.90, MIDDLE: 0.99, DEATH: 1.03 },
      wicketMultiplier: { POWERPLAY: 1.24, MIDDLE: 1.02, DEATH: 0.98 },
      boundaryMultiplier: 0.95,
      paceRatingBonus: { POWERPLAY: 8, MIDDLE: 2, DEATH: 1 },
      spinRatingBonus: { POWERPLAY: -3, MIDDLE: 1, DEATH: 0 },
      spinHittingWeightBoost: 0,
      paceHittingWeightBoost: 0.16,
      powerWeightBoost: 0,
      techniqueWeightBoost: 0.22,
      variationWeightBoost: 0.05,
    },
  },

  tacticalPlans: {
    // Powerplay plans
    ATTACK_WICKETS: {
      id: 'ATTACK_WICKETS',
      phase: 'POWERPLAY',
      label: 'Attack Wickets',
      shortLabel: 'ATTACK WKT',
      strength: 'Higher strike probability with slips & attacking lengths',
      risk: 'Leaves boundary gaps if batters survive early spell',
      runMultiplier: 1.05,
      wicketMultiplier: 1.18,
      boundaryMultiplier: 1.10,
      extraMultiplier: 1.05,
      dotBoost: 1.04,
      preferWicketTaking: true,
    },
    BALANCED: {
      id: 'BALANCED',
      phase: 'POWERPLAY',
      label: 'Balanced Lengths',
      shortLabel: 'BALANCED',
      strength: 'Standard Powerplay control without over-committing',
      risk: 'Neutral edge against dominant openers',
      runMultiplier: 1.0,
      wicketMultiplier: 1.0,
      boundaryMultiplier: 1.0,
      extraMultiplier: 1.0,
      dotBoost: 1.0,
    },
    PROTECT_BOUNDARIES: {
      id: 'PROTECT_BOUNDARIES',
      phase: 'POWERPLAY',
      label: 'Protect Boundaries',
      shortLabel: 'DEFEND BND',
      strength: 'Cuts fours & caps Powerplay explosion',
      risk: 'Lower early wicket threat',
      runMultiplier: 0.92,
      wicketMultiplier: 0.86,
      boundaryMultiplier: 0.84,
      extraMultiplier: 0.94,
      dotBoost: 0.95,
      preferControl: true,
    },

    // Middle overs plans
    BUILD_PRESSURE: {
      id: 'BUILD_PRESSURE',
      phase: 'MIDDLE',
      label: 'Build Pressure',
      shortLabel: 'BUILD PRESS',
      strength: 'Tight ring fields boost dot balls; consecutive quiet overs force errors',
      risk: 'Requires accurate control bowlers',
      runMultiplier: 0.91,
      wicketMultiplier: 1.06,
      boundaryMultiplier: 0.85,
      extraMultiplier: 0.92,
      dotBoost: 1.14,
      preferControl: true,
    },
    DEFEND_BOUNDARIES: {
      id: 'DEFEND_BOUNDARIES',
      phase: 'MIDDLE',
      label: 'Defend Boundaries',
      shortLabel: 'DEFEND BND',
      strength: 'Deep sweepers deny fours & sixes on flat surfaces',
      risk: 'Easy singles let batters get settled',
      runMultiplier: 0.94,
      wicketMultiplier: 0.88,
      boundaryMultiplier: 0.80,
      extraMultiplier: 0.96,
      dotBoost: 0.88,
      preferControl: true,
    },

    // Death overs plans
    YORKER_PLAN: {
      id: 'YORKER_PLAN',
      phase: 'DEATH',
      label: 'Yorker Plan',
      shortLabel: 'YORKERS',
      strength: 'Cuts death sixes & rewards top Control / Death Bowling',
      risk: 'Missed yorkers turn into full tosses or wides',
      runMultiplier: 0.90,
      wicketMultiplier: 1.08,
      boundaryMultiplier: 0.82,
      extraMultiplier: 1.18,
      dotBoost: 1.12,
      preferControl: true,
    },
    SLOWER_BALL_PLAN: {
      id: 'SLOWER_BALL_PLAN',
      phase: 'DEATH',
      label: 'Slower-Ball Plan',
      shortLabel: 'SLOWER BALL',
      strength: 'Deceives big hitters; great on Slow & Low pitches with Variation',
      risk: 'Risky if variation rating is low on flat batting decks',
      runMultiplier: 0.93,
      wicketMultiplier: 1.15,
      boundaryMultiplier: 0.88,
      extraMultiplier: 1.02,
      dotBoost: 1.06,
      preferVariation: true,
    },
    WIDE_LINE_PLAN: {
      id: 'WIDE_LINE_PLAN',
      phase: 'DEATH',
      label: 'Wide-Line Plan',
      shortLabel: 'WIDE LINE',
      strength: 'Keeps ball away from leg-side hitting arc',
      risk: 'Higher wide-ball extra risk',
      runMultiplier: 0.92,
      wicketMultiplier: 0.94,
      boundaryMultiplier: 0.84,
      extraMultiplier: 1.45,
      dotBoost: 1.08,
      preferControl: true,
    },
    ATTACK_STUMPS: {
      id: 'ATTACK_STUMPS',
      phase: 'DEATH',
      label: 'Attack Stumps',
      shortLabel: 'STUMPS',
      strength: 'Maximum wicket-taking aggression against tail or new batters',
      risk: 'Higher boundary concession if batter connects cleanly',
      runMultiplier: 1.06,
      wicketMultiplier: 1.22,
      boundaryMultiplier: 1.12,
      extraMultiplier: 0.95,
      dotBoost: 0.96,
      preferWicketTaking: true,
    },
    MIXED_PLAN: {
      id: 'MIXED_PLAN',
      phase: 'DEATH',
      label: 'Mixed Variations',
      shortLabel: 'MIXED',
      strength: 'Balanced death-overs blend of yorkers, cutters & hard lengths',
      risk: 'No extreme bonus or penalty',
      runMultiplier: 0.98,
      wicketMultiplier: 1.02,
      boundaryMultiplier: 0.96,
      extraMultiplier: 1.0,
      dotBoost: 1.0,
    },
  },

  fatigue: {
    consecutivePenaltyOver3: 2.5,
    consecutivePenaltyOver4: 5.5,
    tiredEconomyRunMult: 1.06,
  },

  quietOverPressure: {
    dotThresholdInOver: 4,
    pressureWicketBoost: 1.14,
    pressureRunDampen: 0.94,
  },

  difficultyAI: {
    CASUAL: {
      label: 'Casual',
      selectionNoise: 14,
      planSmartChance: 0.45,
      showRecommendedBadge: true,
      showFullMatchupHints: true,
    },
    STANDARD: {
      label: 'Standard',
      selectionNoise: 6,
      planSmartChance: 0.78,
      showRecommendedBadge: true,
      showFullMatchupHints: true,
    },
    EXPERT: {
      label: 'Expert',
      selectionNoise: 1.5,
      planSmartChance: 0.96,
      showRecommendedBadge: false,
      showFullMatchupHints: false,
    },
  },

  settling: {
    rampBalls: 7, // ~4-8 balls settling period
    finisherRampBalls: 3, // Elite Death/IMP finishers settle faster at the Death
    finisherThreshold: 80,
    freshScoringMultiplier: 0.84, // Fresh batter reduced effectiveness
    freshWicketMultiplier: 1.22, // Slightly more vulnerable early
    settledThresholdBalls: 10,
    maxSettledScoringBonus: 1.08, // Set BAT 85 (~91.8) > Fresh BAT 92 (~77.3)
    maxSettledWicketReduction: 0.82,
  },

  aggressionModes: {
    STABILIZE: {
      id: 'STABILIZE',
      label: 'Stabilize',
      shortLabel: 'STABILIZE',
      description: 'Protect wicket during collapse or tough new-ball spell; elevates Technique & Consistency.',
      runMultiplier: 0.85,
      boundaryMultiplier: 0.70,
      dotBias: 1.14,
      wicketMultiplier: 0.76,
      runOutRiskMultiplier: 0.72,
    },
    ROTATE_STRIKE: {
      id: 'ROTATE_STRIKE',
      label: 'Rotate Strike',
      shortLabel: 'ROTATE',
      description: 'Work singles and twos into gaps, cut dots, and keep the board moving safely.',
      runMultiplier: 0.97,
      boundaryMultiplier: 0.84,
      dotBias: 0.78,
      wicketMultiplier: 0.88,
      runOutRiskMultiplier: 1.12,
    },
    BALANCED: {
      id: 'BALANCED',
      label: 'Balanced',
      shortLabel: 'BALANCED',
      description: 'Natural T20 tempo aligned with phase and pitch conditions.',
      runMultiplier: 1.0,
      boundaryMultiplier: 1.0,
      dotBias: 1.0,
      wicketMultiplier: 1.0,
      runOutRiskMultiplier: 1.0,
    },
    ATTACK: {
      id: 'ATTACK',
      label: 'Attack',
      shortLabel: 'ATTACK',
      description: 'Proactively target boundaries and gaps; modestly raises dismissal risk.',
      runMultiplier: 1.11,
      boundaryMultiplier: 1.20,
      dotBias: 0.95,
      wicketMultiplier: 1.19,
      runOutRiskMultiplier: 1.15,
    },
    ALL_OUT_ATTACK: {
      id: 'ALL_OUT_ATTACK',
      label: 'All-Out Attack',
      shortLabel: 'ALL-OUT',
      description: 'Maximum boundary intent for steep chases or final death overs; high risk/reward.',
      runMultiplier: 1.19,
      boundaryMultiplier: 1.38,
      dotBias: 0.93,
      wicketMultiplier: 1.44,
      runOutRiskMultiplier: 1.32,
    },
  },

  extrasAndFreeHit: {
    wideBaseProb: 0.030, // ~3% base wide rate before control/plan
    noBallBaseProb: 0.008, // ~0.8% base no-ball rate (triggers Free Hit)
    byeBaseProb: 0.006, // Legal delivery byes
    legByeBaseProb: 0.015, // Legal delivery leg-byes
    runOutBaseProb: 0.0038, // Base run-out probability (not credited to bowler)
    freeHitRunMultiplier: 1.32,
    freeHitBoundaryMultiplier: 1.48,
  },

  batterFatigue: {
    startBalls: 36,
    maxPenalty: 0.04,
    slopePerBall: 0.0018,
  },

  partnershipStability: {
    minBalls: 18,
    maxVolatilityDampen: 0.09,
    maxRotationBoost: 0.05,
  },

  formRegression: {
    towardNormalChance: 0.16,
  },

  wicketValue: {
    POWERPLAY: {
      disruptionBalls: 6,
      scoringMultiplier: 0.88, // Meaningful Powerplay disruption
      wicketRiskMultiplier: 1.06,
      incomingQualityMitigation: 0.42,
    },
    MIDDLE: {
      disruptionBalls: 5,
      scoringMultiplier: 0.93, // Moderate disruption
      wicketRiskMultiplier: 1.04,
      incomingQualityMitigation: 0.48,
    },
    DEATH: {
      disruptionBalls: 2,
      scoringMultiplier: 0.98, // Smaller slowdown; incoming batter swings immediately
      wicketRiskMultiplier: 1.02,
      incomingQualityMitigation: 0.65,
    },
  },

  collapsePressure: {
    triggerWickets: 2,
    windowBalls: 7, // 2+ wickets inside 7 balls triggers sudden collapse pressure
    baseScoringMultiplier: 0.86,
    baseWicketMultiplier: 1.17,
    extraEscalationPerWicket: 0.11,
    stabilizationBallsNeeded: 10,
    stabilizationWeights: {
      technique: 0.3,
      pressure: 0.28,
      consistency: 0.22,
      overallRating: 0.2,
    },
  },

  ratingWeights: {
    batting: {
      POWERPLAY: {
        powerplay: 0.34,
        paceHitting: 0.24,
        timing: 0.16,
        technique: 0.12,
        power: 0.08,
        battingRating: 0.06,
      },
      MIDDLE: {
        technique: 0.25,
        strikeRotation: 0.25,
        spinHitting: 0.2,
        consistency: 0.16,
        middleOvers: 0.14,
      },
      DEATH: {
        power: 0.24,
        finishing: 0.26,
        deathOvers: 0.22,
        pressure: 0.14,
        impactAbility: 0.14,
      },
    },
    bowling: {
      POWERPLAY: {
        powerplayBowling: 0.34,
        wicketTaking: 0.24,
        control: 0.22,
        economy: 0.12,
        bowlingRating: 0.08,
      },
      MIDDLE: {
        economy: 0.28,
        control: 0.24,
        variation: 0.22,
        middleOversBowling: 0.2,
        wicketTaking: 0.06,
      },
      DEATH: {
        deathBowling: 0.3,
        control: 0.22,
        variation: 0.18,
        economy: 0.16,
        pressure: 0.14,
      },
    },
  },

  variance: {
    teamDaySpread: 0.055,
    bowlerSpellSpread: 0.055,
    batterKnockSpread: 0.075,
    seamerSwingNightChance: 0.05,
    flatRoadNightChance: 0.05,
    chaseTargetAwareness: {
      cruiseRrrThreshold: 7.2,
      urgentRrrThreshold: 10.6,
      desperateRrrThreshold: 13.0,
      urgentRunBoost: 1.03,
      urgentWicketBoost: 1.09,
      desperateRunBoost: 1.07,
      desperateWicketBoost: 1.18,
    },
  },

  impactRecommendation: {
    POWERPLAY_COLLAPSE: {
      label: 'Powerplay Collapse Stabilization',
      description:
        'Early wickets lost inside the Powerplay — prioritize Technique, Pressure composure & Consistency to arrest the slide.',
      preferRole: 'BAT_SPECIALIST',
      weights: {
        technique: 0.35,
        pressure: 0.3,
        consistency: 0.2,
        middleOvers: 0.15,
      },
    },
    MIDDLE_VS_SPIN: {
      label: 'Middle-Overs Spin Counter',
      description:
        'Spin squeeze through overs 7–15 — prioritize Spin Hitting, Strike Rotation & Middle-Overs accumulation.',
      preferRole: 'BAT_SPECIALIST',
      weights: {
        spinHitting: 0.4,
        strikeRotation: 0.28,
        middleOvers: 0.22,
        technique: 0.1,
      },
    },
    DEATH_FINISH: {
      label: 'Death Chase / 65 Needed Off 5',
      description:
        'Steep finish required in the final 5 overs — prioritize Finishing, Power, Death Batting & Impact.',
      preferRole: 'BAT_SPECIALIST',
      weights: {
        finishing: 0.34,
        power: 0.26,
        deathOvers: 0.25,
        pressure: 0.1,
        impactAbility: 0.05,
      },
    },
    NEED_WICKETS: {
      label: 'Strike Breakthrough Needed',
      description:
        'Partnership building cleanly — prioritize Wicket Taking strike threat, Variation & Impact.',
      preferRole: 'BOWL_SPECIALIST',
      weights: {
        wicketTaking: 0.44,
        variation: 0.24,
        impactAbility: 0.18,
        pressure: 0.14,
      },
    },
    DEFENDING_DEATH: {
      label: 'Defending Final 5 Overs',
      description:
        'Tight death defence on the line — prioritize Death Bowling, Control, Variation & Economy.',
      preferRole: 'BOWL_SPECIALIST',
      weights: {
        deathBowling: 0.36,
        control: 0.24,
        variation: 0.2,
        economy: 0.2,
      },
    },
  },
};

export function getInningsPhaseForOver(overNumber1Based: number): InningsPhase {
  if (overNumber1Based <= SIM_CONFIG.phases.POWERPLAY.endOver) return 'POWERPLAY';
  if (overNumber1Based <= SIM_CONFIG.phases.MIDDLE.endOver) return 'MIDDLE';
  return 'DEATH';
}

export function getPlansForPhase(phase: InningsPhase): TacticalPlanConfig[] {
  if (phase === 'POWERPLAY') {
    return [
      SIM_CONFIG.tacticalPlans.ATTACK_WICKETS,
      SIM_CONFIG.tacticalPlans.BALANCED,
      SIM_CONFIG.tacticalPlans.PROTECT_BOUNDARIES,
    ];
  }
  if (phase === 'MIDDLE') {
    return [
      SIM_CONFIG.tacticalPlans.BUILD_PRESSURE,
      SIM_CONFIG.tacticalPlans.ATTACK_WICKETS,
      SIM_CONFIG.tacticalPlans.DEFEND_BOUNDARIES,
    ];
  }
  return [
    SIM_CONFIG.tacticalPlans.YORKER_PLAN,
    SIM_CONFIG.tacticalPlans.SLOWER_BALL_PLAN,
    SIM_CONFIG.tacticalPlans.WIDE_LINE_PLAN,
    SIM_CONFIG.tacticalPlans.ATTACK_STUMPS,
    SIM_CONFIG.tacticalPlans.MIXED_PLAN,
  ];
}

export function getDefaultPlanForPhase(phase: InningsPhase): BowlingPlanId {
  if (phase === 'POWERPLAY') return 'ATTACK_WICKETS';
  if (phase === 'MIDDLE') return 'BUILD_PRESSURE';
  return 'YORKER_PLAN';
}

export function mapSettingsDifficulty(
  diff: DraftSettings['difficulty'] | undefined
): CaptaincyDifficulty {
  if (diff === 'Casual') return 'CASUAL';
  if (diff === 'Hard') return 'EXPERT';
  return 'STANDARD';
}

