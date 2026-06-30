import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotModule, ComponentHandler } from '@cleanqueue/shared';
import type { Interaction } from 'discord.js';
import { store } from '../../db/store';
import { errorEmbed, infoEmbed, primaryEmbed, successEmbed } from '../../lib/ui';

type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { suit: Suit; value: number; label: string };

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const VALUES = [
  { v: 2, l: '2' },
  { v: 3, l: '3' },
  { v: 4, l: '4' },
  { v: 5, l: '5' },
  { v: 6, l: '6' },
  { v: 7, l: '7' },
  { v: 8, l: '8' },
  { v: 9, l: '9' },
  { v: 10, l: '10' },
  { v: 10, l: 'J' },
  { v: 10, l: 'Q' },
  { v: 10, l: 'K' },
  { v: 11, l: 'A' },
];

interface BlackjackGame {
  deck: Card[];
  player: Card[];
  dealer: Card[];
  userId: string;
  guildId: string;
}

const activeGames = new Map<string, BlackjackGame>();

function gameKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const { v, l } of VALUES) {
      deck.push({ suit, value: v, label: `${l}${suit}` });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter((c) => c.label.startsWith('A')).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function formatHand(cards: Card[], hideFirst = false): string {
  if (hideFirst && cards.length > 0) {
    return `🂠 · ${cards.slice(1).map((c) => c.label).join(' · ')}`;
  }
  return cards.map((c) => c.label).join(' · ');
}

function buildBlackjackEmbed(game: BlackjackGame, reveal = false): ReturnType<typeof primaryEmbed> {
  const playerVal = handValue(game.player);
  const dealerVal = reveal ? handValue(game.dealer) : '?';

  return primaryEmbed('🃏 Blackjack', undefined)
    .addFields(
      { name: 'Deine Hand', value: `${formatHand(game.player)}\n**${playerVal}**`, inline: true },
      {
        name: 'Dealer',
        value: `${formatHand(game.dealer, !reveal)}\n**${dealerVal}**`,
        inline: true,
      },
    );
}

function endGame(key: string): void {
  activeGames.delete(key);
}

async function handleBlackjackComponent(interaction: Interaction): Promise<boolean> {
  if (!interaction.guild || !interaction.isButton()) return false;
  if (!interaction.customId.startsWith('bj:')) return false;

  const key = gameKey(interaction.guild.id, interaction.user.id);
  const game = activeGames.get(key);
  if (!game) {
    await interaction.reply({ embeds: [errorEmbed('Kein aktives Blackjack-Spiel.')], ephemeral: true });
    return true;
  }

  if (interaction.customId === 'bj:hit') {
    game.player.push(game.deck.pop()!);
    const val = handValue(game.player);

    if (val > 21) {
      endGame(key);
      await interaction.update({
        embeds: [buildBlackjackEmbed(game, true).setDescription('**Bust!** Du hast verloren.')],
        components: [],
      });
      return true;
    }

    if (val === 21) {
      endGame(key);
      await interaction.update({
        embeds: [buildBlackjackEmbed(game, true).setDescription('**21!** Stark — du gewinnst!')],
        components: [],
      });
      return true;
    }

    await interaction.update({
      embeds: [buildBlackjackEmbed(game)],
      components: interaction.message.components,
    });
    return true;
  }

  if (interaction.customId === 'bj:stand') {
    while (handValue(game.dealer) < 17) {
      game.dealer.push(game.deck.pop()!);
    }

    const pVal = handValue(game.player);
    const dVal = handValue(game.dealer);
    let result: string;

    if (dVal > 21 || pVal > dVal) result = '**Du gewinnst!**';
    else if (pVal === dVal) result = '**Unentschieden.**';
    else result = '**Dealer gewinnt.**';

    endGame(key);
    await interaction.update({
      embeds: [buildBlackjackEmbed(game, true).setDescription(result)],
      components: [],
    });
    return true;
  }

  return false;
}

function blackjackCommand() {
  return {
    name: 'blackjack',
    moduleId: 'games',
    data: new SlashCommandBuilder().setName('blackjack').setDescription('Blackjack — Hit or Stand'),
    async execute(interaction: import('discord.js').ChatInputCommandInteraction) {
      if (!interaction.guild) {
        await interaction.reply({ content: 'Nur auf Servern.', ephemeral: true });
        return;
      }

      const key = gameKey(interaction.guild.id, interaction.user.id);
      if (activeGames.has(key)) {
        await interaction.reply({
          embeds: [errorEmbed('Du hast bereits ein laufendes Spiel. Beende es zuerst.')],
          ephemeral: true,
        });
        return;
      }

      const deck = freshDeck();
      const game: BlackjackGame = {
        deck,
        player: [deck.pop()!, deck.pop()!],
        dealer: [deck.pop()!, deck.pop()!],
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      };
      activeGames.set(key, game);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bj:hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
        new ButtonBuilder().setCustomId('bj:stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setEmoji('✋'),
      );

      await interaction.reply({
        embeds: [buildBlackjackEmbed(game)],
        components: [row],
      });
    },
  };
}

function triviaCommand() {
  const TRIVIA = [
    { q: 'Welche Farbe hat CleanQueue Branding? (Hex ohne #)', a: ['7c5cfc', '7C5CFC'] },
    { q: 'Wie viele Strikes bis Auto-Mute?', a: ['3', 'drei'] },
    { q: 'Discord wurde 2015 gegründet — True or False? (false)', a: ['false', 'falsch', 'nein'] },
  ];

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
        embeds: [
          primaryEmbed('🧠 Trivia').setDescription(
            `**${item.q}**\n\nAntworte im Chat innerhalb von 60 Sekunden.`,
          ),
        ],
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
            level: (await import('../../lib/levels')).levelFromXp(newXp),
          });
          await interaction.followUp({ embeds: [successEmbed('Richtig! +25 XP')] });
        } else {
          await interaction.followUp({
            embeds: [infoEmbed(`Falsch. Richtige Antwort: **${item.a[0]}**`, 'Trivia')],
          });
        }
      } catch {
        await interaction.followUp({ embeds: [infoEmbed('Zeit abgelaufen.', 'Trivia')] });
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
      await interaction.reply({ embeds: [primaryEmbed('🪙 Münzwurf').setDescription(`**${result}**`)] });
    },
  };
}

export const gamesModule: BotModule = {
  id: 'games',
  label: 'Games',
  phase: 4,
  enabled: true,
  description: 'Blackjack, Trivia, Coinflip',
  commands: [blackjackCommand(), triviaCommand(), coinflipCommand()],
  componentHandlers: [handleBlackjackComponent as ComponentHandler],
};
