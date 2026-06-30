import type { Message } from 'discord.js';
import { store } from '../../db/store';
import { checkAutomod, violationLabel } from '../../lib/automod';
import { sendUnifiedLog } from '../../lib/logging';
import { isModerator } from '../../lib/permissions';

export async function handleAutomodMessage(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.member) return false;

  const settings = store.getGuildSettings(message.guild.id);
  if (isModerator(message.member, settings)) return false;

  const automod = settings.automod ?? {};
  const result = checkAutomod(message, automod);
  if (!result) return false;

  await message.delete().catch(() => undefined);
  store.clearSpamTracker(message.guild.id, message.author.id);

  if (automod.quarantineOnViolation && settings.roles.quarantine) {
    await message.member.roles
      .add(settings.roles.quarantine, `AutoMod: ${result.reason}`)
      .catch(() => undefined);
  }

  const caseRecord = store.createCase({
    guildId: message.guild.id,
    targetId: message.author.id,
    type: 'automod',
    reason: `${violationLabel(result.violation)} — ${result.reason}`,
    status: 'open',
  });

  await sendUnifiedLog(
    message.guild,
    'mod',
    'AutoMod — Verstoß',
    `${message.author} in ${message.channel}`,
    [
      { name: 'Typ', value: violationLabel(result.violation), inline: true },
      { name: 'Case', value: `#${caseRecord.caseNumber}`, inline: true },
      { name: 'Grund', value: result.reason },
      {
        name: 'Nachricht',
        value: (message.content || '(leer)').slice(0, 200) || '—',
      },
    ],
  );

  if (!message.channel.isTextBased() || message.channel.isDMBased()) return true;

  const notice = await message.channel
    .send({
      content: `${message.author}, deine Nachricht wurde entfernt: **${result.reason}** (Case #${caseRecord.caseNumber})`,
    })
    .catch(() => null);

  if (notice) setTimeout(() => notice.delete().catch(() => undefined), 8000);

  return true;
}
