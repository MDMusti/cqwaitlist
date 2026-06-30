import {
  SlashCommandBuilder,
  type GuildMember,
  type Interaction,
  type Message,
} from 'discord.js';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import { store } from '../../db/store';
import { brandEmbed, successEmbed } from '../../lib/embeds';
import { levelFromXp, xpToNextLevel } from '../../lib/levels';
import { ROLE_KEYS } from './panel';

const XP_COOLDOWN_MS = 60_000;
const XP_PER_MESSAGE = 15;

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
          brandEmbed(`Level ${record.level}`)
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

      await interaction.reply({ embeds: [brandEmbed('🏆 Leaderboard').setDescription(lines)] });
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
              brandEmbed('💡 Neuer Vorschlag')
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
      const newXp = record.xp + bonusXp;
      const newLevel = levelFromXp(newXp);

      store.updateMember(interaction.guild.id, interaction.user.id, {
        lastDaily: now.toISOString(),
        streakDays: streak,
        xp: newXp,
        level: newLevel,
      });

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

export const communityModule: BotModule = {
  id: 'community',
  label: 'Community',
  phase: 3,
  enabled: true,
  description: 'Levels, XP, Leaderboard, Rollen, Vorschläge, Daily',
  commands: [levelsCommand(), leaderboardCommand(), suggestCommand(), dailyCommand()],
  componentHandlers: [handleRoleSelect as ComponentHandler],
  events: [
    {
      name: 'messageCreate',
      async execute(message: Message) {
        if (message.author.bot || !message.guild) return;
        const record = store.getOrCreateMember(message.guild.id, message.author.id);
        const now = Date.now();
        if (record.lastXpAt && now - new Date(record.lastXpAt).getTime() < XP_COOLDOWN_MS) return;

        const newXp = record.xp + XP_PER_MESSAGE;
        store.updateMember(message.guild.id, message.author.id, {
          xp: newXp,
          level: levelFromXp(newXp),
          lastXpAt: new Date(now).toISOString(),
        });
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
            brandEmbed('👋 Willkommen!')
              .setDescription(`Hey ${member}, schön dass du bei **CleanQueue** bist!\n\nVerifiziere dich in <#${settings.channels.verify ?? 'verify'}>.`),
          ],
        });
      },
    },
  ],
};
