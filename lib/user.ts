/**
 * Utility functions for user-related calculations.
 */

export const calculateUserLevel = (avgScore: number) => {
  if (avgScore >= 9) return 5;
  if (avgScore >= 8) return 4;
  if (avgScore >= 6.5) return 3;
  if (avgScore >= 5) return 2;
  return 1;
};

export const calculateNextLevelXp = (level: number) => {
  return level * 500;
};

export interface UserStats {
  avgScore: number;
  totalCorrections: number;
  level: number;
  levelLabel: string;
  xp: number;
  nextLevelXp: number;
}

export const calculateUserStats = (user: any, corrections: any[], t: (path: string) => string): UserStats => {
  const total = corrections.length;
  
  if (total > 0) {
    const sum = corrections.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
    const avg = sum / total;
    const level = calculateUserLevel(avg);

    return {
      avgScore: parseFloat(avg.toFixed(1)),
      totalCorrections: total,
      level: level,
      levelLabel: t(`profile.levels.${level}`),
      xp: user?.xp || 0,
      nextLevelXp: calculateNextLevelXp(level)
    };
  }

  return {
    avgScore: 0,
    totalCorrections: 0,
    level: 1,
    levelLabel: t('profile.levels.1'),
    xp: user?.xp || 0,
    nextLevelXp: 500
  };
};
