import type { FranchiseCode, FranchiseMeta } from '../types/game';

const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

export const FRANCHISES: Record<FranchiseCode, FranchiseMeta> = {
  CSK: {
    code: 'CSK',
    name: 'Chennai Super Kings',
    shortName: 'Chennai',
    primaryColor: '#EAB308',
    accentColor: '#FACC15',
    activeSeasons: [...range(2008, 2015), ...range(2018, 2026)],
  },
  MI: {
    code: 'MI',
    name: 'Mumbai Indians',
    shortName: 'Mumbai',
    primaryColor: '#2563EB',
    accentColor: '#3B82F6',
    activeSeasons: range(2008, 2026),
  },
  RCB: {
    code: 'RCB',
    name: 'Royal Challengers Bengaluru',
    shortName: 'Bengaluru',
    primaryColor: '#DC2626',
    accentColor: '#F59E0B',
    activeSeasons: range(2008, 2026),
  },
  KKR: {
    code: 'KKR',
    name: 'Kolkata Knight Riders',
    shortName: 'Kolkata',
    primaryColor: '#7C3AED',
    accentColor: '#F59E0B',
    activeSeasons: range(2008, 2026),
  },
  SRH: {
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    shortName: 'Hyderabad',
    primaryColor: '#EA580C',
    accentColor: '#F97316',
    activeSeasons: range(2013, 2026),
  },
  RR: {
    code: 'RR',
    name: 'Rajasthan Royals',
    shortName: 'Rajasthan',
    primaryColor: '#DB2777',
    accentColor: '#3B82F6',
    activeSeasons: [...range(2008, 2015), ...range(2018, 2026)],
  },
  DC: {
    code: 'DC',
    name: 'Delhi Capitals',
    shortName: 'Delhi',
    primaryColor: '#1D4ED8',
    accentColor: '#EF4444',
    activeSeasons: range(2008, 2026),
  },
  PBKS: {
    code: 'PBKS',
    name: 'Punjab Kings',
    shortName: 'Punjab',
    primaryColor: '#E11D48',
    accentColor: '#CBD5E1',
    activeSeasons: range(2008, 2026),
  },
  GT: {
    code: 'GT',
    name: 'Gujarat Titans',
    shortName: 'Gujarat',
    primaryColor: '#0EA5E9',
    accentColor: '#EAB308',
    activeSeasons: range(2022, 2026),
  },
  LSG: {
    code: 'LSG',
    name: 'Lucknow Super Giants',
    shortName: 'Lucknow',
    primaryColor: '#0284C7',
    accentColor: '#F97316',
    activeSeasons: range(2022, 2026),
  },
  DCH: {
    code: 'DCH',
    name: 'Deccan Chargers',
    shortName: 'Deccan',
    primaryColor: '#38BDF8',
    accentColor: '#94A3B8',
    activeSeasons: range(2008, 2012),
  },
  PWI: {
    code: 'PWI',
    name: 'Pune Warriors India',
    shortName: 'Pune',
    primaryColor: '#06B6D4',
    accentColor: '#64748B',
    activeSeasons: range(2011, 2013),
  },
  RPS: {
    code: 'RPS',
    name: 'Rising Pune Supergiant',
    shortName: 'Pune SG',
    primaryColor: '#9333EA',
    accentColor: '#EC4899',
    activeSeasons: [2016, 2017],
  },
  GL: {
    code: 'GL',
    name: 'Gujarat Lions',
    shortName: 'Gujarat L',
    primaryColor: '#F97316',
    accentColor: '#3B82F6',
    activeSeasons: [2016, 2017],
  },
};

export const FRANCHISE_LIST: FranchiseMeta[] = Object.values(FRANCHISES);

export function makeComboKey(franchise: FranchiseCode, season: number): string {
  return `${franchise}-${season}`;
}

const FRANCHISE_ALIASES: Record<string, FranchiseCode> = {
  CSK: 'CSK',
  'CHENNAI SUPER KINGS': 'CSK',
  CHENNAI: 'CSK',

  MI: 'MI',
  'MUMBAI INDIANS': 'MI',
  MUMBAI: 'MI',

  RCB: 'RCB',
  'ROYAL CHALLENGERS BENGALURU': 'RCB',
  'ROYAL CHALLENGERS BANGALORE': 'RCB',
  BENGALURU: 'RCB',
  BANGALORE: 'RCB',

  KKR: 'KKR',
  'KOLKATA KNIGHT RIDERS': 'KKR',
  KOLKATA: 'KKR',

  SRH: 'SRH',
  'SUNRISERS HYDERABAD': 'SRH',
  HYDERABAD: 'SRH',

  RR: 'RR',
  'RAJASTHAN ROYALS': 'RR',
  RAJASTHAN: 'RR',

  DC: 'DC',
  'DELHI CAPITALS': 'DC',
  DD: 'DC',
  'DELHI DAREDEVILS': 'DC',
  DELHI: 'DC',

  PBKS: 'PBKS',
  'PUNJAB KINGS': 'PBKS',
  KXIP: 'PBKS',
  'KINGS XI PUNJAB': 'PBKS',
  PUNJAB: 'PBKS',

  GT: 'GT',
  'GUJARAT TITANS': 'GT',

  LSG: 'LSG',
  'LUCKNOW SUPER GIANTS': 'LSG',
  LUCKNOW: 'LSG',

  DCH: 'DCH',
  'DECCAN CHARGERS': 'DCH',
  DECCAN: 'DCH',

  PWI: 'PWI',
  'PUNE WARRIORS INDIA': 'PWI',
  'PUNE WARRIORS': 'PWI',

  RPS: 'RPS',
  RPSG: 'RPS',
  'RISING PUNE SUPERGIANT': 'RPS',
  'RISING PUNE SUPERGIANTS': 'RPS',

  GL: 'GL',
  'GUJARAT LIONS': 'GL',
};

export function resolveFranchiseCode(input: string): FranchiseCode | null {
  const normalized = input.trim().replace(/\s+/g, ' ').toUpperCase();
  return FRANCHISE_ALIASES[normalized] ?? null;
}

