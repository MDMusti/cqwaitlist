import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { primaryEmbed, EMOJI } from '../../lib/ui';

export const TICKET_DEPARTMENTS = [
  { id: 'support', label: 'Support', emoji: '💬', description: 'Allgemeine Hilfe' },
  { id: 'report', label: 'Report', emoji: '🚨', description: 'Nutzer melden' },
  { id: 'appeal', label: 'Appeal', emoji: '⚖️', description: 'Ban-Appeal' },
  { id: 'bewerbung', label: 'Bewerbung', emoji: '📝', description: 'Team-Bewerbung' },
] as const;

export function buildTicketPanel() {
  const embed = primaryEmbed(
    `${EMOJI.ticket} Support-Tickets`,
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

export function buildTicketIntakeModal(dept: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ticket:intake:${dept}`)
    .setTitle('Ticket — Anliegen beschreiben')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('subject')
          .setLabel('Betreff')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Beschreibung')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );
}

/** Alias für konsistente Imports */
export const buildTicketModal = buildTicketIntakeModal;

export function buildTicketWelcomeEmbed(opts: {
  member: import('discord.js').GuildMember;
  dept: string;
  subject: string;
  description: string;
}) {
  const accountAgeDays = Math.floor(
    (Date.now() - opts.member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );
  const joinAgeDays = opts.member.joinedTimestamp
    ? Math.floor((Date.now() - opts.member.joinedTimestamp) / (1000 * 60 * 60 * 24))
    : 0;

  return primaryEmbed(`Ticket — ${deptLabel(opts.dept)}`, undefined)
    .setDescription(
      `Hallo ${opts.member}, dein Ticket wurde erstellt.\n\n` +
        'Ein Teammitglied meldet sich in Kürze. Bitte hab etwas Geduld.',
    )
    .addFields(
      { name: 'Betreff', value: opts.subject },
      { name: 'Beschreibung', value: opts.description.slice(0, 1000) },
      { name: 'Nutzer', value: opts.member.user.tag, inline: true },
      { name: 'Account-Alter', value: `~${accountAgeDays} Tage`, inline: true },
      { name: 'Server-Mitglied seit', value: `~${joinAgeDays} Tage`, inline: true },
    );
}

export function buildTicketControls(claimedBy?: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel(claimedBy ? 'Übernommen' : 'Übernehmen')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🙋')
      .setDisabled(Boolean(claimedBy)),
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Schließen')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );
  return row;
}

export function buildCloseReasonModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('ticket:close:reason')
    .setTitle('Ticket schließen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Grund für Schließung')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500),
      ),
    );
}

export function buildSatisfactionRow(ticketId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`ticket:rate:${ticketId}:${n}`)
        .setLabel(`${n}★`)
        .setStyle(n >= 4 ? ButtonStyle.Success : n >= 3 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );
}

export function deptLabel(id: string): string {
  return TICKET_DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}
