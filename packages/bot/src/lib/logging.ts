import type { Guild, TextChannel } from 'discord.js';
import { brandEmbed } from './embeds';
import { store } from '../db/store';

export async function sendGuildLog(
  guild: Guild,
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[],
): Promise<void> {
  const settings = store.getGuildSettings(guild.id);
  const logId = settings.channels.logs ?? settings.channels.modLogs;
  if (!logId) return;

  const channel = guild.channels.cache.get(logId);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const embed = brandEmbed(title).setDescription(description).setTimestamp();
  if (fields?.length) embed.addFields(fields);

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);

  store.createAuditLog({
    guildId: guild.id,
    action: title,
    metadata: { description, fields },
  });
}
