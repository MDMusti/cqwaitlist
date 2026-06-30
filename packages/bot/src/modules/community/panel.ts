import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { EMOJI, primaryEmbed } from '../../lib/ui';

export const ROLE_DEFINITIONS = [
  {
    key: 'gamer',
    label: 'Gamer',
    emoji: '🎮',
    description: 'Zocken, LFG, Gaming-News & Turniere',
  },
  {
    key: 'artist',
    label: 'Künstler',
    emoji: '🎨',
    description: 'Kunst, Design, Kreatives & Portfolio',
  },
  {
    key: 'developer',
    label: 'Developer',
    emoji: '💻',
    description: 'Code, Open Source, Tech-Diskussionen',
  },
  {
    key: 'streamer',
    label: 'Streamer',
    emoji: '📺',
    description: 'Streams, Clips & Content-Creator',
  },
] as const;

export function buildRolesPanel() {
  const embed = primaryEmbed(
    'Community-Rollen',
    [
      `${EMOJI.brand} **Personalisiere dein Profil** — wähle Rollen passend zu deinen Interessen.`,
      '',
      ...ROLE_DEFINITIONS.map((r) => `${r.emoji} **${r.label}** — ${r.description}`),
      '',
      '_Du kannst mehrere Rollen gleichzeitig haben. Änderungen sind jederzeit möglich._',
    ].join('\n'),
  );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('community:roles')
      .setPlaceholder('Rollen auswählen…')
      .setMinValues(0)
      .setMaxValues(ROLE_DEFINITIONS.length)
      .addOptions(
        ROLE_DEFINITIONS.map((r) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(r.label)
            .setValue(r.key)
            .setDescription(r.description.slice(0, 100))
            .setEmoji(r.emoji),
        ),
      ),
  );

  return { embeds: [embed], components: [row] };
}

export const ROLE_KEYS = ROLE_DEFINITIONS.map((r) => r.key) as readonly string[];
