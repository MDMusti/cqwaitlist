import type { GuildMember } from 'discord.js';
import type { GuildModuleSettings } from '@cleanqueue/shared';

/** Entfernt individuelle Channel-Sperren nach erfolgreicher Verifizierung. */
export async function restoreMemberChannelAccess(
  member: GuildMember,
  settings: GuildModuleSettings,
): Promise<void> {
  const keepOpen = new Set(
    [settings.channels.verify, settings.channels.rules].filter(Boolean) as string[],
  );

  for (const ch of member.guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).values()) {
    if (keepOpen.has(ch.id)) continue;
    if ('permissionOverwrites' in ch) {
      const overwrite = ch.permissionOverwrites.cache.get(member.id);
      if (overwrite?.deny.has('ViewChannel')) {
        await ch.permissionOverwrites.delete(member.id).catch(() => undefined);
      }
    }
  }
}

/** Sperrt alle Textkanäle außer Verify/Rules für neue Mitglieder. */
export async function restrictUnverifiedMember(
  member: GuildMember,
  settings: GuildModuleSettings,
): Promise<void> {
  const verifyCh = settings.channels.verify;
  if (!verifyCh) return;

  for (const ch of member.guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).values()) {
    if (ch.id === verifyCh || ch.id === settings.channels.rules) continue;
    if ('permissionOverwrites' in ch) {
      await ch.permissionOverwrites
        .edit(member.id, { ViewChannel: false })
        .catch(() => undefined);
    }
  }

  const verifyChannel = member.guild.channels.cache.get(verifyCh);
  if (verifyChannel && 'permissionOverwrites' in verifyChannel) {
    await verifyChannel.permissionOverwrites
      .edit(member.id, { ViewChannel: true, SendMessages: true })
      .catch(() => undefined);
  }
}
