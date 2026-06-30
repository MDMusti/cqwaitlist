import { SlashCommandBuilder } from 'discord.js';
import type { BotModule } from '@cleanqueue/shared';
import { brandEmbed, successEmbed } from '../../lib/embeds';
import { store } from '../../db/store';
import { levelFromXp } from '../../lib/levels';

const TRIVIA = [
  { q: 'Welche Farbe hat CleanQueue Branding? (Hex ohne #)', a: ['7c5cfc', '7C5CFC'] },
  { q: 'Wie viele Strikes bis Auto-Mute?', a: ['3', 'drei'] },
  { q: 'Discord wurde 2015 gegründet — True or False? (false)', a: ['false', 'falsch', 'nein'] },
];

function triviaCommand() {
  return {
    name: 'trivia',
    moduleId: 'games',
    data: new SlashCommandBuilder().setName('trivia').setDescription('CleanQueue Trivia — +25 XP bei richtiger Antwort'),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }
      const item = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
      await interaction.reply({
        embeds: [brandEmbed('🧠 Trivia').setDescription(`**${item.q}**\n\nAntworte mit \`/answer <text>\` innerhalb von 60 Sekunden.`)],
      });

      const filter = (m: import('discord.js').Message) =>
        m.author.id === interaction.user.id && m.channelId === interaction.channelId;
      const channel = interaction.channel;
      if (!channel?.isTextBased()) return;

      try {
        const collected = await (channel as import('discord.js').TextChannel).awaitMessages({
          filter,
          max: 1,
          time: 60_000,
          errors: ['time'],
        });
        const msg = collected.first();
        const answer = msg?.content.trim().toLowerCase() ?? '';
        const ok = item.a.some((a) => a.toLowerCase() === answer);

        if (ok && interaction.guild) {
          const record = store.getOrCreateMember(interaction.guild.id, interaction.user.id);
          const newXp = record.xp + 25;
          store.updateMember(interaction.guild.id, interaction.user.id, {
            xp: newXp,
            level: levelFromXp(newXp),
          });
          await interaction.followUp({ embeds: [successEmbed('Richtig! +25 XP')] });
        } else {
          await interaction.followUp({ content: `❌ Falsch. Richtige Antwort: **${item.a[0]}**` });
        }
      } catch {
        await interaction.followUp({ content: '⏱ Zeit abgelaufen.' });
      }
    },
  };
}

function coinflipCommand() {
  return {
    name: 'coinflip',
    moduleId: 'games',
    data: new SlashCommandBuilder().setName('coinflip').setDescription('Wirf eine Münze'),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      const result = Math.random() < 0.5 ? 'Kopf' : 'Zahl';
      await interaction.reply({ embeds: [brandEmbed('🪙 Münzwurf').setDescription(`**${result}**`)] });
    },
  };
}

export const gamesModule: BotModule = {
  id: 'games',
  label: 'Games',
  phase: 4,
  enabled: true,
  description: 'Trivia, Coinflip — erweiterbar',
  commands: [triviaCommand(), coinflipCommand()],
};
