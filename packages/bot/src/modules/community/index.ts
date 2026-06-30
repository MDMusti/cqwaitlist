import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
  type Interaction,
  type Message,
} from 'discord.js';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import { store } from '../../db/store';
import {
  levelUpEmbed,
  profileEmbed,
  welcomeEmbed,
  primaryEmbed,
  successEmbed,
  progressBar,
} from '../../lib/ui';
import { levelFromXp, xpToNextLevel, xpForLevel } from '../../lib/levels';
import { applyLevelRoleRewards } from '../../lib/level-rewards';
import { sendUnifiedLog } from '../../lib/logging';
import { ROLE_KEYS } from './panel';

const XP_COOLDOWN_MS = 60_000;
const XP_PER_MESSAGE = 15;

async function handleLevelUp(
  message: Message,
  oldLevel: number,
  newLevel: number,
  newXp: number,
): Promise<void> {
  if (newLevel <= oldLevel || !message.guild) return;

  const settings = store.getGuildSettings(message.guild.id);
  const member = message.member;
  if (member) {
    const granted = await applyLevelRoleRewards(member, settings, oldLevel, newLevel);
    const roleText = granted.length ? `\n\n🎁 Rollen: **${granted.join(', ')}**` : '';

    const levelChId = settings.channels.levelUp ?? settings.channels.general;
    if (levelChId) {
      const ch = message.guild.channels.cache.get(levelChId);
      if (ch?.isTextBased()) {
        const prevXp = xpForLevel(newLevel);
        const nextXp = xpForLevel(newLevel + 1);
        const bar = progressBar(newXp - prevXp, nextXp - prevXp);
        await ch.send({
          embeds: [
            levelUpEmbed({ username: message.author.username, level: newLevel, xp: newXp }).setDescription(
              `**${message.author.username}** ist jetzt **Level ${newLevel}**!\n\n` +
                `Rang-Fortschritt:\n${bar}\n` +
                `Gesamt-XP: **${newXp.toLocaleString('de-DE')}**${roleText}`,
            ),
          ],
        });
      }
    }
  }
}

async function handleRoleSelect(interaction: Interaction): Promise<boolean> {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'community:roles') return false;
  if (!interaction.guild || !interaction.member) return false;

  const member = interaction.member as GuildMember;
  const settings = store.getGuildSettings(interaction.guild.id);
  const roleMap: Record<string, string | undefined> = {
    gamer: settings.roles.gamer,
    artist: settings.roles.artist,
    developer: settings.roles.developer,
    streamer: settings.roles.streamer,
  };

  const selected = new Set(interaction.values);

  for (const key of ROLE_KEYS) {
    const roleId = roleMap[key];
    if (!roleId) continue;
    const has = member.roles.cache.has(roleId);
    const want = selected.has(key);
    if (want && !has) await member.roles.add(roleId).catch(() => undefined);
    if (!want && has) await member.roles.remove(roleId).catch(() => undefined);
  }

  await interaction.reply({
    embeds: [successEmbed('Community-Rollen wurden aktualisiert.')],
    ephemeral: true,
  });
  return true;
}

function rankCommand() {
  return {
    name: 'rank',
    moduleId: 'community',
    data: new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Dein Rang mit Level-Karte (Unicode-Balken)')
      .addUserOption((o) => o.setName('user').setDescription('Anderer Nutzer').setRequired(false)),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user') ?? interaction.user;
      const record = store.getOrCreateMember(interaction.guild.id, target.id);
      const toNext = xpToNextLevel(record.xp, record.level);
      const targetTotal = record.xp + toNext;
      const top = store.getTopMembers(interaction.guild.id, 100);
      const rank = top.findIndex((m) => m.userId === target.id) + 1;

      const prevXp = xpForLevel(record.level);
      const nextXp = xpForLevel(record.level + 1);
      const bar = progressBar(record.xp - prevXp, nextXp - prevXp);

      await interaction.reply({
        embeds: [
          profileEmbed({
            username: target.username,
            avatarUrl: target.displayAvatarURL({ size: 128 }),
            level: record.level,
            xp: record.xp,
            xpToNext: toNext,
            streak: record.streakDays,
            strikes: record.strikes,
            verified: record.verified,
            progressPct: targetTotal > 0 ? (record.xp / targetTotal) * 100 : 100,
          })
            .setTitle(`⭐ Rang #${rank || '?'} — ${target.username}`)
            .setDescription(`Level **${record.level}** · Fortschritt:\n${bar}`),
        ],
      });
    },
  };
}

function levelsCommand() {
  return {
    name: 'levels',
    moduleId: 'community',
    data: new SlashCommandBuilder()
      .setName('levels')
      .setDescription('Zeigt dein Level und XP')
      .addUserOption((o) => o.setName('user').setDescription('Anderer Nutzer').setRequired(false)),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }
      const target = interaction.options.getUser('user') ?? interaction.user;
      const record = store.getOrCreateMember(interaction.guild.id, target.id);
      const next = xpToNextLevel(record.xp, record.level);

      await interaction.reply({
        embeds: [
          primaryEmbed(`Level ${record.level}`)
            .setDescription(`**${target.username}**`)
            .addFields(
              { name: 'XP', value: `${record.xp}`, inline: true },
              { name: 'Bis Level-Up', value: `${next} XP`, inline: true },
              { name: 'Streak', value: `${record.streakDays} Tage`, inline: true },
            ),
        ],
      });
    },
  };
}

function leaderboardCommand() {
  return {
    name: 'leaderboard',
    moduleId: 'community',
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 nach XP'),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }
      const top = store.getTopMembers(interaction.guild.id, 10);
      const lines =
        top.length === 0
          ? 'Noch keine XP-Daten.'
          : top
              .map((m, i) => `${i + 1}. <@${m.userId}> — Level **${m.level}** (${m.xp} XP)`)
              .join('\n');

      await interaction.reply({ embeds: [primaryEmbed('🏆 Leaderboard').setDescription(lines)] });
    },
  };
}

function suggestCommand() {
  return {
    name: 'suggest',
    moduleId: 'community',
    deferReply: { ephemeral: true },
    data: new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Sende einen Vorschlag an das Team')
      .addStringOption((o) =>
        o.setName('text').setDescription('Dein Vorschlag').setRequired(true).setMaxLength(1000),
      ),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.editReply({ content: 'Nur auf Servern.' });
        return;
      }
      const text = interaction.options.getString('text', true);
      const settings = store.getGuildSettings(interaction.guild.id);
      const chId = settings.channels.suggestions;

      if (chId) {
        const ch = interaction.guild.channels.cache.get(chId);
        if (ch?.isTextBased()) {
          await ch.send({
            embeds: [
              primaryEmbed('💡 Neuer Vorschlag')
                .setDescription(text)
                .setFooter({ text: `Von ${interaction.user.tag}` })
                .setTimestamp(),
            ],
          });
        }
      }

      await interaction.editReply({
        embeds: [successEmbed('Vorschlag wurde eingereicht. Danke!')],
      });
    },
  };
}

function dailyCommand() {
  return {
    name: 'daily',
    moduleId: 'community',
    data: new SlashCommandBuilder().setName('daily').setDescription('Tägliche Belohnung (XP + Streak)'),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }
      const record = store.getOrCreateMember(interaction.guild.id, interaction.user.id);
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      if (record.lastDaily?.slice(0, 10) === today) {
        await interaction.reply({
          content: 'Du hast deine Daily-Belohnung heute schon abgeholt.',
          ephemeral: true,
        });
        return;
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterday = record.lastDaily?.slice(0, 10) === yesterday.toISOString().slice(0, 10);
      const streak = wasYesterday ? record.streakDays + 1 : 1;
      const bonusXp = 50 + streak * 10;
      const oldLevel = record.level;
      const newXp = record.xp + bonusXp;
      const newLevel = levelFromXp(newXp);

      store.updateMember(interaction.guild.id, interaction.user.id, {
        lastDaily: now.toISOString(),
        streakDays: streak,
        xp: newXp,
        level: newLevel,
      });

      const member = interaction.member as GuildMember;
      const settings = store.getGuildSettings(interaction.guild.id);
      await applyLevelRoleRewards(member, settings, oldLevel, newLevel);

      await interaction.reply({
        embeds: [
          successEmbed(
            `+**${bonusXp} XP** — Streak: **${streak}** Tag(e) — Level **${newLevel}**`,
            'Daily Belohnung',
          ),
        ],
      });
    },
  };
}

function pollCommand() {
  return {
    name: 'poll',
    moduleId: 'community',
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Erstellt eine Umfrage mit Reaktionen')
      .addStringOption((o) => o.setName('frage').setDescription('Die Frage').setRequired(true))
      .addStringOption((o) => o.setName('optionen').setDescription('Optionen mit | trennen (max 5)').setRequired(true)),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      const question = interaction.options.getString('frage', true);
      const optionsRaw = interaction.options.getString('optionen', true);
      const options = optionsRaw.split('|').map((o) => o.trim()).filter(Boolean).slice(0, 5);

      if (options.length < 2) {
        await interaction.reply({ content: 'Mindestens 2 Optionen (mit | trennen).', ephemeral: true });
        return;
      }

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
      const lines = options.map((o, i) => `${emojis[i]} ${o}`).join('\n');

      const msg = await interaction.reply({
        embeds: [primaryEmbed(`📊 ${question}`).setDescription(lines)],
        fetchReply: true,
      });

      for (let i = 0; i < options.length; i++) {
        await msg.react(emojis[i]).catch(() => undefined);
      }
    },
  };
}

function giveawayCommand() {
  return {
    name: 'giveaway',
    moduleId: 'community',
    deferReply: true,
    data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Giveaway-Verwaltung')
      .addSubcommand((sub) =>
        sub
          .setName('start')
          .setDescription('Startet ein Giveaway')
          .addStringOption((o) => o.setName('preis').setDescription('Preis').setRequired(true))
          .addIntegerOption((o) =>
            o.setName('dauer').setDescription('Dauer in Minuten').setRequired(true).setMinValue(1).setMaxValue(10080),
          )
          .addIntegerOption((o) =>
            o.setName('gewinner').setDescription('Anzahl Gewinner').setRequired(false).setMinValue(1).setMaxValue(10),
          ),
      ),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (interaction.options.getSubcommand() !== 'start') {
        await interaction.editReply({ content: 'Unbekannter Subcommand.' });
        return;
      }
      if (!interaction.guild) {
        await interaction.editReply({ content: 'Nur auf Servern.' });
        return;
      }

      const prize = interaction.options.getString('preis', true);
      const durationMin = interaction.options.getInteger('dauer', true);
      const winnerCount = interaction.options.getInteger('gewinner') ?? 1;
      const endsAt = Date.now() + durationMin * 60_000;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway:enter:pending')
          .setLabel('Teilnehmen 🎉')
          .setStyle(ButtonStyle.Success),
      );

      const channel = interaction.channel;
      if (!channel?.isTextBased() || channel.isDMBased()) {
        await interaction.editReply({ content: 'Giveaway nur in Text-Channels möglich.' });
        return;
      }

      const msg = await channel.send({
        embeds: [
          primaryEmbed('🎁 Giveaway')
            .setDescription(`**Preis:** ${prize}\n**Gewinner:** ${winnerCount}\n**Endet:** <t:${Math.floor(endsAt / 1000)}:R>`)
            .setFooter({ text: `Gestartet von ${interaction.user.tag}` }),
        ],
        components: [row],
      });

      const gw = store.createGiveaway({
        guildId: interaction.guild.id,
        channelId: msg.channel.id,
        messageId: msg.id,
        prize,
        hostId: interaction.user.id,
        winnerCount,
        endsAt,
      });

      await msg.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`giveaway:enter:${gw.id}`)
              .setLabel('Teilnehmen 🎉')
              .setStyle(ButtonStyle.Success),
          ),
        ],
      });

      await interaction.editReply({ embeds: [successEmbed(`Giveaway gestartet: ${msg.url}`)] });

      setTimeout(async () => {
        const current = store.getGiveaway(gw.id);
        if (!current) return;
        const entrants = current.entrants;
        const winners: string[] = [];
        const pool = [...entrants];
        for (let i = 0; i < winnerCount && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(idx, 1)[0]);
        }

        const winnerText =
          winners.length > 0 ? winners.map((id) => `<@${id}>`).join(', ') : 'Keine Teilnehmer';

        await msg
          .edit({
            embeds: [
              primaryEmbed('🎁 Giveaway beendet')
                .setDescription(`**Preis:** ${prize}\n**Gewinner:** ${winnerText}\n**Teilnehmer:** ${entrants.length}`),
            ],
            components: [],
          })
          .catch(() => undefined);

        store.removeGiveaway(gw.id);
      }, durationMin * 60_000);
    },
  };
}

async function handleGiveawayButton(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton() || !interaction.customId.startsWith('giveaway:enter:')) return false;
  const gwId = interaction.customId.split(':')[2];
  if (!gwId || gwId === 'pending') return false;

  const gw = store.getGiveaway(gwId);
  if (!gw) {
    await interaction.reply({ embeds: [successEmbed('Dieses Giveaway ist beendet.')], ephemeral: true });
    return true;
  }

  const added = store.addGiveawayEntrant(gwId, interaction.user.id);
  await interaction.reply({
    embeds: [
      successEmbed(added ? 'Du nimmst am Giveaway teil! 🎉' : 'Du nimmst bereits teil.'),
    ],
    ephemeral: true,
  });
  return true;
}

export const communityModule: BotModule = {
  id: 'community',
  label: 'Community',
  phase: 3,
  enabled: true,
  description: 'Levels, Rank, Rollen-Belohnungen, Welcome/Leave, Poll, Giveaway',
  commands: [
    rankCommand(),
    levelsCommand(),
    leaderboardCommand(),
    suggestCommand(),
    dailyCommand(),
    pollCommand(),
    giveawayCommand(),
  ],
  componentHandlers: [handleRoleSelect as ComponentHandler, handleGiveawayButton as ComponentHandler],
  events: [
    {
      name: 'messageCreate',
      async execute(message: Message) {
        if (message.author.bot || !message.guild) return;
        const record = store.getOrCreateMember(message.guild.id, message.author.id);
        const now = Date.now();
        if (record.lastXpAt && now - new Date(record.lastXpAt).getTime() < XP_COOLDOWN_MS) return;

        const oldLevel = record.level;
        const newXp = record.xp + XP_PER_MESSAGE;
        const newLevel = levelFromXp(newXp);
        store.updateMember(message.guild.id, message.author.id, {
          xp: newXp,
          level: newLevel,
          lastXpAt: new Date(now).toISOString(),
        });

        await handleLevelUp(message, oldLevel, newLevel, newXp);
      },
    },
    {
      name: 'guildMemberAdd',
      async execute(member: GuildMember) {
        const settings = store.getGuildSettings(member.guild.id);
        const welcomeId = settings.channels.welcome;
        if (!welcomeId) return;
        const ch = member.guild.channels.cache.get(welcomeId);
        if (!ch?.isTextBased()) return;

        await ch.send({
          embeds: [
            welcomeEmbed({
              memberMention: `${member}`,
              verifyChannelId: settings.channels.verify,
            }),
          ],
        });
      },
    },
    {
      name: 'guildMemberRemove',
      async execute(member: GuildMember) {
        const settings = store.getGuildSettings(member.guild.id);
        if (!settings.welcome?.leaveMessageEnabled) return;

        const welcomeId = settings.channels.welcome;
        if (!welcomeId) return;
        const ch = member.guild.channels.cache.get(welcomeId);
        if (!ch?.isTextBased()) return;

        const text =
          settings.welcome.leaveMessage ??
          `${member.user.username} hat uns verlassen. Auf Wiedersehen! 👋`;

        await ch.send({
          embeds: [primaryEmbed('👋 Abschied').setDescription(text.replace('{user}', member.user.username))],
        });

        await sendUnifiedLog(
          member.guild,
          'member',
          'Mitglied verlassen',
          `${member.user.tag} hat den Server verlassen.`,
          [{ name: 'Nutzer', value: member.user.tag, inline: true }],
        );
      },
    },
  ],
};
