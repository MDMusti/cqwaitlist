import { EmbedBuilder } from 'discord.js';
import { APP_NAME, BRAND_COLOR } from '@cleanqueue/shared';

export function brandEmbed(title?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setFooter({ text: APP_NAME });
  if (title) embed.setTitle(title);
  return embed;
}

export function successEmbed(message: string, title = 'Erfolg'): EmbedBuilder {
  return brandEmbed(title).setDescription(`✅ ${message}`);
}

export function errorEmbed(message: string, title = 'Fehler'): EmbedBuilder {
  return brandEmbed(title).setDescription(`❌ ${message}`);
}

export function infoEmbed(message: string, title?: string): EmbedBuilder {
  return brandEmbed(title).setDescription(message);
}

export function modCaseEmbed(opts: {
  caseNumber: number;
  type: string;
  targetTag: string;
  moderatorTag: string;
  reason: string;
}): EmbedBuilder {
  return brandEmbed(`Case #${opts.caseNumber} — ${opts.type.toUpperCase()}`)
    .addFields(
      { name: 'Nutzer', value: opts.targetTag, inline: true },
      { name: 'Moderator', value: opts.moderatorTag, inline: true },
      { name: 'Grund', value: opts.reason || 'Kein Grund angegeben' },
    )
    .setTimestamp();
}
