/** XP required to reach a given level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.floor(100 * level * (level - 1) * 0.5);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function xpToNextLevel(xp: number, level: number): number {
  return xpForLevel(level + 1) - xp;
}
