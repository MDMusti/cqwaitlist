import type { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { GuildModuleSettings } from '@cleanqueue/shared';
import { store } from '../db/store';

export function isModerator(member: GuildMember, settings: GuildModuleSettings): boolean {
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const modRoleId = settings.roles.moderator;
  if (modRoleId && member.roles.cache.has(modRoleId)) return true;
  return false;
}

export async function requireModerator(
  interaction: ChatInputCommandInteraction,
): Promise<{ member: GuildMember; settings: GuildModuleSettings } | null> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'Nur auf Servern verfügbar.', ephemeral: true });
    return null;
  }
  const member = interaction.member as GuildMember;
  const settings = store.getGuildSettings(interaction.guild.id);
  if (!isModerator(member, settings)) {
    await interaction.reply({
      content: 'Du benötigst Moderator-Rechte für diesen Befehl.',
      ephemeral: true,
    });
    return null;
  }
  return { member, settings };
}

export function botNeeds(
  member: GuildMember,
  perms: PermissionResolvable[],
): string | null {
  const me = member.guild.members.me;
  if (!me) return 'Bot-Mitglied nicht gefunden.';
  for (const perm of perms) {
    if (!me.permissions.has(perm)) {
      return `Mir fehlt die Berechtigung: \`${String(perm)}\``;
    }
  }
  return null;
}
