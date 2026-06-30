import type { GuildMember } from 'discord.js';
import { store } from '../../db/store';
import { sendUnifiedLog } from '../../lib/logging';

export async function handleAntiRaidJoin(member: GuildMember): Promise<void> {
  const settings = store.getGuildSettings(member.guild.id);
  const antiRaid = settings.antiRaid ?? { joinThreshold: 5, windowMs: 10_000 };
  const count = store.trackJoin(member.guild.id, antiRaid.windowMs);

  if (count < antiRaid.joinThreshold) return;

  const verifyId = settings.channels.verify;
  if (verifyId) {
    const verifyCh = member.guild.channels.cache.get(verifyId);
    if (verifyCh && 'permissionOverwrites' in verifyCh) {
      await verifyCh.permissionOverwrites
        .edit(member.guild.roles.everyone, { SendMessages: false })
        .catch(() => undefined);
    }
  }

  await sendUnifiedLog(
    member.guild,
    'security',
    'Anti-Raid — Join-Welle erkannt',
    `${count} Beitritte in ${antiRaid.windowMs / 1000}s — Verify-Channel gesperrt.`,
    [
      { name: 'Schwellwert', value: `${antiRaid.joinThreshold} Joins`, inline: true },
      { name: 'Letzter Join', value: `${member.user.tag}`, inline: true },
    ],
  );

  const modRoleId = settings.roles.moderator;
  const alertChannelId = settings.channels.modLogs ?? settings.channels.logs;
  if (alertChannelId) {
    const ch = member.guild.channels.cache.get(alertChannelId);
    if (ch?.isTextBased()) {
      const ping = modRoleId ? `<@&${modRoleId}>` : '@here';
      await ch
        .send({
          content: `${ping} **Anti-Raid aktiv!** ${count} Joins in ${antiRaid.windowMs / 1000}s. Verify-Channel ist gesperrt.`,
        })
        .catch(() => undefined);
    }
  }

  setTimeout(() => {
    store.clearJoinTracker(member.guild.id);
    if (verifyId) {
      const verifyCh = member.guild.channels.cache.get(verifyId);
      if (verifyCh && 'permissionOverwrites' in verifyCh) {
        verifyCh.permissionOverwrites
          .edit(member.guild.roles.everyone, { SendMessages: null })
          .catch(() => undefined);
      }
    }
  }, 60_000);
}

export async function logMemberJoin(member: GuildMember): Promise<void> {
  const accountAge = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );
  await sendUnifiedLog(
    member.guild,
    'member',
    'Mitglied beigetreten',
    `${member.user.tag} ist dem Server beigetreten.`,
    [
      { name: 'Nutzer', value: `${member}`, inline: true },
      { name: 'Account-Alter', value: `${accountAge} Tage`, inline: true },
    ],
  );
}
