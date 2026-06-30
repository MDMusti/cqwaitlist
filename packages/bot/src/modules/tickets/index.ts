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
import { brandEmbed, errorEmbed, successEmbed } from '../../lib/embeds';
import { buildTicketControls, deptLabel } from './panel';

const TRANSCRIPT_DIR = path.join(process.cwd(), 'data', 'transcripts');

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

async function handleTicketComponent(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild) return false;

  if (interaction.isButton() && interaction.customId.startsWith('ticket:open:')) {
    const dept = interaction.customId.split(':')[2] ?? 'support';
    const member = interaction.member as GuildMember;
    const settings = store.getGuildSettings(interaction.guild.id);

    const existing = store.getOpenTicket(interaction.guild.id, member.id);
    if (existing) {
      await interaction.reply({
        embeds: [errorEmbed(`Du hast bereits ein offenes Ticket: <#${existing.channelId}>`)],
        ephemeral: true,
      });
      return true;
    }

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
      topic: `${deptLabel(dept)} — ${member.user.tag}`,
    });

    store.createTicket({
      guildId: interaction.guild.id,
      channelId: channel.id,
      userId: member.id,
      department: dept,
    });

    const embed = brandEmbed(`Ticket — ${deptLabel(dept)}`)
      .setDescription(
        `Hallo ${member}, dein Ticket wurde erstellt.\n\nBitte beschreibe dein Anliegen. Ein Teammitglied meldet sich bald.`,
      );

    await channel.send({ embeds: [embed], components: [buildTicketControls()] });
    await interaction.reply({
      embeds: [successEmbed(`Ticket erstellt: ${channel}`)],
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isButton() && (interaction.customId === 'ticket:close' || interaction.customId === 'ticket:archive')) {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) return false;

    const ticket = store.getTicketByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({ embeds: [errorEmbed('Kein Ticket-Kanal.')], ephemeral: true });
      return true;
    }

    await interaction.deferReply();

    const filePath = await saveTranscript(channel as TextChannel);
    store.closeTicket(channel.id);

    const settings = store.getGuildSettings(interaction.guild.id);
    const logCh = settings.channels.modLogs;
    if (logCh) {
      const logChannel = interaction.guild.channels.cache.get(logCh);
      if (logChannel?.isTextBased()) {
        await logChannel.send({
          embeds: [
            brandEmbed('Ticket geschlossen')
              .addFields(
                { name: 'Abteilung', value: deptLabel(ticket.department), inline: true },
                { name: 'Nutzer', value: `<@${ticket.userId}>`, inline: true },
                { name: 'Geschlossen von', value: `${interaction.user}`, inline: true },
              ),
          ],
          files: [new AttachmentBuilder(filePath, { name: path.basename(filePath) })],
        });
      }
    }

    await interaction.editReply({ embeds: [successEmbed('Ticket wird geschlossen…')] });
    setTimeout(() => channel.delete('Ticket geschlossen').catch(() => undefined), 3000);
    return true;
  }

  return false;
}

export const ticketsModule: BotModule = {
  id: 'tickets',
  label: 'Tickets',
  phase: 2,
  enabled: true,
  description: 'Support-Panel, private Kanäle, Transkripte',
  componentHandlers: [handleTicketComponent as ComponentHandler],
};
