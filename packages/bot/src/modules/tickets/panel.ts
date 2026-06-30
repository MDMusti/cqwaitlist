import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { brandEmbed } from '../../lib/embeds';

export const TICKET_DEPARTMENTS = [
  { id: 'support', label: 'Support', emoji: '💬', description: 'Allgemeine Hilfe' },
  { id: 'report', label: 'Report', emoji: '🚨', description: 'Nutzer melden' },
  { id: 'appeal', label: 'Appeal', emoji: '⚖️', description: 'Ban-Appeal' },
  { id: 'bewerbung', label: 'Bewerbung', emoji: '📝', description: 'Team-Bewerbung' },
] as const;

export function buildTicketPanel() {
  const embed = brandEmbed('🎫 Support-Tickets')
    .setDescription(
      'Wähle eine Abteilung, um ein privates Ticket zu eröffnen.\n\n' +
        TICKET_DEPARTMENTS.map((d) => `${d.emoji} **${d.label}** — ${d.description}`).join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const dept of TICKET_DEPARTMENTS) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:open:${dept.id}`)
        .setLabel(dept.label)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(dept.emoji),
    );
  }

  return { embeds: [embed], components: [row] };
}

export function buildTicketControls() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Schließen')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId('ticket:archive')
      .setLabel('Archivieren')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📁'),
  );
}

export function deptLabel(id: string): string {
  return TICKET_DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}
