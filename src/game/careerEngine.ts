import type { CareerAchievement, CareerStats, SeasonState } from '../types/game';

export const DEFAULT_ACHIEVEMENTS: CareerAchievement[] = [
  {
    id: 'complete_draft',
    title: 'Squad Architect',
    description: 'Complete a full 15-player Retention + Spin Draft.',
    unlocked: false,
  },
  {
    id: 'playoff_bound',
    title: 'Top-4 Contender',
    description: 'Qualify for the IPL Playoffs in the league standings.',
    unlocked: false,
  },
  {
    id: 'champion',
    title: 'Championship Glory',
    description: 'Win the IPL Final and lift the trophy.',
    unlocked: false,
  },
  {
    id: 'invincible_14',
    title: '20-0 Invincibles',
    description: 'Finish the 20-match league stage unbeaten.',
    unlocked: false,
  },
  {
    id: 'impact_tactician',
    title: 'Impact Tactician',
    description: 'Deploy an Impact Player substitution during a live match.',
    unlocked: false,
  },
  {
    id: 'dynasty_two',
    title: 'Back-to-Back Legacy',
    description: 'Win 2 or more IPL titles across your franchise career.',
    unlocked: false,
  },
];

export function createInitialCareerStats(): CareerStats {
  return {
    seasonsPlayed: 0,
    titlesWon: 0,
    bestFinish: '—',
    bestPosition: null,
    achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
  };
}

export function mergeCareerAchievements(saved?: CareerAchievement[]): CareerAchievement[] {
  const byId = new Map((saved ?? []).map((a) => [a.id, a]));
  return DEFAULT_ACHIEVEMENTS.map((def) => {
    const existing = byId.get(def.id);
    return existing ? { ...def, ...existing } : { ...def };
  });
}

export function unlockAchievement(
  career: CareerStats,
  achievementId: string,
  seasonNumber?: number
): CareerStats {
  let changed = false;
  const nextAchievements = career.achievements.map((ach) => {
    if (ach.id === achievementId && !ach.unlocked) {
      changed = true;
      return {
        ...ach,
        unlocked: true,
        unlockedAtSeason: seasonNumber,
      };
    }
    return ach;
  });
  if (!changed) return career;
  return {
    ...career,
    achievements: nextAchievements,
  };
}

function getFinishLabelFromSeason(season: SeasonState, position: number): { rankScore: number; label: string } {
  if (season.championTeamId === 'YOU') {
    return { rankScore: 1, label: 'CHAMPION' };
  }
  const final = season.playoffs.FINAL;
  if (final.status === 'COMPLETED' && (final.homeTeamId === 'YOU' || final.awayTeamId === 'YOU')) {
    return { rankScore: 2, label: 'RUNNER-UP' };
  }
  const q2 = season.playoffs.Q2;
  if (q2.status === 'COMPLETED' && (q2.homeTeamId === 'YOU' || q2.awayTeamId === 'YOU')) {
    return { rankScore: 3, label: 'QUALIFIER 2' };
  }
  const elim = season.playoffs.ELIM;
  if (elim.status === 'COMPLETED' && (elim.homeTeamId === 'YOU' || elim.awayTeamId === 'YOU')) {
    return { rankScore: 4, label: 'ELIMINATOR' };
  }
  return { rankScore: 4 + position, label: `#${position} LEAGUE` };
}

function finishLabelToRankScore(label: string): number {
  if (label === 'CHAMPION') return 1;
  if (label === 'RUNNER-UP') return 2;
  if (label === 'QUALIFIER 2') return 3;
  if (label === 'ELIMINATOR') return 4;
  const match = /^#(\d+)/.exec(label);
  if (match) return 4 + Number(match[1]);
  return 999;
}

export function recordCompletedSeasonInCareer(
  career: CareerStats,
  season: SeasonState
): CareerStats {
  const userIndex = season.pointsTable.findIndex((r) => r.teamId === 'YOU');
  const position = userIndex >= 0 ? userIndex + 1 : 10;
  const wonTitle = season.championTeamId === 'YOU';
  const nextTitles = career.titlesWon + (wonTitle ? 1 : 0);
  const nextSeasons = career.seasonsPlayed + 1;

  const currentFinish = getFinishLabelFromSeason(season, position);
  const prevRank = finishLabelToRankScore(career.bestFinish);
  const bestFinish = currentFinish.rankScore < prevRank ? currentFinish.label : career.bestFinish;
  const bestPosition =
    career.bestPosition === null ? position : Math.min(career.bestPosition, position);

  let next: CareerStats = {
    ...career,
    seasonsPlayed: nextSeasons,
    titlesWon: nextTitles,
    bestFinish,
    bestPosition,
  };

  if (season.userQualified) {
    next = unlockAchievement(next, 'playoff_bound', season.seasonNumber);
  }
  if (wonTitle) {
    next = unlockAchievement(next, 'champion', season.seasonNumber);
  }
  if (season.challenge14Status === 'COMPLETED') {
    next = unlockAchievement(next, 'invincible_14', season.seasonNumber);
  }
  if ((season.impactHistory?.length ?? 0) > 0) {
    next = unlockAchievement(next, 'impact_tactician', season.seasonNumber);
  }
  if (nextTitles >= 2) {
    next = unlockAchievement(next, 'dynasty_two', season.seasonNumber);
  }

  return next;
}
