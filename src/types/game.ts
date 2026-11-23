export type CanonicalRole = 'BAT' | 'WK' | 'AR' | 'BOWL';
export type PlayerRole = CanonicalRole | 'UNKNOWN';
export type BowlingType =
  | 'Pace'
  | 'Medium Pace'
  | 'Leg Spin'
  | 'Off Spin'
  | 'Left-arm Spin'
  | 'Unknown';
export type DataQualityStatus = 'VERIFIED' | 'INFERRED' | 'NEEDS_REVIEW';
export type PlayerOriginType = 'Domestic' | 'Overseas' | 'Unknown';
export type RatingStatus = 'FINAL' | 'PROVISIONAL';

export interface CanonicalPlayerRoleNationality {
  playerId: string;
  primaryRole: CanonicalRole | null;
  roleStatus: DataQualityStatus;
  nationality: string | null;
  isOverseas: boolean | null;
  nationalityStatus: DataQualityStatus;
  bowlingType: BowlingType;
  seasonRoles?: Record<string, CanonicalRole>;
}

export interface RoleNationalityValidationReport {
  totalCanonicalPlayers: number;
  roleVerified: number;
  roleInferred: number;
  roleNeedsReview: number;
  nationalityVerified: number;
  nationalityInferred: number;
  nationalityNeedsReview: number;
  indianPlayers: number;
  overseasPlayers: number;
  unknownOriginPlayers: number;
  missingNationality: number;
  missingRole: number;
}
export type RatingBand =
  | 'Historic'
  | 'Elite'
  | 'Excellent'
  | 'Strong'
  | 'Useful'
  | 'Average/Limited'
  | 'Weak'
  | 'Non-specialist';
export type PlayerForm = 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'POOR' | 'VERY_POOR';

export interface BattingAttributes {
  power: number;
  timing: number;
  technique: number;
  strikeRotation: number;
  paceHitting: number;
  spinHitting: number;
  powerplay: number;
  middleOvers: number;
  deathOvers: number;
  chase: number;
  pressure: number;
  finishing: number;
}

export interface BowlingAttributes {
  wicketTaking: number;
  economy: number;
  powerplayBowling: number;
  middleOversBowling: number;
  deathBowling: number;
  control: number;
  variation: number;
  pressure: number;
}

export interface OtherAttributes {
  fielding: number;
  captaincy: number;
  consistency: number;
  fitness: number;
  impactAbility: number;
}

export interface PlayerDetailedAttributes {
  batting: BattingAttributes;
  bowling: BowlingAttributes;
  other: OtherAttributes;
}

export type FranchiseCode =
  | 'CSK'
  | 'MI'
  | 'RCB'
  | 'KKR'
  | 'SRH'
  | 'RR'
  | 'DC'
  | 'PBKS'
  | 'GT'
  | 'LSG'
  | 'DCH'
  | 'PWI'
  | 'RPS'
  | 'GL';

export interface FranchiseMeta {
  code: FranchiseCode;
  name: string;
  shortName: string;
  primaryColor: string;
  accentColor: string;
  activeSeasons: number[];
}

export type SalarySource = 'REAL_CONTRACT' | 'GAME_VALUE' | 'REPORTED' | 'UNAVAILABLE';

export interface IplDatabasePlayerRatings {
  bat: number;
  bowl: number;
  impact?: number;
  imp?: number;
  overall?: number;
  ovr?: number;
}

export interface IplDatabasePlayerSalary {
  salaryCr: number | null;
  gamePriceCr?: number | null;
  type?: string;
  status?: string;
  verified?: boolean;
  sourceIds?: string[];
  valueBasis?: string | null;
}

export interface IplDatabaseRatingQuality {
  status?: string;
  battingReliability?: number;
  bowlingReliability?: number;
}

export interface IplDatabasePlayerStats {
  batting?: {
    innings?: number;
    not_outs?: number;
    runs_scored?: number;
    balls_faced?: number;
    batting_average?: number;
    batting_strike_rate?: number;
    highest_score?: number;
    hundreds?: number;
    fifties?: number;
    fours?: number;
    sixes?: number;
  } | null;
  bowling?: {
    innings?: number;
    balls_bowled?: number;
    total_runs_conceded?: number;
    total_wickets?: number;
    economy_rate?: number;
    bowling_average?: number;
    bowling_strike_rate?: number;
    best_wickets?: number;
    three_wicket_hauls?: number;
    four_wicket_hauls?: number;
    five_wicket_hauls?: number;
  } | null;
}

export interface IplDatabasePlayerRaw {
  id?: string;
  playerId?: string;
  sourcePlayerId?: string;
  name?: string;
  playerName?: string;
  aliases?: string[];
  cricsheetId?: string | null;
  cricsheetName?: string | null;
  cricsheetUniqueName?: string | null;
  identityStatus?: string;
  franchise: string;
  teamName?: string;
  season: number;
  role?: string | null;
  primaryRole?: CanonicalRole | null;
  seasonRole?: CanonicalRole | null;
  roleStatus?: DataQualityStatus;
  nationality?: string | null;
  nationalityStatus?: DataQualityStatus;
  playerType?: string | null;
  isOverseas?: boolean | null;
  battingStyle?: string;
  bowlingStyle?: string;
  bowlingType?: BowlingType;
  matches?: number;
  runs?: number;
  battingAverage?: number;
  strikeRate?: number;
  wickets?: number;
  economy?: number;
  ratings?: IplDatabasePlayerRatings | null;
  bat?: number | null;
  bowl?: number | null;
  imp?: number | null;
  ovr?: number | null;
  salary?: IplDatabasePlayerSalary | null;
  salaryCr?: number | null;
  salaryVerified?: boolean;
  gamePriceCr?: number | null;
  ratingQuality?: IplDatabaseRatingQuality | null;
  stats?: IplDatabasePlayerStats | null;
  dataIncomplete?: boolean;
  // Legacy compatibility fields (never prioritized over nested objects)
  battingRating?: number;
  bowlingRating?: number;
  impactRating?: number;
  overallRating?: number;
  priceCr?: number | null;
  ratingStatus?: string;
  attributes?: PlayerDetailedAttributes;
}

export interface IplDatabaseTeamRaw {
  teamName: string;
  dataStatus?: string;
  players: IplDatabasePlayerRaw[];
}

export interface IplDatabaseJson {
  meta?: {
    title?: string;
    schemaVersion?: string;
    seasonRange?: [number, number];
    playerSeasonRecords?: number;
    uniqueCanonicalPlayers?: number;
    verifiedContracts?: number;
    statsDerivedRatings?: number;
    incompleteRatings?: number;
    unresolvedMetadata?: number;
    ratingStatus?: string;
    note?: string;
  };
  gameDefaults?: {
    startingPurseCr?: number;
    squadSize?: number;
    maxOverseasSquad?: number;
    playingXI?: number;
    maxOverseasXI?: number;
  };
  canonicalPlayers?: Record<string, CanonicalPlayerRoleNationality>;
  seasons: Record<string, Record<string, IplDatabaseTeamRaw>>;
}

export interface PlayerSeasonRecord {
  id: string;
  name: string;
  playerId: string;
  playerName: string;
  aliases?: string[];
  cricsheetId?: string | null;
  identityStatus?: string;
  season: number;
  franchise: FranchiseCode;
  teamName: string;
  nationality: string | null;
  nationalityStatus?: DataQualityStatus;
  playerType: PlayerOriginType;
  isOverseas: boolean | null;
  role: PlayerRole;
  primaryRole?: CanonicalRole | null;
  seasonRole?: CanonicalRole | null;
  roleStatus?: DataQualityStatus;
  battingStyle: string;
  bowlingStyle: string;
  bowlingType?: BowlingType;
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economy: number;
  hasRatings?: boolean;
  isIncomplete?: boolean;
  ratings?: {
    bat: number;
    bowl: number;
    impact: number;
    overall: number;
  } | null;
  salaryCr?: number | null;
  gamePriceCr?: number | null;
  salarySource?: SalarySource;
  salaryType?: string;
  salaryVerified?: boolean;
  salaryStatus?: string;
  salary?: {
    salaryCr: number | null;
    gamePriceCr?: number | null;
    verified: boolean;
    type?: string;
    status?: string;
    sourceIds?: string[];
    valueBasis?: string | null;
  };
  ratingQuality?: {
    status: string;
    battingReliability?: number;
    bowlingReliability?: number;
  };
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
  ratingBand: RatingBand;
  form: PlayerForm;
  attributes: PlayerDetailedAttributes;
  priceCr: number;
  ratingStatus: RatingStatus;
  isRetained?: boolean;
  retentionSlot?: number;
}

export interface CanonicalPlayerSummary {
  playerId: string;
  playerName: string;
  aliases: string[];
  role: PlayerRole;
  primaryRole?: CanonicalRole | null;
  roleStatus?: DataQualityStatus;
  bowlingStyle: string;
  bowlingType?: BowlingType;
  nationality?: string | null;
  nationalityStatus?: DataQualityStatus;
  isOverseas: boolean | null;
  hasRatings: boolean;
  bestOvr: number;
  bestImp: number;
  bestSeasonKey: string;
  bestRecord: PlayerSeasonRecord;
  seasons: PlayerSeasonRecord[];
}

export interface RetentionSlot {
  slotNumber: 1 | 2 | 3 | 4;
  costCr: number;
  player: PlayerSeasonRecord | null;
}

export interface RetentionState {
  targetCount: 0 | 1 | 2 | 3 | 4 | null;
  slots: RetentionSlot[];
  locked: boolean;
}

export interface SpinResult {
  franchise: FranchiseCode;
  season: number;
  comboKey: string;
  pool: PlayerSeasonRecord[];
}

export type AnimationMode = 'FULL' | 'REDUCED' | 'OFF';

export interface DraftSettings {
  franchiseName: string;
  startingPurseCr: number;
  squadSize: number;
  overseasSquadLimit: number;
  playingXIOverseasLimit: number;
  seasonStart: number;
  seasonEnd: number;
  difficulty: 'Casual' | 'Standard' | 'Hard';
  soundEnabled: boolean;
  animationEnabled: boolean;
  animationMode?: AnimationMode;
  skipMatchAnimations?: boolean;
  simSpeed: 'Normal' | 'Fast';
}

export interface CustomFranchise {
  name: string;
  code: string;
  homeCity: string;
  homeGround: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface LiveDraftTeamState {
  teamId: SeasonTeamId;
  code: string;
  name: string;
  primaryColor: string;
  secondaryColor?: string;
  isUser: boolean;
  squad: PlayerSeasonRecord[];
  remainingPurseCr: number;
  overseasCount: number;
}

export interface DraftTransaction {
  pickNumber: number;
  roundNumber: number;
  teamId: SeasonTeamId;
  teamCode: string;
  teamName: string;
  playerId: string;
  canonicalId: string;
  playerName: string;
  role: PlayerRole;
  sourceFranchise: FranchiseCode;
  sourceSeason: number;
  salaryCr: number | null;
  isRetained?: boolean;
}

export interface LeagueDraftValidation {
  isValid: boolean;
  errors: string[];
  totalTeams: number;
  totalRosterSlots: number;
  uniqueCanonicalPlayers: number;
  duplicateCanonicalIds: string[];
}

export interface LiveLeagueDraftState {
  teams: Record<SeasonTeamId, LiveDraftTeamState>;
  teamOrder: SeasonTeamId[];
  ownedPlayerIds: string[];
  playerOwners: Record<string, SeasonTeamId>;
  feed: DraftTransaction[];
  lastRoundTransactions: DraftTransaction[];
  totalPicks: number;
  roundNumber: number;
  validation: LeagueDraftValidation | null;
}

export interface DraftState {
  settings: DraftSettings;
  customFranchise: CustomFranchise | null;
  remainingPurseCr: number;
  squad: PlayerSeasonRecord[];
  draftedPlayerIds: string[];
  usedComboKeys: string[];
  currentSpin: SpinResult | null;
  retention: RetentionState;
  liveLeague?: LiveLeagueDraftState | null;
  status: 'READY_TO_SPIN' | 'PICKING_PLAYER' | 'COMPLETED';
}

export type ScreenTab = 'HOME' | 'DRAFT' | 'SQUAD' | 'FIXTURES' | 'STANDINGS' | 'STATS';

export type BowlerType = 'PACE' | 'SPIN' | 'NONE';

export interface PlayingXIState {
  playingXiIds: string[];
  captainId: string | null;
  wicketkeeperId: string | null;
  isConfirmed: boolean;
}

export interface PlayingXIValidation {
  isValid: boolean;
  errors: string[];
  xiPlayers: PlayerSeasonRecord[];
  benchPlayers: PlayerSeasonRecord[];
  overseasCount: number;
  indianCount: number;
  wicketkeepersInXI: PlayerSeasonRecord[];
}

export interface BowlingOptionsBreakdown {
  primaryBowlers: Array<PlayerSeasonRecord & { bowlerType: BowlerType }>;
  allRounders: Array<PlayerSeasonRecord & { bowlerType: BowlerType }>;
  partTimers: Array<PlayerSeasonRecord & { bowlerType: BowlerType }>;
}

export interface TeamSummary {
  battingRating: number;
  bowlingRating: number;
  overallRating: number;
  indianCount: number;
  overseasCount: number;
  captainName: string | null;
  keeperName: string | null;
}

export type SelectionBlockReason =
  | 'SQUAD_FULL'
  | 'ALREADY_DRAFTED'
  | 'OVERSEAS_LIMIT'
  | 'INSUFFICIENT_PURSE';

export interface SelectionCheck {
  allowed: boolean;
  reason?: SelectionBlockReason;
  label?: string;
  ownerTeamId?: SeasonTeamId;
  ownerTeamCode?: string;
}

export type SeasonTeamId = 'YOU' | FranchiseCode;

export interface SeasonTeam {
  id: SeasonTeamId;
  code: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor?: string;
  homeCity?: string;
  homeVenue: string;
  homePitch?: PitchCondition;
  isUser: boolean;
  sourceSeason?: number;
  players: PlayerSeasonRecord[];
  squad?: PlayerSeasonRecord[];
  impactBench?: PlayerSeasonRecord[];
}

export type PitchCondition =
  | 'BATTING_PARADISE'
  | 'BALANCED'
  | 'SPIN_FRIENDLY'
  | 'PACE_SEAMER'
  | 'SLOW_AND_LOW'
  | 'SWINGING';

export type CaptaincyDifficulty = 'CASUAL' | 'STANDARD' | 'EXPERT';

export type PowerplayBowlingPlan = 'ATTACK_WICKETS' | 'BALANCED' | 'PROTECT_BOUNDARIES';
export type MiddleBowlingPlan = 'BUILD_PRESSURE' | 'ATTACK_WICKETS' | 'DEFEND_BOUNDARIES';
export type DeathBowlingPlan =
  | 'YORKER_PLAN'
  | 'SLOWER_BALL_PLAN'
  | 'WIDE_LINE_PLAN'
  | 'ATTACK_STUMPS'
  | 'MIXED_PLAN';

export type BowlingPlanId =
  | PowerplayBowlingPlan
  | MiddleBowlingPlan
  | DeathBowlingPlan;

export type MatchupRating = 'STRONG_MATCHUP' | 'EVEN_MATCHUP' | 'RISKY_MATCHUP';

export type BowlerDisabledReason =
  | 'MAXIMUM 4 OVERS COMPLETE'
  | 'BOWLED PREVIOUS OVER'
  | 'SUBSTITUTED OUT'
  | 'NOT ELIGIBLE TO BOWL'
  | 'INNINGS COMPLETE';

export interface BowlerEligibilityOption {
  player: PlayerSeasonRecord;
  bowlerType: BowlerType;
  isPartTimer: boolean;
  eligible: boolean;
  canBowlNow: boolean;
  disabledReason?: BowlerDisabledReason;
  oversBowled: number;
  ballsBowled: number;
  oversRemaining: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  currentSpellOvers: number;
  phaseSuitability: 'HIGH' | 'MEDIUM' | 'LOW';
  pitchSuitability: 'HIGH' | 'MEDIUM' | 'LOW';
  matchup: MatchupRating;
  matchupSummary: string;
  autoScore: number;
  isRecommended: boolean;
}

export interface OverSummaryLine {
  overNumber: number; // 1..20
  phase: InningsPhase;
  bowlerId: string;
  bowlerName: string;
  bowlerType: BowlerType;
  planId: BowlingPlanId;
  runs: number;
  wickets: number;
  dots: number;
  fours: number;
  sixes: number;
  wides: number;
  noBalls: number;
  isMaiden: boolean;
  cumulativeRuns: number;
  cumulativeWickets: number;
  ballsSequence: string[]; // e.g. ['1', '0', 'W', '4', 'Wd', '2']
  bowlerSpellFigures: string; // e.g. '3-0-22-2'
  wicketBatterNames: string[];
}

export interface VenueMemoryStats {
  venue: string;
  matches: number;
  totalFirstInnRuns: number;
  totalFirstInnWkts: number;
  totalSecondInnRuns: number;
  batFirstWins: number;
  chaseWins: number;
  highestScore: number;
  lowestDefended: number | null;
}

export const SIMULATION_VERSION = '1.0.0' as const;

export type BattingAggressionMode =
  | 'STABILIZE'
  | 'ROTATE_STRIKE'
  | 'BALANCED'
  | 'ATTACK'
  | 'ALL_OUT_ATTACK';

export type DismissalType =
  | 'Bowled'
  | 'Caught'
  | 'LBW'
  | 'Stumped'
  | 'Run out'
  | 'Hit wicket'
  | 'Caught & bowled';

export type DeliveryExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';

export interface DeliveryEvent {
  ballNumber: number; // Overall sequence index (1-based)
  legalBallNumber: number; // Legal ball in innings (0..120)
  overNumber: number; // 1..20
  ballInOver: number; // Legal ball within over (0..6)
  phase: InningsPhase;
  outcome: string; // '0' | '1' | '2' | '3' | '4' | '6' | 'W' | 'Wd' | 'NB' | 'B1'..'B4' | 'LB1'..'LB4'
  runs: number; // Total runs added to team score
  batterRuns: number;
  extrasRuns: number;
  extraType: DeliveryExtraType;
  isLegal: boolean;
  isWicket: boolean;
  dismissalType?: DismissalType;
  dismissedBatterId?: string;
  bowlerCreditedWicket: boolean;
  isFreeHit: boolean;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  aggressionMode: BattingAggressionMode;
  bowlingPlan: BowlingPlanId;
  commentary: string;
}

export interface SuperOverInningsSummary {
  teamId: SeasonTeamId;
  runs: number;
  wickets: number;
  balls: number;
  ballsSequence: string[];
}

export interface SuperOverSummary {
  round: number;
  firstTeam: SuperOverInningsSummary;
  secondTeam: SuperOverInningsSummary;
  winnerId: SeasonTeamId | 'TIE';
}

export interface TossInfo {
  callerTeamId: SeasonTeamId;
  call: 'HEADS' | 'TAILS';
  outcome: 'HEADS' | 'TAILS';
  winnerTeamId: SeasonTeamId;
  decision: 'BAT' | 'BOWL';
}

export interface BatterScorecardLine {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  dismissalText: string;
  impactPoints: number;
  isImpactIn?: boolean;
  isSubbedOut?: boolean;
}

export interface BowlerScorecardLine {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  bowlerType?: BowlerType;
  overs: number;
  ballsBowled?: number;
  maidens?: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  dots?: number;
  foursConceded?: number;
  sixesConceded?: number;
  wides?: number;
  noBalls?: number;
  impactPoints: number;
  isImpactIn?: boolean;
  isSubbedOut?: boolean;
}

export type InningsPhase = 'POWERPLAY' | 'MIDDLE' | 'DEATH';

export interface PhaseSplit {
  phase: InningsPhase;
  label: string;
  runs: number;
  wickets: number;
  balls: number;
  fours: number;
  sixes: number;
  runRate: number;
}

export interface FallOfWicketLine {
  wicketNumber: number;
  runs: number;
  overLabel: string;
  batterId: string;
  batterName: string;
  phase: InningsPhase;
}

export interface PartnershipLine {
  wicketNumber: number;
  batter1Name: string;
  batter2Name: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  dots?: number;
  runRate?: number;
}

export type ImpactSituationType =
  | 'POWERPLAY_COLLAPSE'
  | 'MIDDLE_VS_SPIN'
  | 'DEATH_FINISH'
  | 'NEED_WICKETS'
  | 'DEFENDING_DEATH';

export interface ImpactRecommendation {
  playerId: string;
  playerName: string;
  situation: ImpactSituationType;
  situationLabel: string;
  tacticalScore: number;
  headlineReason: string;
  keyAttributes: Array<{ label: string; value: number }>;
  suggestedOutId: string | null;
  suggestedOutName: string | null;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface InningsScorecard {
  teamId: SeasonTeamId;
  runs: number;
  wickets: number;
  overs: number;
  legalBalls?: number;
  batting: BatterScorecardLine[];
  bowling: BowlerScorecardLine[];
  extras: number;
  extrasBreakdown?: ExtrasBreakdown;
  runRate: number;
  phaseSplits?: PhaseSplit[];
  fallOfWickets?: FallOfWicketLine[];
  partnerships?: PartnershipLine[];
  collapseEvents?: number;
  overHistory?: OverSummaryLine[];
}

export type HighlightBadge =
  | '50 UP!'
  | '100 UP!'
  | 'WICKET!'
  | 'COLLAPSE ALERT'
  | 'RECOVERY'
  | 'DEATH SURGE'
  | '50 PARTNERSHIP'
  | 'FIFTY'
  | 'CENTURY'
  | '3 WICKETS'
  | 'IMPACT PLAYER ACTIVATED'
  | 'VICTORY!';

export interface MatchHighlightEvent {
  id: string;
  inningsNumber: 1 | 2;
  phase?: InningsPhase;
  overLabel: string;
  teamId: SeasonTeamId;
  scoreSnapshot: string;
  runRateSnapshot: string;
  requiredRateSnapshot: string | null;
  badge: HighlightBadge;
  title: string;
  detail: string;
  progressPct: number;
}

export interface ImpactSubstitution {
  teamId: SeasonTeamId;
  inPlayerId: string;
  inPlayerName: string;
  outPlayerId: string;
  outPlayerName: string;
  overLabel: string;
  wasFifthOverseas: boolean;
}

export interface InningsSummary {
  teamId: SeasonTeamId;
  runs: number;
  wickets: number;
  overs: number; // e.g. 20, 19.4, 18.2
  oversForNrr: number; // Decimal overs; 20.0 when bowled out (wickets === 10)
}

export interface MatchResult {
  simulationVersion?: string;
  matchSeed?: string | number;
  battingFirstTeamId: SeasonTeamId;
  battingSecondTeamId: SeasonTeamId;
  firstInnings: InningsSummary;
  secondInnings: InningsSummary;
  winnerId: SeasonTeamId;
  loserId: SeasonTeamId;
  marginText: string; // e.g. "Win by 13 runs" or "Won by 5 wickets"
  superOver: boolean;
  superOverCount?: number;
  superOverHistory?: SuperOverSummary[];
  pitchCondition?: PitchCondition;
  toss?: TossInfo;
  firstScorecard?: InningsScorecard;
  secondScorecard?: InningsScorecard;
  highlights?: MatchHighlightEvent[];
  playerOfTheMatch?: {
    playerId: string;
    playerName: string;
    teamId: SeasonTeamId;
    summary: string;
    impactPoints: number;
  };
  bestImpact?: {
    playerId: string;
    playerName: string;
    teamId: SeasonTeamId;
    summary: string;
    impactPoints: number;
  };
  keyMoment?: string;
  impactSub?: ImpactSubstitution;
}

export interface SeasonFixture {
  id: string;
  round: number; // 1..22
  matchNumber: number; // 1..110 overall
  userMatchNumber: number | null; // 1..20 for user fixtures
  homeTeamId: SeasonTeamId;
  awayTeamId: SeasonTeamId;
  venue: string;
  status: 'SCHEDULED' | 'COMPLETED';
  result: MatchResult | null;
}

export type PlayoffRoundId = 'Q1' | 'ELIM' | 'Q2' | 'FINAL';

export interface PlayoffFixture {
  id: PlayoffRoundId;
  label: string;
  subtitle: string;
  venue: string;
  homeTeamId: SeasonTeamId | null;
  awayTeamId: SeasonTeamId | null;
  homeSeedLabel: string;
  awaySeedLabel: string;
  status: 'LOCKED' | 'READY' | 'COMPLETED';
  result: MatchResult | null;
}

export interface PointsTableRow {
  teamId: SeasonTeamId;
  played: number;
  won: number;
  lost: number;
  points: number;
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
  nrr: number;
}

export type Challenge20Status = 'ALIVE' | 'COMPLETED' | 'FAILED';
export type Challenge14Status = Challenge20Status;

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  teamId: SeasonTeamId;
  role: PlayerRole;
  isOverseas: boolean | null;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highestScore: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  oversBowled: number;
  maidens?: number;
  dots?: number;
  wides?: number;
  noBalls?: number;
  runsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  impactPoints: number;
  potmCount: number;
}

export interface SeasonStatsContainer {
  matchesSimulated: number;
  highestUserScore: number;
  playerStats: Record<string, PlayerSeasonStats>;
}

export interface TransferImpactNotice {
  playerCanonicalId: string;
  playerName: string;
  originalFranchise: FranchiseCode;
  draftedByFranchise: string;
  draftedByName: string;
  isInformationalOnly: true;
  message: string;
}

export interface SeasonState {
  simulationVersion?: string;
  seasonNumber: number;
  teams: Record<SeasonTeamId, SeasonTeam>;
  teamOrder: SeasonTeamId[];
  fixtures: SeasonFixture[];
  pointsTable: PointsTableRow[];
  playoffs: Record<PlayoffRoundId, PlayoffFixture>;
  phase: 'LEAGUE' | 'PLAYOFFS' | 'COMPLETED';
  championTeamId: SeasonTeamId | null;
  userQualified: boolean | null;
  challenge14Status: Challenge14Status;
  challengeBrokenAtMatch: number | null;
  playerForms: Record<string, PlayerForm>;
  stats: SeasonStatsContainer;
  venueStats?: Record<string, VenueMemoryStats>;
  userBench?: PlayerSeasonRecord[];
  transferImpactNotices?: TransferImpactNotice[];
  impactHistory?: Array<{
    matchId: string;
    matchLabel: string;
    inPlayerId: string;
    inPlayerName: string;
    outPlayerId: string;
    outPlayerName: string;
    overLabel: string;
  }>;
}

export interface CareerAchievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAtSeason?: number;
}

export interface CareerStats {
  seasonsPlayed: number;
  titlesWon: number;
  bestFinish: string;
  bestPosition: number | null;
  achievements: CareerAchievement[];
}


