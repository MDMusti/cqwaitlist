import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { BotCommand } from '@cleanqueue/shared';
import { APP_NAME, BRAND_COLOR } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { brandEmbed } from '../../lib/embeds';
import { buildVerifyPanel } from '../verification/panel';
import { buildTicketPanel } from '../tickets/panel';
import { buildRolesPanel } from '../community/panel';

export function createSetupCommand(): BotCommand {
  return {
    name: 'setup',
    moduleId: 'core',
    data: new SlashCommandBuilder()
      .setName('setup')
      .setDescription('CleanQueue Server-Struktur einrichten (Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub.setName('server').setDescription('Rollen, Kategorien, Channels und Panels anlegen'),
      ),
    async execute(interaction) {
      if (interaction.options.getSubcommand() !== 'server') return;
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern verfügbar.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const me = guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply('Ich benötige Administrator-Rechte für /setup.');
        return;
      }

      const roles = {
        verified18: await guild.roles.create({
          name: 'Verified 18+',
          color: 0x7c5cfc,
          reason: 'CleanQueue Setup',
        }),
        member: await guild.roles.create({
          name: 'Member',
          color: 0x5865f2,
          reason: 'CleanQueue Setup',
        }),
        moderator: await guild.roles.create({
          name: 'Moderator',
          color: 0xed4245,
          permissions: [
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageMessages,
          ],
          reason: 'CleanQueue Setup',
        }),
        muted: await guild.roles.create({
          name: 'Muted',
          color: 0x747f8d,
          permissions: [],
          reason: 'CleanQueue Setup',
        }),
        gamer: await guild.roles.create({ name: 'Gamer', color: 0x57f287, reason: 'CleanQueue Setup' }),
        artist: await guild.roles.create({ name: 'Künstler', color: 0xfee75c, reason: 'CleanQueue Setup' }),
        developer: await guild.roles.create({ name: 'Developer', color: 0xeb459e, reason: 'CleanQueue Setup' }),
        streamer: await guild.roles.create({ name: 'Streamer', color: 0x9b59b6, reason: 'CleanQueue Setup' }),
      };

      const infoCat = await guild.channels.create({
        name: 'INFO',
        type: ChannelType.GuildCategory,
      });
      const communityCat = await guild.channels.create({
        name: 'COMMUNITY',
        type: ChannelType.GuildCategory,
      });
      const supportCat = await guild.channels.create({
        name: 'SUPPORT',
        type: ChannelType.GuildCategory,
      });
      const voiceCat = await guild.channels.create({
        name: 'VOICE',
        type: ChannelType.GuildCategory,
      });
      const logsCat = await guild.channels.create({
        name: 'LOGS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: roles.moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
      });

      const rules = await guild.channels.create({
        name: 'regeln',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: 'Server-Regeln',
      });
      const verify = await guild.channels.create({
        name: 'verify',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: '18+ Verifizierung',
      });
      const welcome = await guild.channels.create({
        name: 'willkommen',
        type: ChannelType.GuildText,
        parent: communityCat.id,
      });
      const general = await guild.channels.create({
        name: 'allgemein',
        type: ChannelType.GuildText,
        parent: communityCat.id,
      });
      const suggestions = await guild.channels.create({
        name: 'vorschläge',
        type: ChannelType.GuildText,
        parent: communityCat.id,
        topic: 'Vorschläge mit /suggest',
      });
      const rolesCh = await guild.channels.create({
        name: 'rollen',
        type: ChannelType.GuildText,
        parent: communityCat.id,
        topic: 'Rollen auswählen',
      });
      const tickets = await guild.channels.create({
        name: 'tickets',
        type: ChannelType.GuildText,
        parent: supportCat.id,
        topic: 'Support-Tickets',
      });
      const ticketCategory = await guild.channels.create({
        name: 'TICKETS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: roles.moderator.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
      });
      const logs = await guild.channels.create({
        name: 'audit-log',
        type: ChannelType.GuildText,
        parent: logsCat.id,
      });
      const modLogs = await guild.channels.create({
        name: 'mod-log',
        type: ChannelType.GuildText,
        parent: logsCat.id,
      });
      const createVoice = await guild.channels.create({
        name: '➕ Create Voice',
        type: ChannelType.GuildVoice,
        parent: voiceCat.id,
      });

      // Muted role: no send in text channels
      for (const ch of guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).values()) {
        if (ch.id === logsCat.id) continue;
        if ('permissionOverwrites' in ch) {
          await ch.permissionOverwrites
            .edit(roles.muted, { SendMessages: false, AddReactions: false, Speak: false })
            .catch(() => undefined);
        }
      }

      store.upsertGuildConfig(guild.id, {
        name: guild.name,
        config: {
          channels: {
            verify: verify.id,
            rules: rules.id,
            welcome: welcome.id,
            general: general.id,
            tickets: tickets.id,
            ticketCategory: ticketCategory.id,
            suggestions: suggestions.id,
            roles: rolesCh.id,
            logs: logs.id,
            modLogs: modLogs.id,
            createVoice: createVoice.id,
            voiceCategory: voiceCat.id,
          },
          roles: {
            verified18: roles.verified18.id,
            member: roles.member.id,
            moderator: roles.moderator.id,
            muted: roles.muted.id,
            gamer: roles.gamer.id,
            artist: roles.artist.id,
            developer: roles.developer.id,
            streamer: roles.streamer.id,
          },
          verification: { minAccountAgeDays: 7 },
        },
      });

      // Post panels
      if (verify.isTextBased()) {
        await verify.send(buildVerifyPanel());
      }
      if (tickets.isTextBased()) {
        await tickets.send(buildTicketPanel());
      }
      if (rolesCh.isTextBased()) {
        await rolesCh.send(buildRolesPanel());
      }

      const embed = brandEmbed(`${APP_NAME} Setup abgeschlossen`)
        .setDescription(
          'Server-Struktur wurde angelegt. Panels in `#verify`, `#tickets` und `#rollen` gepostet.\n\n' +
            '**Hinweis:** Alte Setup-Ressourcen vom vorherigen Bot manuell aufräumen.',
        )
        .addFields(
          { name: 'Rollen', value: Object.values(roles).map((r) => r.toString()).join(' '), inline: false },
        );

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
