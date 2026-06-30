import type { GuildMember } from 'discord.js';
import type { GuildModuleSettings } from '@cleanqueue/shared';

const MILESTONES = [
  { level: 5, key: 'level5' as const },
  { level: 10, key: 'level10' as const },
  { level: 25, key: 'level25' as const },
];

export async function applyLevelRoleRewards(
  member: GuildMember,
  settings: GuildModuleSettings,
  oldLevel: number,
  newLevel: number,
): Promise<string[]> {
  const granted: string[] = [];

  for (const { level, key } of MILESTONES) {
    if (newLevel >= level && oldLevel < level) {
      const roleId = settings.roles[key];
      if (roleId && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, `Level ${level} Belohnung`).catch(() => undefined);
        granted.push(`Level ${level}`);
      }
    }
  }

  return granted;
}
