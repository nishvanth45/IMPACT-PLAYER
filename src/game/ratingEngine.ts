import type {
  BattingAttributes,
  BowlingAttributes,
  FranchiseCode,
  OtherAttributes,
  PlayerDetailedAttributes,
  PlayerForm,
  PlayerRole,
  RatingBand,
} from '../types/game';

export const RATING_MIN = 20;
export const RATING_MAX = 99;

export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return RATING_MIN;
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(value)));
}

export function getRatingBand(rating: number): RatingBand {
  const r = clampRating(rating);
  if (r >= 95) return 'Historic';
  if (r >= 90) return 'Elite';
  if (r >= 84) return 'Excellent';
  if (r >= 76) return 'Strong';
  if (r >= 67) return 'Useful';
  if (r >= 55) return 'Average/Limited';
  if (r >= 40) return 'Weak';
  return 'Non-specialist';
}

export function getRatingBandColorClass(band: RatingBand): string {
  switch (band) {
    case 'Historic':
      return 'text-amber-900 border-amber-600/50 bg-amber-100';
    case 'Elite':
      return 'text-purple-900 border-purple-600/45 bg-purple-100';
    case 'Excellent':
      return 'text-emerald-900 border-emerald-600/45 bg-emerald-100';
    case 'Strong':
      return 'text-blue-900 border-blue-600/45 bg-blue-100';
    case 'Useful':
      return 'text-slate-800 border-slate-500/40 bg-slate-200/70';
    case 'Average/Limited':
      return 'text-stone-700 border-stone-400/50 bg-stone-200/70';
    case 'Weak':
      return 'text-orange-900 border-orange-500/45 bg-orange-100';
    case 'Non-specialist':
    default:
      return 'text-stone-600 border-stone-300 bg-stone-100';
  }
}

export interface FormMeta {
  id: PlayerForm;
  icon: string;
  label: string;
  shortLabel: string;
  modifier: number;
  badgeClass: string;
  darkBadgeClass: string;
}

export const FORM_ORDER: readonly PlayerForm[] = [
  'VERY_POOR',
  'POOR',
  'NORMAL',
  'GOOD',
  'EXCELLENT',
] as const;

export const FORM_META: Record<PlayerForm, FormMeta> = {
  EXCELLENT: {
    id: 'EXCELLENT',
    icon: '🔥',
    label: 'Excellent',
    shortLabel: '🔥 Excellent',
    modifier: 4,
    badgeClass: 'border-amber-600/45 bg-amber-100 text-amber-900',
    darkBadgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  },
  GOOD: {
    id: 'GOOD',
    icon: '↑',
    label: 'Good',
    shortLabel: '↑ Good',
    modifier: 2,
    badgeClass: 'border-emerald-700/40 bg-emerald-100 text-emerald-900',
    darkBadgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  },
  NORMAL: {
    id: 'NORMAL',
    icon: '→',
    label: 'Normal',
    shortLabel: '→ Normal',
    modifier: 0,
    badgeClass: 'border-stone-400/50 bg-stone-100 text-stone-800',
    darkBadgeClass: 'border-white/15 bg-slate-800/70 text-slate-300',
  },
  POOR: {
    id: 'POOR',
    icon: '↓',
    label: 'Poor',
    shortLabel: '↓ Poor',
    modifier: -2,
    badgeClass: 'border-orange-600/45 bg-orange-100 text-orange-900',
    darkBadgeClass: 'border-orange-400/35 bg-orange-500/15 text-orange-300',
  },
  VERY_POOR: {
    id: 'VERY_POOR',
    icon: '❄',
    label: 'Very Poor',
    shortLabel: '❄ Very Poor',
    modifier: -4,
    badgeClass: 'border-sky-700/40 bg-sky-100 text-sky-900',
    darkBadgeClass: 'border-sky-400/35 bg-sky-500/15 text-sky-300',
  },
};

export function getPlayerFormMeta(form: PlayerForm = 'NORMAL'): FormMeta {
  return FORM_META[form] ?? FORM_META.NORMAL;
}

export function getPlayerFormModifier(form: PlayerForm = 'NORMAL'): number {
  return getPlayerFormMeta(form).modifier;
}

export function shiftPlayerForm(current: PlayerForm, delta: -1 | 0 | 1): PlayerForm {
  if (delta === 0) return current;
  const idx = FORM_ORDER.indexOf(current);
  const safeIdx = idx >= 0 ? idx : 2;
  const nextIdx = Math.max(0, Math.min(FORM_ORDER.length - 1, safeIdx + delta));
  return FORM_ORDER[nextIdx];
}

export function getEffectiveMatchRatings(
  ratings: {
    battingRating: number;
    bowlingRating: number;
    impactRating: number;
    overallRating: number;
  },
  form: PlayerForm = 'NORMAL'
) {
  const mod = getPlayerFormModifier(form);
  return {
    battingRating: clampRating(ratings.battingRating + mod),
    bowlingRating: clampRating(ratings.bowlingRating + mod),
    impactRating: clampRating(ratings.impactRating + mod),
    overallRating: clampRating(ratings.overallRating + mod),
    formModifier: mod,
  };
}

/**
 * Deterministic 32-bit FNV-1a hash so ratings never shift randomly across game loads.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Returns deterministic float in [0, 1) for a seed key.
 */
function seededUnit(key: string): number {
  return (fnv1a32(key) % 10000) / 10000;
}

/**
 * Returns deterministic signed offset in [-spread, +spread].
 */
function seededOffset(key: string, spread: number): number {
  return (seededUnit(key) * 2 - 1) * spread;
}

type BatterArchetype = 'ANCHOR' | 'OPENER' | 'FINISHER' | 'ALL_PHASE';
type BowlerArchetype = 'DEATH_EXPRESS' | 'POWERPLAY_SWING' | 'STRIKE_SPINNER' | 'CONTAINMENT';

interface CuratedPlayerProfile {
  baseTier: number; // ~74..92 baseline prime level
  peakSeasons: number[];
  peakBoost?: number;
  battingTilt?: number;
  bowlingTilt?: number;
  impactBoost?: number;
  leadership?: number;
  batStyle?: BatterArchetype;
  bowlStyle?: BowlerArchetype;
  seasonOverrides?: Record<number, { bat?: number; bowl?: number; imp?: number }>;
}

const CURATED_PLAYERS: Record<string, CuratedPlayerProfile> = {
  'virat-kohli': {
    baseTier: 88,
    peakSeasons: [2013, 2016, 2018, 2023, 2024, 2025],
    peakBoost: 6,
    impactBoost: 3,
    leadership: 92,
    batStyle: 'ANCHOR',
    seasonOverrides: {
      2016: { bat: 98, imp: 95 },
      2023: { bat: 92, imp: 88 },
      2024: { bat: 94, imp: 91 },
    },
  },
  'ab-de-villiers': {
    baseTier: 90,
    peakSeasons: [2015, 2016, 2018, 2020],
    peakBoost: 5,
    impactBoost: 7,
    leadership: 84,
    batStyle: 'ALL_PHASE',
    seasonOverrides: {
      2015: { bat: 95, imp: 96 },
      2016: { bat: 96, imp: 97 },
    },
  },
  'chris-gayle': {
    baseTier: 86,
    peakSeasons: [2011, 2012, 2013, 2015],
    peakBoost: 7,
    impactBoost: 7,
    batStyle: 'OPENER',
    seasonOverrides: {
      2011: { bat: 95, imp: 96 },
      2012: { bat: 96, imp: 96 },
      2013: { bat: 95, imp: 95 },
    },
  },
  'david-warner': {
    baseTier: 88,
    peakSeasons: [2015, 2016, 2017, 2019],
    peakBoost: 6,
    impactBoost: 5,
    leadership: 90,
    batStyle: 'OPENER',
    seasonOverrides: {
      2016: { bat: 96, imp: 95 },
      2019: { bat: 94, imp: 92 },
    },
  },
  'ms-dhoni': {
    baseTier: 85,
    peakSeasons: [2010, 2013, 2018, 2019],
    peakBoost: 5,
    impactBoost: 9,
    leadership: 98,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2013: { bat: 90, imp: 95 },
      2018: { bat: 91, imp: 96 },
      2019: { bat: 89, imp: 94 },
    },
  },
  'rohit-sharma': {
    baseTier: 85,
    peakSeasons: [2013, 2015, 2016, 2020, 2024],
    peakBoost: 4,
    impactBoost: 5,
    leadership: 96,
    batStyle: 'OPENER',
    seasonOverrides: {
      2015: { bat: 90, imp: 91 },
      2024: { bat: 88, imp: 91 },
    },
  },
  'suresh-raina': {
    baseTier: 86,
    peakSeasons: [2010, 2012, 2013, 2014],
    peakBoost: 5,
    impactBoost: 6,
    leadership: 86,
    batStyle: 'ALL_PHASE',
    seasonOverrides: {
      2013: { bat: 92, imp: 93 },
      2014: { bat: 91, imp: 94 },
    },
  },
  'gautam-gambhir': {
    baseTier: 83,
    peakSeasons: [2012, 2014, 2016, 2017],
    peakBoost: 5,
    impactBoost: 3,
    leadership: 94,
    batStyle: 'ANCHOR',
    seasonOverrides: {
      2012: { bat: 90, imp: 88 },
      2014: { bat: 87, imp: 86 },
    },
  },
  'surya-kumar-yadav': {
    baseTier: 85,
    peakSeasons: [2020, 2023, 2024, 2025],
    peakBoost: 7,
    impactBoost: 7,
    batStyle: 'ALL_PHASE',
    seasonOverrides: {
      2023: { bat: 94, imp: 96 },
      2025: { bat: 93, imp: 95 },
    },
  },
  'jos-buttler': {
    baseTier: 87,
    peakSeasons: [2018, 2022, 2024, 2025],
    peakBoost: 7,
    impactBoost: 6,
    leadership: 85,
    batStyle: 'OPENER',
    seasonOverrides: {
      2022: { bat: 96, imp: 95 },
    },
  },
  'kl-rahul': {
    baseTier: 86,
    peakSeasons: [2018, 2020, 2021, 2022],
    peakBoost: 5,
    impactBoost: 1,
    leadership: 83,
    batStyle: 'ANCHOR',
    seasonOverrides: {
      2018: { bat: 92, imp: 90 },
      2020: { bat: 93, imp: 87 },
    },
  },
  'rishabh-pant': {
    baseTier: 84,
    peakSeasons: [2018, 2019, 2024],
    peakBoost: 6,
    impactBoost: 7,
    leadership: 84,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2018: { bat: 93, imp: 95 },
    },
  },
  'shubman-gill': {
    baseTier: 83,
    peakSeasons: [2023, 2024, 2025],
    peakBoost: 7,
    impactBoost: 2,
    leadership: 84,
    batStyle: 'ANCHOR',
    seasonOverrides: {
      2023: { bat: 95, imp: 91 },
    },
  },
  'sanju-samson': {
    baseTier: 82,
    peakSeasons: [2021, 2024, 2025],
    peakBoost: 5,
    impactBoost: 5,
    leadership: 85,
    batStyle: 'ALL_PHASE',
  },
  'shreyas-iyer': {
    baseTier: 82,
    peakSeasons: [2019, 2020, 2024, 2025],
    peakBoost: 5,
    impactBoost: 4,
    leadership: 91,
    batStyle: 'ALL_PHASE',
  },
  'ruturaj-gaikwad': {
    baseTier: 83,
    peakSeasons: [2021, 2023, 2024],
    peakBoost: 6,
    impactBoost: 2,
    leadership: 82,
    batStyle: 'ANCHOR',
    seasonOverrides: {
      2021: { bat: 91, imp: 89 },
    },
  },
  'yashasvi-jaiswal': {
    baseTier: 83,
    peakSeasons: [2023, 2024, 2025],
    peakBoost: 6,
    impactBoost: 6,
    batStyle: 'OPENER',
    seasonOverrides: {
      2023: { bat: 91, imp: 93 },
    },
  },
  'rinku-singh': {
    baseTier: 78,
    peakSeasons: [2023, 2024],
    peakBoost: 5,
    impactBoost: 10,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2023: { bat: 84, imp: 93 },
    },
  },
  'heinrich-klaasen': {
    baseTier: 84,
    peakSeasons: [2023, 2024, 2025],
    peakBoost: 7,
    impactBoost: 9,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2024: { bat: 92, imp: 96 },
    },
  },
  'nicholas-pooran': {
    baseTier: 83,
    peakSeasons: [2020, 2023, 2024, 2025],
    peakBoost: 6,
    impactBoost: 8,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2024: { bat: 90, imp: 95 },
    },
  },
  'faf-du-plessis': {
    baseTier: 84,
    peakSeasons: [2021, 2023, 2024],
    peakBoost: 5,
    impactBoost: 4,
    leadership: 89,
    batStyle: 'OPENER',
    seasonOverrides: {
      2023: { bat: 92, imp: 91 },
    },
  },
  'shikhar-dhawan': {
    baseTier: 84,
    peakSeasons: [2016, 2019, 2020, 2021],
    peakBoost: 4,
    impactBoost: 2,
    leadership: 82,
    batStyle: 'OPENER',
  },
  'travis-head': {
    baseTier: 84,
    peakSeasons: [2024, 2025],
    peakBoost: 7,
    impactBoost: 8,
    batStyle: 'OPENER',
    seasonOverrides: {
      2024: { bat: 92, imp: 96 },
    },
  },
  'abhishek-sharma': {
    baseTier: 80,
    peakSeasons: [2024, 2025],
    peakBoost: 7,
    impactBoost: 9,
    batStyle: 'OPENER',
    seasonOverrides: {
      2024: { bat: 88, imp: 94 },
    },
  },
  'andre-russell': {
    baseTier: 84,
    peakSeasons: [2015, 2018, 2019, 2024],
    peakBoost: 6,
    battingTilt: 4,
    bowlingTilt: -2,
    impactBoost: 11,
    batStyle: 'FINISHER',
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2019: { bat: 93, bowl: 80, imp: 98 },
    },
  },
  'sunil-narine': {
    baseTier: 85,
    peakSeasons: [2012, 2014, 2017, 2018, 2024],
    peakBoost: 6,
    battingTilt: 2,
    bowlingTilt: 5,
    impactBoost: 8,
    batStyle: 'OPENER',
    bowlStyle: 'STRIKE_SPINNER',
    seasonOverrides: {
      2012: { bowl: 95, imp: 95 },
      2014: { bowl: 93, imp: 93 },
      2024: { bat: 88, bowl: 90, imp: 97 },
    },
  },
  'kieron-pollard': {
    baseTier: 82,
    peakSeasons: [2010, 2013, 2019, 2020],
    peakBoost: 5,
    battingTilt: 5,
    bowlingTilt: -6,
    impactBoost: 10,
    leadership: 86,
    batStyle: 'FINISHER',
    seasonOverrides: {
      2020: { bat: 88, bowl: 72, imp: 94 },
    },
  },
  'hardik-pandya': {
    baseTier: 83,
    peakSeasons: [2019, 2022, 2023],
    peakBoost: 6,
    battingTilt: 4,
    bowlingTilt: 0,
    impactBoost: 8,
    leadership: 86,
    batStyle: 'FINISHER',
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2019: { bat: 90, bowl: 80, imp: 95 },
      2022: { bat: 89, bowl: 81, imp: 92 },
    },
  },
  'ravindra-jadeja': {
    baseTier: 83,
    peakSeasons: [2014, 2020, 2021, 2023],
    peakBoost: 5,
    battingTilt: 0,
    bowlingTilt: 4,
    impactBoost: 6,
    batStyle: 'FINISHER',
    bowlStyle: 'CONTAINMENT',
    seasonOverrides: {
      2021: { bat: 86, bowl: 86, imp: 92 },
    },
  },
  'shane-watson': {
    baseTier: 84,
    peakSeasons: [2008, 2013, 2018],
    peakBoost: 6,
    battingTilt: 4,
    bowlingTilt: 1,
    impactBoost: 7,
    leadership: 85,
    batStyle: 'OPENER',
    bowlStyle: 'POWERPLAY_SWING',
    seasonOverrides: {
      2008: { bat: 91, bowl: 87, imp: 95 },
      2013: { bat: 90, bowl: 84, imp: 93 },
    },
  },
  'dwayne-bravo': {
    baseTier: 82,
    peakSeasons: [2012, 2013, 2015, 2018],
    peakBoost: 6,
    battingTilt: -5,
    bowlingTilt: 7,
    impactBoost: 8,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2013: { bowl: 93, imp: 94 },
      2015: { bowl: 92, imp: 93 },
    },
  },
  'glenn-maxwell': {
    baseTier: 81,
    peakSeasons: [2014, 2021, 2023],
    peakBoost: 7,
    battingTilt: 5,
    bowlingTilt: -6,
    impactBoost: 9,
    batStyle: 'ALL_PHASE',
    seasonOverrides: {
      2014: { bat: 92, bowl: 68, imp: 96 },
      2021: { bat: 89, bowl: 71, imp: 92 },
    },
  },
  'axar-patel': {
    baseTier: 81,
    peakSeasons: [2020, 2023, 2024, 2025],
    peakBoost: 5,
    battingTilt: -2,
    bowlingTilt: 5,
    impactBoost: 5,
    leadership: 83,
    bowlStyle: 'CONTAINMENT',
  },
  'jasprit-bumrah': {
    baseTier: 91,
    peakSeasons: [2017, 2019, 2020, 2024, 2025],
    peakBoost: 5,
    impactBoost: 7,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2020: { bowl: 96, imp: 96 },
      2024: { bowl: 98, imp: 97 },
    },
  },
  'lasith-malinga': {
    baseTier: 89,
    peakSeasons: [2011, 2012, 2013, 2015, 2019],
    peakBoost: 6,
    impactBoost: 8,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2011: { bowl: 96, imp: 97 },
    },
  },
  'rashid-khan': {
    baseTier: 90,
    peakSeasons: [2018, 2020, 2022, 2023],
    peakBoost: 4,
    impactBoost: 7,
    leadership: 83,
    bowlStyle: 'STRIKE_SPINNER',
    seasonOverrides: {
      2018: { bowl: 95, imp: 95 },
      2023: { bowl: 93, imp: 95 },
    },
  },
  'yuzvendra-chahal': {
    baseTier: 86,
    peakSeasons: [2016, 2020, 2022, 2023],
    peakBoost: 5,
    impactBoost: 6,
    bowlStyle: 'STRIKE_SPINNER',
    seasonOverrides: {
      2022: { bowl: 93, imp: 93 },
    },
  },
  'bhuvneshwar-kumar': {
    baseTier: 85,
    peakSeasons: [2016, 2017, 2022],
    peakBoost: 6,
    impactBoost: 5,
    leadership: 82,
    bowlStyle: 'POWERPLAY_SWING',
    seasonOverrides: {
      2016: { bowl: 92, imp: 91 },
      2017: { bowl: 93, imp: 92 },
    },
  },
  'kagiso-rabada': {
    baseTier: 86,
    peakSeasons: [2019, 2020, 2022],
    peakBoost: 5,
    impactBoost: 6,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2020: { bowl: 93, imp: 94 },
    },
  },
  'trent-boult': {
    baseTier: 85,
    peakSeasons: [2020, 2022, 2024, 2025],
    peakBoost: 5,
    impactBoost: 6,
    bowlStyle: 'POWERPLAY_SWING',
    seasonOverrides: {
      2020: { bowl: 92, imp: 93 },
    },
  },
  'mitchell-starc': {
    baseTier: 84,
    peakSeasons: [2014, 2015, 2024],
    peakBoost: 6,
    impactBoost: 7,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2015: { bowl: 92, imp: 93 },
      2024: { bowl: 89, imp: 93 },
    },
  },
  'pat-cummins': {
    baseTier: 83,
    peakSeasons: [2020, 2024, 2025],
    peakBoost: 5,
    impactBoost: 6,
    leadership: 93,
    bowlStyle: 'DEATH_EXPRESS',
  },
  'kuldeep-yadav': {
    baseTier: 83,
    peakSeasons: [2018, 2022, 2024, 2025],
    peakBoost: 6,
    impactBoost: 6,
    bowlStyle: 'STRIKE_SPINNER',
    seasonOverrides: {
      2024: { bowl: 90, imp: 91 },
    },
  },
  'varun-chakaravarthy': {
    baseTier: 83,
    peakSeasons: [2020, 2021, 2024, 2025],
    peakBoost: 6,
    impactBoost: 6,
    bowlStyle: 'STRIKE_SPINNER',
    seasonOverrides: {
      2024: { bowl: 91, imp: 92 },
    },
  },
  'matheesha-pathirana': {
    baseTier: 82,
    peakSeasons: [2023, 2024],
    peakBoost: 7,
    impactBoost: 9,
    bowlStyle: 'DEATH_EXPRESS',
    seasonOverrides: {
      2024: { bowl: 90, imp: 94 },
    },
  },
  'mohammad-shami': {
    baseTier: 84,
    peakSeasons: [2020, 2022, 2023],
    peakBoost: 6,
    impactBoost: 6,
    bowlStyle: 'POWERPLAY_SWING',
    seasonOverrides: {
      2023: { bowl: 93, imp: 92 },
    },
  },
  'arshdeep-singh': {
    baseTier: 82,
    peakSeasons: [2022, 2023, 2024, 2025],
    peakBoost: 5,
    impactBoost: 6,
    bowlStyle: 'DEATH_EXPRESS',
  },
  'ravichandran-ashwin': {
    baseTier: 83,
    peakSeasons: [2010, 2011, 2012, 2022],
    peakBoost: 5,
    impactBoost: 4,
    leadership: 88,
    bowlStyle: 'CONTAINMENT',
  },
  'harbhajan-singh': {
    baseTier: 82,
    peakSeasons: [2010, 2013, 2015, 2019],
    peakBoost: 4,
    impactBoost: 4,
    leadership: 86,
    bowlStyle: 'CONTAINMENT',
  },
  'amit-mishra': {
    baseTier: 82,
    peakSeasons: [2008, 2013, 2016, 2020],
    peakBoost: 5,
    impactBoost: 5,
    bowlStyle: 'STRIKE_SPINNER',
  },
  'zaheer-khan': {
    baseTier: 82,
    peakSeasons: [2010, 2012, 2016],
    peakBoost: 5,
    impactBoost: 4,
    leadership: 89,
    bowlStyle: 'POWERPLAY_SWING',
  },
};

function computeBattingRatingFromAttributes(
  b: BattingAttributes,
  role: PlayerRole
): number {
  const weighted =
    b.power * 0.1 +
    b.timing * 0.13 +
    b.technique * 0.11 +
    b.strikeRotation * 0.1 +
    b.paceHitting * 0.1 +
    b.spinHitting * 0.09 +
    b.powerplay * 0.08 +
    b.middleOvers * 0.09 +
    b.deathOvers * 0.07 +
    b.chase * 0.06 +
    b.pressure * 0.04 +
    b.finishing * 0.03;

  if (role === 'BOWL') {
    return clampRating(Math.min(60, weighted));
  }
  return clampRating(weighted);
}

function computeBowlingRatingFromAttributes(
  bw: BowlingAttributes,
  role: PlayerRole
): number {
  const weighted =
    bw.wicketTaking * 0.2 +
    bw.economy * 0.18 +
    bw.powerplayBowling * 0.12 +
    bw.middleOversBowling * 0.12 +
    bw.deathBowling * 0.14 +
    bw.control * 0.1 +
    bw.variation * 0.08 +
    bw.pressure * 0.06;

  if (role === 'BAT' || role === 'WK') {
    return clampRating(Math.min(46, weighted));
  }
  return clampRating(weighted);
}

export function computeImpactRatingFromAttributes(
  attrs: PlayerDetailedAttributes,
  role: PlayerRole
): number {
  const { batting: b, bowling: bw, other: o } = attrs;

  const batSituational =
    b.power * 0.18 +
    b.deathOvers * 0.18 +
    b.finishing * 0.18 +
    b.pressure * 0.15 +
    b.chase * 0.13 +
    o.impactAbility * 0.18;

  const bowlSituational =
    bw.wicketTaking * 0.23 +
    bw.deathBowling * 0.22 +
    bw.pressure * 0.16 +
    bw.variation * 0.12 +
    bw.economy * 0.07 +
    o.impactAbility * 0.2;

  if (role === 'BAT' || role === 'WK') {
    return clampRating(batSituational);
  }
  if (role === 'BOWL') {
    return clampRating(bowlSituational);
  }
  if (role === 'AR') {
    const primary = Math.max(batSituational, bowlSituational);
    const secondary = Math.min(batSituational, bowlSituational);
    const versatilityBonus = secondary >= 68 ? 4 : secondary >= 58 ? 2 : 0;
    return clampRating(
      primary * 0.56 + secondary * 0.24 + o.impactAbility * 0.2 + versatilityBonus
    );
  }
  return clampRating(Math.max(batSituational, bowlSituational) * 0.65 + o.impactAbility * 0.35);
}

/**
 * Role-based OVR calculation:
 * - BAT / WK: Primarily BAT + IMP (never punished for low BOWL)
 * - BOWL: Primarily BOWL + IMP (never punished for low BAT)
 * - AR: Balanced BAT + BOWL + IMP
 */
export function calculateRoleOverallRating(
  role: PlayerRole,
  battingRating: number,
  bowlingRating: number,
  impactRating: number
): number {
  if (role === 'BAT' || role === 'WK') {
    return clampRating(battingRating * 0.8 + impactRating * 0.2);
  }
  if (role === 'BOWL') {
    return clampRating(bowlingRating * 0.8 + impactRating * 0.2);
  }
  if (role === 'AR') {
    const twoWayBonus = Math.min(battingRating, bowlingRating) >= 72 ? 3 : 0;
    return clampRating(
      battingRating * 0.4 + bowlingRating * 0.4 + impactRating * 0.2 + twoWayBonus
    );
  }
  return clampRating(Math.max(battingRating, bowlingRating) * 0.75 + impactRating * 0.25);
}

function generateAttributesForRecord(params: {
  playerId: string;
  season: number;
  franchise: FranchiseCode;
  role: PlayerRole;
  matches: number;
  priceCr: number;
}): {
  attributes: PlayerDetailedAttributes;
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
} {
  const { playerId, season, franchise, role, matches } = params;
  const curated = CURATED_PLAYERS[playerId];
  const seasonKey = `${playerId}:${season}:${franchise}`;

  // Player-level deterministic baseline (independent of salary!)
  const playerUnit = seededUnit(`player-tier:${playerId}`);
  const seasonWave = Math.sin((season - 2007) * 0.85 + playerUnit * Math.PI * 2);
  const seasonJitter = seededOffset(`season:${seasonKey}`, 4.5);

  let baseLevel: number;
  if (curated) {
    const isPeak = curated.peakSeasons.includes(season);
    const peakOffset = isPeak ? curated.peakBoost ?? 5 : seasonWave * 2.5;
    baseLevel = curated.baseTier + peakOffset + seededOffset(`curated:${seasonKey}`, 2.0);
  } else {
    // Non-curated players span realistic 52..82 (Average/Limited -> Strong) without eclipsing curated IPL icons
    const rawTier = 55 + playerUnit * 18;
    const matchesLift = matches > 0 ? Math.min(3, matches * 0.2) : 0;
    baseLevel = Math.min(82, rawTier + seasonWave * 2.5 + seasonJitter * 0.8 + matchesLift);
  }

  if (role === 'UNKNOWN') {
    baseLevel = 34 + playerUnit * 22 + seasonJitter * 0.7;
  }

  // Determine batting & bowling center points per role
  const isPureBat = role === 'BAT' || role === 'WK';
  const isPureBowl = role === 'BOWL';
  const isAr = role === 'AR';

  const batBase = isPureBat
    ? baseLevel
    : isAr
      ? baseLevel + (curated?.battingTilt ?? seededOffset(`ar-bat:${playerId}`, 6))
      : isPureBowl
        ? 24 + seededUnit(`tail-bat:${playerId}`) * 24 + seededOffset(`tail-bat-s:${seasonKey}`, 3)
        : baseLevel;

  const bowlBase = isPureBowl
    ? baseLevel
    : isAr
      ? baseLevel + (curated?.bowlingTilt ?? seededOffset(`ar-bowl:${playerId}`, 6))
      : isPureBat
        ? 20 + seededUnit(`part-bowl:${playerId}`) * 18 + seededOffset(`part-bowl-s:${seasonKey}`, 2)
        : 22 + seededUnit(`unk-bowl:${playerId}`) * 18;

  const batStyle: BatterArchetype =
    curated?.batStyle ??
    (['ANCHOR', 'OPENER', 'FINISHER', 'ALL_PHASE'][
      fnv1a32(`bat-style:${playerId}`) % 4
    ] as BatterArchetype);

  const bowlStyle: BowlerArchetype =
    curated?.bowlStyle ??
    (['DEATH_EXPRESS', 'POWERPLAY_SWING', 'STRIKE_SPINNER', 'CONTAINMENT'][
      fnv1a32(`bowl-style:${playerId}`) % 4
    ] as BowlerArchetype);

  const batAttr = (key: string, styleBias = 0): number =>
    clampRating(batBase + styleBias + seededOffset(`b:${key}:${seasonKey}`, 4.5));

  const bowlAttr = (key: string, styleBias = 0): number =>
    clampRating(bowlBase + styleBias + seededOffset(`bw:${key}:${seasonKey}`, 4.5));

  const batting: BattingAttributes = {
    power: batAttr('power', batStyle === 'FINISHER' ? 7 : batStyle === 'OPENER' ? 4 : -2),
    timing: batAttr('timing', batStyle === 'ANCHOR' ? 5 : 1),
    technique: batAttr('technique', batStyle === 'ANCHOR' ? 6 : batStyle === 'FINISHER' ? -3 : 1),
    strikeRotation: batAttr('strikeRotation', batStyle === 'ANCHOR' ? 5 : 0),
    paceHitting: batAttr('paceHitting', batStyle === 'OPENER' ? 4 : 0),
    spinHitting: batAttr('spinHitting', batStyle === 'ALL_PHASE' ? 4 : 0),
    powerplay: batAttr('powerplay', batStyle === 'OPENER' ? 8 : batStyle === 'FINISHER' ? -5 : 1),
    middleOvers: batAttr('middleOvers', batStyle === 'ANCHOR' ? 5 : 1),
    deathOvers: batAttr('deathOvers', batStyle === 'FINISHER' ? 9 : batStyle === 'OPENER' ? -4 : 1),
    chase: batAttr('chase', batStyle === 'ANCHOR' || batStyle === 'FINISHER' ? 5 : 0),
    pressure: batAttr('pressure', batStyle === 'FINISHER' ? 6 : 1),
    finishing: batAttr('finishing', batStyle === 'FINISHER' ? 10 : batStyle === 'OPENER' ? -5 : 0),
  };

  const bowling: BowlingAttributes = {
    wicketTaking: bowlAttr(
      'wicketTaking',
      bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'DEATH_EXPRESS' ? 5 : -1
    ),
    economy: bowlAttr('economy', bowlStyle === 'CONTAINMENT' ? 6 : 0),
    powerplayBowling: bowlAttr(
      'powerplayBowling',
      bowlStyle === 'POWERPLAY_SWING' ? 8 : bowlStyle === 'DEATH_EXPRESS' ? -2 : 0
    ),
    middleOversBowling: bowlAttr(
      'middleOversBowling',
      bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'CONTAINMENT' ? 6 : -1
    ),
    deathBowling: bowlAttr(
      'deathBowling',
      bowlStyle === 'DEATH_EXPRESS' ? 9 : bowlStyle === 'STRIKE_SPINNER' ? -4 : 0
    ),
    control: bowlAttr('control', bowlStyle === 'CONTAINMENT' ? 5 : 1),
    variation: bowlAttr('variation', bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'DEATH_EXPRESS' ? 5 : 0),
    pressure: bowlAttr('pressure', bowlStyle === 'DEATH_EXPRESS' ? 6 : 1),
  };

  const baseOther = Math.max(batBase, bowlBase);
  const impactTraitBoost =
    curated?.impactBoost ??
    (batStyle === 'FINISHER' || bowlStyle === 'DEATH_EXPRESS' ? 5 : seededOffset(`imp:${playerId}`, 6));

  const other: OtherAttributes = {
    fielding: clampRating(58 + seededUnit(`fld:${playerId}`) * 32 + seededOffset(`fld-s:${seasonKey}`, 3)),
    captaincy: clampRating(
      curated?.leadership ?? 42 + seededUnit(`cap:${playerId}`) * 44
    ),
    consistency: clampRating(baseOther + seededOffset(`con:${seasonKey}`, 5)),
    fitness: clampRating(62 + seededUnit(`fit:${playerId}`) * 30 + seededOffset(`fit-s:${seasonKey}`, 4)),
    impactAbility: clampRating(baseOther + impactTraitBoost + seededOffset(`ia:${seasonKey}`, 4)),
  };

  const attributes: PlayerDetailedAttributes = { batting, bowling, other };

  // Apply explicit landmark season overrides when present while keeping attributes aligned
  const override = curated?.seasonOverrides?.[season];
  const battingRating = clampRating(
    override?.bat ?? computeBattingRatingFromAttributes(batting, role)
  );
  const bowlingRating = clampRating(
    override?.bowl ?? computeBowlingRatingFromAttributes(bowling, role)
  );
  const impactRating = clampRating(
    override?.imp ?? computeImpactRatingFromAttributes(attributes, role)
  );
  const overallRating = calculateRoleOverallRating(
    role,
    battingRating,
    bowlingRating,
    impactRating
  );

  return {
    attributes,
    battingRating,
    bowlingRating,
    impactRating,
    overallRating,
  };
}

function generateAttributesAnchoredToRatings(params: {
  playerId: string;
  season: number;
  franchise: FranchiseCode;
  role: PlayerRole;
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
}): PlayerDetailedAttributes {
  const {
    playerId,
    season,
    franchise,
    role,
    battingRating,
    bowlingRating,
    impactRating,
    overallRating,
  } = params;
  const curated = CURATED_PLAYERS[playerId];
  const seasonKey = `${playerId}:${season}:${franchise}`;

  const batStyle: BatterArchetype =
    curated?.batStyle ??
    (['ANCHOR', 'OPENER', 'FINISHER', 'ALL_PHASE'][
      fnv1a32(`bat-style:${playerId}`) % 4
    ] as BatterArchetype);

  const bowlStyle: BowlerArchetype =
    curated?.bowlStyle ??
    (['DEATH_EXPRESS', 'POWERPLAY_SWING', 'STRIKE_SPINNER', 'CONTAINMENT'][
      fnv1a32(`bowl-style:${playerId}`) % 4
    ] as BowlerArchetype);

  const batAttr = (key: string, styleBias = 0): number =>
    clampRating(battingRating + styleBias + seededOffset(`b:${key}:${seasonKey}`, 3.5));

  const bowlAttr = (key: string, styleBias = 0): number =>
    clampRating(bowlingRating + styleBias + seededOffset(`bw:${key}:${seasonKey}`, 3.5));

  const batting: BattingAttributes = {
    power: batAttr('power', batStyle === 'FINISHER' ? 5 : batStyle === 'OPENER' ? 3 : -1),
    timing: batAttr('timing', batStyle === 'ANCHOR' ? 4 : 1),
    technique: batAttr('technique', batStyle === 'ANCHOR' ? 4 : batStyle === 'FINISHER' ? -2 : 1),
    strikeRotation: batAttr('strikeRotation', batStyle === 'ANCHOR' ? 4 : 0),
    paceHitting: batAttr('paceHitting', batStyle === 'OPENER' ? 3 : 0),
    spinHitting: batAttr('spinHitting', batStyle === 'ALL_PHASE' ? 3 : 0),
    powerplay: batAttr('powerplay', batStyle === 'OPENER' ? 5 : batStyle === 'FINISHER' ? -3 : 1),
    middleOvers: batAttr('middleOvers', batStyle === 'ANCHOR' ? 4 : 1),
    deathOvers: batAttr('deathOvers', batStyle === 'FINISHER' ? 6 : batStyle === 'OPENER' ? -3 : 1),
    chase: batAttr('chase', batStyle === 'ANCHOR' || batStyle === 'FINISHER' ? 4 : 0),
    pressure: batAttr('pressure', batStyle === 'FINISHER' ? 4 : 1),
    finishing: batAttr('finishing', batStyle === 'FINISHER' ? 6 : batStyle === 'OPENER' ? -3 : 0),
  };

  const bowling: BowlingAttributes = {
    wicketTaking: bowlAttr(
      'wicketTaking',
      bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'DEATH_EXPRESS' ? 4 : -1
    ),
    economy: bowlAttr('economy', bowlStyle === 'CONTAINMENT' ? 4 : 0),
    powerplayBowling: bowlAttr(
      'powerplayBowling',
      bowlStyle === 'POWERPLAY_SWING' ? 5 : bowlStyle === 'DEATH_EXPRESS' ? -2 : 0
    ),
    middleOversBowling: bowlAttr(
      'middleOversBowling',
      bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'CONTAINMENT' ? 4 : -1
    ),
    deathBowling: bowlAttr(
      'deathBowling',
      bowlStyle === 'DEATH_EXPRESS' ? 6 : bowlStyle === 'STRIKE_SPINNER' ? -3 : 0
    ),
    control: bowlAttr('control', bowlStyle === 'CONTAINMENT' ? 4 : 1),
    variation: bowlAttr('variation', bowlStyle === 'STRIKE_SPINNER' || bowlStyle === 'DEATH_EXPRESS' ? 4 : 0),
    pressure: bowlAttr('pressure', bowlStyle === 'DEATH_EXPRESS' ? 4 : 1),
  };

  const baseOther = role === 'AR' ? Math.max(battingRating, bowlingRating, overallRating) : overallRating;
  const other: OtherAttributes = {
    fielding: clampRating(58 + seededUnit(`fld:${playerId}`) * 32 + seededOffset(`fld-s:${seasonKey}`, 3)),
    captaincy: clampRating(
      curated?.leadership ?? 42 + seededUnit(`cap:${playerId}`) * 44
    ),
    consistency: clampRating(baseOther + seededOffset(`con:${seasonKey}`, 4)),
    fitness: clampRating(62 + seededUnit(`fit:${playerId}`) * 30 + seededOffset(`fit-s:${seasonKey}`, 4)),
    impactAbility: clampRating(impactRating + seededOffset(`ia:${seasonKey}`, 2.5)),
  };

  return { batting, bowling, other };
}

export function buildAttributesForStoredRatings(params: {
  playerId: string;
  season: number;
  franchise: FranchiseCode;
  role: PlayerRole;
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
  rawAttributes?: PlayerDetailedAttributes;
}): PlayerDetailedAttributes {
  if (params.rawAttributes) {
    return params.rawAttributes;
  }
  return generateAttributesAnchoredToRatings({
    playerId: params.playerId,
    season: params.season,
    franchise: params.franchise,
    role: params.role,
    battingRating: clampRating(params.battingRating),
    bowlingRating: clampRating(params.bowlingRating),
    impactRating: clampRating(params.impactRating),
    overallRating: clampRating(params.overallRating),
  });
}

export function resolvePlayerRatings(params: {
  playerId: string;
  season: number;
  franchise: FranchiseCode;
  role: PlayerRole;
  matches: number;
  priceCr: number;
  ratingStatus: 'FINAL' | 'PROVISIONAL';
  hasExplicitRatings?: boolean;
  rawBattingRating: number;
  rawBowlingRating: number;
  rawImpactRating?: number;
  rawOverallRating: number;
  rawAttributes?: PlayerDetailedAttributes;
}): {
  attributes: PlayerDetailedAttributes;
  battingRating: number;
  bowlingRating: number;
  impactRating: number;
  overallRating: number;
  ratingBand: RatingBand;
} {
  if (params.hasExplicitRatings) {
    const battingRating = clampRating(params.rawBattingRating);
    const bowlingRating = clampRating(params.rawBowlingRating);
    const overallRating = clampRating(params.rawOverallRating);
    const impactRating = clampRating(params.rawImpactRating ?? overallRating);
    const attributes = buildAttributesForStoredRatings({
      playerId: params.playerId,
      season: params.season,
      franchise: params.franchise,
      role: params.role,
      battingRating,
      bowlingRating,
      impactRating,
      overallRating,
      rawAttributes: params.rawAttributes,
    });
    return {
      attributes,
      battingRating,
      bowlingRating,
      impactRating,
      overallRating,
      ratingBand: getRatingBand(overallRating),
    };
  }

  // Never fabricate ratings in React when database record has no stored ratings.
  // Keep numeric fields at 0 (displayed as incomplete) and anchor internal engine attributes to baseline.
  const attributes = buildAttributesForStoredRatings({
    playerId: params.playerId,
    season: params.season,
    franchise: params.franchise,
    role: params.role,
    battingRating: RATING_MIN,
    bowlingRating: RATING_MIN,
    impactRating: RATING_MIN,
    overallRating: RATING_MIN,
    rawAttributes: params.rawAttributes,
  });

  return {
    attributes,
    battingRating: 0,
    bowlingRating: 0,
    impactRating: 0,
    overallRating: 0,
    ratingBand: getRatingBand(RATING_MIN),
  };
}
