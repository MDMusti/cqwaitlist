import fs from 'fs';
import path from 'path';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import type { GuildMember, Interaction, TextChannel } from 'discord.js';
import {
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import { store } from '../../db/store';
import { errorEmbed, primaryEmbed, successEmbed } from '../../lib/ui';
import { sendUnifiedLog } from '../../lib/logging';
import {
  buildTicketControls,
  buildTicketIntakeModal,
  buildCloseReasonModal,
  buildSatisfactionRow,
  deptLabel,
} from './panel';

const TRANSCRIPT_DIR = path.join(process.cwd(), 'data', 'transcripts');
const pendingClose = new Map<string, string>();

async function saveTranscript(channel: TextChannel): Promise<string> {
  if (!fs.existsSync(TRANSCRIPT_DIR)) fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

  const lines: string[] = [`# Transcript: ${channel.name}`, `Channel-ID: ${channel.id}`, '---', ''];
  let lastId: string | undefined;

  for (let i = 0; i < 20; i++) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;
    const sorted = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const msg of sorted) {
      lines.push(`[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '(Anhang/Embed)'}`);
    }
    lastId = sorted[0]?.id;
  }

  const filePath = path.join(TRANSCRIPT_DIR, `${channel.id}-${Date.now()}.txt`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return filePath;
}

async function finalizeClose(
  interaction: Interaction,
  channel: TextChannel,
  reason: string,
): Promise<void> {
  if (!interaction.guild) return;

  const ticket = store.getTicketByChannel(channel.id);
  if (!ticket) return;

  const filePath = await saveTranscript(channel);
  store.closeTicket(channel.id);

  await sendUnifiedLog(
    interaction.guild,
    'ticket',
    'Ticket geschlossen',
    `<@${ticket.userId}> — ${deptLabel(ticket.department)}`,
    [
      { name: 'Abteilung', value: deptLabel(ticket.department), inline: true },
      { name: 'Geschlossen von', value: `${interaction.user}`, inline: true },
      { name: 'Grund', value: reason },
      { name: 'Bewertung', value: 'Wird eingeholt…', inline: true },
    ],
  );

  const settings = store.getGuildSettings(interaction.guild.id);
  const logCh = settings.channels.modLogs ?? settings.channels.logs;
  if (logCh) {
    const logChannel = interaction.guild.channels.cache.get(logCh);
    if (logChannel?.isTextBased()) {
      const ratingRow = buildSatisfactionRow(ticket.id);
      await logChannel.send({
        embeds: [
          primaryEmbed('Ticket geschlossen — Transcript')
            .addFields(
              { name: 'Nutzer', value: `<@${ticket.userId}>`, inline: true },
              { name: 'Grund', value: reason },
            ),
        ],
        files: [new AttachmentBuilder(filePath, { name: path.basename(filePath) })],
        components: [ratingRow],
      });
    }
  }

  const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
  if (user) {
    await user
      .send({
        embeds: [
          primaryEmbed('Ticket geschlossen')
            .setDescription(`Dein Ticket wurde geschlossen.\n\n**Grund:** ${reason}`)
            .setFooter({ text: 'Wie zufrieden warst du? (optional im Server bewerten)' }),
        ],
        components: [buildSatisfactionRow(ticket.id)],
      })
      .catch(() => undefined);
  }

  setTimeout(() => channel.delete('Ticket geschlossen').catch(() => undefined), 5000);
}

async function handleTicketComponent(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild) return false;

  if (interaction.isButton() && interaction.customId.startsWith('ticket:open:')) {
    const dept = interaction.customId.split(':')[2] ?? 'support';
    await interaction.showModal(buildTicketIntakeModal(dept));
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:intake:')) {
    const dept = interaction.customId.split(':')[2] ?? 'support';
    const member = interaction.member as GuildMember;
    const subject = interaction.fields.getTextInputValue('subject');
    const description = interaction.fields.getTextInputValue('description');
    const settings = store.getGuildSettings(interaction.guild.id);

    const existing = store.getOpenTicket(interaction.guild.id, member.id);
    if (existing) {
      await interaction.reply({
        embeds: [errorEmbed(`Du hast bereits ein offenes Ticket: <#${existing.channelId}>`)],
        ephemeral: true,
      });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    const categoryId = settings.channels.ticketCategory;
    const modRoleId = settings.roles.moderator;

    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    if (modRoleId) {
      overwrites.push({
        id: modRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${dept}-${member.user.username}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: categoryId ?? undefined,
      permissionOverwrites: overwrites,
      topic: `${deptLabel(dept)} — ${subject}`,
    });

    store.createTicket({
      guildId: interaction.guild.id,
      channelId: channel.id,
      userId: member.id,
      department: dept,
      subject,
      description,
    });

    const embed = primaryEmbed(`Ticket — ${deptLabel(dept)}`)
      .addFields(
        { name: 'Betreff', value: subject },
        { name: 'Beschreibung', value: description },
        { name: 'Erstellt von', value: `${member}`, inline: true },
      );

    await channel.send({ embeds: [embed], components: [buildTicketControls()] });
    await interaction.editReply({
      embeds: [successEmbed(`Ticket erstellt: ${channel}`)],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'ticket:claim') {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) return false;

    const ticket = store.getTicketByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({ embeds: [errorEmbed('Kein Ticket-Kanal.')], ephemeral: true });
      return true;
    }
    if (ticket.claimedBy) {
      await interaction.reply({
        embeds: [errorEmbed(`Bereits übernommen von <@${ticket.claimedBy}>.`)],
        ephemeral: true,
      });
      return true;
    }

    store.updateTicket(channel.id, { claimedBy: interaction.user.id });
    await interaction.reply({
      embeds: [successEmbed(`${interaction.user} hat das Ticket übernommen.`)],
    });

    await sendUnifiedLog(
      interaction.guild,
      'ticket',
      'Ticket übernommen',
      `<@${ticket.userId}> — ${deptLabel(ticket.department)}`,
      [{ name: 'Moderator', value: `${interaction.user}`, inline: true }],
    );
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'ticket:close') {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) return false;

    const ticket = store.getTicketByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({ embeds: [errorEmbed('Kein Ticket-Kanal.')], ephemeral: true });
      return true;
    }

    pendingClose.set(interaction.user.id, channel.id);
    await interaction.showModal(buildCloseReasonModal());
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket:close:reason') {
    const channelId = pendingClose.get(interaction.user.id);
    pendingClose.delete(interaction.user.id);
    if (!channelId) {
      await interaction.reply({ embeds: [errorEmbed('Kein Ticket-Kontext.')], ephemeral: true });
      return true;
    }

    const channel = interaction.guild!.channels.cache.get(channelId);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [errorEmbed('Kanal nicht gefunden.')], ephemeral: true });
      return true;
    }

    const reason = interaction.fields.getTextInputValue('reason');
    await interaction.reply({ embeds: [successEmbed('Ticket wird geschlossen…')] });
    await finalizeClose(interaction, channel as TextChannel, reason);
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('ticket:rate:')) {
    const parts = interaction.customId.split(':');
    const ticketId = parts[2];
    const rating = parts[3];

    await interaction.reply({
      embeds: [successEmbed(`Danke für deine Bewertung: **${rating}/5** ★`)],
      ephemeral: true,
    });

    await sendUnifiedLog(
      interaction.guild!,
      'ticket',
      'Ticket-Bewertung',
      `Ticket \`${ticketId}\` — ${rating}/5 Sterne`,
      [{ name: 'Nutzer', value: `${interaction.user}`, inline: true }],
    );
    return true;
  }

  return false;
}

export const ticketsModule: BotModule = {
  id: 'tickets',
  label: 'Tickets',
  phase: 2,
  enabled: true,
  description: 'Modal-Intake, Claim, Close+Grund, Transcript, Bewertung',
  componentHandlers: [handleTicketComponent as ComponentHandler],
};
