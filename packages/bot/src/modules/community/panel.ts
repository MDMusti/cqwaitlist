import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { brandEmbed } from '../../lib/embeds';

export function buildRolesPanel() {
  const embed = brandEmbed('🎭 Community-Rollen')
    .setDescription('Wähle deine Interessen — du kannst mehrere Rollen gleichzeitig haben.');

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('community:roles')
      .setPlaceholder('Rollen auswählen…')
      .setMinValues(0)
      .setMaxValues(4)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Gamer').setValue('gamer').setEmoji('🎮'),
        new StringSelectMenuOptionBuilder().setLabel('Künstler').setValue('artist').setEmoji('🎨'),
        new StringSelectMenuOptionBuilder().setLabel('Developer').setValue('developer').setEmoji('💻'),
        new StringSelectMenuOptionBuilder().setLabel('Streamer').setValue('streamer').setEmoji('📺'),
      ),
  );

  return { embeds: [embed], components: [row] };
}

export const ROLE_KEYS = ['gamer', 'artist', 'developer', 'streamer'] as const;
