import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand } from '@cleanqueue/shared';
import { APP_NAME } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { helpEmbed, infoEmbed, primaryEmbed, rulesEmbed, successEmbed } from '../../lib/ui';
import { buildVerifyPanel } from '../verification/panel';
import { buildTicketPanel } from '../tickets/panel';
import { buildRolesPanel } from '../community/panel';

export function createSetupCommand(): BotCommand {
  return {
    name: 'setup',
    moduleId: 'core',
    deferReply: { ephemeral: true },
    data: new SlashCommandBuilder()
      .setName('setup')
      .setDescription('CleanQueue Server-Struktur einrichten (Admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub.setName('server').setDescription('Rollen, Kategorien, Channels und Panels anlegen'),
      ),
    async execute(interaction) {
      if (interaction.options.getSubcommand() !== 'server') {
        await interaction.editReply({ content: 'Unbekannter Subcommand.' });
        return;
      }
      if (!interaction.guild) {
        await interaction.editReply({ content: 'Nur auf Servern verfügbar.' });
        return;
      }

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
        quarantine: await guild.roles.create({
          name: 'Quarantine',
          color: 0x992d22,
          permissions: [],
          reason: 'CleanQueue Setup',
        }),
        level5: await guild.roles.create({ name: 'Level 5', color: 0x3498db, reason: 'CleanQueue Setup' }),
        level10: await guild.roles.create({ name: 'Level 10', color: 0x9b59b6, reason: 'CleanQueue Setup' }),
        level25: await guild.roles.create({ name: 'Level 25', color: 0xf1c40f, reason: 'CleanQueue Setup' }),
        gamer: await guild.roles.create({ name: 'Gamer', color: 0x57f287, reason: 'CleanQueue Setup' }),
        artist: await guild.roles.create({ name: 'Künstler', color: 0xfee75c, reason: 'CleanQueue Setup' }),
        developer: await guild.roles.create({ name: 'Developer', color: 0xeb459e, reason: 'CleanQueue Setup' }),
        streamer: await guild.roles.create({ name: 'Streamer', color: 0x9b59b6, reason: 'CleanQueue Setup' }),
      };

      const infoCat = await guild.channels.create({ name: 'INFO', type: ChannelType.GuildCategory });
      const communityCat = await guild.channels.create({ name: 'COMMUNITY', type: ChannelType.GuildCategory });
      const supportCat = await guild.channels.create({ name: 'SUPPORT', type: ChannelType.GuildCategory });
      const voiceCat = await guild.channels.create({ name: 'VOICE', type: ChannelType.GuildCategory });
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
        topic: 'Server-Regeln — Kurzfassung',
      });
      const rulesDetailed = await guild.channels.create({
        name: 'regeln-ausführlich',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: 'Ausführliche Regeln & Richtlinien',
      });
      const verify = await guild.channels.create({
        name: 'verify',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: '18+ Verifizierung — Multi-Step Flow',
      });
      const botCommands = await guild.channels.create({
        name: 'bot-befehle',
        type: ChannelType.GuildText,
        parent: infoCat.id,
        topic: 'CleanQueue Befehle & Hilfe',
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
      const events = await guild.channels.create({
        name: 'events',
        type: ChannelType.GuildText,
        parent: communityCat.id,
        topic: 'Community-Events & Ankündigungen',
      });
      const levelUp = await guild.channels.create({
        name: 'level-up',
        type: ChannelType.GuildText,
        parent: communityCat.id,
        topic: 'Level-Up Feiern',
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
        topic: 'Community-Rollen auswählen',
      });
      const partner = await guild.channels.create({
        name: 'partner',
        type: ChannelType.GuildText,
        parent: communityCat.id,
        topic: 'Partner & Kooperationen',
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
      const modOnly = await guild.channels.create({
        name: 'mod-only',
        type: ChannelType.GuildText,
        parent: supportCat.id,
        topic: 'Interner Moderator-Channel',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: roles.moderator.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });
      const automodNotice = await guild.channels.create({
        name: 'automod-log',
        type: ChannelType.GuildText,
        parent: logsCat.id,
        topic: 'AutoMod Eingriffe',
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
      const voiceControl = await guild.channels.create({
        name: 'voice-control',
        type: ChannelType.GuildText,
        parent: voiceCat.id,
        topic: 'Temp-Voice Steuerungspanels',
      });
      const createVoice = await guild.channels.create({
        name: '➕ Create Voice',
        type: ChannelType.GuildVoice,
        parent: voiceCat.id,
      });

      for (const restrictedRole of [roles.muted, roles.quarantine]) {
        for (const ch of guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).values()) {
          if (ch.parentId === logsCat.id) continue;
          if ('permissionOverwrites' in ch) {
            await ch.permissionOverwrites
              .edit(restrictedRole, { SendMessages: false, AddReactions: false, Speak: false })
              .catch(() => undefined);
          }
        }
      }

      store.upsertGuildConfig(guild.id, {
        name: guild.name,
        config: {
          channels: {
            verify: verify.id,
            rules: rules.id,
            rulesDetailed: rulesDetailed.id,
            welcome: welcome.id,
            general: general.id,
            events: events.id,
            botCommands: botCommands.id,
            levelUp: levelUp.id,
            tickets: tickets.id,
            ticketCategory: ticketCategory.id,
            suggestions: suggestions.id,
            roles: rolesCh.id,
            partner: partner.id,
            modOnly: modOnly.id,
            automodNotice: automodNotice.id,
            logs: logs.id,
            modLogs: modLogs.id,
            createVoice: createVoice.id,
            voiceCategory: voiceCat.id,
            voiceControl: voiceControl.id,
          },
          roles: {
            verified18: roles.verified18.id,
            member: roles.member.id,
            moderator: roles.moderator.id,
            muted: roles.muted.id,
            quarantine: roles.quarantine.id,
            level5: roles.level5.id,
            level10: roles.level10.id,
            level25: roles.level25.id,
            gamer: roles.gamer.id,
            artist: roles.artist.id,
            developer: roles.developer.id,
            streamer: roles.streamer.id,
          },
          verification: { minAccountAgeDays: 7 },
          automod: {
            blockInvites: true,
            maxMentions: 5,
            spamThreshold: 5,
            spamWindowMs: 5000,
            capsThreshold: 70,
            capsMinLength: 12,
            repeatedTextCount: 3,
            repeatedTextWindowMs: 60_000,
            quarantineOnViolation: false,
          },
          welcome: { leaveMessageEnabled: true },
          antiRaid: { joinThreshold: 5, windowMs: 10_000 },
        },
      });

      if (rules.isTextBased()) {
        await rules.send({ embeds: [rulesEmbed()] });
      }
      if (rulesDetailed.isTextBased()) {
        await rulesDetailed.send({
          embeds: [
            rulesEmbed()
              .setTitle('📜 Ausführliche Regeln')
              .addFields({
                name: 'Appeals & Tickets',
                value:
                  'Bei Moderationsentscheidungen kannst du jederzeit ein Ticket unter **Appeal** eröffnen. ' +
                  'Wir prüfen jeden Fall fair und zeitnah.',
              }),
          ],
        });
      }
      if (botCommands.isTextBased()) {
        await botCommands.send({
          embeds: [
            helpEmbed([
              { name: 'cleanqueue', description: 'Command Hub — help, modules, profile, status', module: 'core' },
              { name: 'mod', description: 'Moderation — warn, mute, kick, ban, timeout, history', module: 'moderation' },
              { name: 'rank', description: 'Profil, XP & Fortschritt', module: 'community' },
              { name: 'daily', description: 'Tägliche XP-Belohnung', module: 'community' },
              { name: 'blackjack', description: 'Blackjack spielen', module: 'games' },
              { name: 'setup', description: 'Server-Struktur (Admin)', module: 'core' },
            ]),
          ],
        });
      }
      if (automodNotice.isTextBased()) {
        await automodNotice.send({
          embeds: [
            infoEmbed(
              'Dieser Channel protokolliert **AutoMod-Eingriffe**:\n\n' +
                '• Discord-Invites (discord.gg)\n' +
                '• Massen-Mentions (>5)\n' +
                '• Spam (5 Nachrichten in 5 Sekunden)\n' +
                '• CAPS-Lock (>70% Großbuchstaben)\n' +
                '• Wiederholter Text (3× identisch)',
              'AutoMod aktiv',
            ),
          ],
        });
      }
      if (verify.isTextBased()) await verify.send(buildVerifyPanel());
      if (tickets.isTextBased()) await tickets.send(buildTicketPanel());
      if (rolesCh.isTextBased()) await rolesCh.send(buildRolesPanel());

      const embed = successEmbed(
        [
          '**Server-Struktur wurde angelegt.**',
          '',
          'Panels in `#verify`, `#tickets`, `#rollen`. Regeln in `#regeln`, Hilfe in `#bot-befehle`.',
          '',
          '**Neu:** Quarantine, Level-Rollen (5/10/25), Anti-Raid, erweitertes AutoMod, Voice-Control.',
        ].join('\n'),
        `${APP_NAME} Setup abgeschlossen`,
      ).addFields({
        name: 'Rollen',
        value: `${roles.quarantine} ${roles.level5} ${roles.level10} ${roles.level25}`,
      });

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
