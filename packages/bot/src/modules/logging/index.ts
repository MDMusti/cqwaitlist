import type { GuildMember, Message, PartialMessage } from 'discord.js';
import type { BotModule } from '@cleanqueue/shared';
import { sendUnifiedLog } from '../../lib/logging';

export const loggingModule: BotModule = {
  id: 'logging',
  label: 'Logging',
  phase: 2,
  enabled: true,
  description: 'Einheitliches Audit-Log — Nachrichten, Mitglieder, Rollen',
  events: [
    {
      name: 'messageDelete',
      async execute(message: Message | PartialMessage) {
        if (!message.guild || message.author?.bot) return;
        const content = message.partial ? '(Nachricht nicht im Cache)' : message.content || '(leer/Embed)';
        await sendUnifiedLog(message.guild, 'message', 'Nachricht gelöscht', content.slice(0, 500), [
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
        await sendUnifiedLog(newMsg.guild, 'message', 'Nachricht bearbeitet', '', [
          { name: 'Autor', value: newMsg.author?.tag ?? '?', inline: true },
          { name: 'Channel', value: `${newMsg.channel}`, inline: true },
          { name: 'Vorher', value: before.slice(0, 200) },
          { name: 'Nachher', value: after.slice(0, 200) },
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

        await sendUnifiedLog(newMember.guild, 'member', 'Rollen geändert', newMember.user.tag, [
          { name: 'Nutzer', value: `${newMember}`, inline: true },
          { name: 'Änderung', value: parts.join('\n') || '—' },
        ]);
      },
    },
  ],
};
