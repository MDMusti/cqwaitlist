import type { GuildMember, Message, PartialMessage } from 'discord.js';
import type { BotModule } from '@cleanqueue/shared';
import { sendGuildLog } from '../../lib/logging';

export const loggingModule: BotModule = {
  id: 'logging',
  label: 'Logging',
  phase: 2,
  enabled: true,
  description: 'Nachrichten, Mitglieder, Rollen — Audit-Log Channel',
  events: [
    {
      name: 'messageDelete',
      async execute(message: Message | PartialMessage) {
        if (!message.guild || message.author?.bot) return;
        const content = message.partial ? '(Nachricht nicht im Cache)' : message.content || '(leer/Embed)';
        await sendGuildLog(message.guild, 'Nachricht gelöscht', content.slice(0, 500), [
          { name: 'Autor', value: message.author?.tag ?? 'Unbekannt', inline: true },
          { name: 'Channel', value: `${message.channel}`, inline: true },
        ]);
      },
    },
    {
      name: 'messageUpdate',
      async execute(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) {
        if (!newMsg.guild || newMsg.author?.bot) return;
        const before = oldMsg.content ?? '(unbekannt)';
        const after = newMsg.content ?? '(unbekannt)';
        if (before === after) return;
        await sendGuildLog(newMsg.guild, 'Nachricht bearbeitet', '', [
          { name: 'Autor', value: newMsg.author?.tag ?? '?', inline: true },
          { name: 'Channel', value: `${newMsg.channel}`, inline: true },
          { name: 'Vorher', value: before.slice(0, 200) },
          { name: 'Nachher', value: after.slice(0, 200) },
        ]);
      },
    },
    {
      name: 'guildMemberRemove',
      async execute(member: GuildMember) {
        await sendGuildLog(member.guild, 'Mitglied verlassen', `${member.user.tag} hat den Server verlassen.`, [
          { name: 'Nutzer', value: member.user.tag, inline: true },
        ]);
      },
    },
    {
      name: 'guildMemberUpdate',
      async execute(oldMember: GuildMember, newMember: GuildMember) {
        const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
        const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
        if (added.size === 0 && removed.size === 0) return;

        const parts: string[] = [];
        if (added.size) parts.push(`+ ${added.map((r) => r.name).join(', ')}`);
        if (removed.size) parts.push(`- ${removed.map((r) => r.name).join(', ')}`);

        await sendGuildLog(newMember.guild, 'Rollen geändert', `${newMember.user.tag}`, [
          { name: 'Änderung', value: parts.join('\n') || '—' },
        ]);
      },
    },
  ],
};
