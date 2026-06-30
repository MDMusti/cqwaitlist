import type { Guild, TextChannel } from 'discord.js';
import { store } from '../db/store';
import { infoEmbed } from './ui';

export type LogCategory = 'mod' | 'member' | 'message' | 'ticket' | 'voice' | 'security' | 'system';

const CATEGORY_EMOJI: Record<LogCategory, string> = {
  mod: '🛡️',
  member: '👤',
  message: '💬',
  ticket: '🎫',
  voice: '🔊',
  security: '🚨',
  system: '⚙️',
};

export async function sendUnifiedLog(
  guild: Guild,
  category: LogCategory,
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[],
): Promise<void> {
  const settings = store.getGuildSettings(guild.id);
  const logId = settings.channels.logs ?? settings.channels.modLogs;
  if (!logId) return;

  const channel = guild.channels.cache.get(logId);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const embed = infoEmbed(description, `${CATEGORY_EMOJI[category]} ${title}`).setTimestamp();
  if (fields?.length) embed.addFields(fields);

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);

  store.createAuditLog({
    guildId: guild.id,
    action: `${category}:${title}`,
    metadata: { description, fields, category },
  });
}

/** @deprecated Use sendUnifiedLog */
export async function sendGuildLog(
  guild: Guild,
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[],
): Promise<void> {
  await sendUnifiedLog(guild, 'system', title, description, fields);
}
